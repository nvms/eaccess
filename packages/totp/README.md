# @eaccess/totp

TOTP generation and verification. Used internally by `@eaccess/auth` for two-factor authentication.

## Usage

```typescript
import Otp from "@eaccess/totp";

const secret = Otp.createSecret();
const code = Otp.generateTotp(secret);
const isValid = Otp.verifyTotp(secret, code);
```

## QR Code URI

```typescript
const uri = Otp.createTotpKeyUriForQrCode("MyApp", "user@example.com", secret);
```

## Verification Window

```typescript
// allow 1 step of drift (default)
Otp.verifyTotp(secret, code, 1);

// strict - no drift tolerance
Otp.verifyTotp(secret, code, 0);
```
