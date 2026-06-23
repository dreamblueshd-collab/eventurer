const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');
const { auditAuthMiddleware, auditLogoutMiddleware } = require('../middleware/auditLogger');
const formEncryptionService = require('../services/formEncryptionService');

/**
 * Authentication Routes
 * Base path: /api/auth
 */

/**
 * @route   GET /api/auth/encryption-challenge
 * @desc    Get one-time AES-256 key for client-side form encryption
 * @access  Public
 */
router.get('/encryption-challenge', (req, res) => {
  const challenge = formEncryptionService.generateChallenge();
  res.json(challenge);
});

/**
 * @route   POST /api/auth/login
 * @desc    Login with username and password
 * @access  Public
 */
router.post('/login', auditAuthMiddleware, authController.loginValidation, authController.login);
router.post('/forgot-password', authController.forgotPasswordValidation, authController.forgotPassword);
router.post('/reset-password', authController.resetPasswordValidation, authController.resetPassword);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout and invalidate session
 * @access  Private
 */
router.post('/logout', requireAuth, auditLogoutMiddleware, authController.logout);

/**
 * @route   GET /api/auth/validate
 * @desc    Validate current token
 * @access  Private
 */
router.get('/validate', requireAuth, authController.validate);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public
 */
router.post('/refresh', authController.refreshValidation, authController.refresh);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user information
 * @access  Private
 */
router.get('/me', requireAuth, authController.getCurrentUser);

module.exports = router;
