import hash from "@prsm/hash";
import ms from "@prsm/ms";
import type { Request, Response } from "express";
import type { AuthConfig, AuthAccount, AuthSession, TokenCallback, AuthManager as IAuthManager, OAuthProvider } from "./types.js";
import { AuthStatus, AuthRole, AuthActivityAction } from "./types.js";
import { AuthQueries } from "./queries.js";
import { ActivityLogger } from "./activity-logger.js";
import { validateEmail, createMapFromEnum } from "./util.js";
import {
  ConfirmationExpiredError,
  ConfirmationNotFoundError,
  EmailNotVerifiedError,
  EmailTakenError,
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
  TwoFactorExpiredError,
} from "./errors.js";
import { GitHubProvider, GoogleProvider, AzureProvider } from "./providers/index.js";
import { TwoFactorManager } from "./two-factor/index.js";
import * as authFunctions from "./auth-functions.js";

export class AuthManager implements IAuthManager {
  private req: Request;
  private res: Response;
  private config: AuthConfig;
  private queries: AuthQueries;
  private activityLogger: ActivityLogger;
  public providers: {
    github?: OAuthProvider;
    google?: OAuthProvider;
    azure?: OAuthProvider;
  };

  public twoFactor: TwoFactorManager;

  constructor(req: Request, res: Response, config: AuthConfig) {
    this.req = req;
    this.res = res;
    this.config = config;
    this.queries = new AuthQueries(config);
    this.activityLogger = new ActivityLogger(config);
    this.providers = this.initializeProviders();
    this.twoFactor = new TwoFactorManager(req, res, config);
  }

  private initializeProviders(): {
    github?: OAuthProvider;
    google?: OAuthProvider;
    azure?: OAuthProvider;
  } {
    const providers: any = {};

    if (this.config.providers?.github) {
      providers.github = new GitHubProvider(this.config.providers.github, this.config, this);
    }

    if (this.config.providers?.google) {
      providers.google = new GoogleProvider(this.config.providers.google, this.config, this);
    }

    if (this.config.providers?.azure) {
      providers.azure = new AzureProvider(this.config.providers.azure, this.config, this);
    }

    return providers;
  }

  private generateAutoUserId(): string {
    // Generate a UUID for auto users
    return crypto.randomUUID();
  }

  private async shouldRequire2FA(account: AuthAccount): Promise<boolean> {
    // skip 2FA for OAuth users unless explicitly configured
    const providers = await this.queries.findProvidersByAccountId(account.id);
    const hasOAuthProviders = providers.length > 0;

    if (hasOAuthProviders && !this.config.twoFactor?.requireForOAuth) {
      return false;
    }
    return true;
  }

  private validatePassword(password: string): void {
    const minLength = this.config.minPasswordLength || 8;
    const maxLength = this.config.maxPasswordLength || 64;

    if (typeof password !== "string") {
      throw new InvalidPasswordError();
    }

    if (password.length < minLength) {
      throw new InvalidPasswordError();
    }

    if (password.length > maxLength) {
      throw new InvalidPasswordError();
    }
  }

  private getRoleMap(): Record<number, string> {
    return createMapFromEnum(this.config.roles || AuthRole);
  }

  private getStatusMap(): Record<number, string> {
    return createMapFromEnum(AuthStatus);
  }

  private async getAuthAccount(): Promise<AuthAccount | null> {
    if (!this.req.session?.auth?.accountId) {
      return null;
    }

    return await this.queries.findAccountById(this.req.session.auth.accountId);
  }

  private setRememberCookie(token: string | null, expires: Date): void {
    const cookieName = this.config.rememberCookieName || "remember_token";
    const cookieConfig = this.config.cookie || {};

    if (token === null) {
      this.res.clearCookie(cookieName, {
        domain: cookieConfig.domain,
        secure: cookieConfig.secure ?? this.req.secure,
        sameSite: cookieConfig.sameSite,
      });
    } else {
      this.res.cookie(cookieName, token, {
        expires,
        httpOnly: true,
        secure: cookieConfig.secure ?? this.req.secure,
        domain: cookieConfig.domain,
        sameSite: cookieConfig.sameSite,
      });
    }
  }

