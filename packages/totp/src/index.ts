import { base32 } from "@scure/base";
import * as crypto from "node:crypto";

export class InvalidOtpLengthError extends Error {}
export class InvalidSecretError extends Error {}
export class InvalidHashFunctionError extends Error {}
export class InvalidSecretStrengthError extends Error {}

class Otp {
  static OTP_LENGTH_MIN = 6;
  static OTP_LENGTH_MAX = 8;
  static OTP_LENGTH_DEFAULT = 6;
  static INTERVAL_LENGTH_DEFAULT = 30;
  static EPOCH_DEFAULT = 0;
  static HASH_FUNCTION_SHA_1 = 1;
  static HASH_FUNCTION_SHA_256 = 2;
  static HASH_FUNCTION_SHA_512 = 3;
  static HASH_FUNCTION_DEFAULT = Otp.HASH_FUNCTION_SHA_1;
  static SHARED_SECRET_STRENGTH_LOW = 1;
  static SHARED_SECRET_STRENGTH_MODERATE = 2;
  static SHARED_SECRET_STRENGTH_HIGH = 3;

  /**
   * Generates a shared secret using a specified strength.
   *
   * @param {number} strength - The strength of the shared secret, defaulting to Otp.SHARED_SECRET_STRENGTH_HIGH.
   *                            This determines the number of bits used to generate the secret.
   * @returns {string} - A base32 encoded string representing the generated shared secret.
   * @throws {Error} - If the strength parameter is invalid or if there is an issue generating random bytes.
   */
  static createSecret(strength: number = Otp.SHARED_SECRET_STRENGTH_HIGH): string {
    const bits = this.determineBitsForSharedSecretStrength(strength);
    const bytes = Math.ceil(bits / 8);
    const buffer = crypto.randomBytes(bytes);
    return base32.encode(buffer).replace(/=+$/, "");
  }

  /**
   * Generates a TOTP (Time-based One-Time Password) Key URI for use in QR code generation.
   * This URI can be scanned by authenticator apps like Google Authenticator or Authy.
   *
   * @param {string} issuer - The name of the service or organization issuing the OTP.
   * @param {string} accountName - The account name or email address associated with the OTP.
   * @param {string} secret - The shared secret key used for generating the OTP.
   * @returns {string} - A URI formatted according to the otpauth URI scheme.
   * @throws {Error} - Throws an error if any of the parameters are invalid or missing.
   */
  static createTotpKeyUriForQrCode(issuer: string, accountName: string, secret: string): string {
    return `otpauth://totp/${issuer}:${encodeURIComponent(accountName)}?secret=${secret}&issuer=${issuer}`;
  }

  /**
   * Generates a Time-based One-Time Password (TOTP) using the provided secret and parameters.
   *
   * @param {string} secret - The shared secret key used for generating the TOTP. Must be at least 16 characters long.
   * @param {number} [t=Math.floor(Date.now() / 1000)] - The current Unix time in seconds. Defaults to the current time.
   * @param {number} [otpLength=Otp.OTP_LENGTH_DEFAULT] - The desired length of the OTP. Must be between Otp.OTP_LENGTH_MIN and Otp.OTP_LENGTH_MAX.
   * @param {number} [t_x=Otp.INTERVAL_LENGTH_DEFAULT] - The time step in seconds. Defaults to Otp.INTERVAL_LENGTH_DEFAULT.
   * @param {number} [t_0=Otp.EPOCH_DEFAULT] - The Unix time to start counting time steps. Defaults to Otp.EPOCH_DEFAULT.
   * @param {number} [hashFunction=Otp.HASH_FUNCTION_DEFAULT] - The hash function to use (e.g., Otp.HASH_FUNCTION_SHA_1, Otp.HASH_FUNCTION_SHA_256, Otp.HASH_FUNCTION_SHA_512). Defaults to Otp.HASH_FUNCTION_DEFAULT.
   * @returns {string} - The generated TOTP as a string of digits, padded to the specified length.
   * @throws {InvalidOtpLengthError} - If the specified OTP length is not within the valid range.
   * @throws {InvalidSecretError} - If the provided secret is less than 16 characters long.
   * @throws {InvalidHashFunctionError} - If the specified hash function is not supported.
   */
  static generateTotp(
    secret: string,
    t: number = Math.floor(Date.now() / 1000),
    otpLength: number = Otp.OTP_LENGTH_DEFAULT,
    t_x: number = Otp.INTERVAL_LENGTH_DEFAULT,
    t_0: number = Otp.EPOCH_DEFAULT,
    hashFunction: number = Otp.HASH_FUNCTION_DEFAULT,
  ): string {
    if (otpLength < Otp.OTP_LENGTH_MIN || otpLength > Otp.OTP_LENGTH_MAX) {
      throw new InvalidOtpLengthError();
    }

    secret = secret ? secret : "";
    t = t ? t : Math.floor(Date.now() / 1000);
    t_x = t_x ? t_x : Otp.INTERVAL_LENGTH_DEFAULT;
    t_0 = t_0 ? t_0 : Otp.EPOCH_DEFAULT;

    const c_t = Math.max(0, Math.floor((t - t_0) / t_x)); // Ensure c_t is non-negative

    secret = secret.replace(/[^A-Za-z2-7]/g, "").toUpperCase();

    if (secret.length < 16) {
      throw new InvalidSecretError();
    }

    // Add padding back if needed for @scure/base compatibility
    const paddedSecret = secret + "=".repeat((8 - (secret.length % 8)) % 8);
    const k = base32.decode(paddedSecret);

    const counter64BitBigEndian = Buffer.alloc(8);
    counter64BitBigEndian.writeUInt32BE(Math.floor(c_t / Math.pow(2, 32)), 0);
    counter64BitBigEndian.writeUInt32BE(c_t % Math.pow(2, 32), 4);

    let hashFunctionNameForHmac: string;
    switch (hashFunction) {
      case Otp.HASH_FUNCTION_SHA_1:
        hashFunctionNameForHmac = "sha1";
        break;
      case Otp.HASH_FUNCTION_SHA_256:
        hashFunctionNameForHmac = "sha256";
        break;
      case Otp.HASH_FUNCTION_SHA_512:
        hashFunctionNameForHmac = "sha512";
        break;
      default:
        throw new InvalidHashFunctionError();
    }

    const hmac = crypto.createHmac(hashFunctionNameForHmac, Buffer.from(k));
    hmac.update(counter64BitBigEndian);
    const mac = hmac.digest();

    const offset = mac[mac.length - 1] & 0x0f;
    const macSubstring4Bytes = mac.slice(offset, offset + 4);

    const integer32Bit = macSubstring4Bytes.readUInt32BE(0) & 0x7fffffff;

    const hotp = integer32Bit % Math.pow(10, otpLength);

    return hotp.toString().padStart(otpLength, "0");
  }

