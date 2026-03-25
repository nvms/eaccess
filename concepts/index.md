# Core Concepts

eaccess is session-based Express auth backed by PostgreSQL. The middleware attaches an `AuthManager` to every request as `req.auth`, which handles login, registration, roles, MFA, OAuth, and session management.

## Architecture

- **Auth tables** with configurable prefix: accounts, confirmations, resets, remembers, providers, 2fa_methods, 2fa_tokens, activity_log
- **Express middleware** creates an AuthManager per request and attaches it to `req.auth`
- **Admin UI** mounts as Express middleware, serves a Vue SPA for user management
- **OAuth providers** (GitHub, Google, Azure) with pluggable user creation
- **MFA**: TOTP, email OTP, SMS OTP, backup codes
- **Roles**: bitmask-based, either custom (`defineRoles`) or built-in defaults

## Topics

- [Sessions & Resync](https://nvms.github.io/eaccess/concepts/sessions/index.md) - how the middleware manages session state
- [Registration & Confirmation](https://nvms.github.io/eaccess/concepts/registration/index.md) - creating accounts with optional email verification
- [Authentication & MFA](https://nvms.github.io/eaccess/concepts/authentication/index.md) - login flow, 2FA challenges, remember-me
- [Password Reset](https://nvms.github.io/eaccess/concepts/password-reset/index.md) - forgot password with secure tokens
- [Roles](https://nvms.github.io/eaccess/concepts/roles/index.md) - bitmask roles with `defineRoles` and built-in defaults
- [Multi-Tenant Mapping](https://nvms.github.io/eaccess/concepts/multi-tenant/index.md) - linking auth accounts to your own user tables
- [Providers](https://nvms.github.io/eaccess/concepts/providers/index.md) - OAuth with GitHub, Google, Azure
- [Standalone Auth](https://nvms.github.io/eaccess/concepts/standalone/index.md) - using auth outside of Express routes
