jest.mock('../../services/emailService', () => ({
  sendSurveyBlast: jest.fn(),
  getTargetRecipients: jest.fn(),
  sendReminders: jest.fn(),
  getNonRespondents: jest.fn(),
  sendApprovalNotification: jest.fn(),
  sendRejectionNotification: jest.fn(),
  getTemplate: jest.fn(),
  sendStandaloneBlast: jest.fn(),
}));

jest.mock('../../config/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
}));

const emailService = require('../../services/emailService');
const emailController = require('../emailController');

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

describe('emailController (standard envelope)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sendSurveyBlast returns send summary under data', async () => {
    emailService.sendSurveyBlast.mockResolvedValue({
      total: 10, sent: 9, failed: 1, skipped: 0, errors: [], message: 'done',
    });

    const res = createResponse();
    await emailController.sendSurveyBlast({ body: {} }, res);

    expect(res.body).toEqual({
      success: true,
      data: { total: 10, sent: 9, failed: 1, skipped: 0, errors: [], detail: 'done' },
      meta: { message: 'Survey blast sent successfully' },
    });
  });

  it('getTargetRecipients returns recipients under data with count meta', async () => {
    emailService.getTargetRecipients.mockResolvedValue([{ email: 'a@x.com' }, { email: 'b@x.com' }]);

    const res = createResponse();
    await emailController.getTargetRecipients({ body: {} }, res);

    expect(res.body).toEqual({
      success: true,
      data: [{ email: 'a@x.com' }, { email: 'b@x.com' }],
      meta: { count: 2 },
    });
  });

  it('getTemplate returns 404 NOT_FOUND when missing', async () => {
    emailService.getTemplate.mockResolvedValue(null);

    const res = createResponse();
    await emailController.getTemplate({ params: { templateName: 'x' } }, res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ success: false, error: { code: 'NOT_FOUND', message: 'Template not found' } });
  });

  it('sendApprovalNotification maps service failure to 400', async () => {
    emailService.sendApprovalNotification.mockResolvedValue({ success: false, error: 'smtp down' });

    const res = createResponse();
    await emailController.sendApprovalNotification({ body: { to: 'a@x.com' } }, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ success: false, error: { code: 'BAD_REQUEST', message: 'smtp down' } });
  });
});
