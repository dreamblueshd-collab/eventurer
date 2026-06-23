/**
 * Standalone Scheduled Operations Service
 * Handles scheduling of standalone email blasts (no survey context).
 */

const sql = require('../database/sql-client');
const db = require('../database/connection');
const logger = require('../config/logger');
const { normalizeScheduledTime, toSqlTimeValue } = require('./survey-service/scheduling');

/**
 * Resolve initial execution datetime string based on frequency.
 */
function resolveInitialExecutionStr(scheduledDateStr, frequency, scheduledTime) {
  if (frequency === 'once') {
    return scheduledDateStr;
  }
  const datePart = scheduledDateStr.split(' ')[0].split('T')[0];
  const timePart = scheduledTime || '00:00:00';
  return `${datePart} ${timePart}`;
}

/**
 * Schedule a standalone email blast (no SurveyId required).
 * @param {Object} params
 * @param {string} params.scheduledDate - ISO date or datetime string
 * @param {string|null} params.scheduledTime - HH:mm or HH:mm:ss
 * @param {string} params.frequency - once|daily|weekly|monthly
 * @param {number|null} params.dayOfWeek - 0-6 for weekly
 * @param {Object} params.operationContext - Full standalone blast payload (recipients, subject, message, etc.)
 * @param {number|null} params.createdBy - UserId of the scheduler
 * @returns {Object} Created operation record
 */
async function scheduleStandaloneBlast(params) {
  const {
    scheduledDate,
    scheduledTime = null,
    frequency = 'once',
    dayOfWeek = null,
    operationContext,
    createdBy
  } = params;

  const normalizedScheduledTime = normalizeScheduledTime(scheduledTime);
  const sqlScheduledTime = toSqlTimeValue(scheduledTime);

  // Format scheduledDate as local time string
  let scheduledDateStr;
  if (scheduledDate instanceof Date) {
    const pad = (n) => String(n).padStart(2, '0');
    scheduledDateStr = `${scheduledDate.getFullYear()}-${pad(scheduledDate.getMonth() + 1)}-${pad(scheduledDate.getDate())} ${pad(scheduledDate.getHours())}:${pad(scheduledDate.getMinutes())}:${pad(scheduledDate.getSeconds())}`;
  } else {
    scheduledDateStr = String(scheduledDate).replace('T', ' ').replace('Z', '');
  }

  const nextExecutionStr = resolveInitialExecutionStr(scheduledDateStr, frequency, normalizedScheduledTime);

  const pool = await db.getPool();
  const result = await pool.request()
    .input('operationType', sql.NVarChar(50), 'StandaloneBlast')
    .input('frequency', sql.NVarChar(50), frequency)
    .input('scheduledDate', sql.NVarChar(50), scheduledDateStr)
    .input('scheduledTime', sql.Time, sqlScheduledTime)
    .input('dayOfWeek', sql.Int, dayOfWeek)
    .input('emailTemplate', sql.NVarChar(sql.MAX), 'standalone-blast')
    .input('embedCover', sql.Bit, false)
    .input('targetCriteria', sql.NVarChar(sql.MAX), null)
    .input('operationContext', sql.NVarChar(sql.MAX), JSON.stringify(operationContext))
    .input('nextExecutionAt', sql.NVarChar(50), nextExecutionStr)
    .input('createdBy', sql.BigInt, createdBy || null)
    .query(`
      INSERT INTO ScheduledOperations (
        SurveyId,
        OperationType,
        Frequency,
        ScheduledDate,
        ScheduledTime,
        DayOfWeek,
        EmailTemplate,
        EmbedCover,
        TargetCriteria,
        OperationContext,
        Status,
        NextExecutionAt,
        CreatedBy
      )
      OUTPUT INSERTED.*
      VALUES (
        NULL,
        @operationType,
        @frequency,
        @scheduledDate,
        @scheduledTime,
        @dayOfWeek,
        @emailTemplate,
        @embedCover,
        @targetCriteria,
        @operationContext,
        'Pending',
        @nextExecutionAt,
        @createdBy
      )
    `);

  const operation = result.recordset[0];

  logger.info(`Standalone blast scheduled, operation ${operation.OperationId}`);

  return {
    operationId: operation.OperationId,
    operationType: operation.OperationType,
    frequency: operation.Frequency,
    scheduledDate: operation.ScheduledDate,
    scheduledTime: operation.ScheduledTime,
    dayOfWeek: operation.DayOfWeek,
    status: operation.Status,
    nextExecutionAt: operation.NextExecutionAt,
    createdAt: operation.CreatedAt
  };
}

module.exports = {
  scheduleStandaloneBlast
};
