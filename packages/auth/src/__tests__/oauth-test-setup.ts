import express from "express";
import session from "express-session";
import cookieParser from "cookie-parser";
import { Pool } from "pg";
import { createAuthMiddleware, createAuthTables, dropAuthTables, type AuthConfig } from "../index.js";

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

export async function createTestDatabase() {
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

  return pool;
}

export async function createOAuthTestApp() {
  const pool = await createTestDatabase();

  const app = express();

  app.use(express.json());
  app.use(cookieParser());
  app.use(
    session({
      secret: "oauth-test-secret-key-for-testing-only",
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false, httpOnly: true },
    }),
  );

  const authConfig: AuthConfig = {
    db: pool,
    createUser: async (userData) => {
      // Simulate creating user in app's user table
      return `oauth-user-${userData.id}`;
    },
    tablePrefix: "oauth_test_",
    minPasswordLength: 6,
    maxPasswordLength: 50,
    rememberDuration: "7d",
    rememberCookieName: "oauth_test_remember_token",
    resyncInterval: "30s",
  };

  await dropAuthTables(authConfig);
  await createAuthTables(authConfig);

  app.use(createAuthMiddleware(authConfig));

  // standard auth routes for testing
  app.post("/register", async (req, res) => {
    try {
      const { email, password, requireConfirmation } = req.body;
      let confirmationToken: string | undefined;

      const account = await req.auth.register(
        email,
        password,
        "oauth-test-user-123",
        requireConfirmation
          ? (token: string) => {
              confirmationToken = token;
            }
          : undefined,
      );

      res.json({
        success: true,
        account: {
          id: account.id,
          email: account.email,
          verified: account.verified,
          status: account.status,
        },
        confirmationToken,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/profile", async (req, res) => {
    if (!req.auth.isLoggedIn()) {
      return res.status(401).json({ error: "Not logged in" });
    }

    res.json({
      id: req.auth.getId(),
      email: req.auth.getEmail(),
      status: req.auth.getStatus(),
      statusName: req.auth.getStatusName(),
      verified: req.auth.getVerified(),
      roles: req.auth.getRoleNames(),
      remembered: req.auth.isRemembered(),
      isAdmin: await req.auth.isAdmin(),
    });
  });

  // utility routes for OAuth tests
  app.post("/set-user-session", (req, res) => {
    req.session.userId = req.body.userId || "oauth-test-user-123";
    req.session.save((err) => {
      if (err) {
        return res.status(500).json({ error: "Failed to save session" });
      }
      res.json({ success: true });
    });
  });

  return { app, pool, authConfig, cleanup: () => pool.end() };
}
