import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import type { Application } from "express";
import type { Pool } from "pg";
import { createTestApp } from "./test-setup.js";
import { Pool } from "pg";
import {
  AuthRole,
  AuthStatus,
  defineRoles,
  createAuthContext,
  createAuthTables,
  dropAuthTables,
  cleanupExpiredTokens,
  getAuthTableStats,
  authenticateRequest,
  isValidEmail,
  validateEmail,
  InvalidEmailError,
  InvalidPasswordError,
  EmailTakenError,
  UserNotFoundError,
  UserInactiveError,
  EmailNotVerifiedError,
  ConfirmationNotFoundError,
  ConfirmationExpiredError,
  ResetNotFoundError,
  ResetExpiredError,
  ResetDisabledError,
  TooManyResetsError,
  UserNotLoggedInError,
  type AuthConfig,
} from "../index.js";

describe("Integration tests", () => {
  let app: Application;
  let pool: Pool;
  let authConfig: AuthConfig;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    pool = testApp.pool;
    authConfig = testApp.authConfig;
    cleanup = testApp.cleanup;
  });

  afterAll(async () => {
    await cleanup();
  });

  beforeEach(async () => {
    await pool.query("DELETE FROM test_2fa_tokens");
    await pool.query("DELETE FROM test_2fa_methods");
    await pool.query("DELETE FROM test_providers");
    await pool.query("DELETE FROM test_resets");
    await pool.query("DELETE FROM test_remembers");
    await pool.query("DELETE FROM test_confirmations");
    await pool.query("DELETE FROM test_activity_log");
    await pool.query("DELETE FROM test_accounts");
  });

  // helpers

  async function registerUser(agent: any, email: string, password = "password123", opts: Record<string, any> = {}) {
    return agent.post("/register").send({ email, password, ...opts });
  }

  async function loginUser(agent: any, email: string, password = "password123", remember = false) {
    return agent.post("/login").send({ email, password, remember });
  }

  async function registerAndLogin(agent: any, email: string, password = "password123") {
    await registerUser(agent, email, password);
    await loginUser(agent, email, password);
  }

  // ---- registration ----

  describe("User registration", () => {
    it("should register a new user without email confirmation", async () => {
      const agent = request.agent(app);
      const response = await registerUser(agent, "test@example.com");

      expect(response.status).toBe(200);
      expect(response.body.account.email).toBe("test@example.com");
      expect(response.body.account.verified).toBe(true);
      expect(response.body.confirmationToken).toBeUndefined();
    });

    it("should register a new user with email confirmation", async () => {
      const agent = request.agent(app);
      const response = await registerUser(agent, "confirm@example.com", "password123", {
        requireConfirmation: true,
      });

      expect(response.status).toBe(200);
      expect(response.body.account.verified).toBe(false);
      expect(response.body.confirmationToken).toBeDefined();
    });

    it("should auto-generate userId when none provided", async () => {
      const agent = request.agent(app);
      const response = await registerUser(agent, "autoid@example.com");

      expect(response.status).toBe(200);
      expect(response.body.account.user_id).toBeDefined();
      expect(response.body.account.user_id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it("should use provided userId", async () => {
      const agent = request.agent(app);
      const response = await registerUser(agent, "customid@example.com", "password123", {
        userId: "my-custom-id",
      });

      expect(response.status).toBe(200);
      expect(response.body.account.user_id).toBe("my-custom-id");
    });

    it("should reject duplicate email registration", async () => {
      const agent = request.agent(app);
      await registerUser(agent, "duplicate@example.com");

      const response = await registerUser(agent, "duplicate@example.com", "different-password");

      expect(response.status).toBe(400);
      expect(response.body.errorType).toBe("EmailTakenError");
    });

    it("should reject password below minimum length", async () => {
      const agent = request.agent(app);
      const response = await registerUser(agent, "short@example.com", "123");

      expect(response.status).toBe(400);
      expect(response.body.errorType).toBe("InvalidPasswordError");
    });

    it("should reject password above maximum length", async () => {
      const agent = request.agent(app);
      const response = await registerUser(agent, "long@example.com", "a".repeat(51));

      expect(response.status).toBe(400);
      expect(response.body.errorType).toBe("InvalidPasswordError");
    });

    it("should reject invalid email format", async () => {
      const agent = request.agent(app);

      for (const email of ["notanemail", "@missing.com", "no@", "spaces in@email.com", ""]) {
        const response = await registerUser(agent, email);
        expect(response.status).toBe(400);
        expect(response.body.errorType).toBe("InvalidEmailError");
      }
    });
  });

  // ---- login ----

  describe("User login", () => {
    beforeEach(async () => {
      const agent = request.agent(app);
      await registerUser(agent, "login@example.com");
    });

    it("should login with valid credentials", async () => {
      const agent = request.agent(app);
      const response = await loginUser(agent, "login@example.com");

      expect(response.status).toBe(200);

      const profile = await agent.get("/profile");
      expect(profile.body.email).toBe("login@example.com");
      expect(profile.body.verified).toBe(true);
      expect(profile.body.statusName).toBe("Normal");
      expect(profile.body.hasPassword).toBe(true);
    });

    it("should reject invalid password", async () => {
      const agent = request.agent(app);
      const response = await loginUser(agent, "login@example.com", "wrongpassword");

      expect(response.status).toBe(401);
      expect(response.body.errorType).toBe("InvalidPasswordError");
    });

    it("should reject non-existent email", async () => {
      const agent = request.agent(app);
      const response = await loginUser(agent, "nonexistent@example.com");

      expect(response.status).toBe(401);
      expect(response.body.errorType).toBe("UserNotFoundError");
    });

    it("should reject login for banned account", async () => {
      const agent = request.agent(app);
      await pool.query("UPDATE test_accounts SET status = $1 WHERE email = $2", [AuthStatus.Banned, "login@example.com"]);

      const response = await loginUser(agent, "login@example.com");

      expect(response.status).toBe(401);
      expect(response.body.errorType).toBe("UserInactiveError");
    });

    it("should reject login for locked account", async () => {
      const agent = request.agent(app);
      await pool.query("UPDATE test_accounts SET status = $1 WHERE email = $2", [AuthStatus.Locked, "login@example.com"]);

      const response = await loginUser(agent, "login@example.com");

      expect(response.status).toBe(401);
      expect(response.body.errorType).toBe("UserInactiveError");
    });

    it("should reject login for suspended account", async () => {
      const agent = request.agent(app);
      await pool.query("UPDATE test_accounts SET status = $1 WHERE email = $2", [AuthStatus.Suspended, "login@example.com"]);

      const response = await loginUser(agent, "login@example.com");

      expect(response.status).toBe(401);
      expect(response.body.errorType).toBe("UserInactiveError");
    });

    it("should reject login for unverified email", async () => {
      const agent = request.agent(app);
      await registerUser(agent, "unverified@example.com", "password123", { requireConfirmation: true });

      const response = await loginUser(agent, "unverified@example.com");

      expect(response.status).toBe(401);
      expect(response.body.errorType).toBe("EmailNotVerifiedError");
    });

    it("should handle remember me functionality", async () => {
      const agent = request.agent(app);
      const response = await loginUser(agent, "login@example.com", "password123", true);

      expect(response.status).toBe(200);
      const cookies = response.headers["set-cookie"];
      expect(cookies.some((cookie: string) => cookie.includes("test_remember_token"))).toBe(true);

      const profile = await agent.get("/profile");
      expect(profile.body.remembered).toBe(true);
    });
  });

  // ---- email confirmation ----

  describe("Email confirmation", () => {
    it("should confirm email without auto-login", async () => {
      const agent = request.agent(app);
      const reg = await registerUser(agent, "confirm@example.com", "password123", { requireConfirmation: true });

      const response = await agent.post("/confirm-email").send({ token: reg.body.confirmationToken });

      expect(response.status).toBe(200);
      expect(response.body.email).toBe("confirm@example.com");

      // should not be logged in
      const profile = await agent.get("/profile");
      expect(profile.status).toBe(401);
    });

    it("should confirm email and auto-login", async () => {
      const agent = request.agent(app);
      const reg = await registerUser(agent, "autologin@example.com", "password123", { requireConfirmation: true });

      await agent.post("/confirm-email").send({ token: reg.body.confirmationToken, autoLogin: true }).expect(200);

      const profile = await agent.get("/profile");
      expect(profile.body.email).toBe("autologin@example.com");
      expect(profile.body.verified).toBe(true);
    });

    it("should reject invalid confirmation token", async () => {
      const agent = request.agent(app);
      const response = await agent.post("/confirm-email").send({ token: "invalid-token" });

      expect(response.status).toBe(400);
      expect(response.body.errorType).toBe("ConfirmationNotFoundError");
    });

    it("should reject expired confirmation token", async () => {
      const agent = request.agent(app);
      const reg = await registerUser(agent, "expired@example.com", "password123", { requireConfirmation: true });

      await pool.query("UPDATE test_confirmations SET expires = NOW() - INTERVAL '1 day' WHERE token = $1", [reg.body.confirmationToken]);

      const response = await agent.post("/confirm-email").send({ token: reg.body.confirmationToken });

      expect(response.status).toBe(400);
      expect(response.body.errorType).toBe("ConfirmationExpiredError");
    });
  });

  // ---- email change ----

  describe("Email change", () => {
    it("should change email with confirmation flow", async () => {
      const agent = request.agent(app);
      await registerAndLogin(agent, "original@example.com");

      const changeResponse = await agent.post("/change-email").send({ newEmail: "newemail@example.com" });

      expect(changeResponse.status).toBe(200);
      expect(changeResponse.body.confirmationToken).toBeDefined();

      await agent.post("/confirm-email").send({ token: changeResponse.body.confirmationToken }).expect(200);

      const profile = await agent.get("/profile");
      expect(profile.body.email).toBe("newemail@example.com");
    });

    it("should reject email change when not logged in", async () => {
      const agent = request.agent(app);
      const response = await agent.post("/change-email").send({ newEmail: "new@example.com" });

      expect(response.status).toBe(400);
      expect(response.body.errorType).toBe("UserNotLoggedInError");
    });

    it("should reject email change to taken email", async () => {
      const agent = request.agent(app);
      await registerUser(agent, "taken@example.com");
      await registerAndLogin(agent, "changer@example.com");

      const response = await agent.post("/change-email").send({ newEmail: "taken@example.com" });

      expect(response.status).toBe(400);
      expect(response.body.errorType).toBe("EmailTakenError");
    });
  });

  // ---- password reset ----

  describe("Password reset", () => {
    beforeEach(async () => {
      const agent = request.agent(app);
      await registerUser(agent, "reset@example.com", "oldpassword123");
    });

    it("should initiate and confirm password reset", async () => {
      const agent = request.agent(app);
      const resetResponse = await agent.post("/reset-password").send({ email: "reset@example.com" });

      expect(resetResponse.body.resetToken).toBeDefined();

      await agent.post("/confirm-reset").send({ token: resetResponse.body.resetToken, password: "newpassword123" }).expect(200);

      await loginUser(agent, "reset@example.com", "newpassword123").then((r) => expect(r.status).toBe(200));
      // old password should fail
      const agent2 = request.agent(app);
      await loginUser(agent2, "reset@example.com", "oldpassword123").then((r) => expect(r.status).toBe(401));
    });

    it("should reject reset for non-existent email", async () => {
      const agent = request.agent(app);
      const response = await agent.post("/reset-password").send({ email: "nope@example.com" });

      expect(response.status).toBe(400);
      expect(response.body.errorType).toBe("EmailNotVerifiedError");
    });

    it("should reject reset for unverified email", async () => {
      const agent = request.agent(app);
      await registerUser(agent, "unverified-reset@example.com", "password123", { requireConfirmation: true });

      const response = await agent.post("/reset-password").send({ email: "unverified-reset@example.com" });

      expect(response.status).toBe(400);
      expect(response.body.errorType).toBe("EmailNotVerifiedError");
    });

    it("should reject reset when resettable is false", async () => {
      const agent = request.agent(app);
      await pool.query("UPDATE test_accounts SET resettable = false WHERE email = $1", ["reset@example.com"]);

      const response = await agent.post("/reset-password").send({ email: "reset@example.com" });

      expect(response.status).toBe(400);
      expect(response.body.errorType).toBe("ResetDisabledError");
    });

    it("should enforce max open reset requests", async () => {
      const agent = request.agent(app);

      await agent.post("/reset-password").send({ email: "reset@example.com", maxRequests: 1 }).expect(200);

      const response = await agent.post("/reset-password").send({ email: "reset@example.com", maxRequests: 1 });

      expect(response.status).toBe(400);
      expect(response.body.errorType).toBe("TooManyResetsError");
    });

    it("should reject expired reset token", async () => {
      const agent = request.agent(app);
      const resetResponse = await agent.post("/reset-password").send({ email: "reset@example.com" });

      await pool.query("UPDATE test_resets SET expires = NOW() - INTERVAL '1 day' WHERE token = $1", [resetResponse.body.resetToken]);

      const response = await agent.post("/confirm-reset").send({ token: resetResponse.body.resetToken, password: "newpassword" });

      expect(response.status).toBe(400);
      expect(response.body.errorType).toBe("ResetExpiredError");
    });

    it("should reject invalid reset token", async () => {
      const agent = request.agent(app);
      const response = await agent.post("/confirm-reset").send({ token: "bogus-token", password: "newpassword" });

      expect(response.status).toBe(400);
      expect(response.body.errorType).toBe("ResetNotFoundError");
    });

    it("should reject weak password on reset confirm", async () => {
      const agent = request.agent(app);
      const resetResponse = await agent.post("/reset-password").send({ email: "reset@example.com" });

      const response = await agent.post("/confirm-reset").send({ token: resetResponse.body.resetToken, password: "123" });

      expect(response.status).toBe(400);
      expect(response.body.errorType).toBe("InvalidPasswordError");
    });
  });

  // ---- session management ----

  describe("Session management", () => {
    it("should logout successfully", async () => {
      const agent = request.agent(app);
      await registerAndLogin(agent, "session@example.com");

      await agent.get("/profile").expect(200);
      await agent.post("/logout").expect(200);
      await agent.get("/profile").expect(401);
    });

    it("should verify password correctly", async () => {
      const agent = request.agent(app);
      await registerAndLogin(agent, "verify@example.com");

      const correct = await agent.post("/verify-password").send({ password: "password123" });
      expect(correct.body.isValid).toBe(true);

      const wrong = await agent.post("/verify-password").send({ password: "wrongpassword" });
      expect(wrong.body.isValid).toBe(false);
    });

    it("should reject verify password when not logged in", async () => {
      const agent = request.agent(app);
      const response = await agent.post("/verify-password").send({ password: "anything" });

      expect(response.status).toBe(400);
      expect(response.body.errorType).toBe("UserNotLoggedInError");
    });

    it("should logout everywhere", async () => {
      const agent = request.agent(app);
      await registerAndLogin(agent, "everywhere@example.com");

      await agent.post("/logout-everywhere").expect(200);
      await agent.get("/profile").expect(401);
    });

    it("should logout everywhere else (current session survives)", async () => {
      const agent = request.agent(app);
      await registerAndLogin(agent, "everywhereelse@example.com");

      await agent.post("/logout-everywhere-else").expect(200);

      // current session should still work
      await agent.get("/profile").expect(200);
    });

    it("should return null values when not logged in", async () => {
      const agent = request.agent(app);
      const profile = await agent.get("/profile");

      expect(profile.status).toBe(401);
    });
  });

  // ---- admin functions ----

  describe("Admin functions", () => {
    it("should create user as admin", async () => {
      const agent = request.agent(app);
      const response = await agent.post("/admin/create-user").send({ email: "admin-created@example.com", password: "adminpassword123" });

      expect(response.status).toBe(200);
      expect(response.body.account.email).toBe("admin-created@example.com");
      expect(response.body.account.verified).toBe(true);
    });

    it("should create user with confirmation via admin", async () => {
      const agent = request.agent(app);
      const response = await agent.post("/admin/create-user").send({
        email: "admin-confirm@example.com",
        password: "password123",
        requireConfirmation: true,
      });

      expect(response.status).toBe(200);
      expect(response.body.account.verified).toBe(false);
      expect(response.body.confirmationToken).toBeDefined();
    });

    it("should login as another user", async () => {
      const agent = request.agent(app);
      await agent.post("/admin/create-user").send({ email: "impersonate@example.com", password: "password123" });
      await agent.post("/admin/login-as").send({ email: "impersonate@example.com" }).expect(200);

      const profile = await agent.get("/profile");
      expect(profile.body.email).toBe("impersonate@example.com");
    });

    it("should reject login-as for non-existent user", async () => {
      const agent = request.agent(app);
      const response = await agent.post("/admin/login-as").send({ email: "nope@example.com" });

      expect(response.status).toBe(400);
      expect(response.body.errorType).toBe("UserNotFoundError");
    });

    it("should add and check roles", async () => {
      const agent = request.agent(app);
      await agent.post("/admin/create-user").send({ email: "roles@example.com", password: "password123" });

      await agent.post("/admin/add-role").send({ identifier: { email: "roles@example.com" }, role: AuthRole.Admin }).expect(200);

      await agent.post("/admin/login-as").send({ email: "roles@example.com" });

      const profile = await agent.get("/profile");
      expect(profile.body.roles).toContain("Admin");
      expect(profile.body.isAdmin).toBe(true);
    });

    it("should remove roles", async () => {
      const agent = request.agent(app);
      await agent.post("/admin/create-user").send({ email: "removerole@example.com", password: "password123" });

      await agent.post("/admin/add-role").send({ identifier: { email: "removerole@example.com" }, role: AuthRole.Admin | AuthRole.Editor });

      const hasAdmin = await agent.post("/admin/has-role").send({ identifier: { email: "removerole@example.com" }, role: AuthRole.Admin });
      expect(hasAdmin.body.hasRole).toBe(true);

      await agent.post("/admin/remove-role").send({ identifier: { email: "removerole@example.com" }, role: AuthRole.Admin }).expect(200);

      const afterRemove = await agent.post("/admin/has-role").send({ identifier: { email: "removerole@example.com" }, role: AuthRole.Admin });
      expect(afterRemove.body.hasRole).toBe(false);

      // editor should still be there
      const hasEditor = await agent.post("/admin/has-role").send({ identifier: { email: "removerole@example.com" }, role: AuthRole.Editor });
      expect(hasEditor.body.hasRole).toBe(true);
    });

    it("should check combined roles (bitmask composition)", async () => {
      const agent = request.agent(app);
      await agent.post("/admin/create-user").send({ email: "combo@example.com", password: "password123" });

      const combined = AuthRole.Admin | AuthRole.Editor | AuthRole.Moderator;
      await agent.post("/admin/add-role").send({ identifier: { email: "combo@example.com" }, role: combined });

      await agent.post("/admin/login-as").send({ email: "combo@example.com" });

      const profile = await agent.get("/profile");
      expect(profile.body.roles).toContain("Admin");
      expect(profile.body.roles).toContain("Editor");
      expect(profile.body.roles).toContain("Moderator");
      expect(profile.body.roles).not.toContain("Owner");
    });

    it("should change password for user", async () => {
      const agent = request.agent(app);
      await agent.post("/admin/create-user").send({ email: "changepw@example.com", password: "oldpassword" });

      await agent.post("/admin/change-password").send({ identifier: { email: "changepw@example.com" }, password: "newpassword" }).expect(200);

      await loginUser(agent, "changepw@example.com", "newpassword").then((r) => expect(r.status).toBe(200));
    });

    it("should reject weak password on admin change", async () => {
      const agent = request.agent(app);
      await agent.post("/admin/create-user").send({ email: "weakpw@example.com", password: "password123" });

      const response = await agent.post("/admin/change-password").send({ identifier: { email: "weakpw@example.com" }, password: "12" });

      expect(response.status).toBe(400);
      expect(response.body.errorType).toBe("InvalidPasswordError");
    });

    it("should set status for user", async () => {
      const agent = request.agent(app);
      await agent.post("/admin/create-user").send({ email: "statususer@example.com", password: "password123" });

      await agent.post("/admin/set-status").send({ identifier: { email: "statususer@example.com" }, status: AuthStatus.Banned }).expect(200);

      const response = await loginUser(agent, "statususer@example.com");
      expect(response.status).toBe(401);
      expect(response.body.errorType).toBe("UserInactiveError");
    });

    it("should initiate password reset for user by identifier", async () => {
      const agent = request.agent(app);
      await agent.post("/admin/create-user").send({ email: "adminreset@example.com", password: "password123" });

      const response = await agent.post("/admin/initiate-reset").send({ identifier: { email: "adminreset@example.com" } });

      expect(response.status).toBe(200);
      expect(response.body.resetToken).toBeDefined();
    });

    it("should check user exists by email", async () => {
      const agent = request.agent(app);
      await agent.post("/admin/create-user").send({ email: "exists@example.com", password: "password123" });

      const exists = await agent.post("/admin/user-exists").send({ email: "exists@example.com" });
      expect(exists.body.exists).toBe(true);

      const notExists = await agent.post("/admin/user-exists").send({ email: "nope@example.com" });
      expect(notExists.body.exists).toBe(false);
    });

    it("should delete user", async () => {
      const agent = request.agent(app);
      await agent.post("/admin/create-user").send({ email: "deleteme@example.com", password: "password123" });

      await agent.post("/admin/delete-user").send({ email: "deleteme@example.com" }).expect(200);

      const exists = await agent.post("/admin/user-exists").send({ email: "deleteme@example.com" });
      expect(exists.body.exists).toBe(false);
    });

    it("should reject delete for non-existent user", async () => {
      const agent = request.agent(app);
      const response = await agent.post("/admin/delete-user").send({ email: "nope@example.com" });

      expect(response.status).toBe(400);
      expect(response.body.errorType).toBe("UserNotFoundError");
    });

    it("should immediately force logout current user", async () => {
      const agent = request.agent(app);
      await registerAndLogin(agent, "forcelogout@example.com");

      await agent.get("/profile").expect(200);
      await agent.post("/admin/force-logout-user").send({ email: "forcelogout@example.com" }).expect(200);
      await agent.get("/profile").expect(401);
    });

    it("should find user by accountId, email, and userId", async () => {
      const agent = request.agent(app);
      const reg = await agent.post("/admin/create-user").send({ email: "findme@example.com", password: "password123", userId: "find-me-id" });
      const accountId = reg.body.account.id;

      // by email
      const byEmail = await agent.post("/admin/has-role").send({ identifier: { email: "findme@example.com" }, role: AuthRole.Admin });
      expect(byEmail.status).toBe(200);

      // by accountId
      const byId = await agent.post("/admin/has-role").send({ identifier: { accountId }, role: AuthRole.Admin });
      expect(byId.status).toBe(200);

      // by userId
      const byUserId = await agent.post("/admin/has-role").send({ identifier: { userId: "find-me-id" }, role: AuthRole.Admin });
      expect(byUserId.status).toBe(200);
    });
  });

  // ---- error handling ----

  describe("Error handling", () => {
    it("should handle profile access when not logged in", async () => {
      const agent = request.agent(app);
      const response = await agent.get("/profile");
      expect(response.status).toBe(401);
    });
  });
});

// ---- defineRoles ----

describe("defineRoles", () => {
  it("should create role object with sequential powers of 2", () => {
    const roles = defineRoles("owner", "editor", "viewer");

    expect(roles.owner).toBe(1);
    expect(roles.editor).toBe(2);
    expect(roles.viewer).toBe(4);
  });

  it("should return frozen object", () => {
    const roles = defineRoles("admin", "user");
    expect(Object.isFrozen(roles)).toBe(true);
  });

  it("should work with bitmask operations", () => {
    const roles = defineRoles("admin", "editor", "viewer");

    const mask = roles.admin | roles.viewer;
    expect(mask & roles.admin).toBe(roles.admin);
    expect(mask & roles.editor).toBe(0);
    expect(mask & roles.viewer).toBe(roles.viewer);
  });

  it("should reject duplicate names", () => {
    expect(() => defineRoles("admin", "admin")).toThrow("Duplicate role name");
  });

  it("should reject empty names list", () => {
    expect(() => defineRoles()).toThrow("At least one role name");
  });

  it("should reject more than 31 roles", () => {
    const names = Array.from({ length: 32 }, (_, i) => `role${i}`);
    expect(() => (defineRoles as any)(...names)).toThrow("Cannot define more than 31 roles");
  });

  it("should preserve exact name casing", () => {
    const roles = defineRoles("SuperAdmin", "basic_user", "READONLY");
    expect("SuperAdmin" in roles).toBe(true);
    expect("basic_user" in roles).toBe(true);
    expect("READONLY" in roles).toBe(true);
  });
});

// ---- defineRoles + getRoleNames integration ----

describe("Custom roles with getRoleNames", () => {
  let app: Application;
  let pool: Pool;
  let cleanup: () => Promise<void>;

  const CustomRoles = defineRoles("owner", "editor", "viewer");

  beforeAll(async () => {
    const testApp = await createTestApp({ roles: CustomRoles, tablePrefix: "roles_test_" });
    app = testApp.app;
    pool = testApp.pool;
    cleanup = testApp.cleanup;
  });

  afterAll(async () => {
    await cleanup();
  });

  beforeEach(async () => {
    await pool.query("DELETE FROM roles_test_2fa_tokens");
    await pool.query("DELETE FROM roles_test_2fa_methods");
    await pool.query("DELETE FROM roles_test_providers");
    await pool.query("DELETE FROM roles_test_resets");
    await pool.query("DELETE FROM roles_test_remembers");
    await pool.query("DELETE FROM roles_test_confirmations");
    await pool.query("DELETE FROM roles_test_activity_log");
    await pool.query("DELETE FROM roles_test_accounts");
  });

  it("should return custom role names from getRoleNames", async () => {
    const agent = request.agent(app);
    await agent.post("/admin/create-user").send({ email: "custom@example.com", password: "password123" });

    await agent.post("/admin/add-role").send({
      identifier: { email: "custom@example.com" },
      role: CustomRoles.owner | CustomRoles.viewer,
    });

    await agent.post("/admin/login-as").send({ email: "custom@example.com" });

    const profile = await agent.get("/profile");
    expect(profile.body.roles).toContain("owner");
    expect(profile.body.roles).toContain("viewer");
    expect(profile.body.roles).not.toContain("editor");
    // should NOT contain default AuthRole names
    expect(profile.body.roles).not.toContain("Admin");
  });
});

// ---- AuthContext (standalone, no request) ----

describe("AuthContext", () => {
  let pool: Pool;
  let authConfig: AuthConfig;

  beforeAll(async () => {
    pool = new Pool({
      host: "localhost",
      port: parseInt(process.env.PGPORT || "5433"),
      database: "easy_auth_test",
      user: "test_user",
      password: "test_password",
    });

    authConfig = {
      db: pool,
      tablePrefix: "ctx_test_",
      minPasswordLength: 6,
      maxPasswordLength: 50,
    };

    await dropAuthTables(authConfig);
    await createAuthTables(authConfig);
  });

  afterAll(async () => {
    await dropAuthTables(authConfig);
    await pool.end();
  });

  beforeEach(async () => {
    await pool.query("DELETE FROM ctx_test_resets");
    await pool.query("DELETE FROM ctx_test_remembers");
    await pool.query("DELETE FROM ctx_test_confirmations");
    await pool.query("DELETE FROM ctx_test_accounts");
  });

  it("should create and use an auth context", async () => {
    const ctx = createAuthContext(authConfig);

    const account = await ctx.createUser({ email: "ctx@example.com", password: "password123" });
    expect(account.email).toBe("ctx@example.com");
    expect(account.verified).toBe(true);
  });

  it("should register via context", async () => {
    const ctx = createAuthContext(authConfig);

    const account = await ctx.register("ctxreg@example.com", "password123");
    expect(account.email).toBe("ctxreg@example.com");
  });

  it("should check user exists via context", async () => {
    const ctx = createAuthContext(authConfig);

    await ctx.createUser({ email: "ctxexists@example.com", password: "password123" });

    expect(await ctx.userExistsByEmail("ctxexists@example.com")).toBe(true);
    expect(await ctx.userExistsByEmail("nope@example.com")).toBe(false);
  });

  it("should delete user via context", async () => {
    const ctx = createAuthContext(authConfig);

    await ctx.createUser({ email: "ctxdelete@example.com", password: "password123" });
    await ctx.deleteUserBy({ email: "ctxdelete@example.com" });

    expect(await ctx.userExistsByEmail("ctxdelete@example.com")).toBe(false);
  });

  it("should manage roles via context", async () => {
    const ctx = createAuthContext(authConfig);

    await ctx.createUser({ email: "ctxroles@example.com", password: "password123" });

    await ctx.addRoleForUserBy({ email: "ctxroles@example.com" }, AuthRole.Admin | AuthRole.Editor);
    expect(await ctx.hasRoleForUserBy({ email: "ctxroles@example.com" }, AuthRole.Admin)).toBe(true);

    await ctx.removeRoleForUserBy({ email: "ctxroles@example.com" }, AuthRole.Admin);
    expect(await ctx.hasRoleForUserBy({ email: "ctxroles@example.com" }, AuthRole.Admin)).toBe(false);
    expect(await ctx.hasRoleForUserBy({ email: "ctxroles@example.com" }, AuthRole.Editor)).toBe(true);
  });

  it("should change password via context", async () => {
    const ctx = createAuthContext(authConfig);

    await ctx.createUser({ email: "ctxpw@example.com", password: "password123" });
    await ctx.changePasswordForUserBy({ email: "ctxpw@example.com" }, "newpassword");
    // no error means success
  });

  it("should set status via context", async () => {
    const ctx = createAuthContext(authConfig);

    await ctx.createUser({ email: "ctxstatus@example.com", password: "password123" });
    await ctx.setStatusForUserBy({ email: "ctxstatus@example.com" }, AuthStatus.Banned);

    const result = await pool.query("SELECT status FROM ctx_test_accounts WHERE email = $1", ["ctxstatus@example.com"]);
    expect(result.rows[0].status).toBe(AuthStatus.Banned);
  });

  it("should reset password via context", async () => {
    const ctx = createAuthContext(authConfig);

    await ctx.createUser({ email: "ctxreset@example.com", password: "password123" });

    let token: string | undefined;
    await ctx.resetPassword("ctxreset@example.com", "1h", 3, (t) => {
      token = t;
    });
    expect(token).toBeDefined();

    const result = await ctx.confirmResetPassword(token!, "newpassword123");
    expect(result.email).toBe("ctxreset@example.com");
  });

  it("should force logout via context", async () => {
    const ctx = createAuthContext(authConfig);

    await ctx.createUser({ email: "ctxforce@example.com", password: "password123" });
    const result = await ctx.forceLogoutForUserBy({ email: "ctxforce@example.com" });
    expect(result.accountId).toBeDefined();
  });

  it("should initiate reset for user by identifier", async () => {
    const ctx = createAuthContext(authConfig);

    await ctx.createUser({ email: "ctxinitiate@example.com", password: "password123" });

    let token: string | undefined;
    await ctx.initiatePasswordResetForUserBy({ email: "ctxinitiate@example.com" }, "1h", (t) => {
      token = t;
    });

    expect(token).toBeDefined();
  });
});

// ---- schema operations ----

describe("Schema operations", () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({
      host: "localhost",
      port: parseInt(process.env.PGPORT || "5433"),
      database: "easy_auth_test",
      user: "test_user",
      password: "test_password",
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  it("should create and drop tables", async () => {
    const config: AuthConfig = { db: pool, tablePrefix: "schema_test_" };

    await createAuthTables(config);

    const result = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'schema_test_%'");
    const tableNames = result.rows.map((r: any) => r.table_name);

    expect(tableNames).toContain("schema_test_accounts");
    expect(tableNames).toContain("schema_test_confirmations");
    expect(tableNames).toContain("schema_test_remembers");
    expect(tableNames).toContain("schema_test_resets");
    expect(tableNames).toContain("schema_test_providers");
    expect(tableNames).toContain("schema_test_activity_log");
    expect(tableNames).toContain("schema_test_2fa_methods");
    expect(tableNames).toContain("schema_test_2fa_tokens");

    await dropAuthTables(config);

    const afterDrop = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'schema_test_%'");
    expect(afterDrop.rows).toHaveLength(0);
  });

  it("should be idempotent (create twice without error)", async () => {
    const config: AuthConfig = { db: pool, tablePrefix: "idempotent_test_" };

    await createAuthTables(config);
    await createAuthTables(config);

    await dropAuthTables(config);
  });

  it("should cleanup expired tokens", async () => {
    const config: AuthConfig = { db: pool, tablePrefix: "cleanup_test_" };

    await dropAuthTables(config);
    await createAuthTables(config);

    // insert an account and some expired tokens
    await pool.query("INSERT INTO cleanup_test_accounts (user_id, email, password, verified, status, rolemask) VALUES ('u1', 'cleanup@test.com', 'pw', true, 0, 0)");
    const account = await pool.query("SELECT id FROM cleanup_test_accounts LIMIT 1");
    const accountId = account.rows[0].id;

    await pool.query("INSERT INTO cleanup_test_confirmations (account_id, token, email, expires) VALUES ($1, 'expired', 'a@b.c', NOW() - INTERVAL '1 day')", [accountId]);
    await pool.query("INSERT INTO cleanup_test_remembers (account_id, token, expires) VALUES ($1, 'expired', NOW() - INTERVAL '1 day')", [accountId]);
    await pool.query("INSERT INTO cleanup_test_resets (account_id, token, expires) VALUES ($1, 'expired', NOW() - INTERVAL '1 day')", [accountId]);

    await cleanupExpiredTokens(config);

    const confirmations = await pool.query("SELECT * FROM cleanup_test_confirmations");
    const remembers = await pool.query("SELECT * FROM cleanup_test_remembers");
    const resets = await pool.query("SELECT * FROM cleanup_test_resets");

    expect(confirmations.rows).toHaveLength(0);
    expect(remembers.rows).toHaveLength(0);
    expect(resets.rows).toHaveLength(0);

    await dropAuthTables(config);
  });

  it("should return table stats", async () => {
    const config: AuthConfig = { db: pool, tablePrefix: "stats_test_" };

    await dropAuthTables(config);
    await createAuthTables(config);

    await pool.query("INSERT INTO stats_test_accounts (user_id, email, password, verified, status, rolemask) VALUES ('u1', 'stats@test.com', 'pw', true, 0, 0)");

    const stats = await getAuthTableStats(config);

    expect(stats.accounts).toBe(1);
    expect(stats.providers).toBe(0);
    expect(stats.confirmations).toBe(0);

    await dropAuthTables(config);
  });
});

// ---- utility functions ----

describe("Utility functions", () => {
  it("isValidEmail should validate email format", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
    expect(isValidEmail("user@sub.domain.com")).toBe(true);
    expect(isValidEmail("notanemail")).toBe(false);
    expect(isValidEmail("@missing.com")).toBe(false);
    expect(isValidEmail("no@")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });

  it("validateEmail should throw InvalidEmailError for bad emails", () => {
    expect(() => validateEmail("valid@email.com")).not.toThrow();
    expect(() => validateEmail("bad")).toThrow(InvalidEmailError);
    expect(() => validateEmail("")).toThrow(InvalidEmailError);
    expect(() => validateEmail(123 as any)).toThrow(InvalidEmailError);
  });
});

// ---- authenticateRequest ----

describe("authenticateRequest", () => {
  let pool: Pool;
  let authConfig: AuthConfig;

  beforeAll(async () => {
    pool = new Pool({
      host: "localhost",
      port: parseInt(process.env.PGPORT || "5433"),
      database: "easy_auth_test",
      user: "test_user",
      password: "test_password",
    });

    authConfig = {
      db: pool,
      tablePrefix: "authreq_test_",
    };

    await dropAuthTables(authConfig);
    await createAuthTables(authConfig);
  });

  afterAll(async () => {
    await dropAuthTables(authConfig);
    await pool.end();
  });

  beforeEach(async () => {
    await pool.query("DELETE FROM authreq_test_remembers");
    await pool.query("DELETE FROM authreq_test_confirmations");
    await pool.query("DELETE FROM authreq_test_accounts");
  });

  it("should return null when no session or cookie", async () => {
    const req = { headers: {} } as any;
    const result = await authenticateRequest(authConfig, req);

    expect(result.account).toBeNull();
    expect(result.source).toBeNull();
  });

  it("should authenticate via remember token cookie", async () => {
    const { default: hash } = await import("@prsm/hash");

    await pool.query("INSERT INTO authreq_test_accounts (user_id, email, password, verified, status, rolemask) VALUES ('u1', 'auth@test.com', 'pw', true, 0, 0)");
    const account = await pool.query("SELECT id FROM authreq_test_accounts LIMIT 1");
    const accountId = account.rows[0].id;

    const token = await hash.encode("auth@test.com");
    const expires = new Date(Date.now() + 1000 * 60 * 60);

    await pool.query("INSERT INTO authreq_test_remembers (account_id, token, expires) VALUES ($1, $2, $3)", [accountId, token, expires]);

    const req = {
      headers: { cookie: `remember_token=${encodeURIComponent(token)}` },
    } as any;

    const result = await authenticateRequest(authConfig, req);

    expect(result.account).not.toBeNull();
    expect(result.account!.email).toBe("auth@test.com");
    expect(result.source).toBe("remember");
  });

  it("should reject expired remember token", async () => {
    const { default: hash } = await import("@prsm/hash");

    await pool.query("INSERT INTO authreq_test_accounts (user_id, email, password, verified, status, rolemask) VALUES ('u2', 'expired@test.com', 'pw', true, 0, 0)");
    const account = await pool.query("SELECT id FROM authreq_test_accounts WHERE email = 'expired@test.com'");
    const accountId = account.rows[0].id;

    const token = await hash.encode("expired@test.com");
    const expires = new Date(Date.now() - 1000);

    await pool.query("INSERT INTO authreq_test_remembers (account_id, token, expires) VALUES ($1, $2, $3)", [accountId, token, expires]);

    const req = {
      headers: { cookie: `remember_token=${encodeURIComponent(token)}` },
    } as any;

    const result = await authenticateRequest(authConfig, req);
    expect(result.account).toBeNull();
  });

  it("should reject remember token for inactive account", async () => {
    const { default: hash } = await import("@prsm/hash");

    await pool.query("INSERT INTO authreq_test_accounts (user_id, email, password, verified, status, rolemask) VALUES ('u3', 'banned@test.com', 'pw', true, $1, 0)", [AuthStatus.Banned]);
    const account = await pool.query("SELECT id FROM authreq_test_accounts WHERE email = 'banned@test.com'");
    const accountId = account.rows[0].id;

    const token = await hash.encode("banned@test.com");
    const expires = new Date(Date.now() + 1000 * 60 * 60);

    await pool.query("INSERT INTO authreq_test_remembers (account_id, token, expires) VALUES ($1, $2, $3)", [accountId, token, expires]);

    const req = {
      headers: { cookie: `remember_token=${encodeURIComponent(token)}` },
    } as any;

    const result = await authenticateRequest(authConfig, req);
    expect(result.account).toBeNull();
  });
});

// ---- standalone role functions ----

describe("Standalone role functions", () => {
  let pool: Pool;
  let authConfig: AuthConfig;

  beforeAll(async () => {
    pool = new Pool({
      host: "localhost",
      port: parseInt(process.env.PGPORT || "5433"),
      database: "easy_auth_test",
      user: "test_user",
      password: "test_password",
    });

    authConfig = { db: pool, tablePrefix: "rolefn_test_" };
    await dropAuthTables(authConfig);
    await createAuthTables(authConfig);
  });

  afterAll(async () => {
    await dropAuthTables(authConfig);
    await pool.end();
  });

  beforeEach(async () => {
    await pool.query("DELETE FROM rolefn_test_accounts");
  });

  it("should add, get, set, and remove roles", async () => {
    const { addRoleToUser, removeRoleFromUser, setUserRoles, getUserRoles } = await import("../user-roles.js");

    await pool.query("INSERT INTO rolefn_test_accounts (user_id, email, password, verified, status, rolemask) VALUES ('u1', 'role@test.com', 'pw', true, 0, 0)");

    await addRoleToUser(authConfig, { email: "role@test.com" }, AuthRole.Admin);
    expect(await getUserRoles(authConfig, { email: "role@test.com" })).toBe(AuthRole.Admin);

    await addRoleToUser(authConfig, { email: "role@test.com" }, AuthRole.Editor);
    expect(await getUserRoles(authConfig, { email: "role@test.com" })).toBe(AuthRole.Admin | AuthRole.Editor);

    await removeRoleFromUser(authConfig, { email: "role@test.com" }, AuthRole.Admin);
    expect(await getUserRoles(authConfig, { email: "role@test.com" })).toBe(AuthRole.Editor);

    await setUserRoles(authConfig, { email: "role@test.com" }, AuthRole.Moderator | AuthRole.Reviewer);
    expect(await getUserRoles(authConfig, { email: "role@test.com" })).toBe(AuthRole.Moderator | AuthRole.Reviewer);
  });

  it("should throw UserNotFoundError for missing user", async () => {
    const { addRoleToUser } = await import("../user-roles.js");

    await expect(addRoleToUser(authConfig, { email: "nope@test.com" }, AuthRole.Admin)).rejects.toThrow(UserNotFoundError);
  });
});
