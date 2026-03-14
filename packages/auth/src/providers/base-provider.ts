import type { Request } from "express";
import type { OAuthProvider, OAuthUserData, OAuthProviderConfig, AuthConfig, OAuthCallbackResult } from "../types.js";
import { AuthManager } from "../auth-manager.js";

export abstract class BaseOAuthProvider implements OAuthProvider {
  protected config: OAuthProviderConfig;
  protected authConfig: AuthConfig;
  protected authManager: AuthManager;

  constructor(config: OAuthProviderConfig, authConfig: AuthConfig, authManager: AuthManager) {
    this.config = config;
    this.authConfig = authConfig;
    this.authManager = authManager;
  }

  abstract getAuthUrl(state?: string, scopes?: string[]): string;
  abstract getUserData(req: Request): Promise<OAuthUserData>;

  async handleCallback(req: Request): Promise<OAuthCallbackResult> {
    const userData = await this.getUserData(req);
    return this.processOAuthLogin(userData, req);
  }

  protected async processOAuthLogin(userData: OAuthUserData, req: Request): Promise<OAuthCallbackResult> {
    const { queries } = this.authManager as any;
    const providerName = this.getProviderName();

    const existingProvider = await queries.findProviderByProviderIdAndType(userData.id, providerName);

    if (existingProvider) {
      const account = await queries.findAccountById(existingProvider.account_id);
      if (account) {
        await (this.authManager as any).onLoginSuccessful(account, true);
        return { isNewUser: false };
      }
    }

    // new OAuth user - check if email already exists
    if (userData.email) {
      const existingAccount = await queries.findAccountByEmail(userData.email);
      if (existingAccount) {
        throw new Error("You already have an account associated with this email address.");
      }
    }

    // create new user and account
    let userId: string | number;

    if (this.authConfig.createUser) {
      userId = await this.authConfig.createUser(userData);
    } else {
      // Generate UUID for OAuth users when no createUser function is provided
      userId = crypto.randomUUID();
    }

    // create the auth account (no password for OAuth)
    const account = await queries.createAccount({
      userId,
      email: userData.email,
      password: null,
      verified: true, // OAuth providers are pre-verified
      status: 0, // AuthStatus.Normal
      rolemask: 0,
    });

    // create the provider record
    await queries.createProvider({
      accountId: account.id,
      provider: providerName,
      providerId: userData.id,
      providerEmail: userData.email,
      providerUsername: userData.username || null,
      providerName: userData.name || null,
      providerAvatar: userData.avatar || null,
    });

    await (this.authManager as any).onLoginSuccessful(account, true);
    return { isNewUser: true };
  }

  protected abstract getProviderName(): string;

  protected async exchangeCodeForToken(code: string, tokenUrl: string): Promise<string> {
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code,
        redirect_uri: this.config.redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!response.ok) {
      throw new Error(`OAuth token exchange failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.access_token) {
      throw new Error("No access token received from OAuth provider");
    }

    return data.access_token;
  }

  protected async fetchUserFromAPI(accessToken: string, apiUrl: string, headers: Record<string, string> = {}): Promise<any> {
    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        ...headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch user data: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }
}
