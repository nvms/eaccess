import type { Request } from "express";
import type { OAuthUserData, GitHubProviderConfig, AuthConfig } from "../types.js";
import { BaseOAuthProvider } from "./base-provider.js";
import { AuthManager } from "../auth-manager.js";

export class GitHubProvider extends BaseOAuthProvider {
  constructor(config: GitHubProviderConfig, authConfig: AuthConfig, authManager: AuthManager) {
    super(config, authConfig, authManager);
  }

  getAuthUrl(state?: string, scopes?: string[]): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: scopes?.join(" ") || "user:email",
      state: state || crypto.randomUUID(),
      response_type: "code",
    });

    return `https://github.com/login/oauth/authorize?${params}`;
  }

  async getUserData(req: Request): Promise<OAuthUserData> {
    const code = req.query.code as string;
    if (!code) {
      throw new Error("No authorization code provided");
    }

    // exchange code for access token
    const accessToken = await this.exchangeCodeForToken(code, "https://github.com/login/oauth/access_token");

    const apiHeaders = {
      Accept: "application/vnd.github+json",
      "User-Agent": this.authConfig.githubUserAgent || "EasyAccess",
      "X-GitHub-Api-Version": "2022-11-28",
    };

    const [user, emails] = await Promise.all([
      this.fetchUserFromAPI(accessToken, "https://api.github.com/user", apiHeaders),
      this.fetchUserFromAPI(accessToken, "https://api.github.com/user/emails", apiHeaders),
    ]);

    const verifiedEmails = Array.isArray(emails) ? emails.filter((email: any) => email.verified) : [];
    const primaryEmail = verifiedEmails.find((email: any) => email.primary)?.email;
    const fallbackEmail = primaryEmail || verifiedEmails[0]?.email;

    if (!fallbackEmail) {
      throw new Error("No verified email found in GitHub account");
    }

    return {
      id: user.id.toString(),
      email: fallbackEmail,
      username: user.login,
      name: user.name || user.login,
      avatar: user.avatar_url,
    };
  }

  protected getProviderName(): string {
    return "github";
  }
}
