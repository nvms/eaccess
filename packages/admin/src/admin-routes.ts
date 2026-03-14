import express from "express";
import type { AuthConfig } from "@eaccess/auth";
import { TwoFactorManager, AuthRole, TotpProvider } from "@eaccess/auth";
import crypto from "crypto";

/**
 * Middleware to check admin access
 */
export const createRequireAdmin = () => async (req: any, res: any, next: any) => {
  try {
    if (!req.auth?.isLoggedIn()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!(await req.auth.isAdmin())) {
      return res.status(403).json({ error: "Admin access required" });
    }

    next();
  } catch (error) {
    res.status(500).json({ error: "Authentication check failed" });
  }
};

/**
 * User agent parsing utility
 */
function parseUserAgent(userAgent: string | undefined) {
  if (!userAgent) {
    return { browser: null, os: null, device: null };
  }

  let browser = null;
  if (userAgent.includes("Chrome")) browser = "Chrome";
  else if (userAgent.includes("Firefox")) browser = "Firefox";
  else if (userAgent.includes("Safari")) browser = "Safari";
  else if (userAgent.includes("Edge")) browser = "Edge";

  let os = null;
  if (userAgent.includes("Windows")) os = "Windows";
  else if (userAgent.includes("Mac OS")) os = "macOS";
  else if (userAgent.includes("Linux")) os = "Linux";
  else if (userAgent.includes("Android")) os = "Android";
  else if (userAgent.includes("iOS")) os = "iOS";

  let device = "desktop";
  if (userAgent.includes("Mobile")) device = "mobile";
  else if (userAgent.includes("Tablet")) device = "tablet";

  return { browser, os, device };
}

/**
 * Create admin API routes that can be shared between dev-server and middleware
 */
