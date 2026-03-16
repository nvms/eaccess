# Express Middleware

## Setup

```typescript
import express from "express";
import session from "express-session";
import { Pool } from "pg";
import { createAuthMiddleware, createAuthTables, defineRoles } from "@eaccess/auth";

const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
}));

const Roles = defineRoles("admin", "owner", "editor", "viewer");

const authConfig = {
  db: pool,
  tablePrefix: "auth_",
  roles: Roles,
  resyncInterval: "30s",
};

await createAuthTables(authConfig);
app.use(createAuthMiddleware(authConfig));
```

## What `req.auth` Gives You

**Session state:** `isLoggedIn()`, `getId()`, `getEmail()`, `getStatus()`, `getStatusName()`, `getVerified()`, `hasPassword()`, `getRoleNames()`, `isRemembered()`

**Auth flows:** `login()`, `register()`, `logout()`, `completeTwoFactorLogin()`

**Email:** `changeEmail()`, `confirmEmail()`, `confirmEmailAndLogin()`

**Password:** `resetPassword()`, `confirmResetPassword()`, `verifyPassword()`

**Roles:** `hasRole()`, `isAdmin()`, `addRoleForUserBy()`, `removeRoleForUserBy()`, `hasRoleForUserBy()`

**Admin:** `createUser()`, `deleteUserBy()`, `loginAsUserBy()`, `forceLogoutForUserBy()`, `changePasswordForUserBy()`, `setStatusForUserBy()`, `userExistsByEmail()`

**Session management:** `logoutEverywhere()`, `logoutEverywhereElse()`, `resyncSession()`

**OAuth:** `req.auth.providers.github`, `.google`, `.azure`

**MFA:** `req.auth.twoFactor` with setup, verify, complete, disable, and status methods

## AuthConfig Reference

```typescript
interface AuthConfig {
  db: Pool;
  createUser?: (userData: OAuthUserData) => string | number | Promise<string | number>;
  tablePrefix?: string;           // default: "user_"
  roles?: Record<string, number>; // from defineRoles(), default: AuthRole
  minPasswordLength?: number;     // default: 8
  maxPasswordLength?: number;     // default: 64
  rememberDuration?: string;      // default: "30d"
  rememberCookieName?: string;    // default: "remember_token"
  resyncInterval?: string;        // default: "30s"
  cookie?: {
    domain?: string;
    secure?: boolean;
    sameSite?: "strict" | "lax" | "none";
  };
  activityLog?: {
    enabled?: boolean;
    maxEntries?: number;
    actions?: AuthActivityActionType[];
  };
  providers?: {
    github?: GitHubProviderConfig;
    google?: GoogleProviderConfig;
    azure?: AzureProviderConfig;
  };
  twoFactor?: {
    enabled?: boolean;
    requireForOAuth?: boolean;
    issuer?: string;
    codeLength?: number;
    tokenExpiry?: string;
    totpWindow?: number;
    backupCodesCount?: number;
  };
}
```