  private getRememberToken(): { token: string | null } {
    const { cookies } = this.req as any;
    if (!cookies) {
      return { token: null };
    }

    const cookieName = this.config.rememberCookieName || "remember_token";
    const token = cookies[cookieName];

    return { token: token || null };
  }

  private async regenerateSession(): Promise<void> {
    const { auth } = this.req.session;

    return new Promise<void>((resolve, reject) => {
      this.req.session.regenerate((err: any) => {
        if (err) {
          reject(err);
          return;
        }
        this.req.session.auth = auth;
        resolve();
      });
    });
  }

  async resyncSession(force = false): Promise<void> {
    if (!this.isLoggedIn()) {
      return;
    }

    if (this.req.session.auth!.shouldForceLogout) {
      await this.logout();
      return;
    }

    const interval = ms(this.config.resyncInterval || "30s");
    const lastResync = new Date(this.req.session.auth!.lastResync);

    if (!force && lastResync && lastResync.getTime() > Date.now() - interval) {
      return;
    }

    const account = await this.getAuthAccount();

    if (!account) {
      await this.logout();
      return;
    }

    if (account.force_logout > this.req.session.auth!.forceLogout) {
      await this.logout();
      return;
    }

    this.req.session.auth!.shouldForceLogout = false;
    this.req.session.auth!.email = account.email;
    this.req.session.auth!.status = account.status;
    this.req.session.auth!.rolemask = account.rolemask;
    this.req.session.auth!.verified = account.verified;
    this.req.session.auth!.hasPassword = account.password !== null;
    this.req.session.auth!.lastResync = new Date();
  }

  async processRememberDirective(): Promise<void> {
    if (this.isLoggedIn()) {
      return;
    }

    const { token } = this.getRememberToken();
    if (!token) {
      return;
    }

    const remember = await this.queries.findRememberToken(token);
    if (!remember) {
      this.setRememberCookie(null, new Date(0));
      return;
    }

    // expired?
    if (new Date() > remember.expires) {
      await this.queries.deleteRememberToken(token);
      this.setRememberCookie(null, new Date(0));
      return;
    }

    // clean up expired tokens for this account
    await this.queries.deleteExpiredRememberTokensForAccount(remember.account_id);

    // get the account and log in
    const account = await this.queries.findAccountById(remember.account_id);
    if (!account) {
      await this.queries.deleteRememberToken(token);
      this.setRememberCookie(null, new Date(0));
      return;
    }

    // pass false to avoid creating a new remember token - we're restoring from an existing one
    await this.onLoginSuccessful(account, false);
  }

