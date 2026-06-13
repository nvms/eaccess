# API Reference

The full API surface lives on `req.auth` (AuthManager instance).

## Session

| Method                    | Returns           | Description                                           |
| ------------------------- | ----------------- | ----------------------------------------------------- |
| `isLoggedIn()`            | `boolean`         | Check if user has an active session                   |
| `getId()`                 | `number \| null`  | Account ID                                            |
| `getEmail()`              | `string \| null`  | Account email                                         |
| `getStatus()`             | `number \| null`  | Status code                                           |
| `getStatusName()`         | `string \| null`  | Status name (Normal, Banned, etc.)                    |
| `getVerified()`           | `boolean \| null` | Email verification status                             |
| `hasPassword()`           | `boolean \| null` | Whether account has a password (false for OAuth-only) |
| `getRoleNames(rolemask?)` | `string[]`        | Role names for current user or given mask             |
| `isRemembered()`          | `boolean`         | Whether session was restored from remember-me cookie  |
| `resyncSession(force?)`   | `Promise<void>`   | Refresh session data from database                    |

## Auth Flows

| Method                                          | Returns                | Description                            |
| ----------------------------------------------- | ---------------------- | -------------------------------------- |
| `login(email, password, remember?)`             | `Promise<void>`        | Authenticate and create session        |
| `register(email, password, userId?, callback?)` | `Promise<AuthAccount>` | Create account                         |
| `logout()`                                      | `Promise<void>`        | End current session                    |
| `completeTwoFactorLogin()`                      | `Promise<void>`        | Complete login after 2FA verification  |
| `confirmEmail(token)`                           | `Promise<string>`      | Confirm email, returns the email       |
| `confirmEmailAndLogin(token, remember?)`        | `Promise<void>`        | Confirm and auto-login                 |
| `changeEmail(newEmail, callback)`               | `Promise<void>`        | Request email change with confirmation |

## Password

| Method                                                         | Returns            | Description                            |
| -------------------------------------------------------------- | ------------------ | -------------------------------------- |
| `resetPassword(email, expiresAfter?, maxRequests?, callback?)` | `Promise<void>`    | Initiate reset                         |
| `confirmResetPassword(token, password, logout?)`               | `Promise<void>`    | Complete reset                         |
| `verifyPassword(password)`                                     | `Promise<boolean>` | Check if password matches current user |

## Roles

| Method                                  | Returns            | Description                             |
| --------------------------------------- | ------------------ | --------------------------------------- |
| `hasRole(role)`                         | `Promise<boolean>` | Check if current user has role          |
| `isAdmin()`                             | `Promise<boolean>` | Check for Admin role (bitmask 1)        |
| `addRoleForUserBy(identifier, role)`    | `Promise<void>`    | Add role by accountId, email, or userId |
| `removeRoleForUserBy(identifier, role)` | `Promise<void>`    | Remove role                             |
| `hasRoleForUserBy(identifier, role)`    | `Promise<boolean>` | Check role for any user                 |

## Admin

| Method                                                                 | Returns                | Description                         |
| ---------------------------------------------------------------------- | ---------------------- | ----------------------------------- |
| `createUser(credentials, userId?, callback?)`                          | `Promise<AuthAccount>` | Create user programmatically        |
| `deleteUserBy(identifier)`                                             | `Promise<void>`        | Delete user and all associated data |
| `loginAsUserBy(identifier)`                                            | `Promise<void>`        | Impersonate a user                  |
| `forceLogoutForUserBy(identifier)`                                     | `Promise<void>`        | Force logout all sessions           |
| `changePasswordForUserBy(identifier, password)`                        | `Promise<void>`        | Admin password change               |
| `setStatusForUserBy(identifier, status)`                               | `Promise<void>`        | Change account status               |
| `initiatePasswordResetForUserBy(identifier, expiresAfter?, callback?)` | `Promise<void>`        | Admin-initiated reset               |
| `userExistsByEmail(email)`                                             | `Promise<boolean>`     | Check if email is registered        |

## Session Management

| Method                   | Returns         | Description                            |
| ------------------------ | --------------- | -------------------------------------- |
| `logoutEverywhere()`     | `Promise<void>` | Clear all sessions and remember tokens |
| `logoutEverywhereElse()` | `Promise<void>` | Clear all except current session       |

## Two-Factor (`req.auth.twoFactor`)

**Status:** `isEnabled()`, `totpEnabled()`, `emailEnabled()`, `smsEnabled()`, `getEnabledMethods()`, `getTotpUri()`, `getContact(mechanism)`

**Setup:** `setup.totp(requireVerification?)`, `setup.email(email?, requireVerification?)`, `setup.sms(phone, requireVerification?)`

**Complete (after setup with verification):** `complete.totp(code)`, `complete.email(code)`, `complete.sms(code)`

**Verify (during login):** `verify.totp(code)`, `verify.email(code)`, `verify.sms(code)`, `verify.backupCode(code)`, `verify.otp(code)`

**Manage:** `disable(mechanism)`, `generateNewBackupCodes()`

## OAuth Providers (`req.auth.providers`)

Each provider (`.github`, `.google`, `.azure`) exposes:

| Method                        | Returns                        | Description                      |
| ----------------------------- | ------------------------------ | -------------------------------- |
| `getAuthUrl(state?, scopes?)` | `string`                       | OAuth authorization URL          |
| `handleCallback(req)`         | `Promise<OAuthCallbackResult>` | Process OAuth callback           |
| `getUserData(req)`            | `Promise<OAuthUserData>`       | Fetch user profile from provider |

## Standalone Functions

| Function                                               | Description                                                 |
| ------------------------------------------------------ | ----------------------------------------------------------- |
| `defineRoles(...names)`                                | Create custom role bitmask object                           |
| `createAuthContext(config)`                            | Auth operations without Express request context             |
| `authenticateRequest(config, req, sessionMiddleware?)` | Authenticate raw HTTP/WebSocket requests                    |
| `createAuthTables(config)`                             | Create all auth tables (idempotent)                         |
| `dropAuthTables(config)`                               | Drop all auth tables                                        |
| `cleanupExpiredTokens(config)`                         | Remove expired confirmations, resets, remembers, 2FA tokens |
| `getAuthTableStats(config)`                            | Get row counts and expired token counts                     |
| `addRoleToUser(config, identifier, role)`              | Add role without request context                            |
| `removeRoleFromUser(config, identifier, role)`         | Remove role without request context                         |
| `setUserRoles(config, identifier, rolemask)`           | Set complete rolemask                                       |
| `getUserRoles(config, identifier)`                     | Get current rolemask                                        |
