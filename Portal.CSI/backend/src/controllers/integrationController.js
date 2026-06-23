const sapSyncService = require('../services/sapSyncService');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { handleControllerError } = require('../utils/controllerError');

/**
 * Trigger SAP sync
 * POST /api/v1/integrations/sap/sync
 */
async function triggerSAPSync(req, res) {
  try {
    const result = await sapSyncService.syncOrganizationalData();

    if (!result.success) {
      return sendError(res, {
        status: 400,
        code: 'BAD_REQUEST',
        message: result.errorMessage,
        details: result.errors
      });
    }

    return sendSuccess(res, {
      added: result.added,
      updated: result.updated,
      deactivated: result.deactivated,
      errors: result.errors
    }, {
      meta: { message: 'SAP sync completed successfully' }
    });
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred during SAP sync');
  }
}

/**
 * Get SAP sync status
 * GET /api/v1/integrations/sap/sync/status
 */
async function getSAPSyncStatus(req, res) {
  try {
    const status = await sapSyncService.getSyncStatus();

    return sendSuccess(res, status);
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while fetching sync status');
  }
}

/**
 * Get SAP sync history
 * GET /api/v1/integrations/sap/sync/history
 */
async function getSAPSyncHistory(req, res) {
  try {
    const { limit, offset } = req.query;

    const filter = {};
    if (limit) filter.limit = parseInt(limit, 10);
    if (offset) filter.offset = parseInt(offset, 10);

    const history = await sapSyncService.getSyncHistory(filter);

    return sendSuccess(res, history.logs, { meta: { total: history.total } });
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while fetching sync history');
  }
}

/**
 * Test SAP connection
 * GET /api/v1/integrations/sap/test-connection
 */
async function testSAPConnection(req, res) {
  try {
    const result = await sapSyncService.testConnection();

    if (!result.success) {
      return sendError(res, { status: 400, code: 'BAD_REQUEST', message: result.errorMessage });
    }

    return sendSuccess(res, result.details, { meta: { message: 'SAP connection successful' } });
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while testing connection');
  }
}

module.exports = {
  triggerSAPSync,
  getSAPSyncStatus,
  getSAPSyncHistory,
  testSAPConnection
};
