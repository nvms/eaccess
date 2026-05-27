import express from "express";
import session from "express-session";
import cookieParser from "cookie-parser";
import { Pool } from "pg";
import { createAuthMiddleware, createAuthTables, dropAuthTables, AuthRole, type AuthConfig, type AuthAccount } from "../index.js";

type ImpersonationPolicy = (actor: AuthAccount, target: AuthAccount) => boolean | Promise<boolean>;

export interface ImpersonationTestOverrides {
  enabled?: boolean;
  defaultTtl?: string | null;
  maxTtl?: string;
  canImpersonate?: ImpersonationPolicy;
}

export async function createImpersonationTestApp(overrides: ImpersonationTestOverrides = {}) {
  const pool = new Pool({
    host: "localhost",
    port: parseInt(process.env.PGPORT || "5433"),
    database: "easy_auth_test",
    user: "test_user",
    password: "test_password",
  });

  try {
    await pool.query("SELECT NOW()");
  } catch (error) {
    throw new Error("Failed to connect to test database. Make sure to run: docker compose up -d");
  }

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(
    session({
      secret: "test-secret-key-for-testing-only",
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false, httpOnly: true },
    }),
  );

  const enabled = overrides.enabled !== false;

  const authConfig: AuthConfig = {
    db: pool,
    tablePrefix: "imp_",
    minPasswordLength: 6,
    maxPasswordLength: 50,
    resyncInterval: "30s",
    impersonation: {
      enabled,
      defaultTtl: overrides.defaultTtl,
      maxTtl: overrides.maxTtl,
      canImpersonate: overrides.canImpersonate ?? (async (actor, _target) => (actor.rolemask & AuthRole.Admin) === AuthRole.Admin),
    },
  };

  await dropAuthTables(authConfig);
  await createAuthTables(authConfig);

  app.use(createAuthMiddleware(authConfig));

  app.post("/register", async (req, res) => {
    try {
      const { email, password } = req.body;
      const account = await req.auth.register(email, password);
      res.json({ success: true, account: { id: account.id, email: account.email } });
    } catch (e: any) {
      res.status(400).json({ error: e.message, errorType: e.constructor.name });
    }
  });

  app.post("/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      await req.auth.login(email, password);
      res.json({ success: true });
    } catch (e: any) {
      res.status(401).json({ error: e.message, errorType: e.constructor.name });
    }
  });

  app.post("/logout", async (req, res) => {
    await req.auth.logout();
    res.json({ success: true });
  });

  app.post("/admin/add-role", async (req, res) => {
    try {
      const { identifier, role } = req.body;
      await req.auth.addRoleForUserBy(identifier, role);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message, errorType: e.constructor.name });
    }
  });

  app.post("/admin/set-status", async (req, res) => {
    try {
      const { identifier, status } = req.body;
      await req.auth.setStatusForUserBy(identifier, status);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message, errorType: e.constructor.name });
    }
  });

  app.post("/admin/force-logout", async (req, res) => {
    try {
      await req.auth.forceLogoutForUserBy(req.body);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message, errorType: e.constructor.name });
    }
  });

  app.post("/admin/delete-user", async (req, res) => {
    try {
      await req.auth.deleteUserBy(req.body);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message, errorType: e.constructor.name });
    }
  });

  app.post("/change-email", async (req, res) => {
    try {
      const { newEmail } = req.body;
      let confirmationToken: string | undefined;
      await req.auth.changeEmail(newEmail, (t) => {
        confirmationToken = t;
      });
      res.json({ success: true, confirmationToken });
    } catch (e: any) {
      res.status(400).json({ error: e.message, errorType: e.constructor.name });
    }
  });

  app.post("/confirm-email", async (req, res) => {
    try {
      const email = await req.auth.confirmEmail(req.body.token);
      res.json({ success: true, email });
    } catch (e: any) {
      res.status(400).json({ error: e.message, errorType: e.constructor.name });
    }
  });

  app.post("/impersonate/start", async (req, res) => {
    try {
      const { identifier, reason, ttl } = req.body;
      await req.auth.startImpersonation(identifier, { reason, ttl });
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message, errorType: e.constructor.name });
    }
  });

  app.post("/impersonate/stop", async (req, res) => {
    try {
      await req.auth.stopImpersonation();
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message, errorType: e.constructor.name });
    }
  });

  app.get("/me", (req, res) => {
    if (!req.auth.isLoggedIn()) {
      return res.status(401).json({ error: "Not logged in" });
    }
    res.json({
      id: req.auth.getId(),
      email: req.auth.getEmail(),
      status: req.auth.getStatus(),
      roles: req.auth.getRoleNames(),
      isImpersonating: req.auth.isImpersonating(),
      actorId: req.auth.getActorId(),
      actorEmail: req.auth.getActorEmail(),
      impersonation: req.auth.getImpersonationInfo(),
    });
  });

  // forces resync regardless of interval
  app.post("/force-resync", async (req, res) => {
    await req.auth.resyncSession(true);
    res.json({ success: true });
  });

  // utility: directly read activity log rows (test only)
  app.get("/activity/:action", async (req, res) => {
    const result = await pool.query(`SELECT account_id, actor_account_id, action, success, metadata FROM imp_activity_log WHERE action = $1 ORDER BY id DESC`, [req.params.action]);
    res.json(
      result.rows.map((r) => ({
        ...r,
        metadata: typeof r.metadata === "string" ? JSON.parse(r.metadata) : r.metadata,
      })),
    );
  });

  return {
    app,
    pool,
    authConfig,
    cleanup: () => pool.end(),
  };
}
