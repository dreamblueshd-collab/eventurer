jest.mock('../../services/authService', () => ({
  login: jest.fn(),
  logout: jest.fn(),
  refreshToken: jest.fn(),
}));

jest.mock('../../services/formEncryptionService', () => ({
  decryptPassword: jest.fn(),
}));

jest.mock('../../utils/auditHelpers', () => ({
  getIpAddress: jest.fn(() => '127.0.0.1'),
}));

jest.mock('../../config/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
}));

const authService = require('../../services/authService');
const authController = require('../authController');

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    cookies: [],
    cleared: [],
    status: jest.fn(function status(code) {
      this.statusCode = code;
      return this;
    }),
    json: jest.fn(function json(payload) {
      this.body = payload;
      return this;
    }),
    cookie: jest.fn(function cookie(name) {
      this.cookies.push(name);
      return this;
    }),
    clearCookie: jest.fn(function clearCookie(name) {
      this.cleared.push(name);
      return this;
    }),
  };
}

const baseUser = {
  userId: 123,
  username: 'testuser',
  displayName: 'Test User',
  email: 'test@example.com',
  role: 'AdminEvent',
};

describe('authController (standard envelope)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('login success returns { success:true, data: authUser } and sets cookies', async () => {
    authService.login.mockResolvedValue({
      success: true,
      token: 'access',
      refreshToken: 'refresh',
      user: baseUser,
    });

    const req = { body: { username: 'testuser', password: 'password123' }, get: () => 'jest', headers: {} };
    const res = createResponse();
    await authController.login(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: {
        userId: 123,
        userKey: 'testuser',
        username: 'testuser',
        displayName: 'Test User',
        email: 'test@example.com',
        role: 'AdminEvent',
      },
    });
    expect(res.cookies).toEqual(['csi_access_token', 'csi_refresh_token']);
  });

  it('login with wrong credentials returns 401 UNAUTHENTICATED', async () => {
    authService.login.mockResolvedValue({ success: false });

    const req = { body: { username: 'testuser', password: 'nope' }, get: () => 'jest', headers: {} };
    const res = createResponse();
    await authController.login(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Username atau password salah' } });
    expect(res.cookies).toEqual([]);
  });

  it('validate returns the authenticated user under data', async () => {
    const req = { user: baseUser };
    const res = createResponse();
    await authController.validate(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: {
        userId: 123,
        userKey: 'testuser',
        username: 'testuser',
        displayName: 'Test User',
        email: 'test@example.com',
        role: 'AdminEvent',
      },
    });
  });

  it('logout success clears cookies and returns meta message', async () => {
    authService.logout.mockResolvedValue(true);

    const req = { token: 'access' };
    const res = createResponse();
    await authController.logout(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, data: null, meta: { message: 'Logged out successfully' } });
    expect(res.cleared).toEqual(['csi_access_token', 'csi_refresh_token']);
  });
});
