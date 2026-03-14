import type { Request, Response } from "express";
import type { Pool } from "pg";
import "express-session";

export interface OAuthProviderConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface GitHubProviderConfig extends OAuthProviderConfig {}

export interface GoogleProviderConfig extends OAuthProviderConfig {}

export interface AzureProviderConfig extends OAuthProviderConfig {
  tenantId: string;
}

export interface AuthConfig {
  db: Pool;

  /**
   * If a user logs in with an OAuth provider, but a matching account (identified by the OAuth user's email address) doesn't
   * exist, createUser will be called:
   *
   * @example:
   *
   * if (this.authConfig.createUser) {
   *   userId = await this.authConfig.createUser(userData);
   * } else {
   *   // Generate UUID for OAuth users when no createUser function is provided
   *   userId = crypto.randomUUID();
   * }
   *
   * This callback is your opportunity to create a user account in *your* database, and return
   * the user ID of the newly-created user for this provider account to be linked to.
   * @param userData
   * @returns
   */
  createUser?: (userData: OAuthUserData) => string | number | Promise<string | number>;

  tablePrefix?: string; // defaults to 'user_'

  roles?: Record<string, number>; // custom roles from defineRoles(), defaults to AuthRole

  minPasswordLength?: number; // defaults to 8
  maxPasswordLength?: number; // defaults to 64

  rememberDuration?: string; // defaults to "30d"
  rememberCookieName?: string; // defaults to "remember_token"

  cookie?: {
    domain?: string;
    secure?: boolean;
    sameSite?: "strict" | "lax" | "none";
  };

  resyncInterval?: string; // defaults to "30s"

  activityLog?: {
    enabled?: boolean; // defaults to true
    maxEntries?: number; // defaults to 10000
    actions?: AuthActivityActionType[]; // which actions to log, defaults to all
  };

  providers?: {
    github?: GitHubProviderConfig;
    google?: GoogleProviderConfig;
    azure?: AzureProviderConfig;
  };

  githubUserAgent?: string;

  twoFactor?: {
    enabled?: boolean; // defaults to false
    requireForOAuth?: boolean; // defaults to false
    issuer?: string; // for TOTP QR codes, defaults to "EasyAccess"
    codeLength?: number; // defaults to 6
    tokenExpiry?: string; // defaults to "5m"
    totpWindow?: number; // defaults to 1
    backupCodesCount?: number; // defaults to 10
  };
}

export interface AuthAccount {
  id: number;
  user_id: string;
  email: string;
  password: string | null;
  verified: boolean;
  status: number;
  rolemask: number;
  last_login: Date | null;
  force_logout: number;
  resettable: boolean;
  registered: Date;
}

