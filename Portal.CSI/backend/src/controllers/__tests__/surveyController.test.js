jest.mock('../../services/surveyService', () => ({
  createSurvey: jest.fn(),
  getSurveys: jest.fn(),
  getSurveyById: jest.fn(),
  updateSurvey: jest.fn(),
  deleteSurvey: jest.fn(),
  getEvents: jest.fn(),
}));

jest.mock('../../services/scheduledOperationsProcessor', () => ({
  triggerProcessing: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../config/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
}));

const surveyService = require('../../services/surveyService');
const surveyController = require('../surveyController');

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

describe('surveyController (standard envelope)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('getSurveys returns list under data', async () => {
    const rows = [{ SurveyId: 1 }];
    surveyService.getSurveys.mockResolvedValue(rows);

    const res = createResponse();
    await surveyController.getSurveys({ query: {}, user: { role: 'SuperAdmin' } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, data: rows });
  });

  it('getSurveyById returns 404 NOT_FOUND when missing', async () => {
    surveyService.getSurveyById.mockResolvedValue(null);

    const res = createResponse();
    await surveyController.getSurveyById({ params: { id: '9' } }, res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ success: false, error: { code: 'NOT_FOUND', message: 'Survey not found' } });
  });

  it('createSurvey returns 201 with data + meta', async () => {
    const created = { SurveyId: 5, Title: 'CSI' };
    surveyService.createSurvey.mockResolvedValue(created);

    const res = createResponse();
    await surveyController.createSurvey({ body: { title: 'CSI' }, user: { userId: 3 } }, res);

    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({ success: true, data: created, meta: { message: 'Event created successfully' } });
  });

  it('createSurvey returns 401 UNAUTHENTICATED when no user id', async () => {
    const res = createResponse();
    await surveyController.createSurvey({ body: { title: 'CSI' }, user: {} }, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Autentikasi gagal' } });
  });

  it('deleteSurvey returns 400 BAD_REQUEST when service returns falsy', async () => {
    surveyService.deleteSurvey.mockResolvedValue(false);

    const res = createResponse();
    await surveyController.deleteSurvey({ params: { id: '5' } }, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ success: false, error: { code: 'BAD_REQUEST', message: 'Event deletion failed' } });
  });

  it('getEvents returns events list under data', async () => {
    const events = [{ EventId: 1 }];
    surveyService.getEvents.mockResolvedValue(events);

    const res = createResponse();
    await surveyController.getEvents({ query: {}, user: { role: 'SuperAdmin' } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, data: events });
  });
});
