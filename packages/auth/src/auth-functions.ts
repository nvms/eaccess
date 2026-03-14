import type { IncomingMessage } from "http";
import hash from "@prsm/hash";
import ms from "@prsm/ms";
import type { AuthConfig, AuthAccount, TokenCallback, AuthenticateRequestResult } from "./types.js";
import { AuthQueries } from "./queries.js";
import { validateEmail } from "./util.js";
import { EmailTakenError, InvalidPasswordError, UserNotFoundError, EmailNotVerifiedError, ResetDisabledError, TooManyResetsError, ResetNotFoundError, ResetExpiredError, InvalidTokenError } from "./errors.js";
import { AuthStatus } from "./types.js";

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  for (const pair of cookieHeader.split(";")) {
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
  }

  return cookies;
}

export async function authenticateRequest(
  config: AuthConfig,
  req: IncomingMessage,
  sessionMiddleware?: (req: any, res: any, next: () => void) => void
): Promise<AuthenticateRequestResult> {
  const queries = new AuthQueries(config);

  if (sessionMiddleware) {
    await new Promise<void>(resolve => {
      sessionMiddleware(req, {}, resolve);
    });
  }

  const session = (req as any).session;
  if (session?.auth?.loggedIn && session.auth.accountId) {
    const account = await queries.findAccountById(session.auth.accountId);
    if (account && account.status === AuthStatus.Normal) {
      return { account, source: "session" };
    }
  }

  const cookies = parseCookies(req.headers.cookie || "");
  const cookieName = config.rememberCookieName || "remember_token";
  const token = cookies[cookieName];

  if (!token) {
    return { account: null, source: null };
  }

  const remember = await queries.findRememberToken(token);
  if (!remember || new Date() > remember.expires) {
    return { account: null, source: null };
  }

  const account = await queries.findAccountById(remember.account_id);
  if (!account || account.status !== AuthStatus.Normal) {
    return { account: null, source: null };
  }

  return { account, source: "remember" };
}