export interface AuthProvider {
  id: number;
  account_id: number;
  provider: string;
  provider_id: string;
  provider_email: string | null;
  provider_username: string | null;
  provider_name: string | null;
  provider_avatar: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface OAuthUserData {
  id: string;
  email: string;
  username?: string;
  name?: string;
  avatar?: string;
}

export interface OAuthCallbackResult {
  isNewUser: boolean;
}

export interface OAuthProvider {
  getAuthUrl(state?: string, scopes?: string[]): string;
  handleCallback(req: Request): Promise<OAuthCallbackResult>;
  getUserData(req: Request): Promise<OAuthUserData>;
}

export interface AuthConfirmation {
  id: number;
  account_id: number;
  token: string;
  email: string;
  expires: Date;
}

export interface AuthRemember {
  id: number;
  account_id: number;
  token: string;
  expires: Date;
}

export interface AuthenticateRequestResult {
  account: AuthAccount | null;
  source: "session" | "remember" | null;
}

export interface AuthReset {
  id: number;
  account_id: number;
  token: string;
  expires: Date;
}

export interface AuthActivity {
  id: number;
  account_id: number | null;
  action: string;
  ip_address: string | null;
  user_agent: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  success: boolean;
  metadata: Record<string, any> | null;
  created_at: Date;
}

export interface AuthSession {
  loggedIn: boolean;
  accountId: number;
  userId: string;
  email: string;
  status: number;
  rolemask: number;
  remembered: boolean;
  lastResync: Date;
  lastRememberCheck: Date;
  forceLogout: number;
  verified: boolean;
  hasPassword: boolean;
  shouldForceLogout?: boolean;
  awaitingTwoFactor?: {
    accountId: number;
    expiresAt: Date;
    remember: boolean;
    availableMechanisms: TwoFactorMechanism[];
    attemptedMechanisms: TwoFactorMechanism[];
    originalEmail: string;
    selectors?: {
      email?: string;
      sms?: string;
    };
  };
}

export enum TwoFactorMechanism {
  TOTP = 1,
  EMAIL = 2,
  SMS = 3,
}

export interface TwoFactorMethod {
  id: number;
  account_id: number;
  mechanism: TwoFactorMechanism;
  secret: string | null;
  backup_codes: string[] | null;
  verified: boolean;
  created_at: Date;
  last_used_at: Date | null;
}

export interface TwoFactorToken {
  id: number;
  account_id: number;
  mechanism: TwoFactorMechanism;
  selector: string;
  token_hash: string;
  expires_at: Date;
  created_at: Date;
}

export interface TwoFactorSetupResult {
  secret: string;
  qrCode: string;
  backupCodes?: string[];
}

export interface TwoFactorChallenge {
  totp?: boolean;
  email?: {
    otpValue: string;
    maskedContact: string;
  };
  sms?: {
    otpValue: string;
    maskedContact: string;
  };
  selectors?: {
    email?: string;
    sms?: string;
  };
}

export const AuthStatus = {
  Normal: 0,
  Archived: 1,
  Banned: 2,
  Locked: 3,
  PendingReview: 4,
  Suspended: 5,
} as const;

export const AuthRole = {
  Admin: 1,
  Author: 2,
  Collaborator: 4,
  Consultant: 8,
  Consumer: 16,
  Contributor: 32,
  Owner: 64,
  Creator: 128,
  Developer: 256,
  Director: 512,
  Editor: 1024,
  Employee: 2048,
  Member: 4096,
  Manager: 8192,
  Moderator: 16384,
  Publisher: 32768,
  Reviewer: 65536,
  Subscriber: 131072,
  SuperAdmin: 262144,
  SuperEditor: 524288,
  SuperModerator: 1048576,
  Translator: 2097152,
} as const;

export const AuthActivityAction = {
  Login: "login",
  Logout: "logout",
  FailedLogin: "failed_login",
  Register: "register",
  EmailConfirmed: "email_confirmed",
  PasswordResetRequested: "password_reset_requested",
  PasswordResetCompleted: "password_reset_completed",
  PasswordChanged: "password_changed",
  EmailChanged: "email_changed",
  RoleChanged: "role_changed",
  StatusChanged: "status_changed",
  ForceLogout: "force_logout",
  OAuthConnected: "oauth_connected",
  RememberTokenCreated: "remember_token_created",
  TwoFactorSetup: "two_factor_setup",
  TwoFactorVerified: "two_factor_verified",
  TwoFactorFailed: "two_factor_failed",
  TwoFactorDisabled: "two_factor_disabled",
  BackupCodeUsed: "backup_code_used",
} as const;

export type AuthActivityActionType = (typeof AuthActivityAction)[keyof typeof AuthActivityAction];

export type TokenCallback = (token: string) => void;

declare module "express-session" {
  interface SessionData {
    auth?: AuthSession;
  }
}

declare global {
  namespace Express {
    interface Request {
      auth: AuthManager;
    }
  }
}

export interface AuthManager {
  isLoggedIn(): boolean;
  login(email: string, password: string, remember?: boolean): Promise<void>;
  completeTwoFactorLogin(): Promise<void>;
  logout(): Promise<void>;
  register(email: string, password: string, userId?: string | number, callback?: TokenCallback): Promise<AuthAccount>;
  resyncSession(force?: boolean): Promise<void>;

