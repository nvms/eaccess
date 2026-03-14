# Errors

All errors extend `AuthError`. You can catch specific types with `instanceof` or check `error.name`.

## Registration

| Error | When |
|-------|------|
| `EmailTakenError` | Email already registered |
| `InvalidEmailError` | Email fails format validation |
| `InvalidPasswordError` | Password outside configured min/max length |

## Email Confirmation

| Error | When |
|-------|------|
| `ConfirmationNotFoundError` | Token doesn't exist |
| `ConfirmationExpiredError` | Token has expired |
| `InvalidTokenError` | Token format is invalid |

## Login

| Error | When |
|-------|------|
| `UserNotFoundError` | No account with that email |
| `InvalidPasswordError` | Password hash doesn't match |
| `EmailNotVerifiedError` | Account email not confirmed |
| `UserInactiveError` | Account status is not Normal (banned, locked, suspended, etc.) |

## Two-Factor Authentication

| Error | When |
|-------|------|
| `SecondFactorRequiredError` | Login paused, user has verified 2FA methods. Includes `availableMethods` |
| `TwoFactorExpiredError` | 2FA session expired before completion |
| `InvalidTwoFactorCodeError` | Wrong TOTP, email, or SMS code |
| `InvalidBackupCodeError` | Backup code not recognized or already used |
| `TwoFactorNotSetupError` | Verification attempted before setup, or method doesn't exist |
| `TwoFactorAlreadyEnabledError` | Trying to enable a mechanism that's already verified |
| `TwoFactorSetupIncompleteError` | Setup started but not completed |

## Password Reset

| Error | When |
|-------|------|
| `ResetNotFoundError` | Reset token doesn't exist |
| `ResetExpiredError` | Reset token has expired |
| `ResetDisabledError` | Account has `resettable = false` |
| `TooManyResetsError` | Exceeded `maxOpenRequests` concurrent reset tokens |
| `InvalidPasswordError` | New password doesn't meet requirements |
| `InvalidTokenError` | Token verification failed |
| `UserNotFoundError` | Account no longer exists |

## Session

| Error | When |
|-------|------|
| `UserNotLoggedInError` | Action requires an authenticated session |

## Catching Errors

```typescript
import { EmailTakenError, InvalidPasswordError, SecondFactorRequiredError } from "@eaccess/auth";

app.post("/register", async (req, res) => {
  try {
    await req.auth.register(req.body.email, req.body.password);
    res.json({ success: true });
  } catch (error) {
    if (error instanceof EmailTakenError) {
      return res.status(409).json({ error: "Email already registered" });
    }
    if (error instanceof InvalidPasswordError) {
      return res.status(400).json({ error: "Password does not meet requirements" });
    }
    throw error;
  }
});
```
