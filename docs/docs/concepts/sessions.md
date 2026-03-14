# Sessions & Resync

`express-session` backs everything. The middleware creates an AuthManager per request, attaches it to `req.auth`, and keeps session state fresh.

## Middleware Flow

`createAuthMiddleware(config)` returns Express middleware that:

1. Creates an `AuthManager` with the current `req`, `res`, and config
2. Attaches it to `req.auth`
3. Calls `resyncSession()` to refresh session data from the database
4. Calls `processRememberDirective()` to restore sessions from remember-me cookies

## Resync

`resyncSession()` keeps the session in sync with the database and enforces force-logout flags.

- Skips if not logged in
- If `shouldForceLogout` is set on the session, logs out immediately
- Throttled by `resyncInterval` (default `"30s"`, configurable)
- Fetches the account from the database; logs out if the account is missing
- Compares `account.force_logout` counter with the session's value; logs out if higher
- Updates session fields: email, status, rolemask, verified, hasPassword

You can force an immediate resync by calling `req.auth.resyncSession(true)`.

## Remember Tokens

When a user logs in with `remember: true`, a token is stored in `{prefix}remembers` and set as an httpOnly cookie.

On subsequent requests, the middleware checks for the cookie and restores the session if the token is valid and unexpired. Invalid or expired tokens are cleared automatically.

## Activity Logging

The `ActivityLogger` records actions like login, failed login, 2FA prompts, remember token creation, role changes, and more. It parses user agent strings for browser/OS/device info and stores metadata as JSON.

Activity logging is enabled by default. Configure it in `AuthConfig`:

```typescript
const authConfig = {
  db: pool,
  activityLog: {
    enabled: true,
    maxEntries: 10000,
    actions: [AuthActivityAction.Login, AuthActivityAction.FailedLogin],
  },
};
```