  /**
   * Verifies a Time-based One-Time Password (TOTP) against a given secret.
   *
   * @param {string} secret - The shared secret key used to generate the TOTP.
   * @param {string} otpValue - The TOTP value to be verified.
   * @param {number} [lookBehindSteps=2] - The number of time steps to look behind for a valid TOTP.
   * @param {number} [lookAheadSteps=2] - The number of time steps to look ahead for a valid TOTP.
   * @param {number} [t=Math.floor(Date.now() / 1000)] - The current Unix time in seconds.
   * @param {number} [otpLength=Otp.OTP_LENGTH_DEFAULT] - The expected length of the TOTP.
   * @param {number} [t_x=Otp.INTERVAL_LENGTH_DEFAULT] - The time step interval in seconds.
   * @param {number} [t_0=Otp.EPOCH_DEFAULT] - The Unix epoch to start counting time steps from.
   * @param {number} [hashFunction=Otp.HASH_FUNCTION_DEFAULT] - The hash function to use for generating the TOTP.
   * @returns {boolean} - Returns true if the TOTP is valid, false otherwise.
   * @throws {Error} - Throws an error if the OTP value length is not within the valid range.
   */
  static verifyTotp(
    secret: string,
    otpValue: string,
    lookBehindSteps: number = 2,
    lookAheadSteps: number = 2,
    t: number = Math.floor(Date.now() / 1000),
    otpLength: number = Otp.OTP_LENGTH_DEFAULT,
    t_x: number = Otp.INTERVAL_LENGTH_DEFAULT,
    t_0: number = Otp.EPOCH_DEFAULT,
    hashFunction: number = Otp.HASH_FUNCTION_DEFAULT,
  ): boolean {
    otpValue = otpValue.replace(/[^0-9]/g, "");

    if (otpValue.length < Otp.OTP_LENGTH_MIN || otpValue.length > Otp.OTP_LENGTH_MAX) {
      return false;
    }

    if (otpValue.length !== otpLength) {
      return false;
    }

    for (let s = -lookBehindSteps; s <= lookAheadSteps; s++) {
      const expectedOtpValue = this.generateTotp(secret, t + t_x * s, otpLength, t_x, t_0, hashFunction);
      if (crypto.timingSafeEqual(Buffer.from(expectedOtpValue), Buffer.from(otpValue))) {
        return true;
      }
    }

    return false;
  }

  private static determineBitsForSharedSecretStrength(strength: number): number {
    switch (strength) {
      case 1:
        return 80;
      case 2:
        return 128;
      case 3:
        return 160;
      default:
        throw new InvalidSecretStrengthError();
    }
  }
}

export default Otp;
