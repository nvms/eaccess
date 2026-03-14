---
hide:
  - navigation
---

# eaccess auth

Session-based Express authentication for PostgreSQL. Roles, MFA, OAuth, and an admin UI. Everything lives on `req.auth`.

```bash
npm install @eaccess/auth express-session
```

## What it does

- Session-based auth with `express-session` and PostgreSQL storage
- Drop-in middleware that puts an auth manager on every request
- Custom roles via bitmask (`defineRoles`) or built-in defaults
- 2FA: TOTP, email OTP, SMS OTP, backup codes
- OAuth: GitHub, Google, Azure
- Remember-me with persistent tokens
- Admin UI for user management
- Maps to your existing user tables via `user_id` - no schema migration needed

## How it works

1. Add `express-session` and the auth middleware to your Express app
2. Call `createAuthTables(config)` once to set up the database tables
3. Every request gets `req.auth` with methods for login, register, roles, MFA, OAuth
4. Optionally mount the admin UI for user management

## Stack

| Layer | Implementation |
|-------|---------------|
| Sessions | `express-session` |
| Storage | PostgreSQL via `pg` Pool |
| Auth | `req.auth` (AuthManager) |
| Roles | Bitmask with `defineRoles()` |
| MFA | TOTP + OTP + backup codes |
| OAuth | GitHub, Google, Azure |
| Admin | Vue 3 SPA served from Express |
