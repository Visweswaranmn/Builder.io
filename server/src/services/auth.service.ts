import { UserModel, type UserDocument } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { generateResetToken, hashToken } from '../utils/token.js';
import { logger } from '../utils/logger.js';

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

function issueTokens(user: UserDocument): Tokens {
  const payload = { sub: user._id.toString(), role: user.role };
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}

export async function register(input: {
  name: string;
  email: string;
  password: string;
}): Promise<{ user: UserDocument; tokens: Tokens }> {
  const existing = await UserModel.findOne({ email: input.email });
  if (existing) {
    throw ApiError.conflict('An account with this email already exists');
  }

  const user = await UserModel.create({
    name: input.name,
    email: input.email,
    password: input.password,
  });

  const tokens = issueTokens(user);
  user.refreshToken = tokens.refreshToken;
  user.lastLoginAt = new Date();
  await user.save();

  return { user, tokens };
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<{ user: UserDocument; tokens: Tokens }> {
  const user = await UserModel.findOne({ email: input.email }).select('+password');
  if (!user || !(await user.comparePassword(input.password))) {
    throw ApiError.unauthorized('Invalid email or password');
  }
  if (!user.isActive) {
    throw ApiError.forbidden('This account has been deactivated');
  }

  const tokens = issueTokens(user);
  user.refreshToken = tokens.refreshToken;
  user.lastLoginAt = new Date();
  await user.save();

  return { user, tokens };
}

/**
 * Rotates the refresh token: verifies the incoming JWT, confirms it matches
 * the one on file for that user (so a logged-out/rotated token can't be
 * replayed), then issues a fresh pair.
 */
export async function refresh(refreshToken: string): Promise<Tokens> {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const user = await UserModel.findById(payload.sub).select('+refreshToken');
  if (!user || user.refreshToken !== refreshToken) {
    throw ApiError.unauthorized('Refresh token is no longer valid');
  }

  const tokens = issueTokens(user);
  user.refreshToken = tokens.refreshToken;
  await user.save();

  return tokens;
}

export async function logout(userId: string): Promise<void> {
  await UserModel.findByIdAndUpdate(userId, { $unset: { refreshToken: 1 } });
}

/**
 * Always resolves without revealing whether the email exists. The raw token
 * is returned only so a not-yet-built email step can be swapped in later;
 * for now it is logged rather than emailed.
 */
export async function forgotPassword(email: string): Promise<{ resetToken?: string }> {
  const user = await UserModel.findOne({ email });
  if (!user) return {};

  const { token, hash } = generateResetToken();
  user.passwordResetToken = hash;
  user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await user.save();

  logger.info(`Password reset requested for ${email}. Reset token (dev only): ${token}`);
  return { resetToken: token };
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const hash = hashToken(token);
  const user = await UserModel.findOne({
    passwordResetToken: hash,
    passwordResetExpires: { $gt: new Date() },
  }).select('+passwordResetToken +passwordResetExpires');

  if (!user) {
    throw ApiError.badRequest('Password reset token is invalid or has expired');
  }

  user.password = newPassword;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  user.refreshToken = undefined; // force re-login on all devices
  await user.save();
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await UserModel.findById(userId).select('+password');
  if (!user || !(await user.comparePassword(currentPassword))) {
    throw ApiError.unauthorized('Current password is incorrect');
  }

  user.password = newPassword;
  await user.save();
}