  getId(): number | null;
  getEmail(): string | null;
  getStatus(): number | null;
  getVerified(): boolean | null;
  hasPassword(): boolean | null;
  getRoleNames(rolemask?: number): string[];
  getStatusName(): string | null;

  hasRole(role: number): Promise<boolean>;
  isAdmin(): Promise<boolean>;
  isRemembered(): boolean;

  changeEmail(newEmail: string, callback: TokenCallback): Promise<void>;
  confirmEmail(token: string): Promise<string>;
  confirmEmailAndLogin(token: string, remember?: boolean): Promise<void>;

  resetPassword(email: string, expiresAfter?: string | number | null, maxOpenRequests?: number | null, callback?: TokenCallback): Promise<void>;
  confirmResetPassword(token: string, password: string, logout?: boolean): Promise<void>;

  verifyPassword(password: string): Promise<boolean>;

  logoutEverywhere(): Promise<void>;
  logoutEverywhereElse(): Promise<void>;

  // admin/standalone functions from AuthContext
  createUser(credentials: { email: string; password: string }, userId?: string | number, callback?: TokenCallback): Promise<AuthAccount>;
  deleteUserBy(identifier: { accountId?: number; email?: string; userId?: string }): Promise<void>;
  addRoleForUserBy(identifier: { accountId?: number; email?: string; userId?: string }, role: number): Promise<void>;
  removeRoleForUserBy(identifier: { accountId?: number; email?: string; userId?: string }, role: number): Promise<void>;
  hasRoleForUserBy(identifier: { accountId?: number; email?: string; userId?: string }, role: number): Promise<boolean>;
  changePasswordForUserBy(identifier: { accountId?: number; email?: string; userId?: string }, password: string): Promise<void>;
  setStatusForUserBy(identifier: { accountId?: number; email?: string; userId?: string }, status: number): Promise<void>;
  initiatePasswordResetForUserBy(identifier: { accountId?: number; email?: string; userId?: string }, expiresAfter?: string | number | null, callback?: TokenCallback): Promise<void>;
  userExistsByEmail(email: string): Promise<boolean>;
  forceLogoutForUserBy(identifier: { accountId?: number; email?: string; userId?: string }): Promise<void>;

  // session-dependent admin functions
  loginAsUserBy(identifier: { accountId?: number; email?: string; userId?: string }): Promise<void>;

  providers: {
    github?: OAuthProvider;
    google?: OAuthProvider;
    azure?: OAuthProvider;
  };

  twoFactor: TwoFactorManager;
}

export interface TwoFactorManager {
  isEnabled(): Promise<boolean>;
  totpEnabled(): Promise<boolean>;
  emailEnabled(): Promise<boolean>;
  smsEnabled(): Promise<boolean>;
  getEnabledMethods(): Promise<TwoFactorMechanism[]>;
  getTotpUri(): Promise<string | null>;

