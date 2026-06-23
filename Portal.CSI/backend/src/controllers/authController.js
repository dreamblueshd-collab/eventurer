const { body, validationResult } = require('express-validator');
const authService = require('../services/authService');
const formEncryptionService = require('../services/formEncryptionService');
const { getIpAddress } = require('../utils/auditHelpers');
const logger = require('../config/logger');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { handleControllerError, sendValidationErrors } = require('../utils/controllerError');

const ACCESS_COOKIE_NAME = 'csi_access_token';
const REFRESH_COOKIE_NAME = 'csi_refresh_token';

function getCookieValue(req, name) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const [key, ...rest] = cookie.trim().split('=');
    if (key === name) {
      return decodeURIComponent(rest.join('='));
    }
  }

  return null;
}

function parseDurationToMs(value, fallbackMs) {
  if (!value || typeof value !== 'string') return fallbackMs;

  const match = value.trim().match(/^(\d+)([smhd])$/i);
  if (!match) return fallbackMs;

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multiplier = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  }[unit];

  return amount * multiplier;
}

function getCookieOptions(maxAge) {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/',
    maxAge
  };
}

function setAuthCookies(res, accessToken, refreshToken) {
  res.cookie(ACCESS_COOKIE_NAME, accessToken, getCookieOptions(parseDurationToMs(process.env.JWT_EXPIRATION || '8h', 8 * 60 * 60 * 1000)));
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, getCookieOptions(parseDurationToMs(process.env.JWT_REFRESH_EXPIRATION || '7d', 7 * 24 * 60 * 60 * 1000)));
}

function clearAuthCookies(res) {
  const baseOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  };

  res.clearCookie(ACCESS_COOKIE_NAME, baseOptions);
  res.clearCookie(REFRESH_COOKIE_NAME, baseOptions);
}

/**
 * Shape the public user object returned by auth endpoints.
 */
function toAuthUser(user) {
  return {
    userId: user.userId,
    userKey: user.username,
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    role: user.role
  };
}

/**
 * Validation rules for login
 */
const loginValidation = [
  body('username')
    .trim()
    .notEmpty().withMessage('Username is required')
    .isLength({ min: 3, max: 50 }).withMessage('Username must be between 3 and 50 characters'),
  body('password')
    .custom((value, { req }) => {
      // Accept either plain password or encrypted password
      if (value) return true;
      if (req.body.encryptedPassword && req.body.challengeId) return true;
      throw new Error('Password is required');
    })
];

/**
 * Validation rules for token refresh
 */
const refreshValidation = [
  body('refreshToken')
    .custom((value, { req }) => {
      if (value) return true;
      if (getCookieValue(req, REFRESH_COOKIE_NAME)) return true;
      throw new Error('Refresh token is required');
    })
];

const forgotPasswordValidation = [
  body('method')
    .optional()
    .isIn(['email', 'phone']).withMessage('Method must be email or phone'),
  body('identifier')
    .trim()
    .notEmpty().withMessage('Email atau nomor telepon wajib diisi')
];

const resetPasswordValidation = [
  body('token')
    .trim()
    .notEmpty().withMessage('Token reset password wajib diisi'),
  body('password')
    .custom((value, { req }) => {
      if (value) return true;
      if (req.body.encryptedPassword && req.body.challengeId) return true;
      throw new Error('Password baru wajib diisi');
    })
];

/**
 * Login controller
 * POST /api/auth/login
 *
 * Success envelope: { success:true, data: <authUser> } (+ httpOnly auth cookies).
 */
async function login(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendValidationErrors(res, errors);
    }

    const { username, password, encryptedPassword, challengeId } = req.body;
    const ipAddress = getIpAddress(req);
    const userAgent = req.get('user-agent');

    // Resolve password: decrypt if encrypted, otherwise use plaintext
    let resolvedPassword = password;
    if (encryptedPassword && challengeId) {
      resolvedPassword = formEncryptionService.decryptPassword(encryptedPassword, challengeId);
      if (!resolvedPassword) {
        return sendError(res, { status: 400, code: 'BAD_REQUEST', message: 'Gagal memproses kredensial' });
      }
    }

    if (!resolvedPassword) {
      return sendError(res, { status: 422, code: 'VALIDATION_ERROR', message: 'Password wajib diisi' });
    }

    const result = await authService.login(username, resolvedPassword, ipAddress, userAgent);

    if (!result.success) {
      return sendError(res, { status: 401, code: 'UNAUTHENTICATED', message: 'Username atau password salah' });
    }

    setAuthCookies(res, result.token, result.refreshToken);
    return sendSuccess(res, toAuthUser(result.user));
  } catch (error) {
    return handleControllerError(res, error, 'Gagal login');
  }
}

