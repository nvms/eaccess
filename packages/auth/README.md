# @eaccess/auth

An Express authentication middleware specifically designed for Postgres that provides complete authentication functionality without being tied to any specific ORM, query builder, or user table structure. Comprehensive auth without overwhelming complexity. A clean separation of concerns -- not conflating authentication with user management.

## Features

- **Flexible User Mapping**: Links to your existing user table structure
- **Zero ORM Dependencies**: Pure SQL with configurable table prefixes
- **Complete Auth Flow**: Registration, login, email verification, password reset
- **Role-based Permissions**: Built-in role system with bitmasks
- **Remember Me**: Persistent login tokens
- **Session Management**: Force logout, logout everywhere
- **Admin Functions**: User management and impersonation
- **OAuth Integration**: GitHub, Google, Azure providers with extensible architecture
- **TypeScript Support**: Full type safety

## Installation

```bash
npm install @eaccess/auth express-session
```

## Quick Start

```typescript
import express from 'express';
import session from 'express-session';
import { Pool } from 'pg';
import { createAuthMiddleware, createAuthTables } from '@eaccess/auth';

const app = express();
const pool = new Pool({ connectionString: 'postgresql://...' });

// Setup session middleware
app.use(session({
  secret: 'your-session-secret',
  resave: false,
  saveUninitialized: false,
}));

// Configure auth middleware
const authConfig = {
  db: pool,
  tablePrefix: 'auth_', // Creates: auth_accounts, auth_confirmations, etc.
};

// Create auth tables (run once)
await createAuthTables(authConfig);

// Add auth middleware
app.use(createAuthMiddleware(authConfig));

// Now use auth in your routes
app.post('/register', async (req, res) => {
  try {
    // Option 1: Let the library auto-generate a UUID for the user
    const account = await req.auth.register(
      req.body.email,
      req.body.password,
      undefined, // Auto-generates UUID
      (token) => {
        // Send confirmation email with token
        console.log('Confirmation token:', token);
      }
    );

    // Option 2: Link to your existing user system
    // const user = await db.insert(users).values({...}).returning();
    // const account = await req.auth.register(
    //   req.body.email,
    //   req.body.password,
    //   user.id, // Link to your user
    //   (token) => {
    //     console.log('Confirmation token:', token);
    //   }
    // );
    res.json({ success: true, account });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/login', async (req, res) => {
  try {
    await req.auth.login(req.body.email, req.body.password, req.body.remember);
    res.json({ success: true });
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

app.get('/profile', (req, res) => {
  if (!req.auth.isLoggedIn()) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  res.json({
    email: req.auth.getEmail(),
    status: req.auth.getStatusName(),
    roles: req.auth.getRoleNames(),
    isAdmin: await req.auth.isAdmin(),
  });
});
```

## OAuth Setup

Easy-auth supports OAuth providers (GitHub, Google, Azure) with a clean, extensible API.

### OAuth Configuration

```typescript
import express from 'express';
import session from 'express-session';
import { Pool } from 'pg';
import { createAuthMiddleware, createAuthTables, type OAuthUserData } from '@eaccess/auth';

const app = express();
const pool = new Pool({ connectionString: 'postgresql://...' });

// Your app's user table (example)
const users: Array<{ id: number; name: string; email: string }> = [];

const authConfig = {
  db: pool,
  // Optional: OAuth createUser function to handle new user registration
  createUser: async (userData: OAuthUserData) => {
    // userData contains: { id, email, username?, name?, avatar? }
    // Create user in your app's user table
    const user = await db.insert(users).values({
      name: userData.name || userData.username,
      email: userData.email,
    }).returning();

    return user.id; // Return the new user's ID
  },
  tablePrefix: 'auth_',

  // OAuth provider configuration
  providers: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      redirectUri: 'http://localhost:3000/auth/github/callback'
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      redirectUri: 'http://localhost:3000/auth/google/callback'
    },
    azure: {
      clientId: process.env.AZURE_CLIENT_ID!,
      clientSecret: process.env.AZURE_CLIENT_SECRET!,
      tenantId: process.env.AZURE_TENANT_ID!,
      redirectUri: 'http://localhost:3000/auth/azure/callback'
    }
  }
};

app.use(createAuthMiddleware(authConfig));
```

