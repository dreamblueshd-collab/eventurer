const sql = require('../../database/sql-client');
const db = require('../../database/connection');
const logger = require('../../config/logger');
const { ConflictError, NotFoundError, ValidationError } = require('./errors');

/**
 * Strip timezone from Date objects returned by mssql driver.
 * DB stores local time but driver returns it as UTC (with Z suffix).
 * We strip the Z so frontend displays it as-is without timezone conversion.
 */
function toLocalDateString(value) {
  if (!value) return value;
  if (value instanceof Date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}T${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}:${pad(value.getUTCSeconds())}`;
  }
  // If string, strip trailing Z
  return String(value).replace(/Z$/, '');
}

/**
 * Resolve initial execution datetime as local time string.
 * For 'once' frequency, returns the scheduledDate as-is.
 * For recurring, applies scheduledTime to the date.
 */
function resolveInitialExecutionStr(scheduledDateStr, frequency, scheduledTime, dayOfWeek) {
  if (frequency === 'once') {
    return scheduledDateStr;
  }

  // For recurring, build datetime from date part + scheduled time
  const datePart = scheduledDateStr.split(' ')[0].split('T')[0];
  const timePart = scheduledTime || '00:00:00';
  return `${datePart} ${timePart}`;
}

function validateScheduleRequest({ surveyId, scheduledDate, frequency, scheduledTime, dayOfWeek }) {
  if (!surveyId || !scheduledDate) {
    throw new ValidationError('Survey ID and scheduled date are required');
  }

  const validFrequencies = ['once', 'daily', 'weekly', 'monthly'];
  if (!validFrequencies.includes(frequency)) {
    throw new ValidationError(`Frequency must be one of: ${validFrequencies.join(', ')}`);
  }

  if (frequency === 'weekly' && (dayOfWeek === null || dayOfWeek < 0 || dayOfWeek > 6)) {
    throw new ValidationError('Weekly scheduling requires dayOfWeek (0-6)');
  }

  if (frequency !== 'once' && !scheduledTime) {
    throw new ValidationError('Recurring schedules require scheduledTime in HH:mm format');
  }
}

async function ensureSurveyExists(surveyId) {
  const pool = await db.getPool();
  const surveyResult = await pool.request()
    .input('surveyId', sql.BigInt, surveyId)
    .query('SELECT SurveyId, Title FROM Surveys WHERE SurveyId = @surveyId');

  if (surveyResult.recordset.length === 0) {
    throw new NotFoundError('Survey not found');
  }

  return { pool, survey: surveyResult.recordset[0] };
}

async function scheduleOperation(request, operationType, dependencies) {
  const {
    normalizeScheduledTime,
    toSqlTimeValue,
    resolveInitialExecution
  } = dependencies;

  const {
    surveyId,
    scheduledDate,
    frequency = 'once',
    scheduledTime = null,
    dayOfWeek = null,
    emailTemplate,
    embedCover = false,
    targetCriteria = null,
    createdBy
  } = request;

  validateScheduleRequest({ surveyId, scheduledDate, frequency, scheduledTime, dayOfWeek });

  const normalizedScheduledTime = normalizeScheduledTime(scheduledTime);
  const sqlScheduledTime = toSqlTimeValue(scheduledTime);
  const { pool } = await ensureSurveyExists(surveyId);

  // Keep scheduledDate as local time string (what user inputted)
  // so DB stores local time that matches display on frontend
  // Handle both Date objects (from validator .toDate()) and strings
  let scheduledDateStr;
  if (scheduledDate instanceof Date) {
    const pad = (n) => String(n).padStart(2, '0');
    scheduledDateStr = `${scheduledDate.getFullYear()}-${pad(scheduledDate.getMonth() + 1)}-${pad(scheduledDate.getDate())} ${pad(scheduledDate.getHours())}:${pad(scheduledDate.getMinutes())}:${pad(scheduledDate.getSeconds())}`;
  } else {
    scheduledDateStr = String(scheduledDate).replace('T', ' ').replace('Z', '');
  }
  const nextExecutionStr = resolveInitialExecutionStr(scheduledDateStr, frequency, normalizedScheduledTime, dayOfWeek);

  const result = await pool.request()
    .input('surveyId', sql.BigInt, surveyId)
    .input('operationType', sql.NVarChar(50), operationType)
    .input('frequency', sql.NVarChar(50), frequency)
    .input('scheduledDate', sql.NVarChar(50), scheduledDateStr)
    .input('scheduledTime', sql.Time, sqlScheduledTime)
    .input('dayOfWeek', sql.Int, dayOfWeek)
    .input('emailTemplate', sql.NVarChar(sql.MAX), emailTemplate)
    .input('embedCover', sql.Bit, embedCover)
    .input('targetCriteria', sql.NVarChar(sql.MAX), targetCriteria ? JSON.stringify(targetCriteria) : null)
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
        Status,
        NextExecutionAt,
        CreatedBy
      )
      OUTPUT INSERTED.*
      VALUES (
        @surveyId,
        @operationType,
        @frequency,
        @scheduledDate,
        @scheduledTime,
        @dayOfWeek,
        @emailTemplate,
        @embedCover,
        @targetCriteria,
        'Pending',
        @nextExecutionAt,
        @createdBy
      )
    `);

  const operation = result.recordset[0];

  logger.info(`${operationType} scheduled for survey ${surveyId}, operation ${operation.OperationId}`);

  return {
    operationId: operation.OperationId,
    surveyId: operation.SurveyId,
    operationType: operation.OperationType,
    frequency: operation.Frequency,
    scheduledDate: toLocalDateString(operation.ScheduledDate),
    scheduledTime: operation.ScheduledTime,
    dayOfWeek: operation.DayOfWeek,
    embedCover: operation.EmbedCover,
    targetCriteria: operation.TargetCriteria ? JSON.parse(operation.TargetCriteria) : null,
    status: operation.Status,
    nextExecutionAt: toLocalDateString(operation.NextExecutionAt),
    createdAt: operation.CreatedAt
  };
}

