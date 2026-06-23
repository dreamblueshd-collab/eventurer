jest.mock('../../services/authService', () => ({
  validateToken: jest.fn(),
}));

jest.mock('../../config/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const { hasPermission, requirePermission } = require('../authMiddleware');

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe('authMiddleware permission matrix', () => {
  it('allows ITLead to propose takeout', () => {
    expect(hasPermission('ITLead', 'responses:propose-takeout')).toBe(true);
  });

  it('allows AdminEvent to propose takeout', () => {
    expect(hasPermission('AdminEvent', 'responses:propose-takeout')).toBe(true);
  });

  it('rejects DepartmentHead for propose takeout', () => {
    expect(hasPermission('DepartmentHead', 'responses:propose-takeout')).toBe(false);
  });

  it('requirePermission passes for ITLead propose takeout', () => {
    const middleware = requirePermission('responses:propose-takeout');
    const req = { user: { userId: 7, username: 'itlead', role: 'ITLead' } };
    const res = createResponse();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});
