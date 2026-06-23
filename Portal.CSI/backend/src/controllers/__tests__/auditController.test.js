jest.mock('../../services/auditService', () => ({
  getAuditLogs: jest.fn(),
  getEntityHistory: jest.fn(),
  logAction: jest.fn(),
}));

jest.mock('../../utils/auditHelpers', () => ({
  getIpAddress: jest.fn(() => '127.0.0.1'),
}));

jest.mock('../../config/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
}));

const auditService = require('../../services/auditService');
const auditController = require('../auditController');

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
    get: jest.fn(() => 'jest'),
  };
}

describe('auditController (standard envelope)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('getAuditLogs returns paginated envelope (data + meta.pagination)', async () => {
    auditService.getAuditLogs.mockResolvedValue({
      data: [{ id: 1 }],
      pagination: { page: 2, pageSize: 20, totalRecords: 25, totalPages: 2 },
    });

    const res = createResponse();
    await auditController.getAuditLogs({ query: {} }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: [{ id: 1 }],
      meta: { pagination: { page: 2, pageSize: 20, total: 25, totalPages: 2 } },
    });
  });

  it('getEntityHistory returns history under data with meta', async () => {
    auditService.getEntityHistory.mockResolvedValue({
      history: [{ change: 'x' }],
      totalChanges: 1,
      entityType: 'Survey',
      entityId: '5',
    });

    const res = createResponse();
    await auditController.getEntityHistory({ params: { entityType: 'Survey', entityId: '5' } }, res);

    expect(res.body).toEqual({
      success: true,
      data: [{ change: 'x' }],
      meta: { totalChanges: 1, entityType: 'Survey', entityId: '5' },
    });
  });

  it('logAction returns 201 with logId under data', async () => {
    auditService.logAction.mockResolvedValue({ success: true, logId: 99 });

    const res = createResponse();
    await auditController.logAction({ body: { action: 'X' }, user: { userId: 1, username: 'a' }, get: () => 'jest' }, res);

    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({
      success: true,
      data: { logId: 99 },
      meta: { message: 'Action logged successfully' },
    });
  });
});
