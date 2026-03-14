# Password Reset

Forgot-password flow using secure reset tokens stored in `{prefix}resets`.

## Flow

1. User requests a password reset by email
2. `resetPassword()` creates a token and calls your callback with it
3. You send an email containing a link with the token
4. User clicks the link and enters a new password
5. `confirmResetPassword()` validates the token and updates the password

## Initiate Reset

```typescript
app.post("/forgot-password", async (req, res) => {
  try {
    await req.auth.resetPassword(req.body.email, "6h", 2, (token) => {
      sendEmail(req.body.email, "Reset your password", `
        <p>Click to reset: <a href="${process.env.APP_URL}/reset/${token}">Reset password</a></p>
        <p>This link expires in 6 hours.</p>
      `);
    });
  } catch (error) {
    // don't leak whether the account exists
  }

  // always return success to prevent user enumeration
  res.json({ message: "If an account exists, reset instructions were sent." });
});
```

**Parameters:**

| Parameter | Default | Description |
|-----------|---------|-------------|
| `email` | required | Account email address |
| `expiresAfter` | `"6h"` | Token expiry, accepts ms format (`"30m"`, `"1d"`) |
| `maxOpenRequests` | `2` | Max concurrent reset tokens per user |
| `callback` | optional | Receives the token for sending the reset email |

**Errors:**

- `EmailNotVerifiedError` - account not found or email not verified
- `ResetDisabledError` - account has `resettable = false`
- `TooManyResetsError` - too many pending reset requests

## Complete Reset

```typescript
app.post("/reset-password", async (req, res) => {
  try {
    await req.auth.confirmResetPassword(req.body.token, req.body.password);
    res.json({ message: "Password updated" });
  } catch (error) {
    if (error.name === "ResetExpiredError") {
      return res.status(400).json({ error: "Reset link expired" });
    }
    res.status(400).json({ error: "Invalid reset link" });
  }
});
```

By default, `confirmResetPassword` forces logout of all sessions after the password change. Pass `false` as the third argument to skip this.

**Errors:** `ResetNotFoundError`, `ResetExpiredError`, `ResetDisabledError`, `InvalidPasswordError`, `InvalidTokenError`, `UserNotFoundError`

## Admin Reset

Initiate a reset for any user by identifier:

```typescript
await req.auth.initiatePasswordResetForUserBy(
  { email: "user@example.com" },
  "1h",
  (token) => sendResetEmail(token),
);
```

## Security

- Always return generic success messages to prevent user enumeration
- Tokens are hashed and verified against the account email
- Expired tokens are cleaned up via `cleanupExpiredTokens()`
- The `resettable` column allows disabling reset for specific accounts
- `maxOpenRequests` prevents token flooding
