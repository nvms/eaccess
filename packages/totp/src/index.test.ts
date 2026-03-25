import { base32 } from "@scure/base";
import { describe, expect, it } from "vitest";
import Otp, { InvalidHashFunctionError, InvalidIntervalError, InvalidOtpLengthError, InvalidSecretError } from "./index";

describe("Otp", () => {
  it("should generate a secret of default strength", () => {
    const secret = Otp.createSecret();
    expect(secret).toBeDefined();
    expect(secret.length).toBe(32);
  });

  it("should generate a secret of low strength", () => {
    const secret = Otp.createSecret(Otp.SHARED_SECRET_STRENGTH_LOW);
    expect(secret).toBeDefined();
    expect(secret.length).toBe(16);
  });

  it("should generate a secret of moderate strength", () => {
    const secret = Otp.createSecret(Otp.SHARED_SECRET_STRENGTH_MODERATE);
    expect(secret).toBeDefined();
    expect(secret.length).toBe(26);
  });

  it("should generate a secret of high strength", () => {
    const secret = Otp.createSecret(Otp.SHARED_SECRET_STRENGTH_HIGH);
    expect(secret).toBeDefined();
    expect(secret.length).toBe(32);
  });

  it("should generate a valid TOTP", () => {
    const secret = Otp.createSecret();
    const totp = Otp.generateTotp(secret);
    expect(totp).toBeDefined();
    expect(totp.length).toBe(Otp.OTP_LENGTH_DEFAULT);
  });

  it("should verify a valid TOTP", () => {
    const secret = Otp.createSecret();
    const totp = Otp.generateTotp(secret);
    const isValid = Otp.verifyTotp(secret, totp);
    expect(isValid).toBe(true);
  });

  it("should not verify an invalid TOTP", () => {
    const secret = Otp.createSecret();
    const isValid = Otp.verifyTotp(secret, "123456");
    expect(isValid).toBe(false);
  });

  it("should generate a valid TOTP with custom length", () => {
    const secret = Otp.createSecret();
    const otpLength = 8;
    const totp = Otp.generateTotp(secret, undefined, otpLength);
    expect(totp).toBeDefined();
    expect(totp.length).toBe(otpLength);
  });

  it("should verify a valid TOTP with custom length", () => {
    const secret = Otp.createSecret();
    const otpLength = 8;
    const totp = Otp.generateTotp(secret, undefined, otpLength);
    const isValid = Otp.verifyTotp(secret, totp, undefined, undefined, undefined, otpLength);
    expect(isValid).toBe(true);
  });

  it("should generate a valid TOTP URI for QR code", () => {
    const secret = Otp.createSecret();
    const uri = Otp.createTotpKeyUriForQrCode("app.example.com", "john.doe@example.org", secret);
    expect(uri).toBeDefined();
    expect(uri).toContain("otpauth://totp/app.example.com:john.doe%40example.org");
    expect(uri).toContain(`secret=${secret}`);
    expect(uri).toContain("issuer=app.example.com");
  });

  it("should encode issuer with special characters in URI", () => {
    const secret = Otp.createSecret();
    const uri = Otp.createTotpKeyUriForQrCode("My App/Service", "user@example.com", secret);
    expect(uri).toContain("otpauth://totp/My%20App%2FService:");
    expect(uri).toContain("issuer=My%20App%2FService");
  });

  it("should throw an error for invalid secret length", () => {
    expect(() => {
      Otp.generateTotp("shortsecret");
    }).toThrow(InvalidSecretError);
  });

  it("should throw an error for invalid OTP length", () => {
    const secret = Otp.createSecret();
    expect(() => {
      Otp.generateTotp(secret, undefined, 5);
    }).toThrow(InvalidOtpLengthError);
    expect(() => {
      Otp.generateTotp(secret, undefined, 9);
    }).toThrow(InvalidOtpLengthError);
  });

  it("should throw an error for invalid hash function", () => {
    const secret = Otp.createSecret();
    expect(() => {
      Otp.generateTotp(secret, undefined, undefined, undefined, undefined, 999);
    }).toThrow(InvalidHashFunctionError);
  });

  it("should generate and verify TOTP with custom time and interval", () => {
    const secret = Otp.createSecret();
    const customTime = Math.floor(Date.now() / 1000) - 100;
    const customInterval = 60;
    const totp = Otp.generateTotp(secret, customTime, undefined, customInterval);
    const isValid = Otp.verifyTotp(secret, totp, undefined, undefined, customTime, undefined, customInterval);
    expect(isValid).toBe(true);
  });

  it("should handle edge case for time steps", () => {
    const secret = Otp.createSecret();
    const currentTime = Math.floor(Date.now() / 1000);
    const interval = Otp.INTERVAL_LENGTH_DEFAULT;
    const boundaryTime = currentTime - (currentTime % interval);
    const totp = Otp.generateTotp(secret, boundaryTime);
    const isValid = Otp.verifyTotp(secret, totp, undefined, undefined, boundaryTime);
    expect(isValid).toBe(true);
  });

  it("should not verify an expired TOTP", () => {
    const secret = Otp.createSecret();
    const pastTime = Math.floor(Date.now() / 1000) - 300; // 5 minutes ago
    const totp = Otp.generateTotp(secret, pastTime);
    const isValid = Otp.verifyTotp(secret, totp);
    expect(isValid).toBe(false);
  });

  it("should not verify a future TOTP", () => {
    const secret = Otp.createSecret();
    const futureTime = Math.floor(Date.now() / 1000) + 300; // 5 minutes in the future
    const totp = Otp.generateTotp(secret, futureTime);
    const isValid = Otp.verifyTotp(secret, totp);
    expect(isValid).toBe(false);
  });

  it("should verify RFC 6238 test vectors for SHA-1", () => {
    const rfc6238TestKeySha1 = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"; // Base32 encoding of '12345678901234567890'
    expect(Otp.verifyTotp(rfc6238TestKeySha1, "94287082", 3, 0, 59 + 90, 8, 30, 0, Otp.HASH_FUNCTION_SHA_1)).toBe(true);
    expect(Otp.verifyTotp(rfc6238TestKeySha1, "94287082", 2, 0, 59 + 90, 8, 30, 0, Otp.HASH_FUNCTION_SHA_1)).toBe(false);
    expect(Otp.verifyTotp(rfc6238TestKeySha1, "94287082", 2, 0, 59 + 60, 8, 30, 0, Otp.HASH_FUNCTION_SHA_1)).toBe(true);
    expect(Otp.verifyTotp(rfc6238TestKeySha1, "94287082", 0, 0, 59 + 60, 8, 30, 0, Otp.HASH_FUNCTION_SHA_1)).toBe(false);
    expect(Otp.verifyTotp(rfc6238TestKeySha1, "94287082", 2, 2, 59, 8, 30, 0, Otp.HASH_FUNCTION_SHA_1)).toBe(true);
    expect(Otp.verifyTotp(rfc6238TestKeySha1, "94287082", 0, 0, 59, 8, 30, 0, Otp.HASH_FUNCTION_SHA_1)).toBe(true);
    expect(Otp.verifyTotp(rfc6238TestKeySha1, "94287082", 0, 2, 59 - 60, 8, 30, 0, Otp.HASH_FUNCTION_SHA_1)).toBe(true);
    expect(Otp.verifyTotp(rfc6238TestKeySha1, "94287082", 0, 0, 59 - 60, 8, 30, 0, Otp.HASH_FUNCTION_SHA_1)).toBe(false);
    expect(Otp.verifyTotp(rfc6238TestKeySha1, "94287082", 0, 3, 59 - 90, 8, 30, 0, Otp.HASH_FUNCTION_SHA_1)).toBe(true);
    expect(Otp.verifyTotp(rfc6238TestKeySha1, "94287082", 0, 2, 59 - 90, 8, 30, 0, Otp.HASH_FUNCTION_SHA_1)).toBe(false);
  });

  it("should verify RFC 6238 test vectors for SHA-256", () => {
    const rfc6238TestKeySha256 = base32.encode(new TextEncoder().encode("12345678901234567890123456789012")).replace(/=+$/, ""); // 12345678901234567890123456789012
    expect(Otp.verifyTotp(rfc6238TestKeySha256, "46119246", 3, 0, 59 + 90, 8, 30, 0, Otp.HASH_FUNCTION_SHA_256)).toBe(true);
    expect(Otp.verifyTotp(rfc6238TestKeySha256, "46119246", 2, 0, 59 + 90, 8, 30, 0, Otp.HASH_FUNCTION_SHA_256)).toBe(false);
    expect(Otp.verifyTotp(rfc6238TestKeySha256, "46119246", 2, 0, 59 + 60, 8, 30, 0, Otp.HASH_FUNCTION_SHA_256)).toBe(true);
    expect(Otp.verifyTotp(rfc6238TestKeySha256, "46119246", 0, 0, 59 + 60, 8, 30, 0, Otp.HASH_FUNCTION_SHA_256)).toBe(false);
    expect(Otp.verifyTotp(rfc6238TestKeySha256, "46119246", 2, 2, 59, 8, 30, 0, Otp.HASH_FUNCTION_SHA_256)).toBe(true);
    expect(Otp.verifyTotp(rfc6238TestKeySha256, "46119246", 0, 0, 59, 8, 30, 0, Otp.HASH_FUNCTION_SHA_256)).toBe(true);
    expect(Otp.verifyTotp(rfc6238TestKeySha256, "46119246", 0, 2, 59 - 60, 8, 30, 0, Otp.HASH_FUNCTION_SHA_256)).toBe(true);
    expect(Otp.verifyTotp(rfc6238TestKeySha256, "46119246", 0, 0, 59 - 60, 8, 30, 0, Otp.HASH_FUNCTION_SHA_256)).toBe(false);
    expect(Otp.verifyTotp(rfc6238TestKeySha256, "46119246", 0, 3, 59 - 90, 8, 30, 0, Otp.HASH_FUNCTION_SHA_256)).toBe(true);
    expect(Otp.verifyTotp(rfc6238TestKeySha256, "46119246", 0, 2, 59 - 90, 8, 30, 0, Otp.HASH_FUNCTION_SHA_256)).toBe(false);
  });

  it("should verify RFC 6238 test vectors for SHA-512", () => {
    const rfc6238TestKeySha512 = base32.encode(new TextEncoder().encode("1234567890123456789012345678901234567890123456789012345678901234")).replace(/=+$/, ""); // 1234567890123456789012345678901234567890123456789012345678901234
    expect(Otp.verifyTotp(rfc6238TestKeySha512, "90693936", 3, 0, 59 + 90, 8, 30, 0, Otp.HASH_FUNCTION_SHA_512)).toBe(true);
    expect(Otp.verifyTotp(rfc6238TestKeySha512, "90693936", 2, 0, 59 + 90, 8, 30, 0, Otp.HASH_FUNCTION_SHA_512)).toBe(false);
    expect(Otp.verifyTotp(rfc6238TestKeySha512, "90693936", 2, 0, 59 + 60, 8, 30, 0, Otp.HASH_FUNCTION_SHA_512)).toBe(true);
    expect(Otp.verifyTotp(rfc6238TestKeySha512, "90693936", 0, 0, 59 + 60, 8, 30, 0, Otp.HASH_FUNCTION_SHA_512)).toBe(false);
    expect(Otp.verifyTotp(rfc6238TestKeySha512, "90693936", 2, 2, 59, 8, 30, 0, Otp.HASH_FUNCTION_SHA_512)).toBe(true);
    expect(Otp.verifyTotp(rfc6238TestKeySha512, "90693936", 0, 0, 59, 8, 30, 0, Otp.HASH_FUNCTION_SHA_512)).toBe(true);
    expect(Otp.verifyTotp(rfc6238TestKeySha512, "90693936", 0, 2, 59 - 60, 8, 30, 0, Otp.HASH_FUNCTION_SHA_512)).toBe(true);
    expect(Otp.verifyTotp(rfc6238TestKeySha512, "90693936", 0, 0, 59 - 60, 8, 30, 0, Otp.HASH_FUNCTION_SHA_512)).toBe(false);
    expect(Otp.verifyTotp(rfc6238TestKeySha512, "90693936", 0, 3, 59 - 90, 8, 30, 0, Otp.HASH_FUNCTION_SHA_512)).toBe(true);
    expect(Otp.verifyTotp(rfc6238TestKeySha512, "90693936", 0, 2, 59 - 90, 8, 30, 0, Otp.HASH_FUNCTION_SHA_512)).toBe(false);
  });
});