### OAuth Routes

```typescript
// Initiate OAuth flow
app.get('/auth/github', (req, res) => {
  const authUrl = req.auth.providers.github.getAuthUrl();
  res.redirect(authUrl);
});

// Handle OAuth callback (this does everything!)
app.get('/auth/github/callback', async (req, res) => {
  try {
    await req.auth.providers.github.handleCallback(req);
    res.redirect('/dashboard'); // Success!
  } catch (error) {
    if (error.message.includes('already have an account')) {
      res.redirect('/login?error=email_taken');
    } else {
      res.redirect('/login?error=oauth_failed');
    }
  }
});

// Same pattern for Google and Azure
app.get('/auth/google', (req, res) => {
  const authUrl = req.auth.providers.google.getAuthUrl();
  res.redirect(authUrl);
});

app.get('/auth/google/callback', async (req, res) => {
  try {
    await req.auth.providers.google.handleCallback(req);
    res.redirect('/dashboard');
  } catch (error) {
    res.redirect('/login?error=oauth_failed');
  }
});
```

### Frontend Integration

```html
<!-- Login page -->
<a href="/auth/github" class="oauth-btn">
  <img src="/github-icon.svg" /> Login with GitHub
</a>
<a href="/auth/google" class="oauth-btn">
  <img src="/google-icon.svg" /> Login with Google
</a>
<a href="/auth/azure" class="oauth-btn">
  <img src="/azure-icon.svg" /> Login with Azure
</a>
```

### OAuth Flow Explained

1. **User clicks "Login with GitHub"** → Browser goes to `/auth/github`
2. **Server redirects to GitHub** → User sees GitHub's login page
3. **User authorizes your app** → GitHub redirects to `/auth/github/callback?code=abc123`
4. **Server processes callback** → `handleCallback()` does:
   - Exchange code for access token
   - Fetch user data from GitHub API
   - Check if OAuth user exists (by provider + provider_id)
   - If exists: log them in
   - If new but email exists: throw error
   - If completely new: call `createUser()`, create account + provider record, log them in

### OAuth Error Handling

```typescript
app.get('/auth/github/callback', async (req, res) => {
  try {
    await req.auth.providers.github.handleCallback(req);
    res.redirect('/dashboard');
  } catch (error) {
    if (error.message.includes('already have an account')) {
      // Email exists with different login method
      res.redirect('/login?error=Please use your existing email/password login');
    } else if (error.message.includes('No authorization code')) {
      // User cancelled or OAuth flow failed
      res.redirect('/login?error=Authorization cancelled');
    } else {
      // Other OAuth errors
      console.error('OAuth error:', error);
      res.redirect('/login?error=Login failed, please try again');
    }
  }
});
```

### Environment Variables

Create a `.env` file:

```bash
# GitHub OAuth App (https://github.com/settings/developers)
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# Google OAuth App (https://console.cloud.google.com/)
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Azure OAuth App (https://portal.azure.com/)
AZURE_CLIENT_ID=your_azure_client_id
AZURE_CLIENT_SECRET=your_azure_client_secret
AZURE_TENANT_ID=your_azure_tenant_id
```

### Advanced OAuth Usage

For more control over the OAuth flow:

