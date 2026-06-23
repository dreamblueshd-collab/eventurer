jest.mock('../../services/applicationService', () => ({
  createApplication: jest.fn(),
  getApplications: jest.fn(),
  getApplicationById: jest.fn(),
  updateApplication: jest.fn(),
  deleteApplication: jest.fn(),
}));

jest.mock('../../config/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
}));

const applicationService = require('../../services/applicationService');
const applicationController = require('../applicationController');

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

describe('applicationController (standard envelope)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('getApplications returns { success:true, data: [...] }', async () => {
    const rows = [{ applicationId: 1, name: 'B2B' }];
    applicationService.getApplications.mockResolvedValue(rows);

    const res = createResponse();
    await applicationController.getApplications({ query: {} }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, data: rows });
  });

  it('getApplicationById returns 404 NOT_FOUND envelope when missing', async () => {
    applicationService.getApplicationById.mockResolvedValue(null);

    const res = createResponse();
    await applicationController.getApplicationById({ params: { id: '99' } }, res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ success: false, error: { code: 'NOT_FOUND', message: 'Application not found' } });
  });

  it('createApplication returns 201 with data + meta message', async () => {
    const created = { applicationId: 5, name: 'ERP' };
    applicationService.createApplication.mockResolvedValue(created);

    const res = createResponse();
    await applicationController.createApplication({ body: { name: 'ERP' } }, res);

    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({
      success: true,
      data: created,
      meta: { message: 'Application created successfully' },
    });
  });

  it('maps a service ValidationError to 422 VALIDATION_ERROR', async () => {
    const err = new Error('Name already exists');
    err.name = 'ValidationError';
    applicationService.createApplication.mockRejectedValue(err);

    const res = createResponse();
    await applicationController.createApplication({ body: { name: 'dup' } }, res);

    expect(res.statusCode).toBe(422);
    expect(res.body).toEqual({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Name already exists' },
    });
  });

  it('deleteApplication returns success envelope with null data', async () => {
    applicationService.deleteApplication.mockResolvedValue();

    const res = createResponse();
    await applicationController.deleteApplication({ params: { id: '5' } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: null,
      meta: { message: 'Application deleted successfully' },
    });
  });
});
