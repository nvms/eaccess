import type { AuthConfig } from "@eaccess/auth";
import { AuthRole } from "@eaccess/auth";

export interface AdminAccessOptions {
  /**
   * Rolemask granting access to the admin UI in addition to the built-in
   * Admin role. Any overlapping bit qualifies, so a combined mask like
   * `Roles.admin | Roles.developer` admits users holding either role.
   */
  accessRole?: number;
}

/**
 * Shared access check: Admin always qualifies; otherwise any single role bit
 * from options.accessRole does. hasRole() requires every bit of the mask it
 * is given, so the mask is checked bit by bit.
 */
export async function canAccessAdmin(req: any, options: AdminAccessOptions = {}): Promise<boolean> {
  if (!req.auth?.isLoggedIn()) return false;
  if (await req.auth.isAdmin()) return true;

  let mask = options.accessRole ?? 0;
  while (mask) {
    const bit = mask & -mask;
    if (await req.auth.hasRole(bit)) return true;
    mask &= ~bit;
  }
  return false;
}

/**
 * Auth status endpoint that can be shared between dev-server and middleware
 */
export function createAuthStatusHandler(_authConfig: AuthConfig, options: AdminAccessOptions = {}) {
  return async (req: any, res: any) => {
    try {
      const isLoggedIn = req.auth?.isLoggedIn();
      let email = null;
      let isAdmin = false;

      if (isLoggedIn) {
        email = req.auth.getEmail();
        isAdmin = await canAccessAdmin(req, options);
      }

      res.json({
        isLoggedIn: !!isLoggedIn,
        email,
        isAdmin,
      });
    } catch (error) {
      console.error("Auth status check failed:", error);
      res.json({
        isLoggedIn: false,
        email: null,
        isAdmin: false,
      });
    }
  };
}

/**
 * Login handler that can be shared between dev-server and middleware
 */
export function createLoginHandler(authConfig: AuthConfig, options: { enableAdminCreation?: boolean } = {}) {
  return async (req: any, res: any) => {
    try {
      const { email, password, remember } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      // In production middleware, only create admin if no users exist
      if (options.enableAdminCreation && email === "admin@demo.com") {
        // Check if any users exist in the database
        const userCountResult = await authConfig.db.query(`SELECT COUNT(*) as count FROM ${authConfig.tablePrefix || "user_"}accounts`);

        const userCount = parseInt(userCountResult.rows[0].count);

        // Only create admin user if no users exist
        if (userCount === 0) {
          try {
            const account = await req.auth.createUser({
              email: "admin@demo.com",
              password,
            });
            // Add admin role to the created user
            await req.auth.addRoleForUserBy({ accountId: account.id }, AuthRole.Admin);
          } catch (error) {
            // Admin user might already exist, which is fine
            // @ts-ignore
            console.log("Admin user creation skipped:", error.message);
          }
        }
      }

      await req.auth.login(email, password, remember);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Login error:", error);
      res.status(401).json({ error: error.message || "Login failed" });
    }
  };
}

/**
 * Logout handler that can be shared between dev-server and middleware
 */
export function createLogoutHandler(_authConfig: AuthConfig) {
  return async (req: any, res: any) => {
    try {
      await req.auth.logout();
      res.json({ success: true });
    } catch (error: any) {
      console.error("Logout error:", error);
      res.status(500).json({ error: error.message || "Logout failed" });
    }
  };
}
