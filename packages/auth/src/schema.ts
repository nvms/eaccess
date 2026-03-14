import type { AuthConfig } from "./types.js";

export async function createAuthTables(config: AuthConfig): Promise<void> {
  const prefix = config.tablePrefix || "user_";
  const { db } = config;

  const accountsTable = `${prefix}accounts`;
  await db.query(`
    CREATE TABLE IF NOT EXISTS ${accountsTable} (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255),
      verified BOOLEAN DEFAULT FALSE,
      status INTEGER DEFAULT 0,
      rolemask INTEGER DEFAULT 0,
      last_login TIMESTAMPTZ,
      force_logout INTEGER DEFAULT 0,
      resettable BOOLEAN DEFAULT TRUE,
      registered TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT ${prefix}unique_user_id_per_account UNIQUE(user_id)
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_${prefix}accounts_user_id ON ${accountsTable}(user_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_${prefix}accounts_email ON ${accountsTable}(email)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_${prefix}accounts_status ON ${accountsTable}(status)`);

  const confirmationsTable = `${prefix}confirmations`;
  await db.query(`
    CREATE TABLE IF NOT EXISTS ${confirmationsTable} (
      id SERIAL PRIMARY KEY,
      account_id INTEGER NOT NULL,
      token VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      expires TIMESTAMPTZ NOT NULL,
      CONSTRAINT fk_${prefix}confirmations_account 
        FOREIGN KEY (account_id) REFERENCES ${accountsTable}(id) ON DELETE CASCADE
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_${prefix}confirmations_token ON ${confirmationsTable}(token)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_${prefix}confirmations_email ON ${confirmationsTable}(email)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_${prefix}confirmations_account_id ON ${confirmationsTable}(account_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_${prefix}confirmations_expires ON ${confirmationsTable}(expires)`);

  const remembersTable = `${prefix}remembers`;
  await db.query(`
    CREATE TABLE IF NOT EXISTS ${remembersTable} (
      id SERIAL PRIMARY KEY,
      account_id INTEGER NOT NULL,
      token VARCHAR(255) NOT NULL,
      expires TIMESTAMPTZ NOT NULL,
      CONSTRAINT fk_${prefix}remembers_account 
        FOREIGN KEY (account_id) REFERENCES ${accountsTable}(id) ON DELETE CASCADE
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_${prefix}remembers_token ON ${remembersTable}(token)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_${prefix}remembers_account_id ON ${remembersTable}(account_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_${prefix}remembers_expires ON ${remembersTable}(expires)`);

  const resetsTable = `${prefix}resets`;
  await db.query(`
    CREATE TABLE IF NOT EXISTS ${resetsTable} (
      id SERIAL PRIMARY KEY,
      account_id INTEGER NOT NULL,
      token VARCHAR(255) NOT NULL,
      expires TIMESTAMPTZ NOT NULL,
      CONSTRAINT fk_${prefix}resets_account 
        FOREIGN KEY (account_id) REFERENCES ${accountsTable}(id) ON DELETE CASCADE
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_${prefix}resets_token ON ${resetsTable}(token)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_${prefix}resets_account_id ON ${resetsTable}(account_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_${prefix}resets_expires ON ${resetsTable}(expires)`);

  const providersTable = `${prefix}providers`;
  await db.query(`
    CREATE TABLE IF NOT EXISTS ${providersTable} (
      id SERIAL PRIMARY KEY,
      account_id INTEGER NOT NULL,
      provider VARCHAR(50) NOT NULL,
      provider_id VARCHAR(255) NOT NULL,
      provider_email VARCHAR(255),
      provider_username VARCHAR(255),
      provider_name VARCHAR(255),
      provider_avatar VARCHAR(500),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT fk_${prefix}providers_account 
        FOREIGN KEY (account_id) REFERENCES ${accountsTable}(id) ON DELETE CASCADE,
      CONSTRAINT ${prefix}unique_provider_identity 
        UNIQUE(provider, provider_id)
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_${prefix}providers_account_id ON ${providersTable}(account_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_${prefix}providers_provider ON ${providersTable}(provider)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_${prefix}providers_provider_id ON ${providersTable}(provider_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_${prefix}providers_email ON ${providersTable}(provider_email)`);

  const activityTable = `${prefix}activity_log`;
  await db.query(`
    CREATE TABLE IF NOT EXISTS ${activityTable} (
      id SERIAL PRIMARY KEY,
      account_id INTEGER,
      action VARCHAR(255) NOT NULL,
      ip_address INET,
      user_agent TEXT,
      browser VARCHAR(255),
      os VARCHAR(255),
      device VARCHAR(255),
      success BOOLEAN DEFAULT TRUE,
      metadata JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT fk_${prefix}activity_log_account 
        FOREIGN KEY (account_id) REFERENCES ${accountsTable}(id) ON DELETE CASCADE
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_${prefix}activity_log_created_at ON ${activityTable}(created_at DESC)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_${prefix}activity_log_account_id ON ${activityTable}(account_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_${prefix}activity_log_action ON ${activityTable}(action)`);

  const twoFactorMethodsTable = `${prefix}2fa_methods`;
  await db.query(`
    CREATE TABLE IF NOT EXISTS ${twoFactorMethodsTable} (
      id SERIAL PRIMARY KEY,
      account_id INTEGER NOT NULL,
      mechanism INTEGER NOT NULL,
      secret VARCHAR(255),
      backup_codes TEXT[],
      verified BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      last_used_at TIMESTAMPTZ,
      CONSTRAINT fk_${prefix}2fa_methods_account 
        FOREIGN KEY (account_id) REFERENCES ${accountsTable}(id) ON DELETE CASCADE,
      CONSTRAINT ${prefix}unique_account_mechanism 
        UNIQUE(account_id, mechanism)
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_${prefix}2fa_methods_account_id ON ${twoFactorMethodsTable}(account_id)`);

  const twoFactorTokensTable = `${prefix}2fa_tokens`;
  await db.query(`
    CREATE TABLE IF NOT EXISTS ${twoFactorTokensTable} (
      id SERIAL PRIMARY KEY,
      account_id INTEGER NOT NULL,
      mechanism INTEGER NOT NULL,
      selector VARCHAR(32) NOT NULL,
      token_hash VARCHAR(255) NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT fk_${prefix}2fa_tokens_account 
        FOREIGN KEY (account_id) REFERENCES ${accountsTable}(id) ON DELETE CASCADE
    )
  `);

  await db.query(`CREATE INDEX IF NOT EXISTS idx_${prefix}2fa_tokens_selector ON ${twoFactorTokensTable}(selector)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_${prefix}2fa_tokens_account_id ON ${twoFactorTokensTable}(account_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_${prefix}2fa_tokens_expires ON ${twoFactorTokensTable}(expires_at)`);
}

