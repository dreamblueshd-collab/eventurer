const sql = require('../../database/sql-client');
const publishCycleService = require('../publishCycleService');
const {
  NotFoundError,
  ResponseApprovalStatus,
  TakeoutStatus,
  UnauthorizedError
} = require('./constants');

let _hasAdminAssignmentSupport = null;
let _isPostRestructure = null;

async function hasAdminAssignmentSupport(executor) {
  if (typeof _hasAdminAssignmentSupport === 'boolean') return _hasAdminAssignmentSupport;
  try {
    const tableCheck = await executor.request().query(
      "SELECT COUNT(*) as Cnt FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'EventAdminAssignments'"
    );
    const colCheck = await executor.request().query(
      "SELECT COUNT(*) as Cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Events' AND COLUMN_NAME = 'AssignedAdminId'"
    );
    _hasAdminAssignmentSupport = Number(tableCheck.recordset[0].Cnt) > 0 && Number(colCheck.recordset[0].Cnt) > 0;
  } catch {
    _hasAdminAssignmentSupport = false;
  }
  return _hasAdminAssignmentSupport;
}

async function isPostRestructureSchema(executor) {
  if (typeof _isPostRestructure === 'boolean') return _isPostRestructure;
  try {
    const check = await executor.request().query(
      "SELECT COUNT(*) as Cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Surveys' AND COLUMN_NAME = 'EventId'"
    );
    _isPostRestructure = Number(check.recordset[0].Cnt) > 0;
  } catch {
    _isPostRestructure = false;
  }
  return _isPostRestructure;
}

async function applyCurrentCycleFilter(pool, request, query, surveyId, responseAlias = 'r') {
  if (!surveyId) return query;
  const currentCycle = await publishCycleService.getCurrentCycle(pool, surveyId);
  if (!currentCycle?.PublishCycleId) return query;
  if (!request.parameters || !request.parameters.publishCycleId) {
    request.input('publishCycleId', sql.BigInt, currentCycle.PublishCycleId);
  }
  return `${query} AND (${responseAlias}.PublishCycleId = @publishCycleId OR ${responseAlias}.PublishCycleId IS NULL)`;
}

async function getResponseApprovalStatus(executor, responseId) {
  const result = await executor.request()
    .input('responseId', sql.BigInt, responseId)
    .query(`
      SELECT ResponseApprovalStatus
      FROM Responses
      WHERE ResponseId = @responseId
    `);

  if (result.recordset.length === 0) {
    throw new NotFoundError(`Response ${responseId} not found`);
  }

  return result.recordset[0].ResponseApprovalStatus || ResponseApprovalStatus.SUBMITTED;
}

async function getResponseRoutingRequirement(executor, responseId) {
  const result = await executor.request()
    .input('responseId', sql.BigInt, responseId)
    .query(`
      SELECT
        r.ResponseId,
        r.SurveyId,
        CASE
          WHEN EXISTS (
            SELECT 1
            FROM Questions q
            WHERE q.SurveyId = r.SurveyId
              AND (
                LOWER(CAST(ISNULL(q.Options, '') AS NVARCHAR(MAX))) LIKE '%app_department%'
                OR LOWER(CAST(ISNULL(q.Options, '') AS NVARCHAR(MAX))) LIKE '%app_function%'
              )
          ) THEN CAST(1 AS BIT)
          ELSE CAST(0 AS BIT)
        END AS RequiresITLead
      FROM Responses r
      WHERE r.ResponseId = @responseId
    `);

  if (result.recordset.length === 0) {
    throw new NotFoundError(`Response ${responseId} not found`);
  }

  return {
    surveyId: result.recordset[0].SurveyId,
    requiresITLead: Boolean(result.recordset[0].RequiresITLead),
  };
}

async function updateResponseApprovalStatus(transaction, responseId, status, fields = {}) {
  const request = transaction.request()
    .input('responseId', sql.BigInt, responseId)
    .input('status', sql.NVarChar(50), status);

  const updates = ['ResponseApprovalStatus = @status'];

  if (Object.prototype.hasOwnProperty.call(fields, 'adminReviewedBy')) {
    request.input('adminReviewedBy', sql.BigInt, fields.adminReviewedBy || null);
    updates.push('AdminReviewedBy = @adminReviewedBy');
  }
  if (Object.prototype.hasOwnProperty.call(fields, 'adminReviewedAt')) {
    request.input('adminReviewedAt', sql.DateTime2, fields.adminReviewedAt || null);
    updates.push('AdminReviewedAt = @adminReviewedAt');
  }
  if (Object.prototype.hasOwnProperty.call(fields, 'adminReviewReason')) {
    request.input('adminReviewReason', sql.NVarChar(sql.MAX), fields.adminReviewReason || null);
    updates.push('AdminReviewReason = @adminReviewReason');
  }
  if (Object.prototype.hasOwnProperty.call(fields, 'itLeadReviewedBy')) {
    request.input('itLeadReviewedBy', sql.BigInt, fields.itLeadReviewedBy || null);
    updates.push('ITLeadReviewedBy = @itLeadReviewedBy');
  }
  if (Object.prototype.hasOwnProperty.call(fields, 'itLeadReviewedAt')) {
    request.input('itLeadReviewedAt', sql.DateTime2, fields.itLeadReviewedAt || null);
    updates.push('ITLeadReviewedAt = @itLeadReviewedAt');
  }
  if (Object.prototype.hasOwnProperty.call(fields, 'itLeadReviewReason')) {
    request.input('itLeadReviewReason', sql.NVarChar(sql.MAX), fields.itLeadReviewReason || null);
    updates.push('ITLeadReviewReason = @itLeadReviewReason');
  }
  if (Object.prototype.hasOwnProperty.call(fields, 'finalizedAt')) {
    request.input('finalizedAt', sql.DateTime2, fields.finalizedAt || null);
    updates.push('FinalizedAt = @finalizedAt');
  }

  await request.query(`
    UPDATE Responses
    SET ${updates.join(', ')}
    WHERE ResponseId = @responseId
  `);
}

