import ms from "@prsm/ms";
import hash from "@prsm/hash";
import type { AuthConfig, TwoFactorMechanism, TwoFactorToken } from "../types.js";
import { AuthQueries } from "../queries.js";

export class OtpProvider {
  private config: AuthConfig;
  private queries: AuthQueries;

  constructor(config: AuthConfig) {
    this.config = config;
    this.queries = new AuthQueries(config);
  }

  generateOTP(): string {
    const length = this.config.twoFactor?.codeLength || 6;
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(bytes, (b) => (b % 10).toString()).join("");
  }

  generateSelector(): string {
    return crypto.randomUUID().replace(/-/g, "");
  }

  async createAndStoreOTP(accountId: number, mechanism: TwoFactorMechanism.EMAIL | TwoFactorMechanism.SMS): Promise<{ otp: string; selector: string }> {
    const otp = this.generateOTP();
    const selector = this.generateSelector();
    const tokenHash = await hash.encode(otp);

    const expiryDuration = this.config.twoFactor?.tokenExpiry || "5m";
    const expiresAt = new Date(Date.now() + ms(expiryDuration));

    // delete any existing tokens for this account and mechanism
    await this.queries.deleteTwoFactorTokensByAccountAndMechanism(accountId, mechanism);

    // store the new token
    await this.queries.createTwoFactorToken({
      accountId,
      mechanism,
      selector,
      tokenHash,
      expiresAt,
    });

    return { otp, selector };
  }

  async verifyOTP(selector: string, inputCode: string): Promise<{ isValid: boolean; token?: TwoFactorToken }> {
    const token = await this.queries.findTwoFactorTokenBySelector(selector);

    if (!token) {
      return { isValid: false };
    }

    // check if token has expired (extra check, even though query filters expired tokens)
    if (token.expires_at <= new Date()) {
      // clean up expired token
      await this.queries.deleteTwoFactorToken(token.id);
      return { isValid: false };
    }

    const isValid = await hash.verify(token.token_hash, inputCode);

    if (isValid) {
      // clean up used token
      await this.queries.deleteTwoFactorToken(token.id);
      return { isValid: true, token };
    }

    return { isValid: false };
  }

  maskPhone(phone: string): string {
    if (phone.length < 4) {
      return phone.replace(/./g, "*");
    }

    // show first digit and last 2 digits: +1234567890 -> +1*****90
    if (phone.startsWith("+")) {
      return phone[0] + phone[1] + "*".repeat(phone.length - 3) + phone.slice(-2);
    }

    // for regular numbers: 1234567890 -> 1*****90
    return phone[0] + "*".repeat(phone.length - 3) + phone.slice(-2);
  }

  maskEmail(email: string): string {
    const [username, domain] = email.split("@");
    if (username.length <= 2) {
      return `${username[0]}***@${domain}`;
    }
    return `${username[0]}${"*".repeat(username.length - 2)}${username[username.length - 1]}@${domain}`;
  }
}