```typescript
app.get('/auth/github/callback', async (req, res) => {
  try {
    // Get user data without logging in
    const userData = await req.auth.providers.github.getUserData(req);

    // Your custom logic here
    const existingUser = await findUserByEmail(userData.email);
    if (existingUser && !existingUser.allowOAuth) {
      throw new Error('OAuth disabled for this account');
    }

    // Then complete the OAuth flow manually
    await req.auth.providers.github.handleCallback(req);

    res.json({ success: true, user: userData });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

## Multi-Factor Authentication (MFA)

Easy-auth supports TOTP (authenticator apps), Email OTP, and SMS OTP for enhanced security.

### MFA Configuration

Enable MFA in your auth config:

```typescript
const authConfig = {
  db: pool,

  twoFactor: {
    enabled: true,
    requireForOAuth: false,    // Skip MFA for OAuth users (optional)
    issuer: 'MyApp',          // TOTP issuer name
    codeLength: 6,            // OTP code length
    tokenExpiry: '5m',        // OTP expiration
    totpWindow: 1,            // TOTP time window tolerance
    backupCodesCount: 10      // Number of backup codes
  }
};
```

### MFA Login Flow

When MFA is enabled, the login process becomes:

```typescript
app.post('/login', async (req, res) => {
  try {
    await req.auth.login(req.body.email, req.body.password);
    res.json({ success: true });
  } catch (error) {
    if (error instanceof SecondFactorRequiredError) {
      // User needs to complete MFA
      return res.status(202).json({
        requiresTwoFactor: true,
        availableMethods: error.challenge,
        message: 'Please complete two-factor authentication'
      });
    }
    res.status(401).json({ error: error.message });
  }
});
```

### MFA Challenge Structure

The `SecondFactorRequiredError.challenge` contains:

```typescript
interface TwoFactorChallenge {
  totp?: boolean;                    // TOTP available
  email?: {
    otpValue: string;               // The actual OTP code that should be sent via email
    maskedContact: string;          // "j***@example.com"
  };
  sms?: {
    otpValue: string;               // The actual OTP code that should be sent via SMS
    maskedContact: string;          // "+1***90"
  };
  selectors?: {
    email?: string;                 // Internal selector (stored in session & database)
    sms?: string;                   // Internal selector (stored in session & database)
  };
}
```

**Important**: The `otpValue` fields contain the actual codes that should be delivered to the user. The `selectors` are internal identifiers used by the library. In production, you should:
1. Send the `otpValue` codes via your email/SMS service
2. Remove both `otpValue` and `selectors` from client responses for security
3. Only return the `maskedContact` to the frontend (selectors are automatically stored in the user's session)

### Completing MFA Login

After receiving `SecondFactorRequiredError`, verify the second factor:

```typescript
app.post('/verify-2fa', async (req, res) => {
  try {
    const { code, method } = req.body;

    // Verify based on method
    switch (method) {
      case 'totp':
        await req.auth.twoFactor.verify.totp(code);
        break;
      case 'email':
        await req.auth.twoFactor.verify.email(code);
        break;
      case 'sms':
        await req.auth.twoFactor.verify.sms(code);
        break;
      case 'backup':
        await req.auth.twoFactor.verify.backupCode(code);
        break;
      case 'otp':
        // Smart OTP - works for both email and SMS
        await req.auth.twoFactor.verify.otp(code);
        break;
    }

    // Complete login
    await req.auth.completeTwoFactorLogin();
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

### MFA Enrollment

Users can enroll in multiple MFA methods:

#### TOTP (Authenticator App)

```typescript
app.post('/setup-totp', async (req, res) => {
  try {
    const { secret, qrCode, backupCodes } = await req.auth.twoFactor.setup.totp();

    // Show QR code to user for scanning with authenticator app
    res.json({
      secret,      // Manual entry secret
      qrCode,      // QR code URL for scanning
      backupCodes  // One-time backup codes
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

#### Email OTP

```typescript
app.post('/setup-email-2fa', async (req, res) => {
  try {
    await req.auth.twoFactor.setup.email();
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

#### SMS OTP

```typescript
app.post('/setup-sms-2fa', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    await req.auth.twoFactor.setup.sms(phoneNumber);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

### MFA Enrollment with Verification

For production apps, require verification during enrollment:

```typescript
app.post('/setup-totp', async (req, res) => {
  try {
    // Setup but require verification
    const { secret, qrCode } = await req.auth.twoFactor.setup.totp(true);
    res.json({ secret, qrCode, requiresVerification: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/verify-totp-setup', async (req, res) => {
  try {
    const { code } = req.body;
    const backupCodes = await req.auth.twoFactor.complete.totp(code);
    res.json({ success: true, backupCodes });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

### MFA Management

```typescript
// Check MFA status
app.get('/mfa-status', async (req, res) => {
  const status = {
    enabled: await req.auth.twoFactor.isEnabled(),
    methods: {
      totp: await req.auth.twoFactor.totpEnabled(),
      email: await req.auth.twoFactor.emailEnabled(),
      sms: await req.auth.twoFactor.smsEnabled()
    }
  };
  res.json(status);
});

// Disable MFA method
app.delete('/mfa/:method', async (req, res) => {
  try {
    const mechanism = req.params.method === 'totp' ? 1 :
                     req.params.method === 'email' ? 2 : 3;
    await req.auth.twoFactor.disable(mechanism);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Generate new backup codes
app.post('/mfa/backup-codes', async (req, res) => {
  try {
    const backupCodes = await req.auth.twoFactor.generateNewBackupCodes();
    res.json({ backupCodes });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

## Configuration

### User ID Mapping

The auth library maintains its own auth tables (accounts, roles, sessions) that can optionally link to your application's user records via a user ID.

**Registration now takes an optional userId parameter**:

```typescript
app.post('/register', async (req, res) => {
  // Option 1: Let easy-auth auto-generate a UUID (simplest)
  const account = await req.auth.register(req.body.email, req.body.password);

  // Option 2: Link to your existing user table
  const user = await db.insert(users).values({
    name: req.body.name,
    email: req.body.email
  }).returning();

  const account = await req.auth.register(req.body.email, req.body.password, user.id);

  res.json({ success: true, userId: user.id });
});
```

**For OAuth**, you can optionally provide a `createUser` function to handle new OAuth users. This is the ONLY use case for `createUser` - it's not used for regular registration or admin user creation:

```typescript
const authConfig = {
  db: pool,
  // ONLY used for OAuth new user creation
  createUser: async (userData: OAuthUserData) => {
    // Create user in your app's user table
    const user = await db.insert(users).values({
      name: userData.name || userData.username,
      email: userData.email,
    }).returning();

    return user.id; // This will be stored as user_id in auth tables
  }
}
```

**If you don't provide `createUser` for OAuth**, a UUID will be auto-generated - no configuration needed!

**For login**, simply call `req.auth.login()`. You don't need to identify the user beforehand because the `login` method itself does the authentication using the provided credentials.

```typescript
app.post('/login', async (req, res) => {
  try {
    await req.auth.login(req.body.email, req.body.password);
  } catch (error) {
    if (error instanceof UserNotFoundError || error instanceof InvalidPasswordError) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (error instanceof UserInactiveError) {
      return res.status(403).json({ error: 'Account inactive' });
    }

    throw error;
  }

  res.json({ success: true });
});
```

**Important**: If you use `req.session.userId`, it could be helpful to augment the session type if you're using TypeScript:

```typescript
declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}
```

### AuthConfig

```typescript
interface AuthConfig {
  // PostgreSQL connection pool
  db: Pool;

  // Optional OAuth new user creation function
  createUser?: (userData: OAuthUserData) => string | number | Promise<string | number>; // Called when OAuth user doesn't exist in your system

  // Optional settings
  tablePrefix?: string;           // default: 'user_'
  roles?: Record<string, number>; // custom roles from defineRoles(), default: AuthRole
  minPasswordLength?: number;     // default: 8
  maxPasswordLength?: number;     // default: 64
  rememberDuration?: string;      // default: '30d'
  rememberCookieName?: string;    // default: 'remember_token'
  resyncInterval?: string;        // default: '30s'

  // OAuth provider configuration
  providers?: {
    github?: GitHubProviderConfig;
    google?: GoogleProviderConfig;
    azure?: AzureProviderConfig;
  };

  // Multi-factor authentication
  twoFactor?: {
    enabled?: boolean;            // default: false
    requireForOAuth?: boolean;    // default: false
    issuer?: string;              // default: 'EasyAuth'
    codeLength?: number;          // default: 6
    tokenExpiry?: string;         // default: '5m'
    totpWindow?: number;          // default: 1
    backupCodesCount?: number;    // default: 10
  };
}
```

## Database Schema

The library creates its own tables that link to your existing user table:

```sql
-- your existing user table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100),
  -- whatever else
);

-- library creates these tables
CREATE TABLE user_accounts (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,  -- links to your users.id or auto-generated UUID
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  status INTEGER DEFAULT 0,
  rolemask INTEGER DEFAULT 0,
  -- ...
);

-- also: user_confirmations, user_remembers, user_resets, user_providers
-- MFA tables: user_2fa_methods, user_2fa_tokens
-- Activity: user_activity_log
```

## API Reference

### Auth Manager (`req.auth`)

#### Authentication
- `isLoggedIn(): boolean`
- `login(email, password, remember?): Promise<void>`
- `completeTwoFactorLogin(): Promise<void>`
- `logout(): Promise<void>`
- `register(email, password, callback?): Promise<AuthAccount>`

#### User Info
- `getId(): number | null`
- `getEmail(): string | null`
- `getStatus(): number | null`
- `getVerified(): boolean | null`
- `getRoleNames(rolemask?): string[]`
- `getStatusName(): string | null`

#### Permissions
- `hasRole(role): Promise<boolean>`
- `isAdmin(): Promise<boolean>`
- `isRemembered(): boolean`

#### Email Management
- `changeEmail(newEmail, callback): Promise<void>`
- `confirmEmail(token): Promise<string>`
- `confirmEmailAndLogin(token, remember?): Promise<void>`

#### Password Management
- `resetPassword(email, expiresAfter?, maxRequests?, callback?): Promise<void>`
- `confirmResetPassword(token, password, logout?): Promise<void>`
- `verifyPassword(password): Promise<boolean>`

#### Session Management
- `logoutEverywhere(): Promise<void>`
- `logoutEverywhereElse(): Promise<void>`

#### Multi-Factor Authentication (`req.auth.twoFactor`)
- `isEnabled(): Promise<boolean>`
- `totpEnabled(): Promise<boolean>`
- `emailEnabled(): Promise<boolean>`
- `smsEnabled(): Promise<boolean>`
- `getEnabledMethods(): Promise<TwoFactorMechanism[]>`

**Setup Methods:**
- `setup.totp(requireVerification?): Promise<TwoFactorSetupResult>`
- `setup.email(email?, requireVerification?): Promise<void>`
- `setup.sms(phone, requireVerification?): Promise<void>`

**Completion Methods (for verification during enrollment):**
- `complete.totp(code): Promise<string[]>`
- `complete.email(code): Promise<void>`
- `complete.sms(code): Promise<void>`

**Verification Methods (during login):**
- `verify.totp(code): Promise<void>`
- `verify.email(code): Promise<void>`
- `verify.sms(code): Promise<void>`
- `verify.backupCode(code): Promise<void>`
- `verify.otp(code): Promise<void>`

**Management Methods:**
- `disable(mechanism): Promise<void>`
- `generateNewBackupCodes(): Promise<string[]>`
- `getContact(mechanism): Promise<string | null>`

### Admin Functions (also on `req.auth`)

#### User Management
- `createUser(credentials, callback?): Promise<AuthAccount>`
- `loginAsUserBy(identifier): Promise<void>`
- `deleteUserBy(identifier): Promise<void>`

#### Role Management
- `addRoleForUserBy(identifier, role): Promise<void>`
- `removeRoleForUserBy(identifier, role): Promise<void>`
- `hasRoleForUserBy(identifier, role): Promise<boolean>`

#### Account Management
- `changePasswordForUserBy(identifier, password): Promise<void>`
- `setStatusForUserBy(identifier, status): Promise<void>`
- `initiatePasswordResetForUserBy(identifier, expiresAfter?, callback?): Promise<void>`

### Schema Utilities

```typescript
import { createAuthTables, dropAuthTables, cleanupExpiredTokens, getAuthTableStats } from '@eaccess/auth';

// Setup tables
await createAuthTables(config);

// Cleanup (useful for cron jobs)
await cleanupExpiredTokens(config);

// Get statistics
const stats = await getAuthTableStats(config);
console.log(`${stats.accounts} accounts, ${stats.expiredRemembers} expired tokens`);

// Remove all auth tables
await dropAuthTables(config);
```

## Custom Roles

The default `AuthRole` enum provides 21 predefined roles, but most apps need their own. Use `defineRoles` to create a custom role set:

```typescript
import { defineRoles } from '@eaccess/auth';

const Roles = defineRoles('owner', 'editor', 'viewer');
// { owner: 1, editor: 2, viewer: 4 }

const authConfig = {
  db: pool,
  roles: Roles, // getRoleNames() will use these names
};

// usage
await req.auth.addRoleForUserBy({ email: 'user@example.com' }, Roles.owner | Roles.editor);
req.auth.getRoleNames(); // ['owner', 'editor']
await req.auth.hasRole(Roles.editor); // true
```

Names are preserved exactly as provided - no transformation. Max 31 roles (Postgres INTEGER is 32-bit signed). If you don't set `config.roles`, the default `AuthRole` enum is used.

The admin panel (`@eaccess/admin`) reads `config.roles` from the backend automatically, so custom roles show up in the user management UI without any extra configuration.

## Standalone Auth (no request context)

For server-side operations outside of Express routes (scripts, workers, cron jobs), use `createAuthContext`:

```typescript
import { createAuthContext } from '@eaccess/auth';

const auth = createAuthContext(authConfig);

await auth.createUser({ email: 'user@example.com', password: 'password123' });
await auth.addRoleForUserBy({ email: 'user@example.com' }, Roles.editor);
await auth.resetPassword('user@example.com', '1h', 3, (token) => sendResetEmail(token));
```

For WebSocket or raw HTTP authentication:

```typescript
import { authenticateRequest } from '@eaccess/auth';

const result = await authenticateRequest(authConfig, req, sessionMiddleware);
// result: { account: AuthAccount | null, source: 'session' | 'remember' | null }
```

## Constants

```typescript
import { AuthStatus, AuthRole } from '@eaccess/auth';

// User statuses
AuthStatus.Normal        // 0
AuthStatus.Archived      // 1
AuthStatus.Banned        // 2
AuthStatus.Locked        // 3
AuthStatus.PendingReview // 4
AuthStatus.Suspended     // 5

// Default roles (bitmask) - or use defineRoles() for custom roles
AuthRole.Admin           // 1
AuthRole.Author          // 2
AuthRole.Collaborator    // 4
// ... many more
```

## Error Handling

```typescript
import {
  EmailTakenError,
  InvalidPasswordError,
  UserNotFoundError,
  SecondFactorRequiredError,
  InvalidTwoFactorCodeError
} from '@eaccess/auth';

app.post('/register', async (req, res) => {
  try {
    await req.auth.register(email, password);
  } catch (error) {
    if (error instanceof EmailTakenError) {
      return res.status(409).json({ error: 'Email already exists' });
    }
    if (error instanceof InvalidPasswordError) {
      return res.status(400).json({ error: 'Password too weak' });
    }
    throw error;
  }
});

app.post('/login', async (req, res) => {
  try {
    await req.auth.login(req.body.email, req.body.password);
    res.json({ success: true });
  } catch (error) {
    if (error instanceof SecondFactorRequiredError) {
      return res.status(202).json({
        requiresTwoFactor: true,
        availableMethods: error.challenge
      });
    }
    if (error instanceof InvalidTwoFactorCodeError) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }
    throw error;
  }
});
```

## Examples

### Database Setup

```typescript
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: 'postgresql://user:password@localhost:5432/dbname'
});

const config = {
  db: pool,
  tablePrefix: 'auth_',
};
```

### Role-Based Access Control

```typescript
app.get('/admin', async (req, res) => {
  if (!req.auth.isLoggedIn()) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  if (!await req.auth.hasRole(AuthRole.Admin)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  // Admin-only content
});

// Add role to user
await req.auth.addRoleForUserBy(
  { email: 'user@example.com' },
  AuthRole.Admin | AuthRole.Editor
);
```

## License

MIT
