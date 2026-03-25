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

The third argument controls drift tolerance in both directions (behind and ahead):

```typescript
// 1 step of drift in each direction (default is 2)
Otp.verifyTotp(secret, code, 1);

// strict - no drift tolerance
Otp.verifyTotp(secret, code, 0);

// asymmetric - 2 steps behind, 0 ahead
Otp.verifyTotp(secret, code, 2, 0);
```