export async function dropAuthTables(config: AuthConfig): Promise<void> {
  const prefix = config.tablePrefix || "user_";
  const { db } = config;

  await db.query(`DROP TABLE IF EXISTS ${prefix}2fa_tokens CASCADE`);
  await db.query(`DROP TABLE IF EXISTS ${prefix}2fa_methods CASCADE`);
  await db.query(`DROP TABLE IF EXISTS ${prefix}activity_log CASCADE`);
  await db.query(`DROP TABLE IF EXISTS ${prefix}providers CASCADE`);
  await db.query(`DROP TABLE IF EXISTS ${prefix}resets CASCADE`);
  await db.query(`DROP TABLE IF EXISTS ${prefix}remembers CASCADE`);
  await db.query(`DROP TABLE IF EXISTS ${prefix}confirmations CASCADE`);
  await db.query(`DROP TABLE IF EXISTS ${prefix}accounts CASCADE`);
}

export async function cleanupExpiredTokens(config: AuthConfig): Promise<void> {
  const prefix = config.tablePrefix || "user_";
  const { db } = config;

  await db.query(`DELETE FROM ${prefix}confirmations WHERE expires < NOW()`);
  await db.query(`DELETE FROM ${prefix}remembers WHERE expires < NOW()`);
  await db.query(`DELETE FROM ${prefix}resets WHERE expires < NOW()`);
  await db.query(`DELETE FROM ${prefix}2fa_tokens WHERE expires_at < NOW()`);
}

export async function getAuthTableStats(config: AuthConfig): Promise<{
  accounts: number;
  providers: number;
  confirmations: number;
  remembers: number;
  resets: number;
  twoFactorMethods: number;
  twoFactorTokens: number;
  expiredConfirmations: number;
  expiredRemembers: number;
  expiredResets: number;
  expiredTwoFactorTokens: number;
}> {
  const prefix = config.tablePrefix || "user_";
  const { db } = config;

  const [accountsResult, providersResult, confirmationsResult, remembersResult, resetsResult, twoFactorMethodsResult, twoFactorTokensResult, expiredConfirmationsResult, expiredRemembersResult, expiredResetsResult, expiredTwoFactorTokensResult] =
    await Promise.all([
      db.query(`SELECT COUNT(*) as count FROM ${prefix}accounts`),
      db.query(`SELECT COUNT(*) as count FROM ${prefix}providers`),
      db.query(`SELECT COUNT(*) as count FROM ${prefix}confirmations`),
      db.query(`SELECT COUNT(*) as count FROM ${prefix}remembers`),
      db.query(`SELECT COUNT(*) as count FROM ${prefix}resets`),
      db.query(`SELECT COUNT(*) as count FROM ${prefix}2fa_methods`),
      db.query(`SELECT COUNT(*) as count FROM ${prefix}2fa_tokens`),
      db.query(`SELECT COUNT(*) as count FROM ${prefix}confirmations WHERE expires < NOW()`),
      db.query(`SELECT COUNT(*) as count FROM ${prefix}remembers WHERE expires < NOW()`),
      db.query(`SELECT COUNT(*) as count FROM ${prefix}resets WHERE expires < NOW()`),
      db.query(`SELECT COUNT(*) as count FROM ${prefix}2fa_tokens WHERE expires_at < NOW()`),
    ]);

  return {
    accounts: parseInt(accountsResult.rows[0]?.count || "0"),
    providers: parseInt(providersResult.rows[0]?.count || "0"),
    confirmations: parseInt(confirmationsResult.rows[0]?.count || "0"),
    remembers: parseInt(remembersResult.rows[0]?.count || "0"),
    resets: parseInt(resetsResult.rows[0]?.count || "0"),
    twoFactorMethods: parseInt(twoFactorMethodsResult.rows[0]?.count || "0"),
    twoFactorTokens: parseInt(twoFactorTokensResult.rows[0]?.count || "0"),
    expiredConfirmations: parseInt(expiredConfirmationsResult.rows[0]?.count || "0"),
    expiredRemembers: parseInt(expiredRemembersResult.rows[0]?.count || "0"),
    expiredResets: parseInt(expiredResetsResult.rows[0]?.count || "0"),
    expiredTwoFactorTokens: parseInt(expiredTwoFactorTokensResult.rows[0]?.count || "0"),
  };
}
