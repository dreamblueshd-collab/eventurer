jest.mock('../../services/mappingService', () => ({
  getFunctionAppMappings: jest.fn(),
  getFunctionAppMappingsWithDetails: jest.fn(),
  createFunctionAppMapping: jest.fn(),
  createMultipleFunctionAppMappings: jest.fn(),
  deleteFunctionAppMapping: jest.fn(),
}));

jest.mock('../../services/bulkImportService', () => ({
  BulkImportService: jest.fn(),
}));

jest.mock('../../config/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
}));

const mappingService = require('../../services/mappingService');
const mappingController = require('../mappingController');

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

describe('mappingController (standard envelope)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('getFunctionAppMappings returns list under data', async () => {
    const rows = [{ id: 1 }, { id: 2 }];
    mappingService.getFunctionAppMappings.mockResolvedValue(rows);

    const res = createResponse();
    await mappingController.getFunctionAppMappings({ query: {} }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, data: rows });
  });

  it('createFunctionAppMapping (single) returns 201 with created mapping as data', async () => {
    const created = { mappingId: 5, functionId: 1, applicationId: 2 };
    mappingService.createFunctionAppMapping.mockResolvedValue(created);

    const res = createResponse();
    await mappingController.createFunctionAppMapping(
      { body: { functionId: 1, applicationId: 2 }, user: { userId: 9 } },
      res
    );

    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({
      success: true,
      data: created,
      meta: { message: 'Function-Application mapping created successfully' },
    });
  });

  it('createFunctionAppMapping without app id(s) returns 422 VALIDATION_ERROR', async () => {
    const res = createResponse();
    await mappingController.createFunctionAppMapping(
      { body: { functionId: 1 }, user: { userId: 9 } },
      res
    );

    expect(res.statusCode).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('deleteFunctionAppMapping returns success envelope with null data', async () => {
    mappingService.deleteFunctionAppMapping.mockResolvedValue();

    const res = createResponse();
    await mappingController.deleteFunctionAppMapping({ params: { id: '3' } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: null,
      meta: { message: 'Function-Application mapping deleted successfully' },
    });
  });
});
