const sql = require('../../database/sql-client');
const { ValidationError } = require('./errors');

function normalizeAssignedAdminIds(data) {
  const listFromArray = Array.isArray(data.assignedAdminIds) ? data.assignedAdminIds : [];
  const listFromLegacy = data.assignedAdminId ? [data.assignedAdminId] : [];
  const merged = [...listFromArray, ...listFromLegacy].filter(Boolean).map((item) => String(item).trim());
  return [...new Set(merged)];
}

function getPrimaryAssignedAdminId(assignedAdminIds) {
  if (!Array.isArray(assignedAdminIds) || assignedAdminIds.length === 0) {
    return null;
  }

  const parsed = Number.parseInt(String(assignedAdminIds[0]).trim(), 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

async function validateAssignedAdmins(pool, assignedAdminIds) {
  for (const adminId of assignedAdminIds) {
    const adminCheck = await pool
      .request()
      .input('userId', sql.BigInt, adminId)
      .query("SELECT UserId FROM Users WHERE UserId = @userId AND IsActive = 1 AND Role = 'AdminEvent'");

    if (adminCheck.recordset.length === 0) {
      throw new ValidationError('Assigned admin user not found, inactive, or not Admin Event');
    }
  }
}

async function syncSurveyAdminAssignments(connection, surveyId, assignedAdminIds) {
  const makeRequest = () => {
    if (connection && typeof connection.request === 'function') {
      return connection.request();
    }
    return new sql.Request(connection);
  };

  await makeRequest()
    .input('surveyId', sql.BigInt, surveyId)
    .query('DELETE FROM EventAdminAssignments WHERE SurveyId = @surveyId');

  for (const adminId of assignedAdminIds) {
    await makeRequest()
      .input('surveyId', sql.BigInt, surveyId)
      .input('adminUserId', sql.BigInt, adminId)
      .query(`
        INSERT INTO EventAdminAssignments (SurveyId, AdminUserId, CreatedAt)
        VALUES (@surveyId, @adminUserId, GETDATE())
      `);
  }

  const primaryAdminUserId = getPrimaryAssignedAdminId(assignedAdminIds);

  // Keep Events.AssignedAdminId compatible with legacy numeric schema/runtime.
  // Multi-admin display data is resolved from EventAdminAssignments in read models.
  await makeRequest()
    .input('surveyId', sql.BigInt, surveyId)
    .input('primaryAdminUserId', sql.BigInt, primaryAdminUserId)
    .query('UPDATE Events SET AssignedAdminId = @primaryAdminUserId WHERE SurveyId = @surveyId');
}

module.exports = {
  getPrimaryAssignedAdminId,
  normalizeAssignedAdminIds,
  syncSurveyAdminAssignments,
  validateAssignedAdmins
};
