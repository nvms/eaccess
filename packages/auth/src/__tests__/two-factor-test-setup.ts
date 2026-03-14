import express from "express";
import session from "express-session";
import cookieParser from "cookie-parser";
import { Pool } from "pg";
import { createAuthMiddleware, createAuthTables, dropAuthTables, type AuthConfig, TwoFactorMechanism } from "../index.js";

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

export async function createTwoFactorTestApp() {
  const pool = await createTestDatabase();

  const app = express();

  app.use(express.json());
  app.use(cookieParser());
  app.use(
    session({
      secret: "2fa-test-secret-key-for-testing-only",
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false, httpOnly: true },
    }),
  );

  const authConfig: AuthConfig = {
    db: pool,
    tablePrefix: "mfa_test_",
    minPasswordLength: 6,
    maxPasswordLength: 50,
    rememberDuration: "7d",
    rememberCookieName: "2fa_test_remember_token",
    resyncInterval: "30s",
    twoFactor: {
      enabled: true,
      issuer: "EasyAccess Test",
      totpWindow: 1,
      backupCodesCount: 10,
    },
  };

  await dropAuthTables(authConfig);
  await createAuthTables(authConfig);

  app.use(createAuthMiddleware(authConfig));

  // standard auth routes
  app.post("/register", async (req, res) => {
    try {
      const { email, password, requireConfirmation } = req.body;
      let confirmationToken: string | undefined;

      const account = await req.auth.register(
        email,
        password,
        "2fa-test-user-123",
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

  app.post("/login", async (req, res) => {
    try {
      const { email, password, remember } = req.body;
      await req.auth.login(email, password, remember);
      res.json({ success: true });
    } catch (error: any) {
      if (error.constructor.name === "SecondFactorRequiredError") {
        // capture the OTP value from the challenge for testing
        if (error.availableMethods.email?.otpValue) {
          lastGeneratedOtp = error.availableMethods.email.otpValue;
        } else if (error.availableMethods.sms?.otpValue) {
          lastGeneratedOtp = error.availableMethods.sms.otpValue;
        }

        return res.status(202).json({
          requiresTwoFactor: true,
          availableMethods: error.availableMethods,
        });
      }
      res.status(401).json({ error: error.message });
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

  app.post("/verify-2fa", async (req, res) => {
    try {
      const { code } = req.body || {};
      await req.auth.twoFactor.verify.otp(code);
      await req.auth.completeTwoFactorLogin();
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message, errorType: error.constructor.name });
    }
  });

  app.post("/verify-2fa-totp", async (req, res) => {
    try {
      const { code } = req.body || {};
      await req.auth.twoFactor.verify.totp(code);
      await req.auth.completeTwoFactorLogin();
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message, errorType: error.constructor.name });
    }
  });

  app.post("/verify-2fa-backup", async (req, res) => {
    try {
      const { code } = req.body || {};
      await req.auth.twoFactor.verify.backupCode(code);
      await req.auth.completeTwoFactorLogin();
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message, errorType: error.constructor.name });
    }
  });

  app.get("/2fa/contact/:mechanism", async (req, res) => {
    try {
      const mechanism = parseInt(req.params.mechanism);
      const contact = await req.auth.twoFactor.getContact(mechanism as any);
      res.json({ contact });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/2fa/totp-uri", async (req, res) => {
    try {
      const uri = await req.auth.twoFactor.getTotpUri();
      res.json({ uri });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/2fa/is-enabled", async (req, res) => {
    try {
      const enabled = await req.auth.twoFactor.isEnabled();
      const totp = await req.auth.twoFactor.totpEnabled();
      const email = await req.auth.twoFactor.emailEnabled();
      const sms = await req.auth.twoFactor.smsEnabled();
      res.json({ enabled, totp, email, sms });
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

  // 2FA setup routes
  app.post("/2fa/setup-totp", async (req, res) => {
    try {
      const { requireVerification } = req.body || {};
      const result = await req.auth.twoFactor.setup.totp(requireVerification);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/2fa/verify-totp-setup", async (req, res) => {
    try {
      const { code } = req.body;
      const backupCodes = await req.auth.twoFactor.complete.totp(code);
      res.json({ success: true, backupCodes });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/2fa/setup-email", async (req, res) => {
    try {
      const { requireVerification } = req.body || {};
      await req.auth.twoFactor.setup.email(undefined, requireVerification);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/2fa/setup-sms", async (req, res) => {
    try {
      const { phoneNumber, requireVerification } = req.body || {};
      await req.auth.twoFactor.setup.sms(phoneNumber, requireVerification !== false);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/2fa/verify-setup", async (req, res) => {
    try {
      const { code, mechanism } = req.body || {};
      if (mechanism === "email") {
        await req.auth.twoFactor.complete.email(code);
      } else if (mechanism === "sms") {
        await req.auth.twoFactor.complete.sms(code);
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/2fa/methods", async (req, res) => {
    try {
      const methods = await req.auth.twoFactor.getEnabledMethods();
      res.json({ methods });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/2fa/method/:mechanism", async (req, res) => {
    try {
      const mechanism = parseInt(req.params.mechanism) as TwoFactorMechanism;
      await req.auth.twoFactor.disable(mechanism);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/2fa/regenerate-backup-codes", async (req, res) => {
    try {
      const codes = await req.auth.twoFactor.generateNewBackupCodes();
      res.json({ codes });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // utility routes for tests
  app.post("/set-user-session", (req, res) => {
    req.session.userId = req.body.userId || "2fa-test-user-123";
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

  let lastGeneratedOtp: string | null = null;

  app.get("/test-otp", (_req, res) => {
    res.json({ otp: lastGeneratedOtp });
  });

  return {
    app,
    pool,
    authConfig,
    cleanup: () => pool.end(),
  };
}