  setup: {
    /**
     * Setup TOTP authentication using an authenticator app.
     * Generates a secret, QR code for easy setup, and optionally backup codes.
     *
     * @param requireVerification - If true, method is created in unverified state and requires calling complete.totp() with a valid code. If false (default), method is immediately enabled and backup codes are generated.
     * @returns Promise resolving to setup result containing secret (for manual entry), QR code URL (for scanning), and backup codes (if verification not required)
     * @throws {UserNotLoggedInError} User is not logged in
     * @throws {TwoFactorAlreadyEnabledError} TOTP is already enabled for this user
     */
    totp(requireVerification?: boolean): Promise<TwoFactorSetupResult>;

    /**
     * Setup email-based two-factor authentication.
     * Uses the user's account email or a specified email address for OTP delivery.
     *
     * @param email - Email address to use for 2FA. If not provided, uses the current user's account email
     * @param requireVerification - If true, method is created in unverified state and requires calling complete.email() with a valid code. If false (default), method is immediately enabled
     * @throws {UserNotLoggedInError} User is not logged in
     * @throws {TwoFactorAlreadyEnabledError} Email 2FA is already enabled for this user
     */
    email(email?: string, requireVerification?: boolean): Promise<void>;

    /**
     * Setup SMS-based two-factor authentication.
     * Uses the provided phone number for OTP delivery via SMS.
     *
     * @param phone - Phone number to use for SMS OTP delivery (should include country code, e.g., "+1234567890")
     * @param requireVerification - If true (default), method is created in unverified state and requires calling complete.sms() with a valid code. If false, method is immediately enabled
     * @throws {UserNotLoggedInError} User is not logged in
     * @throws {TwoFactorAlreadyEnabledError} SMS 2FA is already enabled for this user
     */
    sms(phone: string, requireVerification?: boolean): Promise<void>;
  };

  complete: {
    /**
     * Complete TOTP setup by verifying a code from the user's authenticator app.
     * This is only required if setup.totp() was called with requireVerification: true.
     * Upon successful verification, the method is enabled and backup codes are generated.
     *
     * @param code - The 6-digit TOTP code from the user's authenticator app
     * @returns Promise resolving to an array of backup codes that should be securely stored by the user
     * @throws {UserNotLoggedInError} User is not logged in
     * @throws {TwoFactorNotSetupError} TOTP method was not previously set up or doesn't exist
     * @throws {TwoFactorAlreadyEnabledError} TOTP method is already verified/enabled
     * @throws {InvalidTwoFactorCodeError} The provided TOTP code is invalid or expired
     */
    totp(code: string): Promise<string[]>;

    /**
     * Complete email 2FA setup by verifying an OTP code sent to the user's email.
     * This is only required if setup.email() was called with requireVerification: true.
     * Upon successful verification, the email 2FA method is enabled.
     *
     * @param code - The OTP code that was sent to the user's email address
     * @throws {UserNotLoggedInError} User is not logged in
     * @throws {TwoFactorNotSetupError} Email 2FA method was not previously set up or doesn't exist
     * @throws {TwoFactorAlreadyEnabledError} Email 2FA method is already verified/enabled
     * @throws {InvalidTwoFactorCodeError} The provided email OTP code is invalid or expired
     */
    email(code: string): Promise<void>;

    /**
     * Complete SMS 2FA setup by verifying an OTP code sent to the user's phone.
     * This is only required if setup.sms() was called with requireVerification: true.
     * Upon successful verification, the SMS 2FA method is enabled.
     *
     * @param code - The OTP code that was sent to the user's phone number via SMS
     * @throws {UserNotLoggedInError} User is not logged in
     * @throws {TwoFactorNotSetupError} SMS 2FA method was not previously set up or doesn't exist
     * @throws {TwoFactorAlreadyEnabledError} SMS 2FA method is already verified/enabled
     * @throws {InvalidTwoFactorCodeError} The provided SMS OTP code is invalid or expired
     */
    sms(code: string): Promise<void>;
  };