/**
 * Logout controller
 * POST /api/auth/logout
 */
async function logout(req, res) {
  try {
    const token = req.token;

    if (!token) {
      clearAuthCookies(res);
      return sendError(res, { status: 400, code: 'BAD_REQUEST', message: 'Token tidak tersedia' });
    }

    const success = await authService.logout(token);

    if (!success) {
      return sendError(res, { status: 500, message: 'Gagal logout' });
    }

    clearAuthCookies(res);
    return sendSuccess(res, null, { meta: { message: 'Logged out successfully' } });
  } catch (error) {
    clearAuthCookies(res);
    return handleControllerError(res, error, 'Gagal logout');
  }
}

/**
 * Validate token controller
 * GET /api/auth/validate
 *
 * Success envelope: { success:true, data: <authUser> } (success implies a valid session).
 */
async function validate(req, res) {
  try {
    return sendSuccess(res, toAuthUser(req.user));
  } catch (error) {
    return handleControllerError(res, error, 'Gagal memvalidasi session');
  }
}

/**
 * Refresh token controller
 * POST /api/auth/refresh
 */
async function refresh(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendValidationErrors(res, errors);
    }

    const refreshToken = req.body.refreshToken || getCookieValue(req, REFRESH_COOKIE_NAME);
    const ipAddress = getIpAddress(req);
    const userAgent = req.get('user-agent');

    const result = await authService.refreshToken(refreshToken, ipAddress, userAgent);

    if (!result.success) {
      return sendError(res, { status: 401, code: 'UNAUTHENTICATED', message: 'Gagal refresh token' });
    }

    setAuthCookies(res, result.token, result.refreshToken);
    return sendSuccess(res, toAuthUser(result.user));
  } catch (error) {
    return handleControllerError(res, error, 'Gagal refresh token');
  }
}

/**
 * Get current user info controller
 * GET /api/auth/me
 */
async function getCurrentUser(req, res) {
  try {
    return sendSuccess(res, toAuthUser(req.user));
  } catch (error) {
    return handleControllerError(res, error, 'Gagal memuat data user');
  }
}

async function forgotPassword(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendValidationErrors(res, errors);
    }

    const requestedMethod = String(req.body.method || 'email').trim().toLowerCase();
    if (requestedMethod === 'phone') {
      return sendError(res, { status: 503, code: 'SERVICE_UNAVAILABLE', message: 'Reset password via phone dinonaktifkan sementara.' });
    }

    const result = await authService.requestPasswordReset(
      'email',
      req.body.identifier,
      {
        ipAddress: getIpAddress(req),
        userAgent: req.get('user-agent')
      }
    );

    if (!result.success) {
      return sendError(res, { status: 502, code: 'UPSTREAM_ERROR', message: 'Gagal memproses forgot password' });
    }

    return sendSuccess(res, null, { meta: { message: result.message } });
  } catch (error) {
    return handleControllerError(res, error, 'Gagal request reset password');
  }
}

async function resetPassword(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendValidationErrors(res, errors);
    }

    const { token, password, encryptedPassword, challengeId } = req.body;

    // Resolve password: decrypt if encrypted, otherwise use plaintext
    let resolvedPassword = password;
    if (encryptedPassword && challengeId) {
      resolvedPassword = formEncryptionService.decryptPassword(encryptedPassword, challengeId);
      if (!resolvedPassword) {
        return sendError(res, { status: 400, code: 'BAD_REQUEST', message: 'Gagal memproses kredensial' });
      }
    }

    if (!resolvedPassword || resolvedPassword.length < 8) {
      return sendError(res, { status: 422, code: 'VALIDATION_ERROR', message: 'Password baru minimal 8 karakter' });
    }

    const result = await authService.resetPassword(token, resolvedPassword);
    if (!result.success) {
      return sendError(res, { status: 400, code: 'BAD_REQUEST', message: 'Gagal reset password' });
    }

    clearAuthCookies(res);
    return sendSuccess(res, null, { meta: { message: result.message } });
  } catch (error) {
    return handleControllerError(res, error, 'Gagal reset password');
  }
}

module.exports = {
  login,
  logout,
  validate,
  refresh,
  getCurrentUser,
  forgotPassword,
  resetPassword,
  loginValidation,
  refreshValidation,
  forgotPasswordValidation,
  resetPasswordValidation
};
