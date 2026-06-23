jest.mock('../../services/userService', () => ({
  createUser: jest.fn(),
  getUsers: jest.fn(),
  getUserById: jest.fn(),
  updateUser: jest.fn(),
  deactivateUser: jest.fn(),
}));

jest.mock('../../config/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
}));

const userService = require('../../services/userService');
const userController = require('../userController');

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status: jest.fn(function status(code) {
      this.statusCode = code;
      return this;
    }),
    json: jest.fn(function json(payload) {
      this.body = payload;
      return this;
    }),
  };
}

describe('userController (standard envelope)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('getUsers returns { success:true, data: [...] }', async () => {
    const rows = [{ UserId: 1, Username: 'a' }];
    userService.getUsers.mockResolvedValue(rows);

    const res = createResponse();
    await userController.getUsers({ query: {} }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, data: rows });
  });

  it('getUserById returns 404 NOT_FOUND envelope when missing', async () => {
    userService.getUserById.mockResolvedValue(null);

    const res = createResponse();
    await userController.getUserById({ params: { id: '99' } }, res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
  });

  it('createUser returns 201 with data + meta message', async () => {
    const created = { UserId: 7, Username: 'new' };
    userService.createUser.mockResolvedValue(created);

    const res = createResponse();
    await userController.createUser({ body: { username: 'new' } }, res);

    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({
      success: true,
      data: created,
      meta: { message: 'User created successfully' },
    });
  });

  it('maps an error with statusCode to standardized envelope', async () => {
    const err = new Error('Username already exists');
    err.name = 'ConflictError';
    err.statusCode = 409;
    userService.createUser.mockRejectedValue(err);

    const res = createResponse();
    await userController.createUser({ body: { username: 'dup' } }, res);

    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({
      success: false,
      error: { code: 'CONFLICT', message: 'Username already exists' },
    });
  });
});
