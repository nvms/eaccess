import express, { type Request } from "express";
import session from "express-session";
import cookieParser from "cookie-parser";
import { Pool } from "pg";
import { createAuthMiddleware, createAuthTables, dropAuthTables, TwoFactorManager, defineRoles } from "@eaccess/auth";
import type { AuthConfig } from "@eaccess/auth";
import { createAdminRoutes } from "./src/admin-routes.js";
import { createAuthStatusHandler, createLoginHandler, createLogoutHandler } from "./src/auth-check.js";
import { faker } from "@faker-js/faker";

interface FakeUser {
  email: string;
  userId: string;
  roles: number;
  oauthProvider?: {
    provider: string;
    providerId: string;
    providerEmail: string;
    providerName: string;
  };
}

const Roles = defineRoles("admin", "owner", "editor", "viewer", "billing");

const allRoleValues = Object.values(Roles);

function generateFakeUsers(count: number = 500): FakeUser[] {
  const users: FakeUser[] = [];
  const oauthProviders = ["github", "google", "azure"];

  for (let i = 0; i < count; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();

    const numRoles = faker.number.int({ min: 1, max: 3 });
    const selectedRoles = faker.helpers.shuffle([...allRoleValues]).slice(0, numRoles);

    const user: FakeUser = {
      email: faker.internet.email({ firstName, lastName }).toLowerCase(),
      userId: faker.string.alphanumeric(12),
      roles: selectedRoles.reduce((mask, role) => mask | role, 0),
    };

    if (faker.number.float() < 0.25) {
      user.oauthProvider = {
        provider: faker.helpers.arrayElement(oauthProviders),
        providerId: faker.string.alphanumeric(10),
        providerEmail: user.email,
        providerName: `${firstName} ${lastName}`,
      };
    }

    users.push(user);
  }

  return users;
}

async function seedDemoData(req: any, authConfig: AuthConfig) {
  const fakeUsers = generateFakeUsers(faker.number.int({ min: 510, max: 600 }));
  const prefix = authConfig.tablePrefix;

  let created = 0;
  let oauth = 0;

  for (const user of fakeUsers) {
    try {
      const account = await req.auth.register(user.email, "password123");

      if (user.roles) {
        await req.auth.addRoleForUserBy({ accountId: account.id }, user.roles);
      }

      if (user.oauthProvider) {
        try {
          await authConfig.db.query(
            `INSERT INTO ${prefix}providers (account_id, provider, provider_id, provider_email, provider_name) VALUES ($1, $2, $3, $4, $5)`,
            [account.id, user.oauthProvider.provider, user.oauthProvider.providerId, user.oauthProvider.providerEmail, user.oauthProvider.providerName],
          );
          oauth++;
        } catch {}
      }

      created++;
      if (created % 100 === 0) console.log(`  seeded ${created} users...`);
    } catch {}
  }

  const specificUsers = [
    { email: "user1@demo.com", roles: Roles.editor },
    { email: "user2@demo.com", roles: Roles.viewer },
    { email: "user3@demo.com", roles: Roles.owner | Roles.billing },
    { email: "user4@demo.com", roles: Roles.admin | Roles.editor },
  ];

  for (const user of specificUsers) {
    try {
      const account = await req.auth.register(user.email, "password123");
      await req.auth.addRoleForUserBy({ accountId: account.id }, user.roles);
    } catch {}
  }

  try {
    const unverified = await req.auth.register("unverified@demo.com", "password123", null, () => {});
    await req.auth.addRoleForUserBy({ accountId: unverified.id }, Roles.viewer);
  } catch {}

  // demo tokens
  try {
    const someUsers = await authConfig.db.query(`SELECT id FROM ${prefix}accounts ORDER BY RANDOM() LIMIT 3`);
    for (let i = 0; i < someUsers.rows.length; i++) {
      const id = someUsers.rows[i].id;
      const now = Date.now();
      await authConfig.db.query(`INSERT INTO ${prefix}resets (account_id, token, expires) VALUES ($1, $2, $3)`, [id, `demo-reset-${now}-${i}`, new Date(now + 86400000)]);
      await authConfig.db.query(`INSERT INTO ${prefix}remembers (account_id, token, expires) VALUES ($1, $2, $3)`, [id, `demo-remember-${now}-${i}`, new Date(now + 2592000000)]);
    }
  } catch {}

  // MFA for ~40% of non-OAuth users
  let mfa = 0;
  const mfaCandidates = faker.helpers.shuffle(fakeUsers.filter((u) => !u.oauthProvider)).slice(0, Math.floor(fakeUsers.length * 0.3));

  for (const user of mfaCandidates) {
    try {
      const result = await authConfig.db.query(`SELECT id FROM ${prefix}accounts WHERE email = $1`, [user.email]);
      if (result.rows.length === 0) continue;

      const accountId = result.rows[0].id;
      const mockReq = { session: { auth: { accountId, email: user.email } } };
      const tfm = new TwoFactorManager(mockReq as any, {} as any, authConfig);

      const rand = faker.number.float();
      if (rand < 0.5) {
        await tfm.setup.totp(false);
      } else if (rand < 0.8) {
        await tfm.setup.email(user.email, false);
      } else {
        await tfm.setup.sms(`+1${faker.string.numeric(10)}`, false);
      }
      mfa++;

      if (faker.number.float() < 0.1) {
        try {
          await tfm.setup.email(user.email, false);
          mfa++;
        } catch {}
      }
    } catch {}
  }

  return { created, oauth, mfa };
}

