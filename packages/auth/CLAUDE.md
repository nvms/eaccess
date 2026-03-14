# @eaccess/auth

Postgres-backed Express auth middleware. Handles registration, login, sessions, remember-me, OAuth (GitHub/Google/Azure), roles (bitmask), 2FA (TOTP + email/SMS OTP + backup codes), and activity logging.

## Dev setup

```bash
docker compose up -d    # starts postgres on port 5433
npm run test:run        # runs vitest once
npm run test            # runs vitest in watch mode
npm run build           # builds with tsup
```

## Architecture

- `auth-manager.ts` - main AuthManager class, attached to every request as `req.auth`
- `auth-functions.ts` - standalone functions for admin operations (no request context needed)
- `auth-context.ts` - `createAuthContext()` wraps auth-functions for use outside Express
- `middleware.ts` - `createAuthMiddleware()` creates Express middleware
- `queries.ts` - all DB queries, parameterized, uses configurable table prefix
- `schema.ts` - table creation/drop/cleanup/stats
- `user-roles.ts` - `defineRoles()` helper + standalone role operations
- `providers/` - OAuth providers extending BaseOAuthProvider
- `two-factor/` - TwoFactorManager, TotpProvider, OtpProvider
- `errors.ts` - all error classes extend AuthError
- `types.ts` - all interfaces, AuthConfig, enums (AuthStatus, AuthRole, AuthActivityAction)

## Testing

Tests are integration tests against a real postgres database (port 5433, compose.yml).
Three test files: auth.test.ts (core), oauth.test.ts (OAuth), two-factor.test.ts (2FA).
Each uses its own table prefix to avoid conflicts.

## Key patterns

- all admin/standalone functions live on `req.auth` (there is no separate admin object)
- `defineRoles('x', 'y')` returns `{ x: 1, y: 2 }`, pass as `config.roles` so `getRoleNames()` uses custom names
- OTP/backup codes/OAuth state use `crypto` (not Math.random)
- token comparison goes through `@prsm/hash` verify
- session regeneration on login prevents session fixation
