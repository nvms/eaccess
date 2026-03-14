import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import type { Application } from "express";
import type { Pool } from "pg";
import { createOAuthTestApp } from "./oauth-test-setup.js";

// mock fetch for OAuth calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("OAuth Integration Tests", () => {
  let app: Application;
  let pool: Pool;
  let cleanup: () => Promise<void>;
  let userIdCounter = 1;

  // mock user database (simulates the app's user table)
  const mockUsers: Array<{ id: number; name: string; email: string }> = [];

  beforeAll(async () => {
    const testApp = await createOAuthTestApp();
    app = testApp.app;
    pool = testApp.pool;
    cleanup = testApp.cleanup;

    // configure OAuth providers and createUser function
    const originalConfig = testApp.authConfig;
    originalConfig.providers = {
      github: {
        clientId: "test-github-client-id",
        clientSecret: "test-github-client-secret",
        redirectUri: "http://localhost:3000/auth/github/callback",
      },
      google: {
        clientId: "test-google-client-id",
        clientSecret: "test-google-client-secret",
        redirectUri: "http://localhost:3000/auth/google/callback",
      },
    };

    originalConfig.createUser = async (userData: any) => {
      const userId = userIdCounter++;
      mockUsers.push({
        id: userId,
        name: userData.name || userData.username,
        email: userData.email,
      });
      return userId.toString();
    };

    app.get("/auth/github", (req, res) => {
      if (!req.auth.providers.github) {
        return res.status(400).json({ error: "GitHub provider not configured" });
      }
      const authUrl = req.auth.providers.github.getAuthUrl();
      res.json({ authUrl });
    });

    app.get("/auth/github/callback", async (req, res) => {
      try {
        if (!req.auth.providers.github) {
          return res.status(400).json({ error: "GitHub provider not configured" });
        }
        await req.auth.providers.github.handleCallback(req);
        res.json({ success: true });
      } catch (error: any) {
        res.status(400).json({ error: error.message });
      }
    });

    app.get("/auth/google", (req, res) => {
      if (!req.auth.providers.google) {
        return res.status(400).json({ error: "Google provider not configured" });
      }
      const authUrl = req.auth.providers.google.getAuthUrl();
      res.json({ authUrl });
    });

    app.get("/auth/google/callback", async (req, res) => {
      try {
        if (!req.auth.providers.google) {
          return res.status(400).json({ error: "Google provider not configured" });
        }
        await req.auth.providers.google.handleCallback(req);
        res.json({ success: true });
      } catch (error: any) {
        res.status(400).json({ error: error.message });
      }
    });
  });

  afterAll(async () => {
    await cleanup();
  });

  beforeEach(async () => {
    await pool.query("DELETE FROM oauth_test_providers");
    await pool.query("DELETE FROM oauth_test_resets");
    await pool.query("DELETE FROM oauth_test_remembers");
    await pool.query("DELETE FROM oauth_test_confirmations");
    await pool.query("DELETE FROM oauth_test_accounts");
    mockUsers.length = 0;
    userIdCounter = 1;
    vi.clearAllMocks();
  });

  describe("GitHub OAuth", () => {
    it("should generate GitHub auth URL", async () => {
      const response = await request(app).get("/auth/github").expect(200);

      expect(response.body.authUrl).toMatch(/^https:\/\/github\.com\/login\/oauth\/authorize/);
      expect(response.body.authUrl).toContain("client_id=test-github-client-id");
      expect(response.body.authUrl).toContain("scope=user%3Aemail");
    });

    it("should handle GitHub OAuth callback for new user", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "github-access-token",
          }),
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 12345,
              login: "testuser",
              name: "Test User",
              avatar_url: "https://github.com/avatar.jpg",
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                email: "testuser@example.com",
                primary: true,
                verified: true,
              },
            ]),
        });

      const agent = request.agent(app);

      const response = await agent.get("/auth/github/callback").query({ code: "github-auth-code" }).expect(200);

      expect(response.body.success).toBe(true);

      expect(mockUsers).toHaveLength(1);
      expect(mockUsers[0]).toEqual({
        id: 1,
        name: "Test User",
        email: "testuser@example.com",
      });

      const accounts = await pool.query("SELECT * FROM oauth_test_accounts");
      expect(accounts.rows).toHaveLength(1);
      expect(accounts.rows[0].email).toBe("testuser@example.com");
      expect(accounts.rows[0].password).toBeNull();
      expect(accounts.rows[0].verified).toBe(true);

      const providers = await pool.query("SELECT * FROM oauth_test_providers");
      expect(providers.rows).toHaveLength(1);
      expect(providers.rows[0].provider).toBe("github");
      expect(providers.rows[0].provider_id).toBe("12345");
      expect(providers.rows[0].provider_email).toBe("testuser@example.com");
      expect(providers.rows[0].provider_username).toBe("testuser");

      const profileResponse = await agent.get("/profile").expect(200);
      expect(profileResponse.body.email).toBe("testuser@example.com");
    });

    it("should handle GitHub OAuth callback for existing OAuth user", async () => {
      const agent = request.agent(app);
      await agent.post("/set-user-session").send({ userId: "existing-user" });

      const existingUser = {
        id: 999,
        name: "Existing User",
        email: "existing@example.com",
      };
      mockUsers.push(existingUser);

      const account = await pool.query(
        `INSERT INTO oauth_test_accounts (user_id, email, password, verified, status, rolemask) 
         VALUES ($1, $2, NULL, true, 0, 0) RETURNING *`,
        [existingUser.id, existingUser.email],
      );

      await pool.query(
        `INSERT INTO oauth_test_providers (account_id, provider, provider_id, provider_email, provider_username) 
         VALUES ($1, 'github', '12345', $2, 'existinguser')`,
        [account.rows[0].id, existingUser.email],
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: "github-access-token" }),
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 12345,
              login: "existinguser",
              name: "Existing User",
              avatar_url: "https://github.com/avatar.jpg",
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([{ email: "existing@example.com", primary: true, verified: true }]),
        });

      const response = await agent.get("/auth/github/callback").query({ code: "github-auth-code" }).expect(200);

      expect(response.body.success).toBe(true);

      expect(mockUsers).toHaveLength(1);

      const profileResponse = await agent.get("/profile").expect(200);
      expect(profileResponse.body.email).toBe("existing@example.com");
    });

    it("should reject GitHub OAuth when email already exists with different provider", async () => {
      const agent = request.agent(app);
      await agent.post("/set-user-session").send({ userId: "test-user-123" });

      await agent.post("/register").send({
        email: "conflict@example.com",
        password: "password123",
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: "github-access-token" }),
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 54321,
              login: "conflictuser",
              name: "Conflict User",
              avatar_url: "https://github.com/avatar.jpg",
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([{ email: "conflict@example.com", primary: true, verified: true }]),
        });

      const response = await agent.get("/auth/github/callback").query({ code: "github-auth-code" }).expect(400);

      expect(response.body.error).toContain("already have an account");
    });

    it("should handle GitHub API errors gracefully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
      });

      const response = await request(app).get("/auth/github/callback").query({ code: "invalid-code" }).expect(400);

      expect(response.body.error).toContain("OAuth token exchange failed");
    });
  });

  describe("Google OAuth", () => {
    it("should generate Google auth URL", async () => {
      const response = await request(app).get("/auth/google").expect(200);

      expect(response.body.authUrl).toMatch(/^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth/);
      expect(response.body.authUrl).toContain("client_id=test-google-client-id");
      expect(response.body.authUrl).toContain("scope=openid+profile+email");
    });

    it("should handle Google OAuth callback for new user", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "google-access-token",
          }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "google-user-123",
            email: "googleuser@example.com",
            name: "Google User",
            picture: "https://google.com/avatar.jpg",
          }),
      });

      const agent = request.agent(app);

      const response = await agent.get("/auth/google/callback").query({ code: "google-auth-code" }).expect(200);

      expect(response.body.success).toBe(true);

      expect(mockUsers).toHaveLength(1);
      expect(mockUsers[0].email).toBe("googleuser@example.com");

      const providers = await pool.query("SELECT * FROM oauth_test_providers");
      expect(providers.rows).toHaveLength(1);
      expect(providers.rows[0].provider).toBe("google");
      expect(providers.rows[0].provider_id).toBe("google-user-123");
    });
  });

  describe("OAuth Error Handling", () => {
    it("should handle missing authorization code", async () => {
      const response = await request(app).get("/auth/github/callback").expect(400);

      expect(response.body.error).toContain("No authorization code provided");
    });

    it("should handle missing createUser function by auto-generating UUID", async () => {
      const testAppWithoutCreateUser = await createOAuthTestApp();
      const appWithoutCreateUser = testAppWithoutCreateUser.app;

      const configWithoutCreateUser = (testAppWithoutCreateUser as any).authConfig;
      // Remove createUser to test auto-UUID generation
      delete configWithoutCreateUser.createUser;
      configWithoutCreateUser.providers = {
        github: {
          clientId: "test-github-client-id",
          clientSecret: "test-github-client-secret",
          redirectUri: "http://localhost:3000/auth/github/callback",
        },
      };

      appWithoutCreateUser.get("/auth/github/callback", async (req, res) => {
        try {
          if (!req.auth.providers.github) {
            return res.status(400).json({ error: "GitHub provider not configured" });
          }
          await req.auth.providers.github.handleCallback(req);
          res.json({ success: true });
        } catch (error: any) {
          res.status(400).json({ error: error.message });
        }
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: "github-access-token" }),
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 99999,
              login: "newuser",
              name: "New User",
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([{ email: "newuser@example.com", primary: true, verified: true }]),
        });

      const response = await request(appWithoutCreateUser).get("/auth/github/callback").query({ code: "github-auth-code" }).expect(200);

      expect(response.body.success).toBe(true);

      await testAppWithoutCreateUser.cleanup();
    });
  });

  describe("Provider Integration", () => {
    it("should have providers available on auth object", async () => {
      const agent = request.agent(app);

      // this is tested indirectly by the successful OAuth flows above,
      // but we can verify the providers are initialized
      const githubResponse = await agent.get("/auth/github");
      expect(githubResponse.status).toBe(200);
      expect(githubResponse.body.authUrl).toBeDefined();

      const googleResponse = await agent.get("/auth/google");
      expect(googleResponse.status).toBe(200);
      expect(googleResponse.body.authUrl).toBeDefined();
    });
  });
});
