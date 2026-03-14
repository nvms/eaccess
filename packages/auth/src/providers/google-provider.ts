import type { Request } from "express";
import type { OAuthUserData, GoogleProviderConfig, AuthConfig } from "../types.js";
import { BaseOAuthProvider } from "./base-provider.js";
import { AuthManager } from "../auth-manager.js";

export class GoogleProvider extends BaseOAuthProvider {
  constructor(config: GoogleProviderConfig, authConfig: AuthConfig, authManager: AuthManager) {
    super(config, authConfig, authManager);
  }

  getAuthUrl(state?: string, scopes?: string[]): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: scopes?.join(" ") || "openid profile email",
      state: state || crypto.randomUUID(),
      response_type: "code",
      access_type: "offline",
      prompt: "consent",
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  async getUserData(req: Request): Promise<OAuthUserData> {
    const code = req.query.code as string;
    if (!code) {
      throw new Error("No authorization code provided");
    }

    // exchange code for access token
    const accessToken = await this.exchangeCodeForToken(code, "https://oauth2.googleapis.com/token");

    // fetch user data
    const user = await this.fetchUserFromAPI(accessToken, "https://www.googleapis.com/oauth2/v2/userinfo");

    if (!user.email) {
      throw new Error("No email found in Google account");
    }

    return {
      id: user.id,
      email: user.email,
      username: user.email.split("@")[0], // use email prefix as username
      name: user.name,
      avatar: user.picture,
    };
  }

  protected getProviderName(): string {
    return "google";
  }
}
