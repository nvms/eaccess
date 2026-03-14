import express from "express";
import session from "express-session";
import cookieParser from "cookie-parser";
import { Pool } from "pg";
import { createAuthMiddleware, createAuthTables, dropAuthTables, type AuthConfig, AuthRole } from "../index.js";

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

export async function createTestDatabase() {
  const pool = new Pool({
    host: "localhost",
    port: 5433,
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

export async function createTestApp(configOverrides?: Partial<AuthConfig>) {
  const pool = await createTestDatabase();

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

  const authConfig: AuthConfig = {
    db: pool,
    tablePrefix: "test_",
    minPasswordLength: 6,
    maxPasswordLength: 50,
    rememberDuration: "7d",
    rememberCookieName: "test_remember_token",
    resyncInterval: "30s",
    ...configOverrides,
  };

  await dropAuthTables(authConfig);
  await createAuthTables(authConfig);

  app.use(createAuthMiddleware(authConfig));

  app.post("/register", async (req, res) => {
    try {
      const { email, password, userId, requireConfirmation } = req.body;
      let confirmationToken: string | undefined;

      const account = await req.auth.register(
        email,
        password,
        userId || undefined,
        requireConfirmation
          ? (token) => {
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
          user_id: account.user_id,
        },
        confirmationToken,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message, errorType: error.constructor.name });
    }
  });

  app.post("/login", async (req, res) => {
    try {
      const { email, password, remember } = req.body;
      await req.auth.login(email, password, remember);
      res.json({ success: true });
    } catch (error: any) {
      res.status(401).json({ error: error.message, errorType: error.constructor.name });
    }
  });

  app.post("/logout", async (req, res) => {
    try {
      await req.auth.logout();
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
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
      hasPassword: req.auth.hasPassword(),
      roles: req.auth.getRoleNames(),
      remembered: req.auth.isRemembered(),
      isAdmin: await req.auth.isAdmin(),
      hasRole: req.query.role ? await req.auth.hasRole(parseInt(req.query.role as string)) : undefined,
    });
  });

  app.post("/confirm-email", async (req, res) => {
    try {
      const { token, autoLogin } = req.body;
      if (autoLogin) {
        await req.auth.confirmEmailAndLogin(token);
      } else {
        const email = await req.auth.confirmEmail(token);
        res.json({ success: true, email });
        return;
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message, errorType: error.constructor.name });
    }
  });

  app.post("/reset-password", async (req, res) => {
    try {
      const { email, expiresAfter, maxRequests } = req.body;
      let resetToken: string | undefined;

      await req.auth.resetPassword(email, expiresAfter || "1h", maxRequests || 3, (token) => {
        resetToken = token;
      });

      res.json({ success: true, resetToken });
    } catch (error: any) {
      res.status(400).json({ error: error.message, errorType: error.constructor.name });
    }
  });

  app.post("/confirm-reset", async (req, res) => {
    try {
      const { token, password, logout } = req.body;
      await req.auth.confirmResetPassword(token, password, logout);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message, errorType: error.constructor.name });
    }
  });

  app.post("/change-email", async (req, res) => {
    try {
      const { newEmail } = req.body;
      let confirmationToken: string | undefined;

      await req.auth.changeEmail(newEmail, (token) => {
        confirmationToken = token;
      });

      res.json({ success: true, confirmationToken });
    } catch (error: any) {
      res.status(400).json({ error: error.message, errorType: error.constructor.name });
    }
  });

  app.post("/verify-password", async (req, res) => {
    try {
      const { password } = req.body;
      const isValid = await req.auth.verifyPassword(password);
      res.json({ success: true, isValid });
    } catch (error: any) {
      res.status(400).json({ error: error.message, errorType: error.constructor.name });
    }
  });

  app.post("/logout-everywhere", async (req, res) => {
    try {
      await req.auth.logoutEverywhere();
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/logout-everywhere-else", async (req, res) => {
    try {
      await req.auth.logoutEverywhereElse();
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // admin routes
  app.post("/admin/create-user", async (req, res) => {
    try {
      const { email, password, userId, requireConfirmation } = req.body;
      let confirmationToken: string | undefined;

      const account = await req.auth.createUser(
        { email, password },
        userId || "test-admin-user-456",
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
        },
        confirmationToken,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message, errorType: error.constructor.name });
    }
  });

  app.post("/admin/login-as", async (req, res) => {
    try {
      const identifier = req.body;
      await req.auth.loginAsUserBy(identifier);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message, errorType: error.constructor.name });
    }
  });

  app.post("/admin/add-role", async (req, res) => {
    try {
      const { identifier, role } = req.body;
      await req.auth.addRoleForUserBy(identifier, role);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message, errorType: error.constructor.name });
    }
  });

  app.post("/admin/remove-role", async (req, res) => {
    try {
      const { identifier, role } = req.body;
      await req.auth.removeRoleForUserBy(identifier, role);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message, errorType: error.constructor.name });
    }
  });

  app.post("/admin/has-role", async (req, res) => {
    try {
      const { identifier, role } = req.body;
      const hasRole = await req.auth.hasRoleForUserBy(identifier, role);
      res.json({ success: true, hasRole });
    } catch (error: any) {
      res.status(400).json({ error: error.message, errorType: error.constructor.name });
    }
  });

  app.post("/admin/change-password", async (req, res) => {
    try {
      const { identifier, password } = req.body;
      await req.auth.changePasswordForUserBy(identifier, password);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message, errorType: error.constructor.name });
    }
  });

  app.post("/admin/set-status", async (req, res) => {
    try {
      const { identifier, status } = req.body;
      await req.auth.setStatusForUserBy(identifier, status);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message, errorType: error.constructor.name });
    }
  });

  app.post("/admin/initiate-reset", async (req, res) => {
    try {
      const { identifier, expiresAfter } = req.body;
      let resetToken: string | undefined;
      await req.auth.initiatePasswordResetForUserBy(identifier, expiresAfter, (token: string) => {
        resetToken = token;
      });
      res.json({ success: true, resetToken });
    } catch (error: any) {
      res.status(400).json({ error: error.message, errorType: error.constructor.name });
    }
  });

  app.post("/admin/user-exists", async (req, res) => {
    try {
      const { email } = req.body;
      const exists = await req.auth.userExistsByEmail(email);
      res.json({ success: true, exists });
    } catch (error: any) {
      res.status(400).json({ error: error.message, errorType: error.constructor.name });
    }
  });

  app.post("/admin/delete-user", async (req, res) => {
    try {
      const identifier = req.body;
      await req.auth.deleteUserBy(identifier);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message, errorType: error.constructor.name });
    }
  });

  app.post("/admin/force-logout-user", async (req, res) => {
    try {
      const identifier = req.body;
      await req.auth.forceLogoutForUserBy(identifier);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message, errorType: error.constructor.name });
    }
  });

  // utility routes
  app.post("/set-user-session", (req, res) => {
    req.session.userId = req.body.userId || "test-user-123";
    req.session.save((err) => {
      if (err) {
        return res.status(500).json({ error: "Failed to save session" });
      }
      res.json({ success: true });
    });
  });

  app.get("/session-info", (req, res) => {
    res.json({
      sessionId: req.sessionID,
      userId: req.session.userId,
      auth: req.session.auth || null,
    });
  });

  return { app, pool, authConfig, cleanup: () => pool.end() };
}