export function createAdminRoutes(authConfig: AuthConfig) {
  const router = express.Router();
  const requireAdmin = createRequireAdmin();

  // Apply admin check to all routes
  router.use(requireAdmin);

  const roles = authConfig.roles || AuthRole;

  router.get("/roles", (_req: any, res: any) => {
    res.json(roles);
  });

  // Search users
  router.get("/users/search", async (req: any, res: any) => {
    try {
      const { q } = req.query;

      if (!q || typeof q !== "string" || q.trim().length === 0) {
        return res.json([]);
      }

      const searchTerm = q.trim();
      const prefix = authConfig.tablePrefix || "user_";

      // Search across email, user_id, and id fields (case insensitive)
      const searchQuery = `
        SELECT
          a.id,
          a.user_id,
          a.email,
          a.verified,
          a.status,
          a.rolemask,
          a.last_login,
          a.registered,
          a.resettable
        FROM ${prefix}accounts a
        WHERE
          LOWER(a.email) LIKE LOWER($1) OR
          LOWER(a.user_id) LIKE LOWER($1) OR
          CAST(a.id AS TEXT) LIKE $1
        ORDER BY
          CASE
            WHEN LOWER(a.email) = LOWER($2) THEN 1
            WHEN LOWER(a.user_id) = LOWER($2) THEN 2
            WHEN CAST(a.id AS TEXT) = $2 THEN 3
            WHEN LOWER(a.email) LIKE LOWER($3) THEN 4
            WHEN LOWER(a.user_id) LIKE LOWER($3) THEN 5
            ELSE 6
          END,
          a.email
        LIMIT 20
      `;

      const likePattern = `%${searchTerm}%`;
      const startsWithPattern = `${searchTerm}%`;

      const accountsResult = await authConfig.db.query(searchQuery, [
        likePattern, // $1 - for LIKE searches
        searchTerm, // $2 - for exact matches (highest priority)
        startsWithPattern, // $3 - for starts-with matches (high priority)
      ]);

      if (accountsResult.rows.length === 0) {
        return res.json([]);
      }

      const accountIds = accountsResult.rows.map((account: any) => account.id);

      // Get related data for the found accounts
      const [providersResult, mfaResult] = await Promise.all([
        authConfig.db.query(`SELECT account_id, provider, provider_name FROM ${prefix}providers WHERE account_id = ANY($1)`, [accountIds]),
        authConfig.db.query(`SELECT account_id, id, mechanism, verified, created_at FROM ${prefix}2fa_methods WHERE account_id = ANY($1)`, [accountIds]),
      ]);

      // Build the response with associated data
      const users = accountsResult.rows.map((account: any) => ({
        id: account.id,
        user_id: account.user_id,
        email: account.email,
        verified: account.verified,
        status: account.status,
        rolemask: account.rolemask,
        last_login: account.last_login,
        registered: account.registered,
        resettable: account.resettable,
        providers: providersResult.rows
          .filter((p: any) => p.account_id === account.id)
          .map((p: any) => ({
            provider: p.provider,
            provider_name: p.provider_name,
          })),
        mfa_methods: mfaResult.rows
          .filter((m: any) => m.account_id === account.id)
          .map((m: any) => ({
            id: m.id,
            mechanism: m.mechanism,
            verified: m.verified,
            created_at: m.created_at,
          })),
      }));

      res.json(users);
    } catch (error) {
      console.error("User search error:", error);
      res.status(500).json({ error: "Failed to search users" });
    }
  });

  // Get all users with auth data
  router.get("/users", async (req: any, res: any) => {
    try {
      const prefix = authConfig.tablePrefix || "user_";

      // Parse pagination
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
      const offset = (page - 1) * limit;

      // Parse filter parameters
      const { roles, mfa, status, providers } = req.query;

      const whereConditions = [];
      const queryParams: any[] = [];
      let paramIndex = 1;

      // Role filter - check if rolemask includes any of the specified roles
      if (roles) {
        const roleArray = roles
          .split(",")
          .map((r: string) => parseInt(r))
          .filter((r: number) => !isNaN(r));
        if (roleArray.length > 0) {
          const roleConditions = roleArray.map(() => `(a.rolemask & $${paramIndex++}) > 0`);
          whereConditions.push(`(${roleConditions.join(" OR ")})`);
          queryParams.push(...roleArray);
        }
      }

      // Status filter
      if (status) {
        const statusArray = status
          .split(",")
          .map((s: string) => parseInt(s))
          .filter((s: number) => !isNaN(s));
        if (statusArray.length > 0) {
          const statusPlaceholders = statusArray.map(() => `$${paramIndex++}`);
          whereConditions.push(`a.status IN (${statusPlaceholders.join(", ")})`);
          queryParams.push(...statusArray);
        }
      }

      // MFA filter
      let mfaJoin = "";
      if (mfa) {
        mfaJoin = `LEFT JOIN ${prefix}2fa_methods mfa ON a.id = mfa.account_id AND mfa.verified = true`;
        if (mfa === "enabled") {
          whereConditions.push("mfa.account_id IS NOT NULL");
        } else if (mfa === "disabled") {
          whereConditions.push("mfa.account_id IS NULL");
        }
      }

      // Provider filter
      let providerJoin = "";
      if (providers) {
        const providerArray = providers.split(",").map((p: string) => p.trim());
        providerJoin = `LEFT JOIN ${prefix}providers prov ON a.id = prov.account_id`;

        const providerConditions = [];
        for (const provider of providerArray) {
          if (provider === "email_password") {
            providerConditions.push("prov.account_id IS NULL");
          } else {
            providerConditions.push(`prov.provider = $${paramIndex++}`);
            queryParams.push(provider);
          }
        }
        if (providerConditions.length > 0) {
          whereConditions.push(`(${providerConditions.join(" OR ")})`);
        }
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

      // Get total count for pagination
      const countResult = await authConfig.db.query(
        `SELECT COUNT(DISTINCT a.id) as total FROM ${prefix}accounts a ${mfaJoin} ${providerJoin} ${whereClause}`,
        queryParams,
      );
      const total = parseInt(countResult.rows[0]?.total || "0");

      // Get paginated accounts
      const paginatedParams = [...queryParams, limit, offset];
      const accountsResult = await authConfig.db.query(
        `
        SELECT DISTINCT
          a.id,
          a.user_id,
          a.email,
          a.verified,
          a.status,
          a.rolemask,
          a.last_login,
          a.registered,
          a.resettable
        FROM ${prefix}accounts a
        ${mfaJoin}
        ${providerJoin}
        ${whereClause}
        ORDER BY a.registered DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `,
        paginatedParams,
      );

      if (accountsResult.rows.length === 0) {
        return res.json({ users: [], total, page, limit, pages: Math.ceil(total / limit) });
      }

      // Scope related data queries to only the returned accounts
      const accountIds = accountsResult.rows.map((a: any) => a.id);
      const [providersResult, confirmationsResult, resetsResult, remembersResult, mfaResult] = await Promise.all([
        authConfig.db.query(`SELECT account_id, provider, provider_name FROM ${prefix}providers WHERE account_id = ANY($1)`, [accountIds]),
        authConfig.db.query(`SELECT account_id, expires FROM ${prefix}confirmations WHERE account_id = ANY($1) AND expires > NOW()`, [accountIds]),
        authConfig.db.query(`SELECT account_id, expires FROM ${prefix}resets WHERE account_id = ANY($1) AND expires > NOW()`, [accountIds]),
        authConfig.db.query(`SELECT account_id, expires FROM ${prefix}remembers WHERE account_id = ANY($1) AND expires > NOW()`, [accountIds]),
        authConfig.db.query(`SELECT account_id, id, mechanism, verified, created_at FROM ${prefix}2fa_methods WHERE account_id = ANY($1)`, [accountIds]),
      ]);

      // Create users map with basic account data
      const users = accountsResult.rows.map((account: any) => ({
        id: account.id,
        user_id: account.user_id,
        email: account.email,
        verified: account.verified,
        status: account.status,
        rolemask: account.rolemask,
        last_login: account.last_login,
        registered: account.registered,
        resettable: account.resettable,
        providers: [],
        confirmation_tokens: [],
        reset_tokens: [],
        remember_tokens: [],
        mfa_methods: [],
      }));

      // Create lookup map for efficient data association
      const usersMap = new Map(users.map((user: any) => [user.id, user]));

      // Associate providers
      providersResult.rows.forEach((provider: any) => {
        const user = usersMap.get(provider.account_id);
        if (user) {
          user.providers.push({
            provider: provider.provider,
            provider_name: provider.provider_name,
          });
        }
      });

      // Associate confirmation tokens
      confirmationsResult.rows.forEach((token: any) => {
        const user = usersMap.get(token.account_id);
        if (user) {
          user.confirmation_tokens.push({
            expires: token.expires,
          });
        }
      });

      // Associate reset tokens
      resetsResult.rows.forEach((token: any) => {
        const user = usersMap.get(token.account_id);
        if (user) {
          user.reset_tokens.push({
            expires: token.expires,
          });
        }
      });

      // Associate remember tokens
      remembersResult.rows.forEach((token: any) => {
        const user = usersMap.get(token.account_id);
        if (user) {
          user.remember_tokens.push({
            expires: token.expires,
          });
        }
      });

      // Associate MFA methods
      mfaResult.rows.forEach((method: any) => {
        const user = usersMap.get(method.account_id);
        if (user) {
          user.mfa_methods.push({
            id: method.id,
            mechanism: method.mechanism,
            verified: method.verified,
            created_at: method.created_at,
          });
        }
      });

      res.json({ users, total, page, limit, pages: Math.ceil(total / limit) });
    } catch (error) {
      console.error("Users error:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Get user by ID
  router.get("/users/:id", async (req: any, res: any) => {
    try {
      const prefix = authConfig.tablePrefix || "user_";
      const userId = parseInt(req.params.id);

      // Get basic account data
      const accountResult = await authConfig.db.query(`SELECT * FROM ${prefix}accounts WHERE id = $1`, [userId]);

      if (accountResult.rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      const account = accountResult.rows[0];

      // Get related data
      const [providersResult, confirmationsResult, resetsResult, remembersResult, mfaResult] = await Promise.all([
        authConfig.db.query(`SELECT provider, provider_name FROM ${prefix}providers WHERE account_id = $1`, [userId]),
        authConfig.db.query(`SELECT expires FROM ${prefix}confirmations WHERE account_id = $1 AND expires > NOW()`, [userId]),
        authConfig.db.query(`SELECT expires FROM ${prefix}resets WHERE account_id = $1 AND expires > NOW()`, [userId]),
        authConfig.db.query(`SELECT expires FROM ${prefix}remembers WHERE account_id = $1 AND expires > NOW()`, [userId]),
        authConfig.db.query(`SELECT id, mechanism, verified, created_at FROM ${prefix}2fa_methods WHERE account_id = $1`, [userId]),
      ]);

      // Build complete user object
      const user = {
        id: account.id,
        user_id: account.user_id,
        email: account.email,
        verified: account.verified,
        status: account.status,
        rolemask: account.rolemask,
        last_login: account.last_login,
        registered: account.registered,
        resettable: account.resettable,
        providers: providersResult.rows.map((p: any) => ({
          provider: p.provider,
          provider_name: p.provider_name,
        })),
        confirmation_tokens: confirmationsResult.rows.map((t: any) => ({
          expires: t.expires,
        })),
        reset_tokens: resetsResult.rows.map((t: any) => ({
          expires: t.expires,
        })),
        remember_tokens: remembersResult.rows.map((t: any) => ({
          expires: t.expires,
        })),
        mfa_methods: mfaResult.rows.map((m: any) => ({
          id: m.id,
          mechanism: m.mechanism,
          verified: m.verified,
          created_at: m.created_at,
        })),
      };

      res.json(user);
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  // Update user status
  router.patch("/users/:id/status", async (req: any, res: any) => {
    try {
      const { status } = req.body;

      await authConfig.db.query(`UPDATE ${authConfig.tablePrefix || "user_"}accounts SET status = $1 WHERE id = $2`, [status, req.params.id]);

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update user status" });
    }
  });

  // Update user roles
  router.patch("/users/:id/roles", async (req: any, res: any) => {
    try {
      const { rolemask } = req.body;

      await authConfig.db.query(`UPDATE ${authConfig.tablePrefix || "user_"}accounts SET rolemask = $1 WHERE id = $2`, [rolemask, req.params.id]);

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update user roles" });
    }
  });

  // Force logout user
  router.post("/users/:id/logout", async (req: any, res: any) => {
    try {
      const currentUserId = req.auth.getId();
      const targetUserId = parseInt(req.params.id);

      await req.auth.forceLogoutForUserBy({ accountId: targetUserId });

      if (targetUserId === currentUserId) {
        return res.json({ success: true, selfLogout: true });
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to force logout" });
    }
  });

  // Delete user and all associated data
  router.delete("/users/:id", async (req: any, res: any) => {
    try {
      const prefix = authConfig.tablePrefix || "user_";

      await authConfig.db.query(`DELETE FROM ${prefix}providers WHERE account_id = $1`, [req.params.id]);
      await authConfig.db.query(`DELETE FROM ${prefix}resets WHERE account_id = $1`, [req.params.id]);
      await authConfig.db.query(`DELETE FROM ${prefix}remembers WHERE account_id = $1`, [req.params.id]);
      await authConfig.db.query(`DELETE FROM ${prefix}confirmations WHERE account_id = $1`, [req.params.id]);
      await authConfig.db.query(`DELETE FROM ${prefix}2fa_tokens WHERE account_id = $1`, [req.params.id]);
      await authConfig.db.query(`DELETE FROM ${prefix}2fa_methods WHERE account_id = $1`, [req.params.id]);
      await authConfig.db.query(`DELETE FROM ${prefix}accounts WHERE id = $1`, [req.params.id]);

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // Change user password
  router.patch("/users/:id/password", async (req: any, res: any) => {
    try {
      const { password } = req.body;

      if (!password || password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
      }

      await req.auth.changePasswordForUserBy({ accountId: parseInt(req.params.id) }, password);

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to change password" });
    }
  });

  // Update user_id
  router.patch("/users/:id/user-id", async (req: any, res: any) => {
    try {
      const { user_id } = req.body;

      if (!user_id || user_id.length === 0) {
        return res.status(400).json({ error: "User ID cannot be empty" });
      }

      if (user_id.length > 255) {
        return res.status(400).json({ error: "User ID cannot exceed 255 characters" });
      }

      await authConfig.db.query(`UPDATE ${authConfig.tablePrefix || "user_"}accounts SET user_id = $1 WHERE id = $2`, [user_id, parseInt(req.params.id)]);

      res.json({ success: true });
    } catch (error: any) {
      if (error.code === "23505") {
        // PostgreSQL unique constraint violation
        res.status(409).json({ error: "User ID already exists" });
      } else {
        res.status(500).json({ error: "Failed to update user ID" });
      }
    }
  });

  // Create new user
  router.post("/users", async (req: any, res: any) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      if (password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
      }

      // Set a demo user ID for the new account
      const newUserId = `admin-created-${Date.now()}`;
      req.session.userId = newUserId;

      const account = await req.auth.createUser({ email, password });

      res.json({
        success: true,
        user: account,
      });
    } catch (error: any) {
      if (error.message.includes("already in use") || error.message.includes("Email already exists")) {
        res.status(409).json({ error: "Email already exists" });
      } else {
        res.status(400).json({ error: error.message });
      }
    }
  });

  // Get overview stats for the new overview page
  router.get("/overview-stats", async (_req: any, res: any) => {
    try {
      const prefix = authConfig.tablePrefix || "user_";

      const [totalUsers, activeUsers24h, activeUsers7d, activeUsers30d, pendingConfirmations, pendingResets, activeRememberTokens, statusDistribution, mfaEnabledUsers, authMethods, mfaDistribution, roleDistribution] = await Promise.all([
        // Total users
        authConfig.db.query(`SELECT COUNT(*) as count FROM ${prefix}accounts`),

        // Active users in past 24 hours
        authConfig.db.query(`
          SELECT COUNT(DISTINCT account_id) as count
          FROM ${prefix}activity_log
          WHERE action = 'login' AND created_at > NOW() - INTERVAL '24 hours'
        `),

        // Active users in past week
        authConfig.db.query(`
          SELECT COUNT(DISTINCT account_id) as count
          FROM ${prefix}activity_log
          WHERE action = 'login' AND created_at > NOW() - INTERVAL '7 days'
        `),

        // Active users in past month
        authConfig.db.query(`
          SELECT COUNT(DISTINCT account_id) as count
          FROM ${prefix}activity_log
          WHERE action = 'login' AND created_at > NOW() - INTERVAL '30 days'
        `),

        // Active email confirmation tokens
        authConfig.db.query(`SELECT COUNT(*) as count FROM ${prefix}confirmations WHERE expires > NOW()`),

        // Active password reset tokens
        authConfig.db.query(`SELECT COUNT(*) as count FROM ${prefix}resets WHERE expires > NOW()`),

        // Active session remember tokens
        authConfig.db.query(`SELECT COUNT(*) as count FROM ${prefix}remembers WHERE expires > NOW()`),

        // User status distribution
        authConfig.db.query(`
          SELECT status, COUNT(*) as count
          FROM ${prefix}accounts
          GROUP BY status
          ORDER BY status
        `),

        // Number of users that have at least one MFA mechanism enabled
        authConfig.db.query(`
          SELECT COUNT(DISTINCT account_id) as count
          FROM ${prefix}2fa_methods
          WHERE verified = true
        `),

        // Authentication methods distribution (email/password vs OAuth)
        authConfig.db.query(`
          SELECT
            CASE
              WHEN p.account_id IS NOT NULL THEN p.provider
              ELSE 'email_password'
            END as auth_method,
            COUNT(DISTINCT a.id) as count
          FROM ${prefix}accounts a
          LEFT JOIN ${prefix}providers p ON a.id = p.account_id
          GROUP BY auth_method
          ORDER BY count DESC
        `),

        // MFA mechanism distribution
        authConfig.db.query(`
          SELECT mechanism, COUNT(*) as count
          FROM ${prefix}2fa_methods
          WHERE verified = true
          GROUP BY mechanism
          ORDER BY mechanism
        `),

        // Role distribution - count users with each role using bitwise operations (dynamically generated)
        (() => {
          const roleQueries = Object.entries(roles).map(
            ([roleName, roleValue]) =>
              `SELECT
              '${roleName}' as role_name,
              ${roleValue} as role_value,
              COUNT(*) as count
            FROM ${prefix}accounts
            WHERE (rolemask & ${roleValue}) > 0`,
          );

          const roleDistributionQuery = `${roleQueries.join("\n\nUNION ALL\n\n")}\n\nORDER BY role_name ASC`;

          return authConfig.db.query(roleDistributionQuery);
        })(),
      ]);

      res.json({
        totalUsers: parseInt(totalUsers.rows[0]?.count || "0"),
        activeUsers24h: parseInt(activeUsers24h.rows[0]?.count || "0"),
        activeUsers7d: parseInt(activeUsers7d.rows[0]?.count || "0"),
        activeUsers30d: parseInt(activeUsers30d.rows[0]?.count || "0"),
        pendingConfirmations: parseInt(pendingConfirmations.rows[0]?.count || "0"),
        pendingResets: parseInt(pendingResets.rows[0]?.count || "0"),
        activeRememberTokens: parseInt(activeRememberTokens.rows[0]?.count || "0"),
        mfaEnabledUsers: parseInt(mfaEnabledUsers.rows[0]?.count || "0"),
        statusDistribution: statusDistribution.rows.map((row: any) => ({
          status: parseInt(row.status),
          count: parseInt(row.count),
        })),
        authMethods: authMethods.rows.map((row: any) => ({
          method: row.auth_method,
          count: parseInt(row.count),
        })),
        mfaDistribution: mfaDistribution.rows.map((row: any) => ({
          mechanism: parseInt(row.mechanism),
          count: parseInt(row.count),
        })),
        roleDistribution: roleDistribution.rows
          .filter((row: any) => parseInt(row.count) > 0)
          .map((row: any) => ({
            role: row.role_name,
            count: parseInt(row.count),
          })),
      });
    } catch (error) {
      console.error("Overview stats error:", error);
      res.status(500).json({ error: "Failed to fetch overview stats" });
    }
  });

  // Get session stats (legacy endpoint for existing functionality)
  router.get("/stats", async (_req: any, res: any) => {
    try {
      const prefix = authConfig.tablePrefix || "user_";

      const [accounts, confirmations, remembers, resets, activityStats] = await Promise.all([
        authConfig.db.query(`SELECT COUNT(*) as count FROM ${prefix}accounts`),
        authConfig.db.query(`SELECT COUNT(*) as count FROM ${prefix}confirmations`),
        authConfig.db.query(`SELECT COUNT(*) as count FROM ${prefix}remembers`),
        authConfig.db.query(`SELECT COUNT(*) as count FROM ${prefix}resets`),
        // Activity stats
        Promise.all([
          authConfig.db.query(`SELECT COUNT(*) as count FROM ${prefix}activity_log`),
          authConfig.db.query(`SELECT COUNT(*) as count FROM ${prefix}activity_log WHERE action = 'login' AND created_at > NOW() - INTERVAL '24 hours'`),
          authConfig.db.query(`SELECT COUNT(*) as count FROM ${prefix}activity_log WHERE success = false AND created_at > NOW() - INTERVAL '24 hours'`),
        ]),
      ]);

      const [totalActivity, recentLogins, failedAttempts] = activityStats;

      res.json({
        accounts: parseInt(accounts.rows[0].count),
        pendingConfirmations: parseInt(confirmations.rows[0].count),
        activeRememberTokens: parseInt(remembers.rows[0].count),
        pendingResets: parseInt(resets.rows[0].count),
        totalActivity: parseInt(totalActivity.rows[0].count),
        recentLogins: parseInt(recentLogins.rows[0].count),
        failedAttempts: parseInt(failedAttempts.rows[0].count),
      });
    } catch (error) {
      console.error("Stats error:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // Get activity logs
  router.get("/activity", async (req: any, res: any) => {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
      const offset = (page - 1) * limit;
      const accountId = req.query.accountId ? parseInt(req.query.accountId as string) : null;
      const timeFilter = req.query.timeFilter || "all";
      const { events, browsers, oses } = req.query;

      const whereConditions = ["1=1"];
      let paramIndex = 1;
      const params: any[] = [];

      // Time filter
      if (timeFilter === "1h") {
        whereConditions.push(`al.created_at > NOW() - INTERVAL '1 hour'`);
      } else if (timeFilter === "24h") {
        whereConditions.push(`al.created_at > NOW() - INTERVAL '24 hours'`);
      } else if (timeFilter === "7d") {
        whereConditions.push(`al.created_at > NOW() - INTERVAL '7 days'`);
      } else if (timeFilter === "30d") {
        whereConditions.push(`al.created_at > NOW() - INTERVAL '30 days'`);
      }

      // Event type filter
      if (events) {
        const eventArray = events
          .split(",")
          .map((e: string) => e.trim())
          .filter((e: string) => e.length > 0);
        if (eventArray.length > 0) {
          const eventPlaceholders = eventArray.map(() => `$${paramIndex++}`);
          whereConditions.push(`al.action IN (${eventPlaceholders.join(", ")})`);
          params.push(...eventArray);
        }
      }

      // Browser filter
      if (browsers) {
        const browserArray = browsers
          .split(",")
          .map((b: string) => b.trim())
          .filter((b: string) => b.length > 0);
        if (browserArray.length > 0) {
          const browserPlaceholders = browserArray.map(() => `$${paramIndex++}`);
          whereConditions.push(`al.browser IN (${browserPlaceholders.join(", ")})`);
          params.push(...browserArray);
        }
      }

      // OS filter
      if (oses) {
        const osArray = oses
          .split(",")
          .map((o: string) => o.trim())
          .filter((o: string) => o.length > 0);
        if (osArray.length > 0) {
          const osPlaceholders = osArray.map(() => `$${paramIndex++}`);
          whereConditions.push(`al.os IN (${osPlaceholders.join(", ")})`);
          params.push(...osArray);
        }
      }

      // Account ID filter
      if (accountId) {
        whereConditions.push(`al.account_id = $${paramIndex++}`);
        params.push(accountId);
      }

      let sql = `
        SELECT
          al.*,
          a.email as account_email
        FROM ${authConfig.tablePrefix || "user_"}activity_log al
        LEFT JOIN ${authConfig.tablePrefix || "user_"}accounts a ON al.account_id = a.id
        WHERE ${whereConditions.join(" AND ")}
      `;

      const countSql = `SELECT COUNT(*) as total FROM ${authConfig.tablePrefix || "user_"}activity_log al WHERE ${whereConditions.join(" AND ")}`;
      const countResult = await authConfig.db.query(countSql, [...params]);
      const total = parseInt(countResult.rows[0]?.total || "0");

      sql += ` ORDER BY al.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const result = await authConfig.db.query(sql, params);

      // Parse metadata JSON
      const activities = result.rows.map((row: any) => {
        let metadata = null;
        if (row.metadata) {
          try {
            metadata = typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata;
          } catch (error) {
            console.warn("Failed to parse activity metadata:", error, "Raw metadata:", row.metadata);
            metadata = null;
          }
        }

        return {
          ...row,
          metadata,
        };
      });

      res.json({ activities, total, page, limit, pages: Math.ceil(total / limit) });
    } catch (error) {
      console.error("Activity logs error:", error);
      res.status(500).json({ error: "Failed to fetch activity logs" });
    }
  });

  // Get activity stats (more detailed)
  router.get("/activity/stats", async (_req: any, res: any) => {
    try {
      const prefix = authConfig.tablePrefix || "user_";

      const [totalEntries, uniqueUsers, recentLogins, failedAttempts, actionCounts, browserStats, osStats] = await Promise.all([
        authConfig.db.query(`SELECT COUNT(*) as count FROM ${prefix}activity_log`),
        authConfig.db.query(`SELECT COUNT(DISTINCT account_id) as count FROM ${prefix}activity_log WHERE account_id IS NOT NULL`),
        authConfig.db.query(`SELECT COUNT(*) as count FROM ${prefix}activity_log WHERE action = 'login' AND created_at > NOW() - INTERVAL '24 hours'`),
        authConfig.db.query(`SELECT COUNT(*) as count FROM ${prefix}activity_log WHERE success = false AND created_at > NOW() - INTERVAL '24 hours'`),
        authConfig.db.query(`SELECT action, COUNT(*) as count FROM ${prefix}activity_log GROUP BY action ORDER BY count DESC LIMIT 10`),
        authConfig.db.query(`SELECT browser, COUNT(*) as count FROM ${prefix}activity_log WHERE browser IS NOT NULL GROUP BY browser ORDER BY count DESC LIMIT 10`),
        authConfig.db.query(`SELECT os, COUNT(*) as count FROM ${prefix}activity_log WHERE os IS NOT NULL GROUP BY os ORDER BY count DESC LIMIT 10`),
      ]);

      res.json({
        totalEntries: parseInt(totalEntries.rows[0]?.count || 0),
        uniqueUsers: parseInt(uniqueUsers.rows[0]?.count || 0),
        recentLogins: parseInt(recentLogins.rows[0]?.count || 0),
        failedAttempts: parseInt(failedAttempts.rows[0]?.count || 0),
        actionCounts: actionCounts.rows.map((row: any) => ({
          action: row.action,
          count: parseInt(row.count),
        })),
        browserStats: browserStats.rows.map((row: any) => ({
          browser: row.browser,
          count: parseInt(row.count),
        })),
        osStats: osStats.rows.map((row: any) => ({
          os: row.os,
          count: parseInt(row.count),
        })),
      });
    } catch (error) {
      console.error("Activity stats error:", error);
      res.status(500).json({ error: "Failed to fetch activity stats" });
    }
  });

  // MFA Management Endpoints

  // Get user's MFA methods
  router.get("/users/:id/mfa-methods", async (req: any, res: any) => {
    try {
      const prefix = authConfig.tablePrefix || "user_";
      const userId = parseInt(req.params.id);

      // Get user email for QR code generation
      const userResult = await authConfig.db.query(`SELECT email FROM ${prefix}accounts WHERE id = $1`, [userId]);
      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }
      const userEmail = userResult.rows[0].email;

      const result = await authConfig.db.query(
        `
        SELECT
          id,
          mechanism,
          secret,
          backup_codes,
          verified,
          created_at,
          last_used_at
        FROM ${prefix}2fa_methods
        WHERE account_id = $1
        ORDER BY created_at DESC
      `,
        [userId],
      );

      // Add QR code URI for TOTP methods
      const methods = result.rows.map((method: any) => {
        if (method.mechanism === 1 && method.secret && method.verified) {
          // TOTP
          const issuer = authConfig.twoFactor?.issuer || "EasyAccess";
          method.qrCodeUri = `otpauth://totp/${issuer}:${userEmail}?secret=${method.secret}&issuer=${issuer}`;
        }
        return method;
      });

      res.json({ methods });
    } catch (error) {
      console.error("MFA methods error:", error);
      res.status(500).json({ error: "Failed to fetch MFA methods" });
    }
  });

  // Get user's MFA stats from activity log
  router.get("/users/:id/mfa-stats", async (req: any, res: any) => {
    try {
      const prefix = authConfig.tablePrefix || "user_";
      const userId = parseInt(req.params.id);

      const [verifications, failures, backupCodesUsed] = await Promise.all([
        authConfig.db.query(`SELECT COUNT(*) as count FROM ${prefix}activity_log WHERE account_id = $1 AND action IN ('two_factor_verified') AND success = true`, [userId]),
        authConfig.db.query(`SELECT COUNT(*) as count FROM ${prefix}activity_log WHERE account_id = $1 AND action = 'two_factor_failed' AND success = false`, [userId]),
        authConfig.db.query(`SELECT COUNT(*) as count FROM ${prefix}activity_log WHERE account_id = $1 AND action = 'backup_code_used' AND success = true`, [userId]),
      ]);

      res.json({
        stats: {
          verifications: parseInt(verifications.rows[0]?.count || 0),
          failures: parseInt(failures.rows[0]?.count || 0),
          backupCodesUsed: parseInt(backupCodesUsed.rows[0]?.count || 0),
        },
      });
    } catch (error) {
      console.error("MFA stats error:", error);
      res.json({ stats: null });
    }
  });

  // Disable user's MFA method
  router.delete("/users/:id/mfa-methods/:methodId", async (req: any, res: any) => {
    try {
      const prefix = authConfig.tablePrefix || "user_";
      const userId = parseInt(req.params.id);
      const methodId = parseInt(req.params.methodId);

      // Verify the method belongs to the user
      const method = await authConfig.db.query(`SELECT * FROM ${prefix}2fa_methods WHERE id = $1 AND account_id = $2`, [methodId, userId]);

      if (method.rows.length === 0) {
        return res.status(404).json({ error: "MFA method not found" });
      }

      // Delete the MFA method
      await authConfig.db.query(`DELETE FROM ${prefix}2fa_methods WHERE id = $1 AND account_id = $2`, [methodId, userId]);

      // Log the admin action
      const mechanismName = method.rows[0].mechanism === 1 ? "totp" : method.rows[0].mechanism === 2 ? "email" : "sms";
      const userAgent = req.get("User-Agent");
      const parsed = parseUserAgent(userAgent);

      await authConfig.db.query(
        `
        INSERT INTO ${prefix}activity_log
        (account_id, action, success, ip_address, user_agent, browser, os, device, metadata, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      `,
        [
          userId,
          "two_factor_disabled",
          true,
          req.ip,
          userAgent,
          parsed.browser,
          parsed.os,
          parsed.device,
          JSON.stringify({
            mechanism: mechanismName,
            admin_action: true,
            admin_user: req.auth.getEmail(),
          }),
        ],
      );

      res.json({ success: true });
    } catch (error) {
      console.error("Disable MFA method error:", error);
      res.status(500).json({ error: "Failed to disable MFA method" });
    }
  });

  // Reset user's backup codes
  router.post("/users/:id/mfa-methods/:methodId/backup-codes", async (req: any, res: any) => {
    try {
      const prefix = authConfig.tablePrefix || "user_";
      const userId = parseInt(req.params.id);
      const methodId = parseInt(req.params.methodId);

      // Verify the method exists and belongs to the user
      const method = await authConfig.db.query(`SELECT * FROM ${prefix}2fa_methods WHERE id = $1 AND account_id = $2 AND mechanism = 1 AND verified = true`, [methodId, userId]);

      if (method.rows.length === 0) {
        return res.status(404).json({ error: "TOTP method not found or not verified" });
      }

      // Generate new backup codes
      const generateBackupCodes = (count = 10) => {
        const codes = [];
        for (let i = 0; i < count; i++) {
          const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
          let code = "";
          for (let j = 0; j < 8; j++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          codes.push(code);
        }
        return codes;
      };

      const hashBackupCodes = (codes: string[]) => codes.map((code) => crypto.createHash("sha256").update(code).digest("hex"));

      const newBackupCodes = generateBackupCodes(10);
      const hashedBackupCodes = hashBackupCodes(newBackupCodes);

      // Update the method with new backup codes
      await authConfig.db.query(`UPDATE ${prefix}2fa_methods SET backup_codes = $1 WHERE id = $2 AND account_id = $3`, [hashedBackupCodes, methodId, userId]);

      // Log the admin action
      const userAgent = req.get("User-Agent");
      const parsed = parseUserAgent(userAgent);

      await authConfig.db.query(
        `
        INSERT INTO ${prefix}activity_log
        (account_id, action, success, ip_address, user_agent, browser, os, device, metadata, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      `,
        [
          userId,
          "backup_codes_reset",
          true,
          req.ip,
          userAgent,
          parsed.browser,
          parsed.os,
          parsed.device,
          JSON.stringify({
            admin_action: true,
            admin_user: req.auth.getEmail(),
            codes_count: newBackupCodes.length,
          }),
        ],
      );

      res.json({
        success: true,
        backupCodes: newBackupCodes, // Return plain codes for admin to share with user
      });
    } catch (error) {
      console.error("Reset backup codes error:", error);
      res.status(500).json({ error: "Failed to reset backup codes" });
    }
  });

  // Enable TOTP for user
  router.post("/users/:id/mfa-methods/totp", async (req: any, res: any) => {
    try {
      const userId = parseInt(req.params.id);

      // Get user info
      const userResult = await authConfig.db.query(`SELECT id, email FROM ${authConfig.tablePrefix || "user_"}accounts WHERE id = $1`, [userId]);

      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      const user = userResult.rows[0];

      // Create mock request for TwoFactorManager
      const mockReq = {
        session: {
          auth: {
            accountId: user.id,
            email: user.email,
          },
        },
      };
      const mockRes = {};

      const twoFactorManager = new TwoFactorManager(mockReq as any, mockRes as any, authConfig);
      const result = await twoFactorManager.setup.totp(false); // Don't require verification

      res.json({
        success: true,
        secret: result.secret,
        qrCode: result.qrCode,
        backupCodes: result.backupCodes,
      });
    } catch (error) {
      console.error("Enable TOTP error:", error);
      res.status(500).json({ error: "Failed to enable TOTP" });
    }
  });

  // Enable Email 2FA for user
  router.post("/users/:id/mfa-methods/email", async (req: any, res: any) => {
    try {
      const userId = parseInt(req.params.id);
      const { email } = req.body;

      // Get user info
      const userResult = await authConfig.db.query(`SELECT id, email FROM ${authConfig.tablePrefix || "user_"}accounts WHERE id = $1`, [userId]);

      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      const user = userResult.rows[0];
      const targetEmail = email || user.email; // Use provided email or user's email

      // Create mock request for TwoFactorManager
      const mockReq = {
        session: {
          auth: {
            accountId: user.id,
            email: user.email,
          },
        },
      };
      const mockRes = {};

      const twoFactorManager = new TwoFactorManager(mockReq as any, mockRes as any, authConfig);
      await twoFactorManager.setup.email(targetEmail, false); // Don't require verification

      res.json({ success: true });
    } catch (error) {
      console.error("Enable Email 2FA error:", error);
      res.status(500).json({ error: "Failed to enable Email 2FA" });
    }
  });

  // Enable SMS 2FA for user
  router.post("/users/:id/mfa-methods/sms", async (req: any, res: any) => {
    try {
      const userId = parseInt(req.params.id);
      const { phoneNumber } = req.body;

      if (!phoneNumber) {
        return res.status(400).json({ error: "Phone number is required" });
      }

      // Get user info
      const userResult = await authConfig.db.query(`SELECT id, email FROM ${authConfig.tablePrefix || "user_"}accounts WHERE id = $1`, [userId]);

      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      const user = userResult.rows[0];

      // Create mock request for TwoFactorManager
      const mockReq = {
        session: {
          auth: {
            accountId: user.id,
            email: user.email,
          },
        },
      };
      const mockRes = {};

      const twoFactorManager = new TwoFactorManager(mockReq as any, mockRes as any, authConfig);
      await twoFactorManager.setup.sms(phoneNumber, false); // Don't require verification

      res.json({ success: true });
    } catch (error) {
      console.error("Enable SMS 2FA error:", error);
      res.status(500).json({ error: "Failed to enable SMS 2FA" });
    }
  });

  // Test TOTP code for existing method
  router.post("/users/:id/test-totp", async (req: any, res: any) => {
    try {
      const userId = parseInt(req.params.id);
      const { code } = req.body;

      if (!code || typeof code !== "string" || code.length !== 6) {
        return res.status(400).json({ error: "Invalid TOTP code format" });
      }

      // Get the user's TOTP method
      const prefix = authConfig.tablePrefix || "user_";
      const method = await authConfig.db.query(
        `
        SELECT secret FROM ${prefix}2fa_methods
        WHERE account_id = $1 AND mechanism = 1 AND verified = true
      `,
        [userId],
      );

      if (method.rows.length === 0) {
        return res.status(404).json({ error: "No verified TOTP method found for user" });
      }

      const { secret } = method.rows[0];
      if (!secret) {
        return res.status(404).json({ error: "TOTP secret not found" });
      }

      const totpProvider = new TotpProvider(authConfig);
      const isValid = totpProvider.verify(secret, code);

      if (isValid) {
        res.json({ success: true, message: "TOTP code is valid" });
      } else {
        res.status(400).json({ error: "Invalid TOTP code" });
      }
    } catch (error) {
      console.error("Test TOTP error:", error);
      res.status(500).json({ error: "Failed to test TOTP code" });
    }
  });

  return router;
}