async function startDevServer() {
  const pool = new Pool({
    host: "localhost",
    port: 5433,
    database: "easy_auth_test",
    user: "test_user",
    password: "test_password",
  });

  try {
    await pool.query("SELECT NOW()");
  } catch {
    console.error("database connection failed - run: docker compose up -d");
    process.exit(1);
  }

  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  app.use(
    session({
      secret: "dev-session-secret-change-in-production",
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false, httpOnly: true, maxAge: 86400000 },
    }),
  );

  const authConfig: AuthConfig = {
    db: pool,
    tablePrefix: "auth_",
    roles: Roles,
    resyncInterval: "1s",
  };

  await dropAuthTables(authConfig);
  await createAuthTables(authConfig);

  app.use(createAuthMiddleware(authConfig));

  app.post("/create-admin", async (req: Request, res: any) => {
    try {
      const account = await req.auth.register("admin@demo.com", "Admin123!Demo");
      await req.auth.addRoleForUserBy({ accountId: account.id }, Roles.admin);
      res.json({ success: true });
    } catch (error: any) {
      if (error.message.includes("already in use")) {
        res.json({ success: true });
      } else {
        res.status(400).json({ error: error.message });
      }
    }
  });

  app.post("/create-demo-users", async (req: any, res: any) => {
    try {
      console.log("seeding demo data...");
      const stats = await seedDemoData(req, authConfig);
      console.log(`seeded ${stats.created} users, ${stats.oauth} oauth, ${stats.mfa} mfa`);
      res.json({ success: true, ...stats });
    } catch (error: any) {
      console.error("seed failed:", error.message);
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/admin/api/users/:id/test-totp", async (req: any, res: any) => {
    try {
      const userId = parseInt(req.params.id);
      const { code } = req.body;

      if (!code || typeof code !== "string" || code.length !== 6) {
        return res.status(400).json({ error: "Invalid TOTP code format" });
      }

      const prefix = authConfig.tablePrefix;
      const method = await authConfig.db.query(
        `SELECT secret FROM ${prefix}2fa_methods WHERE account_id = $1 AND mechanism = 1 AND verified = true`,
        [userId],
      );

      if (method.rows.length === 0 || !method.rows[0].secret) {
        return res.status(404).json({ error: "No verified TOTP method found" });
      }

      const { TotpProvider } = await import("@eaccess/auth");
      const totpProvider = new TotpProvider(authConfig);
      const isValid = totpProvider.verify(method.rows[0].secret, code);

      res.json({ success: isValid });
    } catch (error) {
      res.status(500).json({ error: "Failed to test TOTP code" });
    }
  });

  const authStatusHandler = createAuthStatusHandler(authConfig);
  const logoutHandler = createLogoutHandler(authConfig);

  app.post("/admin/api/login", async (req: any, res: any) => {
    try {
      await req.auth.login(req.body.email, req.body.password, req.body.remember);
      res.json({ success: true });
    } catch (error: any) {
      res.status(401).json({ error: error.message });
    }
  });

  app.get("/admin/api/auth-status", authStatusHandler);
  app.post("/admin/api/logout", logoutHandler);
  app.use("/admin/api", createAdminRoutes(authConfig));

  const port = 3001;
  app.listen(port, async () => {
    console.log(`dev server on http://localhost:${port}`);

    try { await fetch(`http://localhost:${port}/create-admin`, { method: "POST" }); } catch {}
    try { await fetch(`http://localhost:${port}/create-demo-users`, { method: "POST" }); } catch {}

    console.log(`\nadmin: admin@demo.com / Admin123!Demo`);
    console.log(`users: user1-4@demo.com / password123`);
    console.log(`\nrun 'make client' to start the frontend`);
  });
}

startDevServer().catch(console.error);
