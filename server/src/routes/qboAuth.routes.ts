import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/async.middleware';
import { createError } from '../middleware/error.middleware';
import { requireAuth } from '../middleware/auth.middleware';
import { oauthService } from '../services/oauth.service';
import { qboService } from '../services/qbo.service';
import { QBOToken } from '../models/QBOToken.model';
import { env } from '../config/env';
import { AuthenticatedRequest, Company } from '../types';

const router = Router();

const VALID_COMPANIES: Company[] = ['york_region', 'consulting'];

function isValidCompany(c: string): c is Company {
  return VALID_COMPANIES.includes(c as Company);
}

// ─── GET /api/auth/qbo/connect/:company ───────────────────────────────────────

router.get(
  '/connect/:company',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { company } = req.params;
    if (!isValidCompany(company)) {
      throw createError('Invalid company — must be york_region or consulting', 400);
    }

    const authUrl = oauthService.generateAuthUrl(company);
    res.redirect(authUrl);
  }),
);

// ─── GET /api/auth/qbo/callback ───────────────────────────────────────────────
// QBO redirects here after user approval. Exchanges code, fetches real company name.

router.get(
  '/callback',
  asyncHandler(async (req: Request, res: Response) => {
    const fullUrl = `${env.QBO_REDIRECT_URI}?${new URLSearchParams(
      req.query as Record<string, string>,
    ).toString()}`;

    const tokenDoc = await oauthService.exchangeCodeForTokens(fullUrl);

    // Enrich with the real company name from QBO — non-fatal if it fails
    try {
      const companyInfo = await qboService.getCompanyInfo(tokenDoc);
      tokenDoc.companyName = companyInfo.CompanyName;
      await tokenDoc.save();
    } catch {
      console.warn(`Could not fetch company info for ${tokenDoc.company} — using realmId as name`);
    }

    res.redirect(`${env.APP_URL}/settings?qbo_connected=${tokenDoc.company}`);
  }),
);

// ─── GET /api/auth/qbo/status ─────────────────────────────────────────────────

router.get(
  '/status',
  requireAuth,
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const [yorkToken, consultingToken] = await Promise.all([
      QBOToken.findByCompany('york_region'),
      QBOToken.findByCompany('consulting'),
    ]);

    res.json({
      success: true,
      data: {
        york_region: yorkToken
          ? {
              connected: true,
              companyName: yorkToken.companyName,
              refreshTokenExpired: yorkToken.isRefreshTokenExpired(),
            }
          : { connected: false },
        consulting: consultingToken
          ? {
              connected: true,
              companyName: consultingToken.companyName,
              refreshTokenExpired: consultingToken.isRefreshTokenExpired(),
            }
          : { connected: false },
      },
    });
  }),
);

// ─── POST /api/auth/qbo/disconnect/:company ───────────────────────────────────

router.post(
  '/disconnect/:company',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { company } = req.params;
    if (!isValidCompany(company)) throw createError('Invalid company', 400);

    const deleted = await QBOToken.findOneAndDelete({ company });
    if (!deleted) throw createError(`No QBO connection found for ${company}`, 404);

    res.json({ success: true, message: `Disconnected ${company}` });
  }),
);

export default router;
