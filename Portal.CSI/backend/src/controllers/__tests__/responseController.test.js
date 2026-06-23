jest.mock('../../services/responseService', () => ({
  getSurveyForm: jest.fn(),
  getAvailableApplications: jest.fn(),
  submitResponse: jest.fn(),
  checkDuplicateResponse: jest.fn(),
  getResponses: jest.fn(),
  getResponseById: jest.fn(),
  getResponseStatistics: jest.fn(),
}));

jest.mock('../../utils/auditHelpers', () => ({
  getIpAddress: jest.fn(() => '127.0.0.1'),
}));

jest.mock('../../config/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
}));

const responseService = require('../../services/responseService');
const responseController = require('../responseController');

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

describe('responseController (standard envelope)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('getSurveyForm returns 404 NOT_FOUND when form missing', async () => {
    responseService.getSurveyForm.mockResolvedValue(null);

    const res = createResponse();
    await responseController.getSurveyForm({ params: { surveyId: '1' } }, res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ success: false, error: { code: 'NOT_FOUND', message: 'Survey not found or not active' } });
  });

  it('getResponses returns list under data', async () => {
    const rows = [{ ResponseId: 1 }];
    responseService.getResponses.mockResolvedValue(rows);

    const res = createResponse();
    await responseController.getResponses({ query: {} }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, data: rows });
  });

  it('submitResponse returns 201 with responseIds under data', async () => {
    responseService.submitResponse.mockResolvedValue({ success: true, responseIds: [10, 11] });

    const res = createResponse();
    await responseController.submitResponse({ body: { surveyId: '1' } }, res);

    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({
      success: true,
      data: { responseIds: [10, 11] },
      meta: { message: 'Response submitted successfully' },
    });
  });

  it('submitResponse maps service failure to 400 envelope', async () => {
    responseService.submitResponse.mockResolvedValue({ success: false, errorMessage: 'Sudah mengisi' });

    const res = createResponse();
    await responseController.submitResponse({ body: { surveyId: '1' } }, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ success: false, error: { code: 'BAD_REQUEST', message: 'Sudah mengisi' } });
  });
});
