declare module 'intuit-oauth' {
  interface OAuthClientConfig {
    clientId: string;
    clientSecret: string;
    environment: 'sandbox' | 'production';
    redirectUri: string;
    logging?: boolean;
  }

  interface AuthorizeUriOptions {
    scope: string[];
    state?: string;
  }

  interface Token {
    token_type: string;
    access_token: string;
    refresh_token: string;
    expires_in: number;
    x_refresh_token_expires_in: number;
    createdAt?: number;
    realmId?: string;
  }

  interface AuthResponse {
    getJson(): Token;
    token: Token;
  }

  class OAuthClient {
    static scopes: {
      Accounting: string;
      Payment: string;
      Payroll: string;
      TimeTracking: string;
      Benefits: string;
      Profile: string;
      Email: string;
      Phone: string;
      Address: string;
      OpenId: string;
      Intuit_name: string;
    };

    constructor(config: OAuthClientConfig);

    authorizeUri(options: AuthorizeUriOptions): string;
    createToken(redirectUrl: string): Promise<AuthResponse>;
    refresh(): Promise<AuthResponse>;
    revoke(params?: { access_token?: string; refresh_token?: string }): Promise<AuthResponse>;
    setToken(token: Partial<Token>): OAuthClient;
    getToken(): Token;
    isAccessTokenValid(): boolean;
    isRefreshTokenValid(): boolean;
  }

  export = OAuthClient;
}
