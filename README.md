<p align="center">
  <img src=".github/logo.svg" width="80" height="80" alt="eaccess logo">
</p>

<h1 align="center">eaccess</h1>

Session-based Express authentication for PostgreSQL.

Handles registration, login, email verification, password reset, roles (bitmask), remember-me, OAuth (GitHub, Google, Azure), two-factor auth (TOTP, email OTP, SMS OTP, backup codes), activity logging, and ships an admin panel for user management.

## Packages

| Package | Description |
|---------|-------------|
| `@eaccess/auth` | Core auth middleware, roles, MFA, OAuth, session management |
| `@eaccess/admin` | Vue 3 admin panel for user management |
| `@eaccess/totp` | TOTP generation and verification |

## Docs

[nvms.github.io/eaccess](https://nvms.github.io/eaccess/)
