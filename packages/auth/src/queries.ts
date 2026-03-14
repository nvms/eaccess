import type { Pool } from "pg";
import type { AuthConfig, AuthAccount, AuthConfirmation, AuthRemember, AuthReset, AuthProvider, TwoFactorMethod, TwoFactorToken, TwoFactorMechanism } from "./types.js";

export class AuthQueries {
  private db: Pool;
  private tablePrefix: string;

  constructor(config: AuthConfig) {
    this.db = config.db;
    this.tablePrefix = config.tablePrefix || "user_";
  }

  private get accountsTable() {
    return `${this.tablePrefix}accounts`;
  }

  private get confirmationsTable() {
    return `${this.tablePrefix}confirmations`;
  }

  private get remembersTable() {
    return `${this.tablePrefix}remembers`;
  }

  private get resetsTable() {
    return `${this.tablePrefix}resets`;
  }

  private get providersTable() {
    return `${this.tablePrefix}providers`;
  }

  private get twoFactorMethodsTable() {
    return `${this.tablePrefix}2fa_methods`;
  }

  private get twoFactorTokensTable() {
    return `${this.tablePrefix}2fa_tokens`;
  }

  async findAccountById(id: number): Promise<AuthAccount | null> {
    const sql = `SELECT * FROM ${this.accountsTable} WHERE id = $1`;
    const result = await this.db.query(sql, [id]);
    return result.rows[0] || null;
  }

  async findAccountByUserId(userId: string | number): Promise<AuthAccount | null> {
    const sql = `SELECT * FROM ${this.accountsTable} WHERE user_id = $1`;
    const result = await this.db.query(sql, [userId]);
    return result.rows[0] || null;
  }

  async findAccountByEmail(email: string): Promise<AuthAccount | null> {
    const sql = `SELECT * FROM ${this.accountsTable} WHERE email = $1`;
    const result = await this.db.query(sql, [email]);
    return result.rows[0] || null;
  }

  async createAccount(data: { userId: string | number; email: string; password: string | null; verified: boolean; status: number; rolemask: number }): Promise<AuthAccount> {
    const sql = `
      INSERT INTO ${this.accountsTable} (
        user_id, email, password, verified, status, rolemask, 
        force_logout, resettable, registered
      )
      VALUES ($1, $2, $3, $4, $5, $6, 0, true, NOW())
      RETURNING *
    `;

    const result = await this.db.query(sql, [data.userId, data.email, data.password, data.verified, data.status, data.rolemask]);

    return result.rows[0];
  }

  async updateAccount(id: number, updates: Partial<AuthAccount>): Promise<void> {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (key === "id") continue; // don't update id
      fields.push(`${key} = $${paramIndex++}`);
      values.push(value);
    }

    if (fields.length === 0) return;

