# Authentication & MFA

Login checks password, account status, email verification, and optional two-factor authentication.

## Login

```typescript
await req.auth.login(email, password, remember);
```

The login method:

1. Finds the account by email
1. Verifies the password hash
1. Checks that the email is verified
1. Checks that the account status is `Normal` (not banned, locked, etc.)
1. If 2FA is enabled and the user has verified methods, throws `SecondFactorRequiredError`
1. Otherwise, creates a session and optionally sets a remember-me token

## Two-Factor Challenge

When `SecondFactorRequiredError` is thrown, the user is not logged in yet. The error includes `availableMethods` describing which mechanisms are available (TOTP, email, SMS). The session holds an `awaitingTwoFactor` state with an expiry.

Return the available methods to the client so it can show the appropriate UI. Do not return raw OTP codes to the client - send them via your email/SMS service.

## Completing 2FA

After verification succeeds, call `completeTwoFactorLogin()` to finish the login:

```typescript
await req.auth.twoFactor.verify.totp(code);
await req.auth.completeTwoFactorLogin();
```

Verifiers: `verify.totp()`, `verify.email()`, `verify.sms()`, `verify.backupCode()`, `verify.otp()` (tries email and SMS automatically).

See the [MFA Patterns](https://nvms.github.io/eaccess/guides/mfa/index.md) guide for full implementation examples including OTP delivery.

## Remember Me

Login with `remember: true` creates a persistent token in `{prefix}remembers` and sets an httpOnly cookie. On future requests, the middleware auto-restores the session from the cookie. Configure `rememberDuration` and `rememberCookieName` in `AuthConfig`.

## Logout

```typescript
await req.auth.logout();
await req.auth.logoutEverywhere();
await req.auth.logoutEverywhereElse();
```

- `logout()` clears the current session and remember token
- `logoutEverywhere()` clears all sessions and remember tokens
- `logoutEverywhereElse()` keeps the current session, clears everything else
