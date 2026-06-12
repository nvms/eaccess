export { createAdminUI } from "./middleware.js";
export { createAdminRoutes } from "./admin-routes.js";
export { createAuthStatusHandler, createLoginHandler, createLogoutHandler, canAccessAdmin } from "./auth-check.js";
export type { AdminAccessOptions } from "./auth-check.js";