async function assertAdminEventCanAccessSurvey(executor, surveyId, adminUserId) {
  if (!(await hasAdminAssignmentSupport(executor))) return; // skip check if schema not ready

  const postRestructure = await isPostRestructureSchema(executor);

  const query = postRestructure
    ? `
      SELECT TOP 1 s.SurveyId
      FROM Surveys s
      INNER JOIN Events e ON e.SurveyId = s.EventId
      LEFT JOIN EventAdminAssignments saa
        ON saa.SurveyId = s.EventId
       AND saa.AdminUserId = @adminUserId
      WHERE s.SurveyId = @surveyId
        AND (TRY_CONVERT(BIGINT, e.AssignedAdminId) = @adminUserId OR saa.AdminUserId IS NOT NULL)
    `
    : `
      SELECT TOP 1 s.SurveyId
      FROM Surveys s
      LEFT JOIN EventAdminAssignments saa
        ON saa.SurveyId = s.SurveyId
       AND saa.AdminUserId = @adminUserId
      WHERE s.SurveyId = @surveyId
        AND (s.AssignedAdminId = @adminUserId OR saa.AdminUserId IS NOT NULL)
    `;

  const result = await executor.request()
    .input('surveyId', sql.BigInt, surveyId)
    .input('adminUserId', sql.BigInt, adminUserId)
    .query(query);

  if (result.recordset.length === 0) {
    throw new UnauthorizedError('Admin Event tidak memiliki akses ke event ini');
  }
}

async function assertAdminEventCanAccessResponse(executor, responseId, adminUserId) {
  if (!(await hasAdminAssignmentSupport(executor))) return; // skip check if schema not ready

  const postRestructure = await isPostRestructureSchema(executor);

  const query = postRestructure
    ? `
      SELECT TOP 1 r.ResponseId
      FROM Responses r
      INNER JOIN Surveys s ON s.SurveyId = r.SurveyId
      INNER JOIN Events e ON e.SurveyId = s.EventId
      LEFT JOIN EventAdminAssignments saa
        ON saa.SurveyId = s.EventId
       AND saa.AdminUserId = @adminUserId
      WHERE r.ResponseId = @responseId
        AND (TRY_CONVERT(BIGINT, e.AssignedAdminId) = @adminUserId OR saa.AdminUserId IS NOT NULL)
    `
    : `
      SELECT TOP 1 r.ResponseId
      FROM Responses r
      INNER JOIN Surveys s ON s.SurveyId = r.SurveyId
      LEFT JOIN EventAdminAssignments saa
        ON saa.SurveyId = s.SurveyId
       AND saa.AdminUserId = @adminUserId
      WHERE r.ResponseId = @responseId
        AND (s.AssignedAdminId = @adminUserId OR saa.AdminUserId IS NOT NULL)
    `;

  const result = await executor.request()
    .input('responseId', sql.BigInt, responseId)
    .input('adminUserId', sql.BigInt, adminUserId)
    .query(query);

  if (result.recordset.length === 0) {
    throw new UnauthorizedError('Admin Event tidak memiliki akses ke response ini');
  }
}

async function assertITLeadCanAccessResponse(executor, responseId, itLeadUserId) {
  const result = await executor.request()
    .input('responseId', sql.BigInt, responseId)
    .input('itLeadUserId', sql.BigInt, itLeadUserId)
    .query(`
      SELECT TOP 1 r.ResponseId
      FROM Responses r
      INNER JOIN FunctionApplicationMappings fam ON fam.ApplicationId = r.ApplicationId
      INNER JOIN Functions f ON f.FunctionId = fam.FunctionId
      WHERE r.ResponseId = @responseId
        AND f.ITLeadUserId = @itLeadUserId
    `);

  if (result.recordset.length === 0) {
    throw new UnauthorizedError('IT Lead tidak memiliki akses ke response ini');
  }
}

async function finalizeResponseIfReady(transaction, responseId, adminUserId, reason = null) {
  const remaining = await transaction.request()
    .input('responseId', sql.BigInt, responseId)
    .input('pendingStatus', sql.NVarChar(50), TakeoutStatus.PROPOSED_TAKEOUT)
    .query(`
      SELECT COUNT(*) AS PendingCount
      FROM QuestionResponses
      WHERE ResponseId = @responseId
        AND TakeoutStatus = @pendingStatus
    `);

  const pendingCount = Number(remaining.recordset?.[0]?.PendingCount || 0);
  if (pendingCount > 0) {
    return false;
  }

  await updateResponseApprovalStatus(transaction, responseId, ResponseApprovalStatus.APPROVED_FINAL, {
    adminReviewedBy: adminUserId || null,
    adminReviewedAt: new Date(),
    adminReviewReason: reason || null,
    finalizedAt: new Date()
  });
  return true;
}

module.exports = {
  applyCurrentCycleFilter,
  assertAdminEventCanAccessResponse,
  assertAdminEventCanAccessSurvey,
  assertITLeadCanAccessResponse,
  finalizeResponseIfReady,
  getResponseApprovalStatus,
  getResponseRoutingRequirement,
  hasAdminAssignmentSupport,
  updateResponseApprovalStatus
};
