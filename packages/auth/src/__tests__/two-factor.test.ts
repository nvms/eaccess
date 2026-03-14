import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import Otp from "@eaccess/totp";
import type { Application } from "express";
import type { Pool } from "pg";
import { createTwoFactorTestApp } from "./two-factor-test-setup.js";
import { TwoFactorMechanism } from "../index.js";

describe("Two-Factor Authentication Integration Tests", () => {
  let app: Application;
  let pool: Pool;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const testApp = await createTwoFactorTestApp();
    app = testApp.app;
    pool = testApp.pool;
    cleanup = testApp.cleanup;
  });

  afterAll(async () => {
    await cleanup();
  });

  beforeEach(async () => {
    await pool.query("DELETE FROM mfa_test_2fa_tokens");
    await pool.query("DELETE FROM mfa_test_2fa_methods");
    await pool.query("DELETE FROM mfa_test_resets");
    await pool.query("DELETE FROM mfa_test_remembers");
    await pool.query("DELETE FROM mfa_test_confirmations");
    await pool.query("DELETE FROM mfa_test_activity_log");
    await pool.query("DELETE FROM mfa_test_accounts");
  });

  async function registerAndLogin(agent: any, email: string) {
    await agent.post("/set-user-session").send({ userId: `user-${email}` }).expect(200);
    await agent.post("/register").send({ email, password: "password123" }).expect(200);
    await agent.post("/login").send({ email, password: "password123" }).expect(200);
  }

  // ---- status queries ----

  describe("2FA status queries", () => {
    it("should report no 2FA initially", async () => {
      const agent = request.agent(app);
      await registerAndLogin(agent, "status@example.com");

      const status = await agent.get("/2fa/is-enabled").expect(200);
      expect(status.body.enabled).toBe(false);
      expect(status.body.totp).toBe(false);
      expect(status.body.email).toBe(false);
      expect(status.body.sms).toBe(false);

      const methods = await agent.get("/2fa/methods").expect(200);
      expect(methods.body.methods).toEqual([]);
    });

    it("should report enabled methods after setup", async () => {
      const agent = request.agent(app);
      await registerAndLogin(agent, "enabled@example.com");

      await agent.post("/2fa/setup-totp").expect(200);
      await agent.post("/2fa/setup-email").expect(200);

      const status = await agent.get("/2fa/is-enabled").expect(200);
      expect(status.body.enabled).toBe(true);
      expect(status.body.totp).toBe(true);
      expect(status.body.email).toBe(true);
      expect(status.body.sms).toBe(false);

      const methods = await agent.get("/2fa/methods").expect(200);
      expect(methods.body.methods).toContain(TwoFactorMechanism.TOTP);
      expect(methods.body.methods).toContain(TwoFactorMechanism.EMAIL);
    });
  });

  // ---- basic setup ----

  describe("Basic 2FA Setup", () => {
    it("should setup TOTP without verification", async () => {
      const agent = request.agent(app);
      await registerAndLogin(agent, "totp@example.com");

      const response = await agent.post("/2fa/setup-totp").expect(200);

      expect(response.body.secret).toBeDefined();
      expect(response.body.qrCode).toBeDefined();
      expect(Array.isArray(response.body.backupCodes)).toBe(true);
      expect(response.body.backupCodes).toHaveLength(10);

      const db = await pool.query("SELECT * FROM mfa_test_2fa_methods WHERE mechanism = 1");
      expect(db.rows).toHaveLength(1);
      expect(db.rows[0].verified).toBe(true);
    });

    it("should setup TOTP with verification required", async () => {
      const agent = request.agent(app);
      await registerAndLogin(agent, "totp-verify@example.com");

      const response = await agent.post("/2fa/setup-totp").send({ requireVerification: true }).expect(200);

      expect(response.body.secret).toBeDefined();
      expect(response.body.backupCodes).toBeUndefined();

      const db = await pool.query("SELECT * FROM mfa_test_2fa_methods WHERE mechanism = 1");
      expect(db.rows[0].verified).toBe(false);
    });

    it("should complete TOTP setup with valid code", async () => {
      const agent = request.agent(app);
      await registerAndLogin(agent, "totp-complete@example.com");

      const setup = await agent.post("/2fa/setup-totp").send({ requireVerification: true }).expect(200);

      const validCode = Otp.generateTotp(setup.body.secret);

      const complete = await agent.post("/2fa/verify-totp-setup").send({ code: validCode }).expect(200);

      expect(complete.body.backupCodes).toBeDefined();
      expect(complete.body.backupCodes).toHaveLength(10);

      const db = await pool.query("SELECT * FROM mfa_test_2fa_methods WHERE mechanism = 1");
      expect(db.rows[0].verified).toBe(true);
    });

    it("should reject TOTP completion with invalid code", async () => {
      const agent = request.agent(app);
      await registerAndLogin(agent, "totp-invalid@example.com");

      await agent.post("/2fa/setup-totp").send({ requireVerification: true }).expect(200);

      const response = await agent.post("/2fa/verify-totp-setup").send({ code: "000000" });
      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Invalid two-factor");
    });

    it("should reject duplicate TOTP setup", async () => {
      const agent = request.agent(app);
      await registerAndLogin(agent, "totp-dup@example.com");

      await agent.post("/2fa/setup-totp").expect(200);

      const response = await agent.post("/2fa/setup-totp");
      expect(response.status).toBe(400);
      expect(response.body.error).toContain("already enabled");
    });

    it("should setup email 2FA", async () => {
      const agent = request.agent(app);
      await registerAndLogin(agent, "email2fa@example.com");

      await agent.post("/2fa/setup-email").expect(200);

      const db = await pool.query("SELECT * FROM mfa_test_2fa_methods WHERE mechanism = 2");
      expect(db.rows).toHaveLength(1);
      expect(db.rows[0].verified).toBe(true);
    });

    it("should setup SMS 2FA", async () => {
      const agent = request.agent(app);
      await registerAndLogin(agent, "sms@example.com");

      await agent.post("/2fa/setup-sms").send({ phoneNumber: "+1234567890", requireVerification: false }).expect(200);

      const db = await pool.query("SELECT * FROM mfa_test_2fa_methods WHERE mechanism = 3");
      expect(db.rows).toHaveLength(1);
      expect(db.rows[0].secret).toBe("+1234567890");
    });
  });

  // ---- login flow with 2FA ----

  describe("2FA Login Flow", () => {
    it("should require 2FA during login and allow completion with email OTP", async () => {
      const agent = request.agent(app);
      await registerAndLogin(agent, "login2fa@example.com");

      await agent.post("/2fa/setup-email").expect(200);
      await agent.post("/logout").expect(200);

      const loginResponse = await agent.post("/login").send({ email: "login2fa@example.com", password: "password123" }).expect(202);

      expect(loginResponse.body.requiresTwoFactor).toBe(true);
      expect(loginResponse.body.availableMethods.email).toBeDefined();

      // not logged in yet
      await agent.get("/profile").expect(401);

      // get the OTP that was captured during login
      const otpResponse = await agent.get("/test-otp");
      const otpCode = otpResponse.body.otp;
      expect(otpCode).toBeDefined();

      await agent.post("/verify-2fa").send({ code: otpCode }).expect(200);

      const profile = await agent.get("/profile").expect(200);
      expect(profile.body.email).toBe("login2fa@example.com");
    });

    it("should require 2FA during login and allow completion with TOTP", async () => {
      const agent = request.agent(app);
      await registerAndLogin(agent, "logintotp@example.com");

      const setup = await agent.post("/2fa/setup-totp").expect(200);
      const secret = setup.body.secret;

      await agent.post("/logout").expect(200);

      const loginResponse = await agent.post("/login").send({ email: "logintotp@example.com", password: "password123" }).expect(202);

      expect(loginResponse.body.requiresTwoFactor).toBe(true);
      expect(loginResponse.body.availableMethods.totp).toBe(true);

      const validCode = Otp.generateTotp(secret);

      await agent.post("/verify-2fa-totp").send({ code: validCode }).expect(200);

      const profile = await agent.get("/profile").expect(200);
      expect(profile.body.email).toBe("logintotp@example.com");
    });

    it("should allow login with backup code", async () => {
      const agent = request.agent(app);
      await registerAndLogin(agent, "loginbackup@example.com");

      const setup = await agent.post("/2fa/setup-totp").expect(200);
      const backupCode = setup.body.backupCodes[0];

      await agent.post("/logout").expect(200);

      await agent.post("/login").send({ email: "loginbackup@example.com", password: "password123" }).expect(202);

      await agent.post("/verify-2fa-backup").send({ code: backupCode }).expect(200);

      const profile = await agent.get("/profile").expect(200);
      expect(profile.body.email).toBe("loginbackup@example.com");
    });

    it("should reject invalid backup code", async () => {
      const agent = request.agent(app);
      await registerAndLogin(agent, "badbackup@example.com");

      await agent.post("/2fa/setup-totp").expect(200);
      await agent.post("/logout").expect(200);

      await agent.post("/login").send({ email: "badbackup@example.com", password: "password123" }).expect(202);

      const response = await agent.post("/verify-2fa-backup").send({ code: "INVALID1" });
      expect(response.status).toBe(400);
      expect(response.body.errorType).toBe("InvalidBackupCodeError");
    });

    it("should consume backup code (single use)", async () => {
      const agent = request.agent(app);
      await registerAndLogin(agent, "consumebackup@example.com");

      const setup = await agent.post("/2fa/setup-totp").expect(200);
      const backupCode = setup.body.backupCodes[0];

      await agent.post("/logout").expect(200);

      // use backup code first time
      await agent.post("/login").send({ email: "consumebackup@example.com", password: "password123" }).expect(202);
      await agent.post("/verify-2fa-backup").send({ code: backupCode }).expect(200);

      await agent.post("/logout").expect(200);

      // try to use same backup code again
      await agent.post("/login").send({ email: "consumebackup@example.com", password: "password123" }).expect(202);
      const response = await agent.post("/verify-2fa-backup").send({ code: backupCode });
      expect(response.status).toBe(400);
    });

    it("should reject invalid TOTP code during login", async () => {
      const agent = request.agent(app);
      await registerAndLogin(agent, "badtotp@example.com");

      await agent.post("/2fa/setup-totp").expect(200);
      await agent.post("/logout").expect(200);

      await agent.post("/login").send({ email: "badtotp@example.com", password: "password123" }).expect(202);

      const response = await agent.post("/verify-2fa-totp").send({ code: "000000" });
      expect(response.status).toBe(400);
      expect(response.body.errorType).toBe("InvalidTwoFactorCodeError");
    });
  });

  // ---- 2FA management ----

  describe("2FA Management", () => {
    it("should disable TOTP method", async () => {
      const agent = request.agent(app);
      await registerAndLogin(agent, "disable@example.com");

      await agent.post("/2fa/setup-totp").expect(200);

      let methods = await agent.get("/2fa/methods").expect(200);
      expect(methods.body.methods).toContain(TwoFactorMechanism.TOTP);

      await agent.delete("/2fa/method/1").expect(200);

      methods = await agent.get("/2fa/methods").expect(200);
      expect(methods.body.methods).not.toContain(TwoFactorMechanism.TOTP);
    });

    it("should reject disabling non-existent method", async () => {
      const agent = request.agent(app);
      await registerAndLogin(agent, "nodisable@example.com");

      const response = await agent.delete("/2fa/method/1");
      expect(response.status).toBe(400);
    });

    it("should regenerate backup codes", async () => {
      const agent = request.agent(app);
      await registerAndLogin(agent, "regen@example.com");

      const setup = await agent.post("/2fa/setup-totp").expect(200);
      const originalCodes = setup.body.backupCodes;

      const regen = await agent.post("/2fa/regenerate-backup-codes").expect(200);
      expect(regen.body.codes).toHaveLength(10);
      expect(regen.body.codes).not.toEqual(originalCodes);
    });

    it("should reject backup code regeneration without TOTP setup", async () => {
      const agent = request.agent(app);
      await registerAndLogin(agent, "noregen@example.com");

      const response = await agent.post("/2fa/regenerate-backup-codes");
      expect(response.status).toBe(400);
    });

    it("should get contact info for email and SMS", async () => {
      const agent = request.agent(app);
      await registerAndLogin(agent, "contact@example.com");

      await agent.post("/2fa/setup-email").expect(200);
      await agent.post("/2fa/setup-sms").send({ phoneNumber: "+15551234567", requireVerification: false }).expect(200);

      const emailContact = await agent.get(`/2fa/contact/${TwoFactorMechanism.EMAIL}`).expect(200);
      expect(emailContact.body.contact).toBe("contact@example.com");

      const smsContact = await agent.get(`/2fa/contact/${TwoFactorMechanism.SMS}`).expect(200);
      expect(smsContact.body.contact).toBe("+15551234567");
    });

    it("should get TOTP URI", async () => {
      const agent = request.agent(app);
      await registerAndLogin(agent, "uri@example.com");

      await agent.post("/2fa/setup-totp").expect(200);

      const uriResponse = await agent.get("/2fa/totp-uri").expect(200);
      expect(uriResponse.body.uri).toContain("otpauth://totp/");
      expect(uriResponse.body.uri).toContain("EasyAccess");
    });

    it("should return null TOTP URI when not setup", async () => {
      const agent = request.agent(app);
      await registerAndLogin(agent, "nouri@example.com");

      const uriResponse = await agent.get("/2fa/totp-uri").expect(200);
      expect(uriResponse.body.uri).toBeNull();
    });
  });

  // ---- edge cases ----

  describe("2FA Edge Cases", () => {
    it("should not require 2FA when no methods are enabled", async () => {
      const agent = request.agent(app);
      await registerAndLogin(agent, "no2fa@example.com");

      await agent.post("/logout").expect(200);

      // login should succeed without 2FA prompt
      const response = await agent.post("/login").send({ email: "no2fa@example.com", password: "password123" });
      expect(response.status).toBe(200);
    });

    it("should handle multiple 2FA methods available", async () => {
      const agent = request.agent(app);
      await registerAndLogin(agent, "multi@example.com");

      await agent.post("/2fa/setup-totp").expect(200);
      await agent.post("/2fa/setup-email").expect(200);

      await agent.post("/logout").expect(200);

      const loginResponse = await agent.post("/login").send({ email: "multi@example.com", password: "password123" }).expect(202);

      expect(loginResponse.body.availableMethods.totp).toBe(true);
      expect(loginResponse.body.availableMethods.email).toBeDefined();
    });
  });
});
