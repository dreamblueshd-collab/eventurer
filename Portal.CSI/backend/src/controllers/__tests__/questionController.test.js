jest.mock('../../services/surveyService', () => ({
  addQuestion: jest.fn(),
  getQuestionsBySurvey: jest.fn(),
  updateQuestion: jest.fn(),
  deleteQuestion: jest.fn(),
  reorderQuestions: jest.fn(),
}));

jest.mock('../../config/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
}));

const surveyService = require('../../services/surveyService');
const questionController = require('../questionController');

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

describe('questionController (standard envelope)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('getQuestionsBySurvey returns list under data', async () => {
    const rows = [{ QuestionId: 1 }];
    surveyService.getQuestionsBySurvey.mockResolvedValue(rows);

    const res = createResponse();
    await questionController.getQuestionsBySurvey({ params: { surveyId: '1' }, body: {} }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, data: rows });
  });

  it('addQuestion returns 201 with data + meta', async () => {
    const created = { QuestionId: 9, Type: 'Text' };
    surveyService.addQuestion.mockResolvedValue(created);

    const res = createResponse();
    await questionController.addQuestion({ params: {}, body: { surveyId: 1, type: 'Text' } }, res);

    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({ success: true, data: created, meta: { message: 'Question added successfully' } });
  });

  it('deleteQuestion returns 400 BAD_REQUEST when not deleted', async () => {
    surveyService.deleteQuestion.mockResolvedValue(false);

    const res = createResponse();
    await questionController.deleteQuestion({ params: { id: '5' } }, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ success: false, error: { code: 'BAD_REQUEST', message: 'Question was not deleted' } });
  });

  it('maps NotFoundError to 404 envelope', async () => {
    const err = new Error('Question not found');
    err.name = 'NotFoundError';
    surveyService.updateQuestion.mockRejectedValue(err);

    const res = createResponse();
    await questionController.updateQuestion({ params: { id: '5' }, body: {} }, res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ success: false, error: { code: 'NOT_FOUND', message: 'Question not found' } });
  });
});
