// NOTE: jest.config uses `transform: {}` so jest.mock() is NOT hoisted above
// imports. These mock registrations MUST come before the requires below so that
// authRoutes -> authController binds to the mocked authService.
jest.mock('../../services/authService', () => ({
  login: jest.fn(),
  logout: jest.fn(),
  refreshToken: jest.fn(),
  validateToken: jest.fn(),
}));
jest.mock('../../config/logger');

const request = require('supertest');
const express = require('express');
const authRoutes = require('../../routes/authRoutes');
const authService = require('../../services/authService');

describe('Auth API Integration Tests (standard envelope)', () => {
  let app;

  beforeAll(() => {
    // Create Express app for testing
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/login', () => {
    it('should return 200, the user under data, and set auth cookies on success', async () => {
      authService.login.mockResolvedValue({
        success: true,
        token: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        user: {
          userId: 123,
          username: 'testuser',
          displayName: 'Test User',
          email: 'test@example.com',
          role: 'AdminEvent'
        },
        errorMessage: null
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'testuser', password: 'password123' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.username).toBe('testuser');
      // Tokens are delivered via httpOnly cookies, not the JSON body
      const cookies = response.headers['set-cookie'] || [];
      expect(cookies.join(';')).toContain('csi_access_token');
      expect(cookies.join(';')).toContain('csi_refresh_token');
      expect(response.body.data.token).toBeUndefined();
    });

    it('should return 401 UNAUTHENTICATED on invalid credentials', async () => {
      authService.login.mockResolvedValue({
        success: false,
        token: null,
        refreshToken: null,
        user: null,
        errorMessage: 'Invalid username or password'
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'testuser', password: 'wrongpassword' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('should return 422 VALIDATION_ERROR on missing username', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ password: 'password123' });

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 422 VALIDATION_ERROR on missing password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'testuser' });

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should return 200 with the user under data on successful refresh', async () => {
      authService.refreshToken.mockResolvedValue({
        success: true,
        token: 'new-access-token',
        refreshToken: 'new-refresh-token',
        user: {
          userId: 123,
          username: 'testuser',
          displayName: 'Test User',
          email: 'test@example.com',
          role: 'AdminEvent'
        },
        errorMessage: null
      });

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'valid-refresh-token' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.username).toBe('testuser');
      const cookies = response.headers['set-cookie'] || [];
      expect(cookies.join(';')).toContain('csi_access_token');
    });

    it('should return 401 UNAUTHENTICATED on invalid refresh token', async () => {
      authService.refreshToken.mockResolvedValue({
        success: false,
        token: null,
        refreshToken: null,
        user: null,
        errorMessage: 'Invalid refresh token'
      });

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('should return 422 VALIDATION_ERROR on missing refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({});

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should return 200 with meta message on successful logout', async () => {
      authService.validateToken.mockResolvedValue({
        isValid: true,
        user: {
          userId: 123,
          username: 'testuser',
          displayName: 'Test User',
          email: 'test@example.com',
          role: 'AdminEvent'
        },
        errorMessage: null
      });

      authService.logout.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.meta.message).toBe('Logged out successfully');
    });

    it('should return 401 on missing token (auth middleware)', async () => {
      const response = await request(app)
        .post('/api/auth/logout');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/auth/validate', () => {
    it('should return 200 and user info under data on valid token', async () => {
      authService.validateToken.mockResolvedValue({
        isValid: true,
        user: {
          userId: 123,
          username: 'testuser',
          displayName: 'Test User',
          email: 'test@example.com',
          role: 'AdminEvent'
        },
        errorMessage: null
      });

      const response = await request(app)
        .get('/api/auth/validate')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.username).toBe('testuser');
    });

    it('should return 401 on invalid token (auth middleware)', async () => {
      authService.validateToken.mockResolvedValue({
        isValid: false,
        user: null,
        errorMessage: 'Invalid token'
      });

      const response = await request(app)
        .get('/api/auth/validate')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user info under data', async () => {
      authService.validateToken.mockResolvedValue({
        isValid: true,
        user: {
          userId: 123,
          username: 'testuser',
          displayName: 'Test User',
          email: 'test@example.com',
          role: 'AdminEvent'
        },
        errorMessage: null
      });

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.data.username).toBe('testuser');
      expect(response.body.data.role).toBe('AdminEvent');
    });
  });
});
