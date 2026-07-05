import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';
import { UserModel, type UserDocument } from '../models/user.model.js';
import * as authService from '../services/auth.service.js';

const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days, mirrors JWT_REFRESH_EXPIRES default

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(env.jwt.refreshCookieName, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'lax',
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    path: '/api/v1/auth',
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(env.jwt.refreshCookieName, { path: '/api/v1/auth' });
}

function toSafeUser(user: UserDocument) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    isActive: user.isActive,
  };
}

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { user, tokens } = await authService.register(req.body);
  setRefreshCookie(res, tokens.refreshToken);
  res.status(201).json({
    success: true,
    message: 'Account created successfully',
    data: { user: toSafeUser(user), accessToken: tokens.accessToken },
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { user, tokens } = await authService.login(req.body);
  setRefreshCookie(res, tokens.refreshToken);
  res.json({
    success: true,
    message: 'Logged in successfully',
    data: { user: toSafeUser(user), accessToken: tokens.accessToken },
  });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[env.jwt.refreshCookieName] as string | undefined;
  if (!token) throw ApiError.unauthorized('Refresh token missing');

  const tokens = await authService.refresh(token);
  setRefreshCookie(res, tokens.refreshToken);
  res.json({ success: true, message: 'Token refreshed', data: { accessToken: tokens.accessToken } });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  if (req.user) await authService.logout(req.user.id);
  clearRefreshCookie(res);
  res.json({ success: true, message: 'Logged out successfully' });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await UserModel.findById(req.user?.id);
  if (!user) throw ApiError.notFound('User not found');
  res.json({ success: true, data: { user: toSafeUser(user) } });
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { resetToken } = await authService.forgotPassword(req.body.email);
  res.json({
    success: true,
    message: 'If that email is registered, a password reset link has been sent',
    // Only present outside production — real email delivery is not wired up yet.
    ...(resetToken && !env.isProd ? { data: { resetToken } } : {}),
  });
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  await authService.resetPassword(req.body.token, req.body.password);
  res.json({ success: true, message: 'Password has been reset. Please log in again' });
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized('Authentication required');
  await authService.changePassword(req.user.id, req.body.currentPassword, req.body.newPassword);
  res.json({ success: true, message: 'Password changed successfully' });
});