describe("Otp - 6 Character Length", () => {
  it("should generate a valid 6-character TOTP", () => {
    const secret = Otp.createSecret();
    const totp = Otp.generateTotp(secret, undefined, 6);
    expect(totp).toBeDefined();
    expect(totp.length).toBe(6);
  });

  it("should verify a valid 6-character TOTP", () => {
    const secret = Otp.createSecret();
    const totp = Otp.generateTotp(secret, undefined, 6);
    const isValid = Otp.verifyTotp(secret, totp, undefined, undefined, undefined, 6);
    expect(isValid).toBe(true);
  });

  it("should not verify an invalid 6-character TOTP", () => {
    const secret = Otp.createSecret();
    const isValid = Otp.verifyTotp(secret, "123456", undefined, undefined, undefined, 6);
    expect(isValid).toBe(false);
  });

  it("should generate and verify 6-character TOTP with custom time and interval", () => {
    const secret = Otp.createSecret();
    const customTime = Math.floor(Date.now() / 1000) - 100;
    const customInterval = 60;
    const totp = Otp.generateTotp(secret, customTime, 6, customInterval);
    const isValid = Otp.verifyTotp(secret, totp, undefined, undefined, customTime, 6, customInterval);
    expect(isValid).toBe(true);
  });

  it("should handle edge case for 6-character OTP time steps", () => {
    const secret = Otp.createSecret();
    const currentTime = Math.floor(Date.now() / 1000);
    const interval = Otp.INTERVAL_LENGTH_DEFAULT;
    const boundaryTime = currentTime - (currentTime % interval);
    const totp = Otp.generateTotp(secret, boundaryTime, 6);
    const isValid = Otp.verifyTotp(secret, totp, undefined, undefined, boundaryTime, 6);
    expect(isValid).toBe(true);
  });

  it("should not verify an expired 6-character TOTP", () => {
    const secret = Otp.createSecret();
    const pastTime = Math.floor(Date.now() / 1000) - 300; // 5 minutes ago
    const totp = Otp.generateTotp(secret, pastTime, 6);
    const isValid = Otp.verifyTotp(secret, totp, undefined, undefined, undefined, 6);
    expect(isValid).toBe(false);
  });

  it("should not verify a future 6-character TOTP", () => {
    const secret = Otp.createSecret();
    const futureTime = Math.floor(Date.now() / 1000) + 300; // 5 minutes in the future
    const totp = Otp.generateTotp(secret, futureTime, 6);
    const isValid = Otp.verifyTotp(secret, totp, undefined, undefined, undefined, 6);
    expect(isValid).toBe(false);
  });

  it("should throw for zero interval", () => {
    const secret = Otp.createSecret();
    expect(() => Otp.generateTotp(secret, undefined, 6, 0)).toThrow(InvalidIntervalError);
  });

  it("should throw for negative interval", () => {
    const secret = Otp.createSecret();
    expect(() => Otp.generateTotp(secret, undefined, 6, -30)).toThrow(InvalidIntervalError);
  });

  it("should use symmetric window when lookAheadSteps is not provided", () => {
    const secret = Otp.createSecret();
    const now = Math.floor(Date.now() / 1000);
    const interval = 30;
    const oneStepAhead = now + interval;
    const totp = Otp.generateTotp(secret, oneStepAhead);
    expect(Otp.verifyTotp(secret, totp, 0, undefined, now)).toBe(false);
    expect(Otp.verifyTotp(secret, totp, 1, undefined, now)).toBe(true);
  });

  it("should allow asymmetric window when lookAheadSteps is explicit", () => {
    const secret = Otp.createSecret();
    const now = Math.floor(Date.now() / 1000);
    const interval = 30;
    const oneStepAhead = now + interval;
    const totp = Otp.generateTotp(secret, oneStepAhead);
    expect(Otp.verifyTotp(secret, totp, 2, 0, now)).toBe(false);
    expect(Otp.verifyTotp(secret, totp, 0, 1, now)).toBe(true);
  });

  it("should be strict with window of 0", () => {
    const secret = Otp.createSecret();
    const now = Math.floor(Date.now() / 1000);
    const totp = Otp.generateTotp(secret, now);
    expect(Otp.verifyTotp(secret, totp, 0, undefined, now)).toBe(true);
    const oneStepAgo = now - 30;
    const oldTotp = Otp.generateTotp(secret, oneStepAgo);
    expect(Otp.verifyTotp(secret, oldTotp, 0, undefined, now)).toBe(false);
  });

  it("should verify RFC 6238 test vectors for SHA-1 with 6-character OTP", () => {
    // const rfc6238TestKeySha1 = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"; // Base32 encoding of '12345678901234567890'
    const rfc6238TestKeySha1 = base32.encode(new TextEncoder().encode("12345678901234567890")).replace(/=+$/, "");
    expect(Otp.verifyTotp(rfc6238TestKeySha1, "287082", 3, 0, 59 + 90, 6, 30, 0, Otp.HASH_FUNCTION_SHA_1)).toBe(true);
    expect(Otp.verifyTotp(rfc6238TestKeySha1, "287082", 2, 0, 59 + 90, 6, 30, 0, Otp.HASH_FUNCTION_SHA_1)).toBe(false);
    expect(Otp.verifyTotp(rfc6238TestKeySha1, "287082", 2, 0, 59 + 60, 6, 30, 0, Otp.HASH_FUNCTION_SHA_1)).toBe(true);
    expect(Otp.verifyTotp(rfc6238TestKeySha1, "287082", 0, 0, 59 + 60, 6, 30, 0, Otp.HASH_FUNCTION_SHA_1)).toBe(false);
    expect(Otp.verifyTotp(rfc6238TestKeySha1, "287082", 2, 2, 59, 6, 30, 0, Otp.HASH_FUNCTION_SHA_1)).toBe(true);
    expect(Otp.verifyTotp(rfc6238TestKeySha1, "287082", 0, 0, 59, 6, 30, 0, Otp.HASH_FUNCTION_SHA_1)).toBe(true);
    expect(Otp.verifyTotp(rfc6238TestKeySha1, "287082", 0, 2, 59 - 60, 6, 30, 0, Otp.HASH_FUNCTION_SHA_1)).toBe(true);
    expect(Otp.verifyTotp(rfc6238TestKeySha1, "287082", 0, 0, 59 - 60, 6, 30, 0, Otp.HASH_FUNCTION_SHA_1)).toBe(false);
    expect(Otp.verifyTotp(rfc6238TestKeySha1, "287082", 0, 3, 59 - 90, 6, 30, 0, Otp.HASH_FUNCTION_SHA_1)).toBe(true);
    expect(Otp.verifyTotp(rfc6238TestKeySha1, "287082", 0, 2, 59 - 90, 6, 30, 0, Otp.HASH_FUNCTION_SHA_1)).toBe(false);
  });
});
