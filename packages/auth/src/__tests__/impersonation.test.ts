import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import type { Application } from "express";
import type { Pool } from "pg";
import { createImpersonationTestApp } from "./impersonation-test-setup.js";
import { AuthRole, AuthStatus } from "../index.js";

describe("Impersonation", () => {
  describe("with default admin-only policy", () => {
    let app: Application;
    let pool: Pool;
    let cleanup: () => Promise<void>;

    beforeAll(async () => {
      const t = await createImpersonationTestApp();
      app = t.app;
      pool = t.pool;
      cleanup = t.cleanup;
    });

    afterAll(async () => {
      await cleanup();
    });

    beforeEach(async () => {
      await pool.query("DELETE FROM imp_activity_log");
      await pool.query("DELETE FROM imp_accounts");
    });

    async function setupAdminAndTarget(agent: any) {
      // create an admin
      await request(app).post("/register").send({ email: "admin@example.com", password: "password123" });
      const adminRow = (await pool.query(`SELECT id FROM imp_accounts WHERE email = $1`, ["admin@example.com"])).rows[0];
      await pool.query(`UPDATE imp_accounts SET rolemask = $1 WHERE id = $2`, [AuthRole.Admin, adminRow.id]);

      // create a target
      await request(app).post("/register").send({ email: "target@example.com", password: "password123" });
      const targetRow = (await pool.query(`SELECT id FROM imp_accounts WHERE email = $1`, ["target@example.com"])).rows[0];

      await agent.post("/login").send({ email: "admin@example.com", password: "password123" }).expect(200);
      return { adminId: adminRow.id, targetId: targetRow.id };
    }

    it("starts impersonation, swaps effective identity, preserves actor", async () => {
      const agent = request.agent(app);
      const { adminId, targetId } = await setupAdminAndTarget(agent);

      const me1 = await agent.get("/me");
      expect(me1.body.email).toBe("admin@example.com");
      expect(me1.body.isImpersonating).toBe(false);

      const res = await agent.post("/impersonate/start").send({ identifier: { email: "target@example.com" }, reason: "support ticket #42" });
      expect(res.status).toBe(200);

      const me2 = await agent.get("/me");
      expect(me2.body.id).toBe(targetId);
      expect(me2.body.email).toBe("target@example.com");
      expect(me2.body.isImpersonating).toBe(true);
      expect(me2.body.actorId).toBe(adminId);
      expect(me2.body.actorEmail).toBe("admin@example.com");
      expect(me2.body.impersonation.reason).toBe("support ticket #42");
      expect(me2.body.impersonation.actor.email).toBe("admin@example.com");
      expect(me2.body.impersonation.target.email).toBe("target@example.com");
    });

    it("regenerates session id on start and on stop", async () => {
      const agent = request.agent(app);
      await setupAdminAndTarget(agent);

      const beforeStart = agent.jar.getCookie("connect.sid", { path: "/", domain: "127.0.0.1", script: false } as any)?.value;
      await agent.post("/impersonate/start").send({ identifier: { email: "target@example.com" } }).expect(200);
      const afterStart = agent.jar.getCookie("connect.sid", { path: "/", domain: "127.0.0.1", script: false } as any)?.value;
      expect(afterStart).toBeTruthy();
      expect(afterStart).not.toBe(beforeStart);

      await agent.post("/impersonate/stop").expect(200);
      const afterStop = agent.jar.getCookie("connect.sid", { path: "/", domain: "127.0.0.1", script: false } as any)?.value;
      expect(afterStop).toBeTruthy();
      expect(afterStop).not.toBe(afterStart);
    });

    it("stops impersonation and reverts to actor", async () => {
      const agent = request.agent(app);
      const { adminId } = await setupAdminAndTarget(agent);
      await agent.post("/impersonate/start").send({ identifier: { email: "target@example.com" } });

      const stop = await agent.post("/impersonate/stop");
      expect(stop.status).toBe(200);

      const me = await agent.get("/me");
      expect(me.body.id).toBe(adminId);
      expect(me.body.email).toBe("admin@example.com");
      expect(me.body.isImpersonating).toBe(false);
      expect(me.body.actorId).toBeNull();
    });

    it("rejects nested impersonation", async () => {
      const agent = request.agent(app);
      await setupAdminAndTarget(agent);
      await request(app).post("/register").send({ email: "second@example.com", password: "password123" });

      await agent.post("/impersonate/start").send({ identifier: { email: "target@example.com" } }).expect(200);
      const res = await agent.post("/impersonate/start").send({ identifier: { email: "second@example.com" } });
      expect(res.status).toBe(400);
      expect(res.body.errorType).toBe("AlreadyImpersonatingError");
    });

    it("rejects self-impersonation", async () => {
      const agent = request.agent(app);
      await setupAdminAndTarget(agent);
      const res = await agent.post("/impersonate/start").send({ identifier: { email: "admin@example.com" } });
      expect(res.status).toBe(400);
      expect(res.body.errorType).toBe("ImpersonationNotAllowedError");
    });

    it("rejects when policy denies", async () => {
      // unauthenticated user can be logged in as non-admin and try to impersonate
      await request(app).post("/register").send({ email: "nobody@example.com", password: "password123" });
      const agent = request.agent(app);
      await agent.post("/login").send({ email: "nobody@example.com", password: "password123" }).expect(200);
      await request(app).post("/register").send({ email: "victim@example.com", password: "password123" });

      const res = await agent.post("/impersonate/start").send({ identifier: { email: "victim@example.com" } });
      expect(res.status).toBe(400);
      expect(res.body.errorType).toBe("ImpersonationNotAllowedError");

      const rejected = await request(app).get("/activity/impersonation_rejected");
      expect(rejected.body.length).toBeGreaterThan(0);
      expect(rejected.body[0].success).toBe(false);
    });

    it("requires login", async () => {
      const agent = request.agent(app);
      await request(app).post("/register").send({ email: "anon@example.com", password: "password123" });
      const res = await agent.post("/impersonate/start").send({ identifier: { email: "anon@example.com" } });
      expect(res.status).toBe(400);
      expect(res.body.errorType).toBe("UserNotLoggedInError");
    });

    it("requires the target to exist", async () => {
      const agent = request.agent(app);
      await setupAdminAndTarget(agent);
      const res = await agent.post("/impersonate/start").send({ identifier: { email: "ghost@example.com" } });
      expect(res.status).toBe(400);
      expect(res.body.errorType).toBe("UserNotFoundError");
    });

    it("stop fails when not impersonating", async () => {
      const agent = request.agent(app);
      await setupAdminAndTarget(agent);
      const res = await agent.post("/impersonate/stop");
      expect(res.status).toBe(400);
      expect(res.body.errorType).toBe("NotImpersonatingError");
    });

    it("logs ImpersonationStarted with actor_account_id = admin and account_id = target", async () => {
      const agent = request.agent(app);
      const { adminId, targetId } = await setupAdminAndTarget(agent);
      await agent.post("/impersonate/start").send({ identifier: { email: "target@example.com" }, reason: "audit" });

      const rows = (await request(app).get("/activity/impersonation_started")).body;
      expect(rows.length).toBe(1);
      expect(rows[0].account_id).toBe(targetId);
      expect(rows[0].actor_account_id).toBe(adminId);
      expect(rows[0].metadata.reason).toBe("audit");
    });

    it("all activity emitted during impersonation carries actor_account_id automatically", async () => {
      const agent = request.agent(app);
      const { adminId, targetId } = await setupAdminAndTarget(agent);
      await agent.post("/impersonate/start").send({ identifier: { email: "target@example.com" } });

      // perform an action that emits activity through the normal logActivity path
      await agent.post("/logout"); // this logs a Logout activity for target

      const logoutRows = (await request(app).get("/activity/logout")).body;
      expect(logoutRows.length).toBe(1);
      expect(logoutRows[0].account_id).toBe(targetId);
      expect(logoutRows[0].actor_account_id).toBe(adminId);
    });

    it("logs ImpersonationStopped on manual stop", async () => {
      const agent = request.agent(app);
      const { adminId, targetId } = await setupAdminAndTarget(agent);
      await agent.post("/impersonate/start").send({ identifier: { email: "target@example.com" } });
      await agent.post("/impersonate/stop");

      const rows = (await request(app).get("/activity/impersonation_stopped")).body;
      expect(rows.length).toBe(1);
      expect(rows[0].account_id).toBe(targetId);
      expect(rows[0].actor_account_id).toBe(adminId);
      expect(rows[0].metadata.cause).toBe("manual");
    });

    it("target force-logout does not kick the impersonator", async () => {
      const agent = request.agent(app);
      await setupAdminAndTarget(agent);
      await agent.post("/impersonate/start").send({ identifier: { email: "target@example.com" } });

      // increment target's force_logout via raw SQL (simulates another admin doing it)
      await pool.query(`UPDATE imp_accounts SET force_logout = force_logout + 1 WHERE email = $1`, ["target@example.com"]);

      await agent.post("/force-resync").expect(200);

      const me = await agent.get("/me");
      expect(me.status).toBe(200);
      expect(me.body.isImpersonating).toBe(true);
      expect(me.body.email).toBe("target@example.com");
    });

    it("actor force-logout terminates the impersonation session entirely", async () => {
      const agent = request.agent(app);
      await setupAdminAndTarget(agent);
      await agent.post("/impersonate/start").send({ identifier: { email: "target@example.com" } });

      await pool.query(`UPDATE imp_accounts SET force_logout = force_logout + 1 WHERE email = $1`, ["admin@example.com"]);
      await agent.post("/force-resync").expect(200);

      const me = await agent.get("/me");
      expect(me.status).toBe(401);
    });

    it("actor account deletion mid-impersonation logs out entirely", async () => {
      const agent = request.agent(app);
      const { adminId } = await setupAdminAndTarget(agent);
      await agent.post("/impersonate/start").send({ identifier: { email: "target@example.com" } });

      await pool.query(`DELETE FROM imp_accounts WHERE id = $1`, [adminId]);
      await agent.post("/force-resync").expect(200);

      const me = await agent.get("/me");
      expect(me.status).toBe(401);
    });

    it("target deleted mid-impersonation reverts to actor", async () => {
      const agent = request.agent(app);
      const { adminId, targetId } = await setupAdminAndTarget(agent);
      await agent.post("/impersonate/start").send({ identifier: { email: "target@example.com" } });

      await pool.query(`DELETE FROM imp_accounts WHERE id = $1`, [targetId]);
      await agent.post("/force-resync").expect(200);

      const me = await agent.get("/me");
      expect(me.status).toBe(200);
      expect(me.body.id).toBe(adminId);
      expect(me.body.isImpersonating).toBe(false);
    });

    it("target status changes are reflected in effective identity", async () => {
      const agent = request.agent(app);
      await setupAdminAndTarget(agent);
      await agent.post("/impersonate/start").send({ identifier: { email: "target@example.com" } });

      await pool.query(`UPDATE imp_accounts SET status = $1 WHERE email = $2`, [AuthStatus.Suspended, "target@example.com"]);
      await agent.post("/force-resync").expect(200);

      const me = await agent.get("/me");
      expect(me.body.status).toBe(AuthStatus.Suspended);
      expect(me.body.isImpersonating).toBe(true);
    });

    it("force-logging-out the target while impersonating does not kick the impersonator", async () => {
      const agent = request.agent(app);
      await setupAdminAndTarget(agent);
      await agent.post("/impersonate/start").send({ identifier: { email: "target@example.com" } });

      // admin force-logs-out the target as part of normal admin work while impersonating.
      // the impersonation session is owned by the actor and must survive this.
      await agent.post("/admin/force-logout").send({ email: "target@example.com" }).expect(200);
      await agent.post("/force-resync").expect(200);

      const me = await agent.get("/me");
      expect(me.status).toBe(200);
      expect(me.body.isImpersonating).toBe(true);
      expect(me.body.email).toBe("target@example.com");
    });

    it("force-logging-out the actor while impersonating kills the session", async () => {
      const agent = request.agent(app);
      await setupAdminAndTarget(agent);
      await agent.post("/impersonate/start").send({ identifier: { email: "target@example.com" } });

      // the admin force-logs-out themselves (e.g. via another admin tool, or revoking their own token)
      // this SHOULD propagate. shouldForceLogout is set, next resync logs out fully.
      await agent.post("/admin/force-logout").send({ email: "admin@example.com" }).expect(200);
      await agent.post("/force-resync").expect(200);

      const me = await agent.get("/me");
      expect(me.status).toBe(401);
    });

    it("on-behalf-of: changeEmail during impersonation operates on the target", async () => {
      const agent = request.agent(app);
      await setupAdminAndTarget(agent);
      await agent.post("/impersonate/start").send({ identifier: { email: "target@example.com" } });

      // admin acting on the user's behalf to start an email change.
      // confirmation token is issued for the target.
      const res = await agent.post("/change-email").send({ newEmail: "target-new@example.com" });
      expect(res.status).toBe(200);
      expect(res.body.confirmationToken).toBeTruthy();

      // confirm the token while impersonating - target's email should change, NOT admin's
      await agent.post("/confirm-email").send({ token: res.body.confirmationToken }).expect(200);

      const admin = (await pool.query(`SELECT email FROM imp_accounts WHERE id = $1`, [(await pool.query(`SELECT id FROM imp_accounts WHERE email = $1`, ["admin@example.com"])).rows[0].id])).rows[0];
      const target = (await pool.query(`SELECT email FROM imp_accounts WHERE email = $1`, ["target-new@example.com"])).rows[0];
      expect(admin.email).toBe("admin@example.com");
      expect(target).toBeTruthy();
    });

    it("does not create a remember token while impersonating", async () => {
      const agent = request.agent(app);
      await setupAdminAndTarget(agent);
      await agent.post("/impersonate/start").send({ identifier: { email: "target@example.com" } });

      const remembers = await pool.query(`SELECT * FROM imp_remembers`);
      expect(remembers.rows.length).toBe(0);
    });
  });

  describe("ttl-based expiry", () => {
    let app: Application;
    let pool: Pool;
    let cleanup: () => Promise<void>;

    beforeAll(async () => {
      const t = await createImpersonationTestApp({
        defaultTtl: "10s",
        canImpersonate: async () => true,
      });
      app = t.app;
      pool = t.pool;
      cleanup = t.cleanup;
    });

    afterAll(async () => {
      await cleanup();
    });

    beforeEach(async () => {
      await pool.query("DELETE FROM imp_activity_log");
      await pool.query("DELETE FROM imp_accounts");
    });

    it("auto-reverts to actor on resync when expiresAt has passed", async () => {
      await request(app).post("/register").send({ email: "a@example.com", password: "password123" });
      await request(app).post("/register").send({ email: "b@example.com", password: "password123" });
      const agent = request.agent(app);
      await agent.post("/login").send({ email: "a@example.com", password: "password123" });

      await agent.post("/impersonate/start").send({ identifier: { email: "b@example.com" }, ttl: "50ms" }).expect(200);

      const me1 = await agent.get("/me");
      expect(me1.body.isImpersonating).toBe(true);

      await new Promise((r) => setTimeout(r, 100));
      await agent.post("/force-resync").expect(200);

      const me2 = await agent.get("/me");
      expect(me2.body.isImpersonating).toBe(false);
      expect(me2.body.email).toBe("a@example.com");

      const expired = (await request(app).get("/activity/impersonation_expired")).body;
      expect(expired.length).toBe(1);
      expect(expired[0].metadata.cause).toBe("expired");
    });

    it("maxTtl caps a longer caller-provided ttl", async () => {
      await cleanup();
      const t = await createImpersonationTestApp({
        maxTtl: "100ms",
        canImpersonate: async () => true,
      });
      app = t.app;
      pool = t.pool;
      cleanup = t.cleanup;

      await request(app).post("/register").send({ email: "a@example.com", password: "password123" });
      await request(app).post("/register").send({ email: "b@example.com", password: "password123" });
      const agent = request.agent(app);
      await agent.post("/login").send({ email: "a@example.com", password: "password123" });

      // ask for 10s, will be capped to 100ms
      await agent.post("/impersonate/start").send({ identifier: { email: "b@example.com" }, ttl: "10s" }).expect(200);

      await new Promise((r) => setTimeout(r, 200));
      await agent.post("/force-resync");
      const me = await agent.get("/me");
      expect(me.body.isImpersonating).toBe(false);
    });
  });

  describe("canImpersonate hook errors", () => {
    let app: Application;
    let pool: Pool;
    let cleanup: () => Promise<void>;

    beforeAll(async () => {
      const t = await createImpersonationTestApp({
        canImpersonate: async () => {
          throw new Error("tenant lookup failed");
        },
      });
      app = t.app;
      pool = t.pool;
      cleanup = t.cleanup;
    });

    afterAll(async () => {
      await cleanup();
    });

    beforeEach(async () => {
      await pool.query("DELETE FROM imp_activity_log");
      await pool.query("DELETE FROM imp_accounts");
    });

    it("fails closed when the policy hook throws", async () => {
      await request(app).post("/register").send({ email: "a@example.com", password: "password123" });
      await request(app).post("/register").send({ email: "b@example.com", password: "password123" });
      const agent = request.agent(app);
      await agent.post("/login").send({ email: "a@example.com", password: "password123" });

      const res = await agent.post("/impersonate/start").send({ identifier: { email: "b@example.com" } });
      expect(res.status).toBe(400);
      expect(res.body.errorType).toBe("ImpersonationNotAllowedError");

      // session is unchanged
      const me = await agent.get("/me");
      expect(me.body.email).toBe("a@example.com");
      expect(me.body.isImpersonating).toBe(false);

      // the failure is recorded with the underlying error message for diagnosis
      const rejected = (await request(app).get("/activity/impersonation_rejected")).body;
      expect(rejected.length).toBe(1);
      expect(rejected[0].success).toBe(false);
      expect(rejected[0].metadata.reason).toBe("policy_error");
      expect(rejected[0].metadata.policyError).toBe("tenant lookup failed");
    });
  });

  describe("when impersonation is disabled", () => {
    let app: Application;
    let pool: Pool;
    let cleanup: () => Promise<void>;

    beforeAll(async () => {
      const t = await createImpersonationTestApp({ enabled: false });
      app = t.app;
      pool = t.pool;
      cleanup = t.cleanup;
    });

    afterAll(async () => {
      await cleanup();
    });

    beforeEach(async () => {
      await pool.query("DELETE FROM imp_activity_log");
      await pool.query("DELETE FROM imp_accounts");
    });

    it("rejects startImpersonation entirely", async () => {
      await request(app).post("/register").send({ email: "a@example.com", password: "password123" });
      await request(app).post("/register").send({ email: "b@example.com", password: "password123" });
      const agent = request.agent(app);
      await agent.post("/login").send({ email: "a@example.com", password: "password123" });

      const res = await agent.post("/impersonate/start").send({ identifier: { email: "b@example.com" } });
      expect(res.status).toBe(400);
      expect(res.body.errorType).toBe("ImpersonationDisabledError");
    });
  });
});
