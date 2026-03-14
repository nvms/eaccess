# MFA Patterns

Supports TOTP (authenticator apps), email OTP, SMS OTP, and backup codes.

## Enable MFA in Config

```typescript
const authConfig = {
  db: pool,
  twoFactor: {
    enabled: true,
    issuer: "MyApp",
    codeLength: 6,
    tokenExpiry: "5m",
    totpWindow: 1,
    backupCodesCount: 10,
    requireForOAuth: false,
  },
};
```

## Enroll TOTP

### Without Verification (immediate)

```typescript
app.post("/2fa/setup-totp", async (req, res) => {
  const { secret, qrCode, backupCodes } = await req.auth.twoFactor.setup.totp(false);
  res.json({ secret, qrCode, backupCodes });
});
```

The method is enabled immediately. The client should display the QR code and backup codes.

### With Verification (recommended for production)

```typescript
app.post("/2fa/setup-totp", async (req, res) => {
  const { secret, qrCode } = await req.auth.twoFactor.setup.totp(true);
  res.json({ secret, qrCode, requiresVerification: true });
});

app.post("/2fa/verify-totp-setup", async (req, res) => {
  const backupCodes = await req.auth.twoFactor.complete.totp(req.body.code);
  res.json({ backupCodes });
});
```

The method stays unverified until the user provides a valid code from their authenticator app. Backup codes are generated on completion.

## Enroll Email OTP

```typescript
await req.auth.twoFactor.setup.email();
await req.auth.twoFactor.setup.email("alternate@example.com");
```

## Enroll SMS OTP

```typescript
await req.auth.twoFactor.setup.sms("+15551234567");
```

## Login with 2FA

When 2FA is enabled and a user has verified methods, `login()` throws `SecondFactorRequiredError`. The error includes `availableMethods` with the mechanisms available.

For email and SMS OTP, the error also includes the generated OTP value. Send it via your email/SMS service - do not return it to the client.

```typescript
app.post("/login", async (req, res) => {
  try {
    await req.auth.login(req.body.email, req.body.password, req.body.remember);
    res.json({ success: true });
  } catch (error) {
    if (error instanceof SecondFactorRequiredError) {
      if (error.availableMethods.email) {
        sendEmail(error.availableMethods.email.maskedContact, error.availableMethods.email.otpValue);
      }
      return res.status(202).json({
        requiresTwoFactor: true,
        methods: {
          totp: !!error.availableMethods.totp,
          email: error.availableMethods.email?.maskedContact,
          sms: error.availableMethods.sms?.maskedContact,
        },
      });
    }
    res.status(401).json({ error: error.message });
  }
});
```

## Complete Login

```typescript
app.post("/verify-2fa", async (req, res) => {
  await req.auth.twoFactor.verify.totp(req.body.code);
  await req.auth.completeTwoFactorLogin();
  res.json({ success: true });
});
```

Other verifiers: `verify.email(code)`, `verify.sms(code)`, `verify.backupCode(code)`, `verify.otp(code)` (tries email and SMS automatically).

## Management

```typescript
const enabled = await req.auth.twoFactor.isEnabled();
const methods = await req.auth.twoFactor.getEnabledMethods();

await req.auth.twoFactor.disable(TwoFactorMechanism.TOTP);

const newCodes = await req.auth.twoFactor.generateNewBackupCodes();

const contact = await req.auth.twoFactor.getContact(TwoFactorMechanism.EMAIL);
const uri = await req.auth.twoFactor.getTotpUri();
```
