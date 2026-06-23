jest.mock('../../services/approvalService', () => ({
  proposeTakeoutForQuestion: jest.fn(),
  approveProposedTakeout: jest.fn(),
  getBestComments: jest.fn(),
  getApprovalStatistics: jest.fn(),
  getPendingApprovalsForITLead: jest.fn(),
}));

jest.mock('../../config/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
}));

const approvalService = require('../../services/approvalService');
const approvalController = require('../approvalController');

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

describe('approvalController (standard envelope)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('getBestComments returns list under data', async () => {
    const rows = [{ id: 1 }];
    approvalService.getBestComments.mockResolvedValue(rows);

    const res = createResponse();
    await approvalController.getBestComments({ query: {} }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, data: rows });
  });

  it('proposeTakeoutForQuestion returns 422 when required fields missing', async () => {
    const res = createResponse();
    await approvalController.proposeTakeoutForQuestion({ body: {}, user: { userId: 1 } }, res);

    expect(res.statusCode).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('proposeTakeoutForQuestion returns success envelope', async () => {
    approvalService.proposeTakeoutForQuestion.mockResolvedValue({ success: true });

    const res = createResponse();
    await approvalController.proposeTakeoutForQuestion(
      { body: { responseId: 1, questionId: 2, reason: 'x' }, user: { userId: 1, role: 'AdminEvent' } },
      res
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, data: null, meta: { message: 'Takeout proposed successfully' } });
  });

  it('approveProposedTakeout maps service failure to 400', async () => {
    approvalService.approveProposedTakeout.mockResolvedValue({ success: false });

    const res = createResponse();
    await approvalController.approveProposedTakeout(
      { body: { responseId: 1, questionId: 2 }, user: { userId: 1, role: 'ITLead' } },
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ success: false, error: { code: 'BAD_REQUEST', message: 'Gagal melakukan approval' } });
  });

  it('maps UnauthorizedError to 403 FORBIDDEN', async () => {
    const err = new Error('nope');
    err.name = 'UnauthorizedError';
    approvalService.getApprovalStatistics.mockRejectedValue(err);

    const res = createResponse();
    await approvalController.getApprovalStatistics({ params: { surveyId: '1' } }, res);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ success: false, error: { code: 'FORBIDDEN', message: 'Akses tidak diizinkan' } });
  });
});
