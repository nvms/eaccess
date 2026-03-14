import type { Request } from "express";
import type { OAuthUserData, AzureProviderConfig, AuthConfig } from "../types.js";
import { BaseOAuthProvider } from "./base-provider.js";
import { AuthManager } from "../auth-manager.js";

export class AzureProvider extends BaseOAuthProvider {
  constructor(config: AzureProviderConfig, authConfig: AuthConfig, authManager: AuthManager) {
    super(config, authConfig, authManager);
  }

  getAuthUrl(state?: string, scopes?: string[]): string {
    const azureConfig = this.config as AzureProviderConfig;
    const params = new URLSearchParams({
      client_id: azureConfig.clientId,
      redirect_uri: azureConfig.redirectUri,
      scope: scopes?.join(" ") || "openid profile email User.Read",
      state: state || crypto.randomUUID(),
      response_type: "code",
      response_mode: "query",
    });

    return `https://login.microsoftonline.com/${azureConfig.tenantId}/oauth2/v2.0/authorize?${params}`;
  }

  async getUserData(req: Request): Promise<OAuthUserData> {
    const code = req.query.code as string;
    if (!code) {
      throw new Error("No authorization code provided");
    }

    // exchange code for access token
    const azureConfig = this.config as AzureProviderConfig;
    const accessToken = await this.exchangeCodeForToken(code, `https://login.microsoftonline.com/${azureConfig.tenantId}/oauth2/v2.0/token`);

    // fetch user data from Microsoft Graph
    const user = await this.fetchUserFromAPI(accessToken, "https://graph.microsoft.com/v1.0/me");

    if (!user.mail && !user.userPrincipalName) {
      throw new Error("No email found in Azure account");
    }

    return {
      id: user.id,
      email: user.mail || user.userPrincipalName,
      username: user.mailNickname || user.userPrincipalName?.split("@")[0],
      name: user.displayName,
      avatar: undefined, // Azure doesn't provide avatar in basic profile
    };
  }

  protected getProviderName(): string {
    return "azure";
  }

  protected async exchangeCodeForToken(code: string, tokenUrl: string): Promise<string> {
    const azureConfig = this.config as AzureProviderConfig;
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: azureConfig.clientId,
        client_secret: azureConfig.clientSecret,
        code,
        redirect_uri: azureConfig.redirectUri,
        grant_type: "authorization_code",
        scope: "openid profile email User.Read",
      }),
    });

    if (!response.ok) {
      throw new Error(`OAuth token exchange failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.access_token) {
      throw new Error("No access token received from Azure");
    }

    return data.access_token;
  }
}
