import { Router, Request, Response } from 'express';
import axios from 'axios';
import { requireAuth } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/async.middleware';
import { env } from '../config/env';
import type { AuthenticatedRequest } from '@nr/auth-middleware';

const router = Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: env.NODE_ENV === 'production',
  maxAge: 8 * 60 * 60 * 1000,
};

// ─── POST /api/auth/app/login ─────────────────────────────────────────────────

router.post(
  '/login',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const response = await axios.post(
        `${env.AUTH_SERVICE_URL}/api/v1/auth/login`,
        req.body,
        { headers: { 'x-app-name': env.APP_NAME } },
      );

      const { token, user, requiresTwoFactor, tempToken } = response.data.data ?? {};

      if (requiresTwoFactor) {
        res.status(200).json({ success: true, data: { requiresTwoFactor: true, tempToken } });
        return;
      }

      if (!token || !user) {
        res.status(500).json({ success: false, error: 'Unexpected response from auth service' });
        return;
      }

      res.cookie('token', token, COOKIE_OPTIONS);
      res.json({ success: true, data: { user } });
    } catch (err: any) {
      const status = err.response?.status || 500;
      const error = err.response?.data?.error || 'Login failed';
      res.status(status).json({ success: false, error });
    }
  }),
);

// ─── POST /api/auth/app/logout ────────────────────────────────────────────────

router.post('/logout', (req: Request, res: Response) => {
  const token = req.cookies?.token;
  if (token) {
    axios.post(
      `${env.AUTH_SERVICE_URL}/api/v1/auth/logout`,
      {},
      { headers: { Authorization: `Bearer ${token}` } },
    ).catch(() => {});
  }
  res.clearCookie('token', { httpOnly: true, sameSite: 'strict', secure: env.NODE_ENV === 'production' });
  res.json({ success: true, message: 'Logged out' });
});

// ─── GET /api/auth/app/me ─────────────────────────────────────────────────────

router.get(
  '/me',
  requireAuth,
  (req: AuthenticatedRequest, res: Response) => {
    res.json({ success: true, data: { user: req.user } });
  },
);

export default router;
