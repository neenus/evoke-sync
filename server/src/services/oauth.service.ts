import OAuthClient from 'intuit-oauth';
import { env } from '../config/env';
import { QBOToken, IQBOTokenDocument } from '../models/QBOToken.model';
import { OAuthTokenData, Company } from '../types';

// ─── OAuth client factory (stateless — new instance per request) ──────────────

function createOAuthClient(): InstanceType<typeof OAuthClient> {
  return new OAuthClient({
    clientId: env.QBO_CLIENT_ID,
    clientSecret: env.QBO_CLIENT_SECRET,
    environment: env.QBO_ENVIRONMENT,
    redirectUri: env.QBO_REDIRECT_URI,
    logging: env.NODE_ENV === 'development',
  });
}

// ─── State encoding (company encoded in state param to survive callback) ───────

interface OAuthState {
  company: Company;
  nonce: string;
}

function encodeState(state: OAuthState): string {
  return Buffer.from(JSON.stringify(state)).toString('base64url');
}

function decodeState(encoded: string): OAuthState {
  try {
    return JSON.parse(Buffer.from(encoded, 'base64url').toString()) as OAuthState;
  } catch {
    throw new Error('Invalid OAuth state parameter');
  }
}

// ─── OAuthService ─────────────────────────────────────────────────────────────

class OAuthService {
  generateAuthUrl(company: Company): string {
    const oauthClient = createOAuthClient();
    const state = encodeState({
      company,
      nonce: Math.random().toString(36).slice(2),
    });

    return oauthClient.authorizeUri({
      scope: [OAuthClient.scopes.Accounting],
      state,
    });
  }

  async exchangeCodeForTokens(
    redirectUrl: string,
  ): Promise<IQBOTokenDocument> {
    const oauthClient = createOAuthClient();
    const url = new URL(redirectUrl);

    const stateParam = url.searchParams.get('state');
    const realmId = url.searchParams.get('realmId');

    if (!stateParam) throw new Error('Missing state parameter in callback URL');
    if (!realmId) throw new Error('Missing realmId in callback URL');

    const { company } = decodeState(stateParam);

    const authResponse = await oauthClient.createToken(redirectUrl);
    const tokenData = authResponse.getJson() as OAuthTokenData;

    const existing = await QBOToken.findByCompany(company);

    if (existing) {
      existing.companyId = realmId;
      existing.environment = env.QBO_ENVIRONMENT;
      return existing.updateTokens(tokenData);
    }

    const doc = new QBOToken({
      company,
      companyId: realmId,
      companyName: company === 'york_region' ? 'Evoke York Region' : 'Evoke Consulting',
      environment: env.QBO_ENVIRONMENT,
      tokenData: { ...tokenData, createdAt: Date.now() },
      accessTokenExpiry: new Date(Date.now() + (tokenData.expires_in - 60) * 1000),
      refreshTokenExpiry: new Date(Date.now() + tokenData.x_refresh_token_expires_in * 1000),
    });

    return doc.save();
  }

  async refreshTokens(tokenDoc: IQBOTokenDocument): Promise<IQBOTokenDocument> {
    const oauthClient = createOAuthClient();
    oauthClient.setToken(tokenDoc.tokenData);

    const response = await oauthClient.refresh();
    const newTokenData = response.getJson() as OAuthTokenData;

    return tokenDoc.updateTokens(newTokenData);
  }

  async getValidAccessToken(tokenDoc: IQBOTokenDocument): Promise<string> {
    if (tokenDoc.isRefreshTokenExpired()) {
      throw new Error(
        `QBO refresh token for "${tokenDoc.company}" has expired — reconnect required.`,
      );
    }

    if (tokenDoc.isAccessTokenExpired()) {
      const refreshed = await this.refreshTokens(tokenDoc);
      return refreshed.tokenData.access_token;
    }

    return tokenDoc.tokenData.access_token;
  }
}

export const oauthService = new OAuthService();
