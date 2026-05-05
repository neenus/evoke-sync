import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AuthenticatedRequest } from '../types';
import { createError } from './error.middleware';

interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

export function requireAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): void {
  const token = req.cookies?.token as string | undefined;

  if (!token) {
    return next(createError('Not authenticated', 401));
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.userId = payload.userId;
    req.userEmail = payload.email;
    req.userRole = payload.role;
    next();
  } catch {
    next(createError('Session expired — please log in again', 401));
  }
}
