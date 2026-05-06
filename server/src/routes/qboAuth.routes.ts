import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/async.middleware';
import { createError } from '../middleware/error.middleware';
import { requireAuth } from '../middleware/auth.middleware';
import { oauthService } from '../services/oauth.service';
import { qboService } from '../services/qbo.service';
import { QBOToken } from '../models/QBOToken.model';
import { AuthenticatedRequest, Company } from '../types';

const router = Router();

const VALID_COMPANIES: Company[] = ['york_region', 'consulting'];

function isValidCompany(c: string): c is Company {
  return VALID_COMPANIES.includes(c as Company);
}

const exchangeSchema = z.object({
  redirectUrl: z.string().url('redirectUrl must be the full callback URL'),
});

// ─── GET /api/auth/qbo/connect/:company ───────────────────────────────────────
// Returns the Intuit authorization URL. Frontend navigates the browser there.

router.get(
  '/connect/:company',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { company } = req.params;
    if (!isValidCompany(company)) {
      throw createError('Invalid company — must be york_region or consulting', 400);
    }

    const authUrl = oauthService.generateAuthUrl(company);
    res.json({ success: true, data: { authUrl } });
  }),
);

// ─── POST /api/auth/qbo/exchange ──────────────────────────────────────────────
// Frontend /callback page calls this after Intuit redirects back with the code.

router.post(
  '/exchange',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = exchangeSchema.safeParse(req.body);
    if (!result.success) {
      throw createError(result.error.errors[0].message, 400);
    }

    const { redirectUrl } = result.data;
    console.log('[QBO exchange] redirectUrl received:', redirectUrl);

    const tokenDoc = await oauthService.exchangeCodeForTokens(redirectUrl);
    console.log('[QBO exchange] token stored — company:', tokenDoc.company, 'realmId:', tokenDoc.companyId, 'env:', tokenDoc.environment, 'hasAccessToken:', !!tokenDoc.tokenData?.access_token, 'accessTokenExpiry:', tokenDoc.accessTokenExpiry);

    // Enrich with the real company name from QBO — non-fatal if it fails
    try {
      const companyInfo = await qboService.getCompanyInfo(tokenDoc);
      tokenDoc.companyName = companyInfo.CompanyName;
      await tokenDoc.save();
    } catch {
      console.warn(`Could not fetch company info for ${tokenDoc.company} — using realmId as name`);
    }

    res.json({ success: true, data: { company: tokenDoc.company } });
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