    values.push(id);
    const sql = `UPDATE ${this.accountsTable} SET ${fields.join(", ")} WHERE id = $${paramIndex}`;
    await this.db.query(sql, values);
  }

  async updateAccountLastLogin(id: number): Promise<void> {
    const sql = `UPDATE ${this.accountsTable} SET last_login = NOW() WHERE id = $1`;
    await this.db.query(sql, [id]);
  }

  async incrementForceLogout(id: number): Promise<void> {
    const sql = `UPDATE ${this.accountsTable} SET force_logout = force_logout + 1 WHERE id = $1`;
    await this.db.query(sql, [id]);
  }

  async deleteAccount(id: number): Promise<void> {
    await this.db.query(`DELETE FROM ${this.twoFactorTokensTable} WHERE account_id = $1`, [id]);
    await this.db.query(`DELETE FROM ${this.twoFactorMethodsTable} WHERE account_id = $1`, [id]);
    await this.db.query(`DELETE FROM ${this.providersTable} WHERE account_id = $1`, [id]);
    await this.db.query(`DELETE FROM ${this.confirmationsTable} WHERE account_id = $1`, [id]);
    await this.db.query(`DELETE FROM ${this.remembersTable} WHERE account_id = $1`, [id]);
    await this.db.query(`DELETE FROM ${this.resetsTable} WHERE account_id = $1`, [id]);

    await this.db.query(`DELETE FROM ${this.accountsTable} WHERE id = $1`, [id]);
  }

  async createConfirmation(data: { accountId: number; token: string; email: string; expires: Date }): Promise<void> {
    await this.db.query(`DELETE FROM ${this.confirmationsTable} WHERE account_id = $1`, [data.accountId]);

    const sql = `
      INSERT INTO ${this.confirmationsTable} (account_id, token, email, expires)
      VALUES ($1, $2, $3, $4)
    `;

    await this.db.query(sql, [data.accountId, data.token, data.email, data.expires]);
  }

  async findConfirmation(token: string): Promise<AuthConfirmation | null> {
    const sql = `SELECT * FROM ${this.confirmationsTable} WHERE token = $1`;
    const result = await this.db.query(sql, [token]);
    return result.rows[0] || null;
  }

  async findLatestConfirmationForAccount(accountId: number): Promise<AuthConfirmation | null> {
    const sql = `
      SELECT * FROM ${this.confirmationsTable} 
      WHERE account_id = $1 
      ORDER BY expires DESC 
      LIMIT 1
    `;
    const result = await this.db.query(sql, [accountId]);
    return result.rows[0] || null;
  }

  async deleteConfirmation(token: string): Promise<void> {
    await this.db.query(`DELETE FROM ${this.confirmationsTable} WHERE token = $1`, [token]);
  }

  async createRememberToken(data: { accountId: number; token: string; expires: Date }): Promise<void> {
    await this.db.query(`DELETE FROM ${this.remembersTable} WHERE account_id = $1`, [data.accountId]);

    const sql = `
      INSERT INTO ${this.remembersTable} (account_id, token, expires)
      VALUES ($1, $2, $3)
    `;

    await this.db.query(sql, [data.accountId, data.token, data.expires]);
  }

  async findRememberToken(token: string): Promise<AuthRemember | null> {
    const sql = `SELECT * FROM ${this.remembersTable} WHERE token = $1`;
    const result = await this.db.query(sql, [token]);
    return result.rows[0] || null;
  }

  async deleteRememberToken(token: string): Promise<void> {
    await this.db.query(`DELETE FROM ${this.remembersTable} WHERE token = $1`, [token]);
  }

  async deleteRememberTokensForAccount(accountId: number): Promise<void> {
    await this.db.query(`DELETE FROM ${this.remembersTable} WHERE account_id = $1`, [accountId]);
  }

  async deleteExpiredRememberTokensForAccount(accountId: number): Promise<void> {
    await this.db.query(`DELETE FROM ${this.remembersTable} WHERE account_id = $1 AND expires <= NOW()`, [accountId]);
  }

  async createResetToken(data: { accountId: number; token: string; expires: Date }): Promise<void> {
    const sql = `
      INSERT INTO ${this.resetsTable} (account_id, token, expires)
      VALUES ($1, $2, $3)
    `;

    await this.db.query(sql, [data.accountId, data.token, data.expires]);
  }

  async findResetToken(token: string): Promise<AuthReset | null> {
    const sql = `
      SELECT * FROM ${this.resetsTable} 
      WHERE token = $1 
      ORDER BY expires DESC 
      LIMIT 1
    `;
    const result = await this.db.query(sql, [token]);
    return result.rows[0] || null;
  }

  async countActiveResetTokensForAccount(accountId: number): Promise<number> {
    const sql = `
      SELECT COUNT(*) as count FROM ${this.resetsTable} 
      WHERE account_id = $1 AND expires >= NOW()
    `;
    const result = await this.db.query(sql, [accountId]);
    return parseInt(result.rows[0]?.count || "0");
  }

  async deleteResetToken(token: string): Promise<void> {
    await this.db.query(`DELETE FROM ${this.resetsTable} WHERE token = $1`, [token]);
  }

  async deleteResetTokensForAccount(accountId: number): Promise<void> {
    await this.db.query(`DELETE FROM ${this.resetsTable} WHERE account_id = $1`, [accountId]);
  }

  async createProvider(data: { accountId: number; provider: string; providerId: string; providerEmail: string | null; providerUsername: string | null; providerName: string | null; providerAvatar: string | null }): Promise<AuthProvider> {
    const sql = `
      INSERT INTO ${this.providersTable} (
        account_id, provider, provider_id, provider_email, 
        provider_username, provider_name, provider_avatar
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const result = await this.db.query(sql, [data.accountId, data.provider, data.providerId, data.providerEmail, data.providerUsername, data.providerName, data.providerAvatar]);

    return result.rows[0];
  }

  async findProviderByProviderIdAndType(providerId: string, provider: string): Promise<AuthProvider | null> {
    const sql = `SELECT * FROM ${this.providersTable} WHERE provider_id = $1 AND provider = $2`;
    const result = await this.db.query(sql, [providerId, provider]);
    return result.rows[0] || null;
  }

  async findProvidersByAccountId(accountId: number): Promise<AuthProvider[]> {
    const sql = `SELECT * FROM ${this.providersTable} WHERE account_id = $1 ORDER BY created_at DESC`;
    const result = await this.db.query(sql, [accountId]);
    return result.rows;
  }

  async deleteProvider(id: number): Promise<void> {
    await this.db.query(`DELETE FROM ${this.providersTable} WHERE id = $1`, [id]);
  }

  async deleteProvidersByAccountId(accountId: number): Promise<void> {
    await this.db.query(`DELETE FROM ${this.providersTable} WHERE account_id = $1`, [accountId]);
  }

  // two-factor authentication methods

  async findTwoFactorMethodsByAccountId(accountId: number): Promise<TwoFactorMethod[]> {
    const sql = `SELECT * FROM ${this.twoFactorMethodsTable} WHERE account_id = $1 ORDER BY created_at DESC`;
    const result = await this.db.query(sql, [accountId]);
    return result.rows;
  }

  async findTwoFactorMethodByAccountAndMechanism(accountId: number, mechanism: TwoFactorMechanism): Promise<TwoFactorMethod | null> {
    const sql = `SELECT * FROM ${this.twoFactorMethodsTable} WHERE account_id = $1 AND mechanism = $2`;
    const result = await this.db.query(sql, [accountId, mechanism]);
    return result.rows[0] || null;
  }

  async createTwoFactorMethod(data: { accountId: number; mechanism: TwoFactorMechanism; secret?: string; backupCodes?: string[]; verified?: boolean }): Promise<TwoFactorMethod> {
    const sql = `
      INSERT INTO ${this.twoFactorMethodsTable} (
        account_id, mechanism, secret, backup_codes, verified
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const result = await this.db.query(sql, [data.accountId, data.mechanism, data.secret || null, data.backupCodes || null, data.verified || false]);

    return result.rows[0];
  }

  async updateTwoFactorMethod(id: number, updates: Partial<Pick<TwoFactorMethod, "secret" | "backup_codes" | "verified" | "last_used_at">>): Promise<void> {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (key === "id") continue;
      fields.push(`${key} = $${paramIndex++}`);
      values.push(value);
    }

    if (fields.length === 0) return;

    values.push(id);
    const sql = `UPDATE ${this.twoFactorMethodsTable} SET ${fields.join(", ")} WHERE id = $${paramIndex}`;
    await this.db.query(sql, values);
  }

  async deleteTwoFactorMethod(id: number): Promise<void> {
    await this.db.query(`DELETE FROM ${this.twoFactorMethodsTable} WHERE id = $1`, [id]);
  }

  async deleteTwoFactorMethodsByAccountId(accountId: number): Promise<void> {
    await this.db.query(`DELETE FROM ${this.twoFactorMethodsTable} WHERE account_id = $1`, [accountId]);
  }

  // two-factor authentication tokens

  async createTwoFactorToken(data: { accountId: number; mechanism: TwoFactorMechanism; selector: string; tokenHash: string; expiresAt: Date }): Promise<TwoFactorToken> {
    const sql = `
      INSERT INTO ${this.twoFactorTokensTable} (
        account_id, mechanism, selector, token_hash, expires_at
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const result = await this.db.query(sql, [data.accountId, data.mechanism, data.selector, data.tokenHash, data.expiresAt]);

    return result.rows[0];
  }

  async findTwoFactorTokenBySelector(selector: string): Promise<TwoFactorToken | null> {
    const sql = `SELECT * FROM ${this.twoFactorTokensTable} WHERE selector = $1 AND expires_at > NOW()`;
    const result = await this.db.query(sql, [selector]);
    return result.rows[0] || null;
  }

  async deleteTwoFactorToken(id: number): Promise<void> {
    await this.db.query(`DELETE FROM ${this.twoFactorTokensTable} WHERE id = $1`, [id]);
  }

  async deleteTwoFactorTokensByAccountId(accountId: number): Promise<void> {
    await this.db.query(`DELETE FROM ${this.twoFactorTokensTable} WHERE account_id = $1`, [accountId]);
  }

  async deleteTwoFactorTokensByAccountAndMechanism(accountId: number, mechanism: TwoFactorMechanism): Promise<void> {
    await this.db.query(`DELETE FROM ${this.twoFactorTokensTable} WHERE account_id = $1 AND mechanism = $2`, [accountId, mechanism]);
  }
}
