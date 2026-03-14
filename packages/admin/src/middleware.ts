import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import type { AuthConfig } from "@eaccess/auth";
import { createAdminRoutes } from "./admin-routes.js";
import { createAuthStatusHandler, createLoginHandler, createLogoutHandler } from "./auth-check.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Create admin UI middleware for easy-auth
 * @param authConfig - The same AuthConfig used with easy-auth
 * @returns Express router with admin routes
 */
export function createAdminUI(authConfig: AuthConfig) {
  const router = express.Router();

  // Serve static assets from built files
  const staticPath = path.join(__dirname, "../dist");
  router.use("/assets", express.static(path.join(staticPath, "assets")));

  // Create auth handlers
  const authStatusHandler = createAuthStatusHandler(authConfig);
  const loginHandler = createLoginHandler(authConfig, { enableAdminCreation: true });
  const logoutHandler = createLogoutHandler(authConfig);

  // Public endpoints
  router.get("/api/auth-status", authStatusHandler);
  router.post("/api/login", loginHandler);
  router.post("/api/logout", logoutHandler);

  // Protected admin routes
  router.use("/api", createAdminRoutes(authConfig));

  // Serve the SPA for all non-API routes
  router.get(/.*/, async (req: any, res: any) => {
    try {
      // Skip auth check for login page and let Vue router handle it
      if (req.path === "/login") {
        return res.sendFile(path.join(staticPath, "index.html"));
      }

      const isLoggedIn = req.auth?.isLoggedIn();
      const isAdmin = isLoggedIn ? await req.auth.isAdmin() : false;

      if (!isLoggedIn || !isAdmin) {
        // For non-API routes, redirect to login (use req.baseUrl to get the mount point)
        if (!req.path.startsWith("/api")) {
          return res.redirect(`${req.baseUrl}/login`);
        }
        return res.status(401).json({ error: "Authentication required" });
      }

      // Serve the SPA for authenticated admin users
      res.sendFile(path.join(staticPath, "index.html"));
    } catch (error) {
      // On error, serve the SPA which will handle auth state
      res.sendFile(path.join(staticPath, "index.html"));
    }
  });

  return router;
}