  // challenge verification (during login flow)
  verify: {
    /**
     * Verifies a TOTP code during the login flow when two-factor authentication is required.
     * This is used after a login attempt triggers a SecondFactorRequiredError and the user
     * provides a code from their authenticator app. After successful verification, call
     * completeTwoFactorLogin() to finish the login process.
     *
     * @param code - The 6-digit TOTP code from the user's authenticator app
     * @throws {UserNotLoggedInError} No active two-factor authentication session
     * @throws {TwoFactorNotSetupError} TOTP method is not enabled for this user
     * @throws {InvalidTwoFactorCodeError} The provided TOTP code is invalid or expired
     */
    totp(code: string): Promise<void>;
    /**
     * Verifies an email OTP code during the login flow when two-factor authentication is required.
     * This is used after a login attempt triggers a SecondFactorRequiredError and the user
     * provides the OTP code that was sent to their email. After successful verification, call
     * completeTwoFactorLogin() to finish the login process.
     *
     * @param code - The OTP code that was sent to the user's email address
     * @throws {UserNotLoggedInError} No active two-factor authentication session
     * @throws {TwoFactorNotSetupError} Email 2FA method is not enabled for this user
     * @throws {InvalidTwoFactorCodeError} The provided email OTP code is invalid or expired
     */
    email(code: string): Promise<void>;

    /**
     * Verifies an SMS OTP code during the login flow when two-factor authentication is required.
     * This is used after a login attempt triggers a SecondFactorRequiredError and the user
     * provides the OTP code that was sent to their phone. After successful verification, call
     * completeTwoFactorLogin() to finish the login process.
     *
     * @param code - The OTP code that was sent to the user's phone number via SMS
     * @throws {UserNotLoggedInError} No active two-factor authentication session
     * @throws {TwoFactorNotSetupError} SMS 2FA method is not enabled for this user
     * @throws {InvalidTwoFactorCodeError} The provided SMS OTP code is invalid or expired
     */
    sms(code: string): Promise<void>;

    /**
     * Verifies a TOTP backup code during the login flow when two-factor authentication is required.
     * Backup codes are generated when TOTP is first set up and can be used as an alternative to
     * the authenticator app. Each backup code can only be used once and is automatically removed
     * after successful verification. After successful verification, call completeTwoFactorLogin()
     * to finish the login process.
     *
     * @param code - A backup code that was generated during TOTP setup (8-character alphanumeric)
     * @throws {UserNotLoggedInError} No active two-factor authentication session
     * @throws {TwoFactorNotSetupError} TOTP method is not enabled for this user or no backup codes exist
     * @throws {InvalidBackupCodeError} The provided backup code is invalid, expired, or already used
     */
    backupCode(code: string): Promise<void>;

    /**
     * Smart OTP verification that works with both email and SMS codes during the login flow.
     * This method automatically determines whether the provided code is an email or SMS OTP
     * by trying to verify it against all available OTP methods. Use this when you want to
     * provide a single input field for users who may have multiple OTP methods enabled.
     * After successful verification, call completeTwoFactorLogin() to finish the login process.
     *
     * @param code - Either an email or SMS OTP code
     * @throws {UserNotLoggedInError} No active two-factor authentication session
     * @throws {TwoFactorNotSetupError} No email or SMS 2FA methods are enabled for this user
     * @throws {InvalidTwoFactorCodeError} The provided code doesn't match any available OTP methods or is expired
     */
    otp(code: string): Promise<void>;
  };

  /**
   * Disable a TwoFactorMechanism for the session user.
   * @param mechanism - The TwoFactorMechanism to disable for the session user
   * @throws {UserNotLoggedInError} User is not logged in
   * @throws {TwoFactorNotSetupError} The specified method is not enabled for this user
   */
  disable(mechanism: TwoFactorMechanism): Promise<void>;

  /**
   * Generates and stores new TOTP backup codes for the session user, invalidating the old ones in the process.
   * @returns Promise resolving to an array of new backup codes that should be securely stored by the user
   * @throws {UserNotLoggedInError} User is not logged in
   * @throws {TwoFactorNotSetupError} TOTP method is not enabled for this user
   */
  generateNewBackupCodes(): Promise<string[]>;

  /**
   * Returns either the email or mobile number for the session user depending on the provided TwoFactorMechanism.
   * @param mechanism - The TwoFactorMechanism for which to return the contact information
   * @returns Promise resolving to the contact information (email or phone number) or null if not found
   * @throws {UserNotLoggedInError} User is not logged in (returns null instead of throwing in implementation)
   */
  getContact(mechanism: TwoFactorMechanism.EMAIL | TwoFactorMechanism.SMS): Promise<string | null>;
}
