import type { AuthConfig, TokenCallback, AuthAccount } from "./types.js";
import * as authFunctions from "./auth-functions.js";

export interface AuthContext {
  createUser: (credentials: { email: string; password: string }, userId?: string | number, callback?: TokenCallback) => Promise<AuthAccount>;
  register: (email: string, password: string, userId?: string | number, callback?: TokenCallback) => Promise<AuthAccount>;
  deleteUserBy: (identifier: { accountId?: number; email?: string; userId?: string }) => Promise<void>;
  addRoleForUserBy: (identifier: { accountId?: number; email?: string; userId?: string }, role: number) => Promise<void>;
  removeRoleForUserBy: (identifier: { accountId?: number; email?: string; userId?: string }, role: number) => Promise<void>;
  hasRoleForUserBy: (identifier: { accountId?: number; email?: string; userId?: string }, role: number) => Promise<boolean>;
  changePasswordForUserBy: (identifier: { accountId?: number; email?: string; userId?: string }, password: string) => Promise<void>;
  setStatusForUserBy: (identifier: { accountId?: number; email?: string; userId?: string }, status: number) => Promise<void>;
  initiatePasswordResetForUserBy: (identifier: { accountId?: number; email?: string; userId?: string }, expiresAfter?: string | number | null, callback?: TokenCallback) => Promise<void>;
  resetPassword: (email: string, expiresAfter?: string | number | null, maxOpenRequests?: number | null, callback?: TokenCallback) => Promise<void>;
  confirmResetPassword: (token: string, password: string) => Promise<{ accountId: number; email: string }>;
  userExistsByEmail: (email: string) => Promise<boolean>;
  forceLogoutForUserBy: (identifier: { accountId?: number; email?: string; userId?: string }) => Promise<{ accountId: number }>;
}

export function createAuthContext(config: AuthConfig): AuthContext {
  return {
    createUser: (credentials, userId?, callback?) => authFunctions.createUser(config, credentials, userId, callback),
    register: (email, password, userId?, callback?) => authFunctions.register(config, email, password, userId, callback),
    deleteUserBy: (identifier) => authFunctions.deleteUserBy(config, identifier),
    addRoleForUserBy: (identifier, role) => authFunctions.addRoleForUserBy(config, identifier, role),
    removeRoleForUserBy: (identifier, role) => authFunctions.removeRoleForUserBy(config, identifier, role),
    hasRoleForUserBy: (identifier, role) => authFunctions.hasRoleForUserBy(config, identifier, role),
    changePasswordForUserBy: (identifier, password) => authFunctions.changePasswordForUserBy(config, identifier, password),
    setStatusForUserBy: (identifier, status) => authFunctions.setStatusForUserBy(config, identifier, status),
    initiatePasswordResetForUserBy: (identifier, expiresAfter?, callback?) => authFunctions.initiatePasswordResetForUserBy(config, identifier, expiresAfter, callback),
    resetPassword: (email, expiresAfter?, maxOpenRequests?, callback?) => authFunctions.resetPassword(config, email, expiresAfter, maxOpenRequests, callback),
    confirmResetPassword: (token, password) => authFunctions.confirmResetPassword(config, token, password),
    userExistsByEmail: (email) => authFunctions.userExistsByEmail(config, email),
    forceLogoutForUserBy: (identifier) => authFunctions.forceLogoutForUserBy(config, identifier),
  };
}