async function getScheduledOperations(surveyId, filter = {}) {
  const pool = await db.getPool();

  let query = `
    SELECT 
      so.OperationId,
      so.SurveyId,
      so.OperationType,
      so.Frequency,
      so.ScheduledDate,
      so.ScheduledTime,
      so.DayOfWeek,
      so.EmailTemplate,
      so.EmbedCover,
      so.TargetCriteria,
      so.Status,
      so.NextExecutionAt,
      so.LastExecutedAt,
      so.ExecutionCount,
      so.ErrorMessage,
      so.CreatedAt,
      so.CreatedBy,
      u.DisplayName as CreatedByName
    FROM ScheduledOperations so
    LEFT JOIN Users u ON so.CreatedBy = u.UserId
    WHERE so.SurveyId = @surveyId
  `;

  const request = pool.request()
    .input('surveyId', sql.BigInt, surveyId);

  if (filter.operationType) {
    query += ' AND so.OperationType = @operationType';
    request.input('operationType', sql.NVarChar(50), filter.operationType);
  }

  if (filter.status) {
    query += ' AND so.Status = @status';
    request.input('status', sql.NVarChar(50), filter.status);
  }

  query += ' ORDER BY so.ScheduledDate DESC, so.CreatedAt DESC';

  const result = await request.query(query);
  const operations = result.recordset.map(op => ({
    operationId: op.OperationId,
    surveyId: op.SurveyId,
    operationType: op.OperationType,
    frequency: op.Frequency,
    scheduledDate: toLocalDateString(op.ScheduledDate),
    scheduledTime: op.ScheduledTime,
    dayOfWeek: op.DayOfWeek,
    emailTemplate: op.EmailTemplate,
    embedCover: op.EmbedCover,
    targetCriteria: op.TargetCriteria ? JSON.parse(op.TargetCriteria) : null,
    status: op.Status,
    nextExecutionAt: toLocalDateString(op.NextExecutionAt),
    lastExecutedAt: toLocalDateString(op.LastExecutedAt),
    executionCount: op.ExecutionCount,
    errorMessage: op.ErrorMessage,
    createdAt: op.CreatedAt,
    createdBy: op.CreatedBy,
    createdByName: op.CreatedByName
  }));

  logger.info(`Retrieved ${operations.length} scheduled operations for survey ${surveyId}`);

  return operations;
}

