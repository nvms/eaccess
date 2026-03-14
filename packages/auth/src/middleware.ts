import type { NextFunction, Request, Response } from "express";
import { AuthManager } from "./auth-manager.js";
import type { AuthConfig } from "./types.js";

export function createAuthMiddleware(config: AuthConfig) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authManager = new AuthManager(req, res, config);

      req.auth = authManager;

      // initialize session and process remember directive
      await authManager.resyncSession();
      await authManager.processRememberDirective();

      next();
    } catch (error) {
      next(error);
    }
  };
}
