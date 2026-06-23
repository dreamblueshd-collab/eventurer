// Mock dependencies
jest.mock('../ldapService');
jest.mock('../emailService', () => ({
  sendEmail: jest.fn()
}));
jest.mock('../../database/connection');
jest.mock('../../config/logger');

const authService = require('../authService');
const ldapService = require('../ldapService');
const emailService = require('../emailService');
const db = require('../../database/connection');

describe('AuthService', () => {
  let mockPool;
  let mockRequest;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup ldapService mock
    ldapService.authenticate = jest.fn();
    
    // Setup emailService mock
    emailService.sendEmail = jest.fn();

    // Setup mock database
    mockRequest = {
      input: jest.fn().mockReturnThis(),
      query: jest.fn()
    };

    mockPool = {
      request: jest.fn().mockReturnValue(mockRequest)
    };

    db.getPool = jest.fn().mockResolvedValue(mockPool);
    db.sql = {
      VarChar: 'VarChar',
      NVarChar: 'NVarChar',
      Bit: 'Bit',
      BigInt: 'BigInt',
      DateTime: 'DateTime',
      DateTime2: 'DateTime2'
    };
  });

  describe('login', () => {
    it('should successfully login with LDAP credentials', async () => {
      // Mock lockout check
      mockRequest.query.mockResolvedValueOnce({
        recordset: [{ FailedCount: 0, LastFailedAt: null }]
      });

      // Mock user from database
      mockRequest.query.mockResolvedValueOnce({
        recordset: [{
          UserId: 123,
          Username: 'testuser',
          DisplayName: 'Test User',
          Email: 'test@example.com',
          Role: 'AdminEvent',
          IsActive: 1,
          UseLDAP: true,
          PasswordHash: null
        }]
      });

      // Mock LDAP authentication
      ldapService.authenticate.mockResolvedValue({
        success: true,
        user: {
          username: 'testuser',
          displayName: 'Test User',
          email: 'test@example.com'
        }
      });

      // Mock session creation (invalidate old sessions)
      mockRequest.query.mockResolvedValueOnce({ recordset: [] });

      // Mock session creation (insert new session)
      mockRequest.query.mockResolvedValueOnce({
        recordset: [{ SessionId: 456 }]
      });

      const result = await authService.login('testuser', 'password123', '127.0.0.1', 'test-agent');

      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user.username).toBe('testuser');
      expect(result.user.role).toBe('AdminEvent');
      expect(ldapService.authenticate).toHaveBeenCalledWith('testuser', 'password123');
    });

    it('should fail login with invalid credentials', async () => {
      // Mock lockout check
      mockRequest.query.mockResolvedValueOnce({
        recordset: [{ FailedCount: 0, LastFailedAt: null }]
      });

      // Mock user from database
      mockRequest.query.mockResolvedValueOnce({
        recordset: [{
          UserId: 123,
          Username: 'testuser',
          DisplayName: 'Test User',
          Email: 'test@example.com',
          Role: 'AdminEvent',
          IsActive: 1,
          UseLDAP: true,
          PasswordHash: null
        }]
      });

      // Mock LDAP authentication failure
      ldapService.authenticate.mockResolvedValue({
        success: false,
        errorMessage: 'Invalid username or password'
      });

      const result = await authService.login('testuser', 'wrongpassword', '127.0.0.1', 'test-agent');

      expect(result.success).toBe(false);
      expect(result.token).toBeNull();
      expect(result.errorMessage).toBe('Password salah atau autentikasi LDAP gagal. Periksa kembali password Anda.');
    });

    it('should fail login for non-existent user', async () => {
      // Mock lockout check
      mockRequest.query.mockResolvedValueOnce({
        recordset: [{ FailedCount: 0, LastFailedAt: null }]
      });

      // Mock user not found
      mockRequest.query.mockResolvedValueOnce({
        recordset: []
      });

      const result = await authService.login('nonexistent', 'password123', '127.0.0.1', 'test-agent');

      expect(result.success).toBe(false);
      expect(result.token).toBeNull();
      expect(result.errorMessage).toBe('Username tidak ditemukan. Periksa kembali username Anda.');
    });

    it('should require username and password', async () => {
      const result = await authService.login('', '', '127.0.0.1', 'test-agent');

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Username and password are required');
    });

    it('should block login when account is temporarily locked', async () => {
      // Mock lockout check indicates locked state
      mockRequest.query.mockResolvedValueOnce({
        recordset: [{
          FailedCount: 5,
          LastFailedAt: new Date()
        }]
      });

      const result = await authService.login('testuser', 'password123', '127.0.0.1', 'test-agent');

      expect(result.success).toBe(false);
      expect(result.token).toBeNull();
      expect(result.errorMessage).toMatch(/Too many login attempts/i);
      expect(ldapService.authenticate).not.toHaveBeenCalled();
    });
  });

  describe('validateToken', () => {
    it('should validate a valid token', async () => {
      const jwt = require('jsonwebtoken');
      const config = require('../../config');

      // Create a valid token
      const token = jwt.sign(
        {
          sub: 123,
          username: 'testuser',
          role: 'AdminEvent',
          email: 'test@example.com',
          type: 'access'
        },
        config.jwt.secret,
        { expiresIn: '1h' }
      );

      // Mock session lookup
      mockRequest.query.mockResolvedValueOnce({
        recordset: [{
          SessionId: 456,
          UserId: 123,
          LastActivity: new Date(),
          ExpiresAt: new Date(Date.now() + 3600000),
          MaxExpiresAt: new Date(Date.now() + 28800000),
          IsActive: 1
        }]
      });

      // Mock user lookup
      mockRequest.query.mockResolvedValueOnce({
        recordset: [{
          UserId: 123,
          Username: 'testuser',
          DisplayName: 'Test User',
          Email: 'test@example.com',
          Role: 'AdminEvent',
          IsActive: 1,
          UseLDAP: true
        }]
      });

      // Mock session update
      mockRequest.query.mockResolvedValueOnce({ recordset: [] });

      const result = await authService.validateToken(token);

      expect(result.isValid).toBe(true);
      expect(result.user.username).toBe('testuser');
    });

    it('should reject an expired token', async () => {
      const jwt = require('jsonwebtoken');
      const config = require('../../config');

      // Create an expired token
      const token = jwt.sign(
        {
          sub: 123,
          username: 'testuser',
          role: 'AdminEvent',
          email: 'test@example.com',
          type: 'access'
        },
        config.jwt.secret,
        { expiresIn: '-1h' }
      );

      const result = await authService.validateToken(token);

      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toBe('Token has expired');
    });

    it('should reject an invalid token', async () => {
      const result = await authService.validateToken('invalid-token');

      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toBe('Invalid token');
    });
  });

  describe('logout', () => {
    it('should successfully logout and invalidate session', async () => {
      const jwt = require('jsonwebtoken');
      const config = require('../../config');

      const token = jwt.sign(
        {
          sub: 123,
          username: 'testuser',
          role: 'AdminEvent',
          email: 'test@example.com',
          type: 'access'
        },
        config.jwt.secret,
        { expiresIn: '1h' }
      );

      // Mock session invalidation
      mockRequest.query.mockResolvedValueOnce({ recordset: [] });

      const result = await authService.logout(token);

      expect(result).toBe(true);
      expect(mockRequest.query).toHaveBeenCalled();
    });
  });

  describe('requestPasswordReset', () => {
    it('should return generic success and send email for local user by email', async () => {
      emailService.sendEmail.mockResolvedValue({ success: true });

      // Mock getLocalUserByRecovery query
      mockRequest.query
        .mockResolvedValueOnce({
          recordset: [{
            UserId: 123,
            Username: 'localuser',
            DisplayName: 'Local User',
            Email: 'local@example.com',
            PhoneNumber: '6281234567890',
            UseLDAP: 0,
            IsActive: 1
          }]
        })
        // Mock invalidateOutstandingResetTokens
        .mockResolvedValueOnce({ recordset: [] })
        // Mock createPasswordResetToken insert
        .mockResolvedValueOnce({
          recordset: [{ PasswordResetTokenId: 456 }]
        });

      const result = await authService.requestPasswordReset('email', 'local@example.com', {
        ipAddress: '127.0.0.1'
      });

      expect(result.success).toBe(true);
      expect(emailService.sendEmail).toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('should reset password for valid token', async () => {
      mockRequest.query
        .mockResolvedValueOnce({
          recordset: [{
            PasswordResetTokenId: 333,
            UserId: 123,
            ExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
            UsedAt: null,
            UseLDAP: 0,
            IsActive: 1
          }]
        })
        .mockResolvedValueOnce({ recordset: [] })
        .mockResolvedValueOnce({ recordset: [] })
        .mockResolvedValueOnce({ recordset: [] });

      const result = await authService.resetPassword('valid-token', 'password123');

      expect(result.success).toBe(true);
    });
  });
});
