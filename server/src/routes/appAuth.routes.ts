import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { asyncHandler } from '../middleware/async.middleware';
import { createError } from '../middleware/error.middleware';
import { requireAuth } from '../middleware/auth.middleware';
import { User } from '../models/User.model';
import { env } from '../config/env';
import { AuthenticatedRequest } from '../types';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: env.NODE_ENV === 'production',
  maxAge: 8 * 60 * 60 * 1000, // 8 hours in ms
};

// ─── POST /api/auth/app/login ─────────────────────────────────────────────────

router.post(
  '/login',
  asyncHandler(async (req: Request, res: Response) => {
    const result = loginSchema.safeParse(req.body);
    if (!result.success) {
      throw createError('Invalid email or password', 401);
    }

    const { email, password } = result.data;
    const user = await User.findByEmail(email);

    if (!user || !(await user.comparePassword(password))) {
      throw createError('Invalid email or password', 401);
    }

    user.lastLogin = new Date();
    await user.save();

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      env.JWT_SECRET,
      { expiresIn: 8 * 60 * 60 }, // 8 hours in seconds
    );

    res.cookie('token', token, COOKIE_OPTIONS);
    res.json({
      success: true,
      data: { user: { name: user.name, email: user.email, role: user.role } },
    });
  }),
);

// ─── POST /api/auth/app/logout ────────────────────────────────────────────────

router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('token', { httpOnly: true, sameSite: 'strict', secure: env.NODE_ENV === 'production' });
  res.json({ success: true, message: 'Logged out' });
});

// ─── GET /api/auth/app/me ─────────────────────────────────────────────────────

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = await User.findById(req.userId).select('-passwordHash');
    if (!user) throw createError('User not found', 404);

    res.json({
      success: true,
      data: { user: { name: user.name, email: user.email, role: user.role } },
    });
  }),
);

export default router;
