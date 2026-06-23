jest.mock('../../services/sapSyncService', () => ({
  syncOrganizationalData: jest.fn(),
  getSyncStatus: jest.fn(),
  getSyncHistory: jest.fn(),
  testConnection: jest.fn(),
}));

jest.mock('../../config/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
}));

const sapSyncService = require('../../services/sapSyncService');
const integrationController = require('../integrationController');

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

describe('integrationController (standard envelope)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('triggerSAPSync returns summary under data on success', async () => {
    sapSyncService.syncOrganizationalData.mockResolvedValue({
      success: true, added: 1, updated: 2, deactivated: 0, errors: [],
    });

    const res = createResponse();
    await integrationController.triggerSAPSync({}, res);

    expect(res.body).toEqual({
      success: true,
      data: { added: 1, updated: 2, deactivated: 0, errors: [] },
      meta: { message: 'SAP sync completed successfully' },
    });
  });

  it('triggerSAPSync maps service failure to 400 with details', async () => {
    sapSyncService.syncOrganizationalData.mockResolvedValue({
      success: false, errorMessage: 'SAP unreachable', errors: ['e1'],
    });

    const res = createResponse();
    await integrationController.triggerSAPSync({}, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'SAP unreachable', details: ['e1'] },
    });
  });

  it('getSAPSyncHistory returns logs under data with total meta', async () => {
    sapSyncService.getSyncHistory.mockResolvedValue({ logs: [{ id: 1 }], total: 1 });

    const res = createResponse();
    await integrationController.getSAPSyncHistory({ query: {} }, res);

    expect(res.body).toEqual({ success: true, data: [{ id: 1 }], meta: { total: 1 } });
  });
});
