# Authentication & MFA

Login checks password, account status, email verification, and optional two-factor authentication.

## Login

```typescript
app.post("/login", async (req, res) => {
  try {
    await req.auth.login(req.body.email, req.body.password, req.body.remember);
    res.json({ success: true });
  } catch (error) {
    if (error.name === "SecondFactorRequiredError") {
      return res.status(202).json({
        requiresTwoFactor: true,
        availableMethods: error.availableMethods,
      });
    }
    res.status(401).json({ error: error.message });
  }
});
```

The login method:

1. Finds the account by email
2. Verifies the password hash
3. Checks that the email is verified
4. Checks that the account status is `Normal` (not banned, locked, etc.)
5. If 2FA is enabled and the user has verified methods, throws `SecondFactorRequiredError`
6. Otherwise, creates a session and optionally sets a remember-me token

## Two-Factor Challenge

When `SecondFactorRequiredError` is thrown, the user is not logged in yet. The error includes `availableMethods` describing which mechanisms are available (TOTP, email, SMS). The session holds an `awaitingTwoFactor` state with an expiry.

Return the available methods to the client so it can show the appropriate UI. Do not return raw OTP codes to the client - send them via your email/SMS service.

## Completing 2FA

```typescript
app.post("/verify-2fa", async (req, res) => {
  const { code, method } = req.body;

  switch (method) {
    case "totp":
      await req.auth.twoFactor.verify.totp(code);
      break;
    case "email":
      await req.auth.twoFactor.verify.email(code);
      break;
    case "sms":
      await req.auth.twoFactor.verify.sms(code);
      break;
    case "backup":
      await req.auth.twoFactor.verify.backupCode(code);
      break;
    case "otp":
      await req.auth.twoFactor.verify.otp(code);
      break;
  }

  await req.auth.completeTwoFactorLogin();
  res.json({ success: true });
});
```

`verify.otp()` is a smart verifier that tries both email and SMS OTP methods automatically.

## Remember Me

Login with `remember: true` creates a persistent token in `{prefix}remembers` and sets an httpOnly cookie. On future requests, the middleware auto-restores the session from the cookie.

Configure the duration and cookie name in `AuthConfig`:

```typescript
const authConfig = {
  db: pool,
  rememberDuration: "30d",
  rememberCookieName: "remember_token",
};
```

## Logout

```typescript
await req.auth.logout();
await req.auth.logoutEverywhere();
await req.auth.logoutEverywhereElse();
```

- `logout()` clears the current session and remember token
- `logoutEverywhere()` clears all sessions and remember tokens
- `logoutEverywhereElse()` keeps the current session, clears everything else
