export { createAuthMiddleware } from "./middleware.js";
export { createAuthTables, dropAuthTables, cleanupExpiredTokens, getAuthTableStats } from "./schema.js";
export { createAuthContext, type AuthContext } from "./auth-context.js";
export * as authFunctions from "./auth-functions.js";
export * from "./auth-functions.js";
export { defineRoles, addRoleToUser, removeRoleFromUser, setUserRoles, getUserRoles, type UserIdentifier } from "./user-roles.js";

export type {
  AuthConfig,
  AuthAccount,
  AuthProvider,
  AuthConfirmation,
  AuthRemember,
  AuthReset,
  AuthActivity,
  AuthSession,
  TokenCallback,
  AuthManager,
  OAuthProvider,
  OAuthUserData,
  OAuthCallbackResult,
  OAuthProviderConfig,
  GitHubProviderConfig,
  GoogleProviderConfig,
  AzureProviderConfig,
  AuthActivityActionType,
  TwoFactorMethod,
  TwoFactorToken,
  TwoFactorSetupResult,
  TwoFactorChallenge,
  AuthenticateRequestResult,
} from "./types.js";

export { AuthStatus, AuthRole, AuthActivityAction, TwoFactorMechanism } from "./types.js";

export {
  AuthError,
  ConfirmationExpiredError,
  ConfirmationNotFoundError,
  EmailNotVerifiedError,
  EmailTakenError,
  InvalidEmailError,
  InvalidPasswordError,
  InvalidTokenError,
  ResetDisabledError,
  ResetExpiredError,
  ResetNotFoundError,
  TooManyResetsError,
  UserInactiveError,
  UserNotFoundError,
  UserNotLoggedInError,
  SecondFactorRequiredError,
  InvalidTwoFactorCodeError,
  TwoFactorExpiredError,
  TwoFactorNotSetupError,
  TwoFactorAlreadyEnabledError,
  InvalidBackupCodeError,
  TwoFactorSetupIncompleteError,
} from "./errors.js";

export { isValidEmail, validateEmail } from "./util.js";

export { ActivityLogger } from "./activity-logger.js";

export { TwoFactorManager, TotpProvider, OtpProvider } from "./two-factor/index.js";

export { GitHubProvider, GoogleProvider, AzureProvider, BaseOAuthProvider } from "./providers/index.js";
