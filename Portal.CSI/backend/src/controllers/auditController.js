const auditService = require('../services/auditService');
const { getIpAddress } = require('../utils/auditHelpers');
const { sendSuccess, sendCreated, sendError, sendPaginated } = require('../utils/apiResponse');
const { handleControllerError } = require('../utils/controllerError');

/**
 * Get audit logs
 * GET /api/v1/audit
 */
async function getAuditLogs(req, res) {
  try {
    const {
      startDate,
      endDate,
      userId,
      username,
      keyword,
      searchBy,
      action,
      entityType,
      entityId,
      page,
      pageSize,
      limit
    } = req.query;

    const filter = {};
    if (startDate) filter.startDate = new Date(startDate);
    if (endDate) filter.endDate = new Date(endDate);
    if (userId) filter.userId = userId;
    if (username) filter.username = username;
    if (keyword) filter.keyword = keyword;
    if (searchBy) filter.searchBy = searchBy;
    if (action) filter.action = action;
    if (entityType) filter.entityType = entityType;
    if (entityId) filter.entityId = entityId;
    if (page) filter.page = parseInt(page, 10);
    if (pageSize) filter.pageSize = parseInt(pageSize, 10);
    if (limit) filter.pageSize = parseInt(limit, 10);

    const result = await auditService.getAuditLogs(filter);

    return sendPaginated(res, result.data || [], {
      page: result.pagination?.page || 1,
      pageSize: result.pagination?.pageSize || 50,
      total: result.pagination?.totalRecords || 0
    });
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while fetching audit logs');
  }
}

/**
 * Get entity history
 * GET /api/v1/audit/entity-history/:entityType/:entityId
 */
async function getEntityHistory(req, res) {
  try {
    const entityType = req.params.entityType;
    const entityId = req.params.entityId;

    const history = await auditService.getEntityHistory(entityType, entityId);

    return sendSuccess(res, history.history || [], {
      meta: {
        totalChanges: history.totalChanges || 0,
        entityType: history.entityType || entityType,
        entityId: history.entityId || entityId
      }
    });
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while fetching entity history');
  }
}

/**
 * Log action (manual logging endpoint - typically done via middleware)
 * POST /api/v1/audit/log
 */
async function logAction(req, res) {
  try {
    const log = {
      ...req.body,
      userId: req.user?.userId,
      username: req.user?.username,
      ipAddress: getIpAddress(req),
      userAgent: req.get('user-agent')
    };

    const result = await auditService.logAction(log);

    if (!result.success) {
      return sendError(res, { status: 400, code: 'BAD_REQUEST', message: result.errorMessage });
    }

    return sendCreated(res, { logId: result.logId }, { meta: { message: 'Action logged successfully' } });
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while logging action');
  }
}

module.exports = {
  getAuditLogs,
  getEntityHistory,
  logAction
};