async function cancelScheduledOperation(operationId) {
  const pool = await db.getPool();

  const checkResult = await pool.request()
    .input('operationId', sql.BigInt, operationId)
    .query(`
      SELECT OperationId, Status, OperationType, SurveyId
      FROM ScheduledOperations
      WHERE OperationId = @operationId
    `);

  if (checkResult.recordset.length === 0) {
    throw new NotFoundError('Scheduled operation not found');
  }

  const operation = checkResult.recordset[0];

  if (operation.Status === 'Completed') {
    throw new ConflictError('Cannot cancel completed operation');
  }

  if (operation.Status === 'Cancelled') {
    throw new ConflictError('Operation is already cancelled');
  }

  if (operation.Status === 'Running') {
    throw new ConflictError('Cannot cancel operation that is currently running');
  }

  const result = await pool.request()
    .input('operationId', sql.BigInt, operationId)
    .query(`
      UPDATE ScheduledOperations
      SET Status = 'Cancelled',
          NextExecutionAt = NULL
      OUTPUT INSERTED.*
      WHERE OperationId = @operationId
    `);

  const updatedOperation = result.recordset[0];

  logger.info(`Cancelled scheduled operation ${operationId} for survey ${operation.SurveyId}`);

  return {
    operationId: updatedOperation.OperationId,
    surveyId: updatedOperation.SurveyId,
    operationType: updatedOperation.OperationType,
    status: updatedOperation.Status,
    nextExecutionAt: updatedOperation.NextExecutionAt
  };
}

async function retryScheduledOperation(operationId) {
  const pool = await db.getPool();

  const checkResult = await pool.request()
    .input('operationId', sql.BigInt, operationId)
    .query(`
      SELECT OperationId, Status, OperationType, SurveyId, Frequency, ScheduledTime, DayOfWeek
      FROM ScheduledOperations
      WHERE OperationId = @operationId
    `);

  if (checkResult.recordset.length === 0) {
    throw new NotFoundError('Scheduled operation not found');
  }

  const operation = checkResult.recordset[0];

  if (operation.Status === 'Pending' || operation.Status === 'Running') {
    throw new ConflictError('Operation is already pending or running');
  }

  if (operation.Status === 'Cancelled') {
    throw new ConflictError('Cannot retry a cancelled operation. Please create a new schedule.');
  }

  // Set NextExecutionAt to now (local time) so processor picks it up on next cycle
  const result = await pool.request()
    .input('operationId', sql.BigInt, operationId)
    .query(`
      UPDATE ScheduledOperations
      SET Status = 'Pending',
          NextExecutionAt = GETDATE(),
          ErrorMessage = NULL
      OUTPUT INSERTED.*
      WHERE OperationId = @operationId
    `);

  const updatedOperation = result.recordset[0];

  logger.info(`Retry scheduled operation ${operationId} for survey ${operation.SurveyId}`);

  return {
    operationId: updatedOperation.OperationId,
    surveyId: updatedOperation.SurveyId,
    operationType: updatedOperation.OperationType,
    status: updatedOperation.Status,
    nextExecutionAt: updatedOperation.NextExecutionAt
  };
}

module.exports = {
  cancelScheduledOperation,
  getScheduledOperations,
  retryScheduledOperation,
  scheduleOperation
};
