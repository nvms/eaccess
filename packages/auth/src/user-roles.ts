import type { AuthConfig, AuthAccount } from "./types.js";
import { AuthQueries } from "./queries.js";
import { UserNotFoundError } from "./errors.js";

const MAX_ROLES = 31;

export function defineRoles<const T extends readonly string[]>(...names: T): Readonly<Record<T[number], number>> {
  if (names.length > MAX_ROLES) {
    throw new Error(`Cannot define more than ${MAX_ROLES} roles (postgres INTEGER is 32-bit signed)`);
  }

  if (names.length === 0) {
    throw new Error("At least one role name is required");
  }

  const seen = new Set<string>();
  const roles = {} as Record<string, number>;

  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    if (seen.has(name)) {
      throw new Error(`Duplicate role name: ${name}`);
    }
    seen.add(name);
    roles[name] = 1 << i;
  }

  return Object.freeze(roles) as Readonly<Record<T[number], number>>;
}

export type UserIdentifier = {
  accountId?: number;
  email?: string;
  userId?: string;
};

async function findAccountByIdentifier(queries: AuthQueries, identifier: UserIdentifier): Promise<AuthAccount> {
  let account: AuthAccount | null = null;

  if (identifier.accountId !== undefined) {
    account = await queries.findAccountById(identifier.accountId);
  } else if (identifier.email !== undefined) {
    account = await queries.findAccountByEmail(identifier.email);
  } else if (identifier.userId !== undefined) {
    account = await queries.findAccountByUserId(identifier.userId);
  }

  if (!account) {
    throw new UserNotFoundError();
  }

  return account;
}

/**
 * Add a role to a user's account.
 * Uses bitwise OR to add role to existing rolemask.
 *
 * @param config - Auth configuration containing database connection
 * @param identifier - Find user by accountId, email, or userId
 * @param role - Role bitmask to add (e.g., AuthRole.Admin)
 * @throws {UserNotFoundError} No account matches the identifier
 */
export async function addRoleToUser(config: AuthConfig, identifier: UserIdentifier, role: number): Promise<void> {
  const queries = new AuthQueries(config);
  const account = await findAccountByIdentifier(queries, identifier);
  
  const rolemask = account.rolemask | role;
  await queries.updateAccount(account.id, { rolemask });
}

/**
 * Remove a role from a user's account.
 * Uses bitwise operations to remove role from rolemask.
 *
 * @param config - Auth configuration containing database connection
 * @param identifier - Find user by accountId, email, or userId
 * @param role - Role bitmask to remove (e.g., AuthRole.Admin)
 * @throws {UserNotFoundError} No account matches the identifier
 */
export async function removeRoleFromUser(config: AuthConfig, identifier: UserIdentifier, role: number): Promise<void> {
  const queries = new AuthQueries(config);
  const account = await findAccountByIdentifier(queries, identifier);
  
  const rolemask = account.rolemask & ~role;
  await queries.updateAccount(account.id, { rolemask });
}

/**
 * Set a user's complete role mask, replacing any existing roles.
 *
 * @param config - Auth configuration containing database connection
 * @param identifier - Find user by accountId, email, or userId
 * @param rolemask - Complete role bitmask to set
 * @throws {UserNotFoundError} No account matches the identifier
 */
export async function setUserRoles(config: AuthConfig, identifier: UserIdentifier, rolemask: number): Promise<void> {
  const queries = new AuthQueries(config);
  const account = await findAccountByIdentifier(queries, identifier);
  
  await queries.updateAccount(account.id, { rolemask });
}

/**
 * Get a user's current role mask.
 *
 * @param config - Auth configuration containing database connection
 * @param identifier - Find user by accountId, email, or userId
 * @returns The user's current role bitmask
 * @throws {UserNotFoundError} No account matches the identifier
 */
export async function getUserRoles(config: AuthConfig, identifier: UserIdentifier): Promise<number> {
  const queries = new AuthQueries(config);
  const account = await findAccountByIdentifier(queries, identifier);
  
  return account.rolemask;
}