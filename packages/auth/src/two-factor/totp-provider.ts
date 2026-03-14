import Otp from "@eaccess/totp";
import hash from "@prsm/hash";
import type { AuthConfig } from "../types.js";
import type { Request } from "express";

export class TotpProvider {
  private config: AuthConfig;

  constructor(config: AuthConfig) {
    this.config = config;
  }

  generateSecret(): string {
    return Otp.createSecret();
  }

  generateQRCode(email: string, secret: string): string {
    const issuer = this.config.twoFactor?.issuer || "EasyAccess";
    return Otp.createTotpKeyUriForQrCode(issuer, email, secret);
  }

  verify(secret: string, code: string): boolean {
    const window = this.config.twoFactor?.totpWindow || 1;
    return Otp.verifyTotp(secret, code, window);
  }

  generateBackupCodes(count: number = 10): string[] {
    const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      const bytes = crypto.getRandomValues(new Uint8Array(8));
      codes.push(Array.from(bytes, (b) => chars[b % chars.length]).join(""));
    }
    return codes;
  }

  async hashBackupCodes(codes: string[]): Promise<string[]> {
    return await Promise.all(codes.map((code) => hash.encode(code)));
  }

  async verifyBackupCode(hashedCodes: string[], inputCode: string): Promise<{ isValid: boolean; index: number }> {
    for (let i = 0; i < hashedCodes.length; i++) {
      if (await hash.verify(hashedCodes[i], inputCode.toUpperCase())) {
        return { isValid: true, index: i };
      }
    }

    return { isValid: false, index: -1 };
  }

  maskEmail(email: string): string {
    const [username, domain] = email.split("@");
    if (username.length <= 2) {
      return `${username[0]}***@${domain}`;
    }
    return `${username[0]}${"*".repeat(username.length - 2)}${username[username.length - 1]}@${domain}`;
  }
}