function validatePassword(password: string, config: AuthConfig): void {
  const minLength = config.minPasswordLength || 8;
  const maxLength = config.maxPasswordLength || 64;

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

function generateAutoUserId(): string {
  return crypto.randomUUID();
}

async function findAccountByIdentifier(queries: AuthQueries, identifier: { accountId?: number; email?: string; userId?: string }): Promise<AuthAccount | null> {
  if (identifier.accountId !== undefined) {
    return await queries.findAccountById(identifier.accountId);
  } else if (identifier.email !== undefined) {
    return await queries.findAccountByEmail(identifier.email);
  } else if (identifier.userId !== undefined) {
    return await queries.findAccountByUserId(identifier.userId);
  }
  return null;
}

async function createConfirmationToken(queries: AuthQueries, account: AuthAccount, email: string, callback: TokenCallback): Promise<void> {
  const token = await hash.encode(email);
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 1 week

  await queries.createConfirmation({
    accountId: account.id,
    token,
    email,
    expires,
  });

  if (callback) {
    callback(token);
  }
}

export async function createUser(config: AuthConfig, credentials: { email: string; password: string }, userId?: string | number, callback?: TokenCallback): Promise<AuthAccount> {
  validateEmail(credentials.email);
  validatePassword(credentials.password, config);

  const queries = new AuthQueries(config);

  const existing = await queries.findAccountByEmail(credentials.email);
  if (existing) {
    throw new EmailTakenError();
  }

  const finalUserId = userId || generateAutoUserId();
  const hashedPassword = await hash.encode(credentials.password);
  const verified = typeof callback !== "function";

  const account = await queries.createAccount({
    userId: finalUserId,
    email: credentials.email,
    password: hashedPassword,
    verified,
    status: AuthStatus.Normal,
    rolemask: 0,
  });

  if (!verified && callback) {
    await createConfirmationToken(queries, account, credentials.email, callback);
  }

  return account;
}

export async function register(config: AuthConfig, email: string, password: string, userId?: string | number, callback?: TokenCallback): Promise<AuthAccount> {
  validateEmail(email);
  validatePassword(password, config);

  const queries = new AuthQueries(config);

  const existing = await queries.findAccountByEmail(email);
  if (existing) {
    throw new EmailTakenError();
  }

  const finalUserId = userId || generateAutoUserId();
  const hashedPassword = await hash.encode(password);
  const verified = typeof callback !== "function";

  const account = await queries.createAccount({
    userId: finalUserId,
    email,
    password: hashedPassword,
    verified,
    status: AuthStatus.Normal,
    rolemask: 0,
  });

  if (!verified && callback) {
    await createConfirmationToken(queries, account, email, callback);
  }

  return account;
}

export async function deleteUserBy(config: AuthConfig, identifier: { accountId?: number; email?: string; userId?: string }): Promise<void> {
  const queries = new AuthQueries(config);
  const account = await findAccountByIdentifier(queries, identifier);

  if (!account) {
    throw new UserNotFoundError();
  }

  await queries.deleteAccount(account.id);
}

export async function addRoleForUserBy(config: AuthConfig, identifier: { accountId?: number; email?: string; userId?: string }, role: number): Promise<void> {
  const queries = new AuthQueries(config);
  const account = await findAccountByIdentifier(queries, identifier);

  if (!account) {
    throw new UserNotFoundError();
  }

  const rolemask = account.rolemask | role;
  await queries.updateAccount(account.id, { rolemask });
}

export async function removeRoleForUserBy(config: AuthConfig, identifier: { accountId?: number; email?: string; userId?: string }, role: number): Promise<void> {
  const queries = new AuthQueries(config);
  const account = await findAccountByIdentifier(queries, identifier);

  if (!account) {
    throw new UserNotFoundError();
  }

  const rolemask = account.rolemask & ~role;
  await queries.updateAccount(account.id, { rolemask });
}

export async function hasRoleForUserBy(config: AuthConfig, identifier: { accountId?: number; email?: string; userId?: string }, role: number): Promise<boolean> {
  const queries = new AuthQueries(config);
  const account = await findAccountByIdentifier(queries, identifier);

  if (!account) {
    throw new UserNotFoundError();
  }

  return (account.rolemask & role) === role;
}

export async function changePasswordForUserBy(config: AuthConfig, identifier: { accountId?: number; email?: string; userId?: string }, password: string): Promise<void> {
  validatePassword(password, config);

  const queries = new AuthQueries(config);
  const account = await findAccountByIdentifier(queries, identifier);

  if (!account) {
    throw new UserNotFoundError();
  }

  await queries.updateAccount(account.id, {
    password: await hash.encode(password),
  });
}

export async function setStatusForUserBy(config: AuthConfig, identifier: { accountId?: number; email?: string; userId?: string }, status: number): Promise<void> {
  const queries = new AuthQueries(config);
  const account = await findAccountByIdentifier(queries, identifier);

  if (!account) {
    throw new UserNotFoundError();
  }

  await queries.updateAccount(account.id, { status });
}

export async function initiatePasswordResetForUserBy(config: AuthConfig, identifier: { accountId?: number; email?: string; userId?: string }, expiresAfter: string | number | null = null, callback?: TokenCallback): Promise<void> {
  const queries = new AuthQueries(config);
  const account = await findAccountByIdentifier(queries, identifier);

  if (!account) {
    throw new UserNotFoundError();
  }

  if (!account.verified) {
    throw new EmailNotVerifiedError();
  }

  const expiry = !expiresAfter ? ms("6h") : ms(expiresAfter);
  const token = await hash.encode(account.email);
  const expires = new Date(Date.now() + expiry);

  await queries.createResetToken({
    accountId: account.id,
    token,
    expires,
  });

  if (callback) {
    callback(token);
  }
}

export async function resetPassword(config: AuthConfig, email: string, expiresAfter: string | number | null = null, maxOpenRequests: number | null = null, callback?: TokenCallback): Promise<void> {
  validateEmail(email);

  const expiry = !expiresAfter ? ms("6h") : ms(expiresAfter);
  const maxRequests = maxOpenRequests === null ? 2 : Math.max(1, maxOpenRequests);

  const queries = new AuthQueries(config);
  const account = await queries.findAccountByEmail(email);

  if (!account || !account.verified) {
    throw new EmailNotVerifiedError();
  }

  if (!account.resettable) {
    throw new ResetDisabledError();
  }

  const openRequests = await queries.countActiveResetTokensForAccount(account.id);

  if (openRequests >= maxRequests) {
    throw new TooManyResetsError();
  }

  const token = await hash.encode(email);
  const expires = new Date(Date.now() + expiry);

  await queries.createResetToken({
    accountId: account.id,
    token,
    expires,
  });

  if (callback) {
    callback(token);
  }
}

export async function confirmResetPassword(config: AuthConfig, token: string, password: string): Promise<{ accountId: number; email: string }> {
  const queries = new AuthQueries(config);
  const reset = await queries.findResetToken(token);

  if (!reset) {
    throw new ResetNotFoundError();
  }

  if (new Date(reset.expires) < new Date()) {
    throw new ResetExpiredError();
  }

  const account = await queries.findAccountById(reset.account_id);
  if (!account) {
    throw new UserNotFoundError();
  }

  if (!account.resettable) {
    throw new ResetDisabledError();
  }

  validatePassword(password, config);

  if (!(await hash.verify(token, account.email))) {
    throw new InvalidTokenError();
  }

  await queries.updateAccount(account.id, {
    password: await hash.encode(password),
  });

  await queries.deleteResetToken(token);

  return { accountId: account.id, email: account.email };
}

export async function userExistsByEmail(config: AuthConfig, email: string): Promise<boolean> {
  validateEmail(email);

  const queries = new AuthQueries(config);
  const account = await queries.findAccountByEmail(email);

  return account !== null;
}

export async function forceLogoutForUserBy(config: AuthConfig, identifier: { accountId?: number; email?: string; userId?: string }): Promise<{ accountId: number }> {
  const queries = new AuthQueries(config);
  const account = await findAccountByIdentifier(queries, identifier);

  if (!account) {
    throw new UserNotFoundError();
  }

  await queries.incrementForceLogout(account.id);

  return { accountId: account.id };
}