  private async onLoginSuccessful(account: AuthAccount, remember = false): Promise<void> {
    await this.queries.updateAccountLastLogin(account.id);

    return new Promise<void>((resolve, reject) => {
      if (!this.req.session?.regenerate) {
        resolve();
        return;
      }

      this.req.session.regenerate(async (err: any) => {
        if (err) {
          reject(err);
          return;
        }

        const session: AuthSession = {
          loggedIn: true,
          accountId: account.id,
          userId: account.user_id,
          email: account.email,
          status: account.status,
          rolemask: account.rolemask,
          remembered: remember,
          lastResync: new Date(),
          lastRememberCheck: new Date(),
          forceLogout: account.force_logout,
          verified: account.verified,
          hasPassword: account.password !== null,
          shouldForceLogout: false,
        };

        this.req.session.auth = session;

        if (remember) {
          await this.createRememberDirective(account);
        }

        this.req.session.save((err: any) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });
    });
  }

  private async createRememberDirective(account: AuthAccount): Promise<string> {
    const token = await hash.encode(account.email);
    const duration = this.config.rememberDuration || "30d";
    const expires = new Date(Date.now() + ms(duration));

    await this.queries.createRememberToken({
      accountId: account.id,
      token,
      expires,
    });

    this.setRememberCookie(token, expires);

    await this.activityLogger.logActivity(account.id, AuthActivityAction.RememberTokenCreated, this.req, true, { email: account.email, duration });

    return token;
  }

  /**
   * Check if the current user is logged in.
   * @returns true if user has an active authenticated session
   */
  isLoggedIn(): boolean {
    return this.req.session?.auth?.loggedIn ?? false;
  }

  /**
   * Authenticate user with email and password.
   * Creates a new session and optionally sets a remember token for persistent login.
   *
   * @param email - User's email address
   * @param password - Plain text password
   * @param remember - If true, sets a persistent cookie for auto-login on future visits
   * @throws {UserNotFoundError} Account with this email doesn't exist
   * @throws {InvalidPasswordError} Password is incorrect
   * @throws {EmailNotVerifiedError} Account exists but email is not verified
   * @throws {UserInactiveError} Account is banned, locked, or otherwise inactive
   */
  async login(email: string, password: string, remember = false): Promise<void> {
    try {
      const account = await this.queries.findAccountByEmail(email);

      if (!account) {
        await this.activityLogger.logActivity(null, AuthActivityAction.FailedLogin, this.req, false, { email, reason: "account_not_found" });
        throw new UserNotFoundError();
      }

      if (!account.password || !(await hash.verify(account.password, password))) {
        await this.activityLogger.logActivity(account.id, AuthActivityAction.FailedLogin, this.req, false, { email, reason: "invalid_password" });
        throw new InvalidPasswordError();
      }

      if (!account.verified) {
        await this.activityLogger.logActivity(account.id, AuthActivityAction.FailedLogin, this.req, false, { email, reason: "email_not_verified" });
        throw new EmailNotVerifiedError();
      }

      if (account.status !== AuthStatus.Normal) {
        await this.activityLogger.logActivity(account.id, AuthActivityAction.FailedLogin, this.req, false, { email, reason: "account_inactive", status: account.status });
        throw new UserInactiveError();
      }

      // check if 2FA is enabled and required for this user
      if (this.config.twoFactor?.enabled && (await this.shouldRequire2FA(account))) {
        const twoFactorMethods = await this.queries.findTwoFactorMethodsByAccountId(account.id);
        const enabledMethods = twoFactorMethods.filter((method) => method.verified);

        if (enabledMethods.length > 0) {
          // create 2FA challenge
          const challenge = await this.twoFactor.createChallenge(account.id);

          // set 2FA session state (user NOT logged in yet)
          const expiryDuration = this.config.twoFactor?.tokenExpiry || "5m";
          const expiresAt = new Date(Date.now() + ms(expiryDuration));

          this.req.session.auth = {
            loggedIn: false,
            accountId: 0,
            userId: "",
            email: "",
            status: 0,
            rolemask: 0,
            remembered: false,
            lastResync: new Date(),
            lastRememberCheck: new Date(),
            forceLogout: 0,
            verified: false,
            hasPassword: false,
            awaitingTwoFactor: {
              accountId: account.id,
              expiresAt,
              remember,
              availableMechanisms: enabledMethods.map((m) => m.mechanism),
              attemptedMechanisms: [],
              originalEmail: account.email,
              selectors: challenge.selectors,
            },
          };

          await this.activityLogger.logActivity(account.id, AuthActivityAction.TwoFactorFailed, this.req, true, { prompt: true, mechanisms: enabledMethods.map((m) => m.mechanism) });

          throw new SecondFactorRequiredError(challenge);
        }
      }

      await this.onLoginSuccessful(account, remember);
      await this.activityLogger.logActivity(account.id, AuthActivityAction.Login, this.req, true, { email, remember });
    } catch (error) {
      // re-throw the error after logging
      throw error;
    }
  }

  /**
   * Complete two-factor authentication and log in the user.
   * This should be called after receiving a SecondFactorRequiredError.
   */
  async completeTwoFactorLogin(): Promise<void> {
    const twoFactorState = this.req.session?.auth?.awaitingTwoFactor;

    if (!twoFactorState) {
      throw new TwoFactorExpiredError();
    }

    // check if the 2FA session has expired
    if (twoFactorState.expiresAt <= new Date()) {
      // clear expired 2FA state
      delete this.req.session.auth!.awaitingTwoFactor;
      throw new TwoFactorExpiredError();
    }

    // get the account that was awaiting 2FA
    const account = await this.queries.findAccountById(twoFactorState.accountId);
    if (!account) {
      delete this.req.session.auth!.awaitingTwoFactor;
      throw new UserNotFoundError();
    }

    // complete the login process
    await this.onLoginSuccessful(account, twoFactorState.remember);

    // clear the 2FA state
    delete this.req.session.auth!.awaitingTwoFactor;

    await this.activityLogger.logActivity(account.id, AuthActivityAction.Login, this.req, true, { email: account.email, remember: twoFactorState.remember, twoFactorCompleted: true });
  }

  /**
   * Log out the current user.
   * Clears the session and removes any remember tokens.
   */
  async logout(): Promise<void> {
    if (!this.isLoggedIn()) {
      return;
    }

    const accountId = this.getId();
    const email = this.getEmail();
    const { token } = this.getRememberToken();

    if (token) {
      await this.queries.deleteRememberToken(token);
      this.setRememberCookie(null, new Date(0));
    }

    this.req.session.auth = undefined;

    if (accountId && email) {
      await this.activityLogger.logActivity(accountId, AuthActivityAction.Logout, this.req, true, { email });
    }
  }

  /**
   * Register a new account.
   *
   * @param email - Email address for the new account
   * @param password - Plain text password (will be hashed)
   * @param userId - Optional user ID to link this auth account to. If not provided, a UUID will be generated automatically.
   * @param callback - If provided, account is created unverified and callback receives confirmation token. Create a URL like /confirm/{token} and call confirmEmail() in that handler. If omitted, account is immediately verified.
   * @returns The created account record
   * @throws {EmailTakenError} Email is already registered
   * @throws {InvalidPasswordError} Password doesn't meet length requirements
   */
  async register(email: string, password: string, userId?: string | number, callback?: TokenCallback): Promise<AuthAccount> {
    validateEmail(email);
    this.validatePassword(password);

    const existing = await this.queries.findAccountByEmail(email);
    if (existing) {
      throw new EmailTakenError();
    }

    const finalUserId = userId || this.generateAutoUserId();

    const hashedPassword = await hash.encode(password);
    const verified = typeof callback !== "function";

    const account = await this.queries.createAccount({
      userId: finalUserId,
      email,
      password: hashedPassword,
      verified,
      status: AuthStatus.Normal,
      rolemask: 0,
    });

    if (!verified && callback) {
      await this.createConfirmationToken(account, email, callback);
    }

    await this.activityLogger.logActivity(account.id, AuthActivityAction.Register, this.req, true, { email, verified, userId: finalUserId });

    return account;
  }

  private async createConfirmationToken(account: AuthAccount, email: string, callback: TokenCallback): Promise<void> {
    const token = await hash.encode(email);
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 1 week

    await this.queries.createConfirmation({
      accountId: account.id,
      token,
      email,
      expires,
    });

    if (callback) {
      callback(token);
    }
  }

  /**
   * Get the current user's account ID.
   * @returns Account ID if logged in, null otherwise
   */
  getId(): number | null {
    return this.req.session?.auth?.accountId || null;
  }

  /**
   * Get the current user's email address.
   * @returns Email if logged in, null otherwise
   */
  getEmail(): string | null {
    return this.req.session?.auth?.email || null;
  }

  /**
   * Get the current user's account status.
   * @returns Status number (0=Normal, 1=Archived, 2=Banned, etc.) if logged in, null otherwise
   */
  getStatus(): number | null {
    return this.req.session?.auth?.status ?? null;
  }

  /**
   * Check if the current user's email is verified.
   * @returns true if verified, false if unverified, null if not logged in
   */
  getVerified(): boolean | null {
    return this.req.session?.auth?.verified ?? null;
  }

  /**
   * Check if the current user has a password set.
   * OAuth-only users will return false.
   * @returns true if user has a password, false if OAuth-only, null if not logged in
   */
  hasPassword(): boolean | null {
    return this.req.session?.auth?.hasPassword ?? null;
  }

  /**
   * Get human-readable role names for the current user or a specific rolemask.
   * @param rolemask - Optional specific rolemask to check. If omitted, uses current user's roles
   * @returns Array of role names (e.g., ['Admin', 'Editor'])
   */
  getRoleNames(rolemask?: number): string[] {
    const mask = rolemask !== undefined ? rolemask : (this.req.session?.auth?.rolemask ?? 0);

    if (!mask && mask !== 0) {
      return [];
    }

    return Object.entries(this.getRoleMap())
      .filter(([key]) => mask & parseInt(key))
      .map(([, value]) => value);
  }

  /**
   * Get human-readable status name for the current user.
   * @returns Status name (e.g., 'Normal', 'Banned', 'Locked') if logged in, null otherwise
   */
  getStatusName(): string | null {
    const status = this.getStatus();
    if (status === null) return null;
    return this.getStatusMap()[status] || null;
  }

  /**
   * Check if the current user has a specific role.
   * @param role - Role bitmask to check (e.g., AuthRole.Admin)
   * @returns true if user has the role, false otherwise
   */
  async hasRole(role: number): Promise<boolean> {
    if (this.req.session?.auth) {
      return (this.req.session.auth.rolemask & role) === role;
    }

    const account = await this.getAuthAccount();
    return account ? (account.rolemask & role) === role : false;
  }

  /**
   * Check if the current user has admin privileges.
   * @returns true if user has Admin role, false otherwise
   */
  async isAdmin(): Promise<boolean> {
    return this.hasRole(AuthRole.Admin);
  }

  /**
   * Check if the current user was automatically logged in via remember token.
   * @returns true if auto-logged in from persistent cookie, false if manual login or not logged in
   */
  isRemembered(): boolean {
    return this.req.session?.auth?.remembered ?? false;
  }

  /**
   * Request an email change for the current user.
   * Sends a confirmation token to verify the new email before changing it.
   *
   * @param newEmail - New email address
   * @param callback - Called with confirmation token. Create a URL like /confirm/{token} and call confirmEmail() in that handler
   * @throws {UserNotLoggedInError} User is not logged in
   * @throws {EmailTakenError} New email is already registered
   * @throws {UserNotFoundError} Current user account not found
   * @throws {EmailNotVerifiedError} Current account's email is not verified
   */
  async changeEmail(newEmail: string, callback: TokenCallback): Promise<void> {
    if (!this.isLoggedIn()) {
      throw new UserNotLoggedInError();
    }

    validateEmail(newEmail);

    const existing = await this.queries.findAccountByEmail(newEmail);
    if (existing) {
      throw new EmailTakenError();
    }

    const account = await this.getAuthAccount();
    if (!account) {
      throw new UserNotFoundError();
    }

    if (!account.verified) {
      throw new EmailNotVerifiedError();
    }

    await this.createConfirmationToken(account, newEmail, callback);
  }

  /**
   * Confirm an email address using a token from registration or email change.
   * Updates the account to verified status and changes email if this was from changeEmail.
   *
   * @param token - Confirmation token from registration or email change
   * @returns The confirmed email address
   * @throws {ConfirmationNotFoundError} Token is invalid or doesn't exist
   * @throws {ConfirmationExpiredError} Token has expired
   * @throws {InvalidTokenError} Token format is invalid
   */
  async confirmEmail(token: string): Promise<string> {
    const confirmation = await this.queries.findConfirmation(token);

    if (!confirmation) {
      throw new ConfirmationNotFoundError();
    }

    if (new Date(confirmation.expires) < new Date()) {
      throw new ConfirmationExpiredError();
    }

    if (!(await hash.verify(token, confirmation.email))) {
      throw new InvalidTokenError();
    }

    await this.queries.updateAccount(confirmation.account_id, {
      verified: true,
      email: confirmation.email,
    });

    if (this.isLoggedIn() && this.req.session?.auth?.accountId === confirmation.account_id) {
      this.req.session.auth.verified = true;
      this.req.session.auth.email = confirmation.email;
    }

    await this.queries.deleteConfirmation(token);

    await this.activityLogger.logActivity(confirmation.account_id, AuthActivityAction.EmailConfirmed, this.req, true, { email: confirmation.email });

    return confirmation.email;
  }

  /**
   * Confirm email and automatically log in the user.
   * Useful for "click to verify and login" flows.
   *
   * @param token - Confirmation token from registration
   * @param remember - Whether to set persistent login cookie
   * @throws {ConfirmationNotFoundError} Token is invalid or doesn't exist
   * @throws {ConfirmationExpiredError} Token has expired
   * @throws {InvalidTokenError} Token format is invalid
   * @throws {UserNotFoundError} Associated account no longer exists
   */
  async confirmEmailAndLogin(token: string, remember = false): Promise<void> {
    const email = await this.confirmEmail(token);

    if (this.isLoggedIn()) {
      return;
    }

    const account = await this.queries.findAccountByEmail(email);
    if (!account) {
      throw new UserNotFoundError();
    }

    // check if 2FA is enabled and required for this user
    if (this.config.twoFactor?.enabled && (await this.shouldRequire2FA(account))) {
      const twoFactorMethods = await this.queries.findTwoFactorMethodsByAccountId(account.id);
      const enabledMethods = twoFactorMethods.filter((method) => method.verified);

      if (enabledMethods.length > 0) {
        // create 2FA challenge
        const challenge = await this.twoFactor.createChallenge(account.id);

        // set 2FA session state (user NOT logged in yet)
        const expiryDuration = this.config.twoFactor?.tokenExpiry || "5m";
        const expiresAt = new Date(Date.now() + ms(expiryDuration));

        this.req.session.auth = {
          loggedIn: false,
          accountId: 0,
          userId: "",
          email: "",
          status: 0,
          rolemask: 0,
          remembered: false,
          lastResync: new Date(),
          lastRememberCheck: new Date(),
          forceLogout: 0,
          verified: false,
          hasPassword: false,
          awaitingTwoFactor: {
            accountId: account.id,
            expiresAt,
            remember,
            availableMechanisms: enabledMethods.map((m) => m.mechanism),
            attemptedMechanisms: [],
            originalEmail: account.email,
            selectors: challenge.selectors,
          },
        };

        await this.activityLogger.logActivity(account.id, AuthActivityAction.TwoFactorFailed, this.req, true, { prompt: true, mechanisms: enabledMethods.map((m) => m.mechanism) });

        throw new SecondFactorRequiredError(challenge);
      }
    }

    await this.onLoginSuccessful(account, remember);
  }

  /**
   * Initiate a password reset for a user.
   * Creates a reset token and calls the callback to send reset email.
   *
   * @param email - Email address of account to reset
   * @param expiresAfter - Token expiration (default: 6h). Accepts ms format like '1h', '30m'
   * @param maxOpenRequests - Maximum concurrent reset tokens (default: 2)
   * @param callback - Called with reset token. Create a URL like /reset/{token} and call confirmResetPassword() in that handler
   * @throws {EmailNotVerifiedError} Account doesn't exist or email not verified
   * @throws {ResetDisabledError} Account has password reset disabled
   * @throws {TooManyResetsError} Too many active reset requests
   */
  async resetPassword(email: string, expiresAfter: string | number | null = null, maxOpenRequests: number | null = null, callback?: TokenCallback): Promise<void> {
    validateEmail(email);

    const expiry = !expiresAfter ? ms("6h") : ms(expiresAfter);
    const maxRequests = maxOpenRequests === null ? 2 : Math.max(1, maxOpenRequests);

    const account = await this.queries.findAccountByEmail(email);

    if (!account || !account.verified) {
      throw new EmailNotVerifiedError();
    }

    if (!account.resettable) {
      throw new ResetDisabledError();
    }

    const openRequests = await this.queries.countActiveResetTokensForAccount(account.id);

    if (openRequests >= maxRequests) {
      throw new TooManyResetsError();
    }

    const token = await hash.encode(email);
    const expires = new Date(Date.now() + expiry);

    await this.queries.createResetToken({
      accountId: account.id,
      token,
      expires,
    });

    await this.activityLogger.logActivity(account.id, AuthActivityAction.PasswordResetRequested, this.req, true, { email });

    if (callback) {
      callback(token);
    }
  }

  /**
   * Complete a password reset using a reset token.
   * Changes the password and optionally logs out all sessions.
   *
   * @param token - Reset token from resetPassword callback
   * @param password - New password (will be hashed)
   * @param logout - Whether to force logout all sessions (default: true)
   * @throws {ResetNotFoundError} Token is invalid or doesn't exist
   * @throws {ResetExpiredError} Token has expired
   * @throws {UserNotFoundError} Associated account no longer exists
   * @throws {ResetDisabledError} Account has password reset disabled
   * @throws {InvalidPasswordError} New password doesn't meet requirements
   * @throws {InvalidTokenError} Token format is invalid
   */
  async confirmResetPassword(token: string, password: string, logout = true): Promise<void> {
    const reset = await this.queries.findResetToken(token);

    if (!reset) {
      throw new ResetNotFoundError();
    }

    if (new Date(reset.expires) < new Date()) {
      throw new ResetExpiredError();
    }

    const account = await this.queries.findAccountById(reset.account_id);
    if (!account) {
      throw new UserNotFoundError();
    }

    if (!account.resettable) {
      throw new ResetDisabledError();
    }

    this.validatePassword(password);

    if (!(await hash.verify(token, account.email))) {
      throw new InvalidTokenError();
    }

    await this.queries.updateAccount(account.id, {
      password: await hash.encode(password),
    });

    if (logout) {
      await this.forceLogoutForAccountById(account.id);
    }

    await this.queries.deleteResetToken(token);

    await this.activityLogger.logActivity(account.id, AuthActivityAction.PasswordResetCompleted, this.req, true, { email: account.email });
  }

  /**
   * Verify if a password matches the current user's password.
   * Useful for "confirm current password" flows before sensitive operations.
   *
   * @param password - Password to verify
   * @returns true if password matches, false otherwise
   * @throws {UserNotLoggedInError} User is not logged in
   * @throws {UserNotFoundError} Current user account not found
   */
  async verifyPassword(password: string): Promise<boolean> {
    if (!this.isLoggedIn()) {
      throw new UserNotLoggedInError();
    }

    const account = await this.getAuthAccount();

    if (!account) {
      throw new UserNotFoundError();
    }

    if (!account.password) {
      return false; // OAuth users don't have passwords
    }

    return await hash.verify(account.password, password);
  }

  private async forceLogoutForAccountById(accountId: number): Promise<void> {
    await this.queries.deleteRememberTokensForAccount(accountId);
    await this.queries.incrementForceLogout(accountId);
  }

  /**
   * Force logout all OTHER sessions while keeping current session active.
   * Useful for "logout other devices" functionality.
   */
  async logoutEverywhereElse(): Promise<void> {
    if (!this.isLoggedIn()) {
      return;
    }

    const accountId = this.getId();
    if (!accountId) {
      return;
    }

    const account = await this.queries.findAccountById(accountId);
    if (!account) {
      await this.logout();
      return;
    }

    await this.forceLogoutForAccountById(accountId);

    this.req.session.auth!.forceLogout += 1;

    await this.regenerateSession();
  }

  /**
   * Force logout ALL sessions including the current one.
   * Logs out everywhere else, then logs out current session.
   */
  async logoutEverywhere(): Promise<void> {
    if (!this.isLoggedIn()) {
      return;
    }

    await this.logoutEverywhereElse();
    await this.logout();
  }

  private async findAccountByIdentifier(identifier: { accountId?: number; email?: string; userId?: string }): Promise<AuthAccount | null> {
    if (identifier.accountId !== undefined) {
      return await this.queries.findAccountById(identifier.accountId);
    } else if (identifier.email !== undefined) {
      return await this.queries.findAccountByEmail(identifier.email);
    } else if (identifier.userId !== undefined) {
      return await this.queries.findAccountByUserId(identifier.userId);
    }

    return null;
  }

  // admin/standalone functions (delegated to auth-functions.js due to lack of need for request context)
  async createUser(credentials: { email: string; password: string }, userId?: string | number, callback?: TokenCallback): Promise<AuthAccount> {
    return authFunctions.createUser(this.config, credentials, userId, callback);
  }

  async deleteUserBy(identifier: { accountId?: number; email?: string; userId?: string }): Promise<void> {
    return authFunctions.deleteUserBy(this.config, identifier);
  }

  async addRoleForUserBy(identifier: { accountId?: number; email?: string; userId?: string }, role: number): Promise<void> {
    return authFunctions.addRoleForUserBy(this.config, identifier, role);
  }

  async removeRoleForUserBy(identifier: { accountId?: number; email?: string; userId?: string }, role: number): Promise<void> {
    return authFunctions.removeRoleForUserBy(this.config, identifier, role);
  }

  async hasRoleForUserBy(identifier: { accountId?: number; email?: string; userId?: string }, role: number): Promise<boolean> {
    return authFunctions.hasRoleForUserBy(this.config, identifier, role);
  }

  async changePasswordForUserBy(identifier: { accountId?: number; email?: string; userId?: string }, password: string): Promise<void> {
    return authFunctions.changePasswordForUserBy(this.config, identifier, password);
  }

  async setStatusForUserBy(identifier: { accountId?: number; email?: string; userId?: string }, status: number): Promise<void> {
    return authFunctions.setStatusForUserBy(this.config, identifier, status);
  }

  async initiatePasswordResetForUserBy(identifier: { accountId?: number; email?: string; userId?: string }, expiresAfter?: string | number | null, callback?: TokenCallback): Promise<void> {
    return authFunctions.initiatePasswordResetForUserBy(this.config, identifier, expiresAfter, callback);
  }

  async userExistsByEmail(email: string): Promise<boolean> {
    return authFunctions.userExistsByEmail(this.config, email);
  }

  async forceLogoutForUserBy(identifier: { accountId?: number; email?: string; userId?: string }): Promise<void> {
    const result = await authFunctions.forceLogoutForUserBy(this.config, identifier);

    if (this.getId() === result.accountId) {
      this.req.session.auth!.shouldForceLogout = true;
    }
  }

  /**
   * Log in as another user (admin function).
   * Creates a new session as the target user without requiring their password.
   *
   * @param identifier - Find user by accountId, email, or userId
   * @throws {UserNotFoundError} No account matches the identifier
   */
  async loginAsUserBy(identifier: { accountId?: number; email?: string; userId?: string }): Promise<void> {
    const account = await this.findAccountByIdentifier(identifier);

    if (!account) {
      throw new UserNotFoundError();
    }

    await this.onLoginSuccessful(account, false);
  }
}
