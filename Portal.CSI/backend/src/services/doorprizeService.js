const sql = require('../database/sql-client');

const db = require('../database/connection');
const logger = require('../config/logger');

/**
 * Custom error classes
 */
class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 422;
  }
}

class ConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConflictError';
    this.statusCode = 409;
  }
}

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

const VALID_EVENT_STATUSES = ['Draft', 'Active', 'Completed', 'Archived'];

/**
 * Map a DoorprizeEvents row (PascalCase columns) to a camelCase plain object
 * matching the DoorprizeEvent type used by the controller / frontend.
 *
 * @param {Object} row - Raw recordset row
 * @returns {Object|null} Mapped event object or null when row is missing
 */
function mapEventRow(row) {
  if (!row) {
    return null;
  }

  const imagePath = row.ImagePath || null;
  const imageUrl = imagePath ? `/${imagePath}` : null;

  return {
    doorprizeEventId: Number(row.DoorprizeEventId),
    name: row.Name,
    eventDate: row.EventDate ? new Date(row.EventDate).toISOString() : null,
    imagePath,
    imageUrl,
    status: row.Status,
    createdBy: row.CreatedBy != null ? Number(row.CreatedBy) : null,
    createdAt: row.CreatedAt ? new Date(row.CreatedAt).toISOString() : null,
    updatedAt: row.UpdatedAt ? new Date(row.UpdatedAt).toISOString() : null,
    parentEventId: row.ParentEventId != null ? Number(row.ParentEventId) : null,
    giftCount: row.GiftCount != null ? Number(row.GiftCount) : 0,
    participantCount: row.ParticipantCount != null ? Number(row.ParticipantCount) : 0,
    resultCount: row.ResultCount != null ? Number(row.ResultCount) : 0
  };
}

/**
 * Validate event status string
 * @param {string} status
 * @throws {ValidationError}
 */
function validateStatus(status) {
  if (!VALID_EVENT_STATUSES.includes(status)) {
    throw new ValidationError(
      `Status must be one of: ${VALID_EVENT_STATUSES.join(', ')}`
    );
  }
}

/**
 * Normalize / parse an event date input (string | Date) into a Date instance.
 * @param {string|Date} value
 * @returns {Date}
 * @throws {ValidationError}
 */
function parseEventDate(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new ValidationError('eventDate is invalid');
    }
    return value;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError('eventDate is invalid');
  }
  return parsed;
}

/**
 * List doorprize events with pagination, status filter, and computed counts
 * (gifts, participants, results).
 *
 * @param {Object} [filters]
 * @param {number} [filters.page=1] - 1-indexed page number
 * @param {number} [filters.limit=20] - Page size (max 100)
 * @param {string} [filters.status] - Optional status filter (Draft|Active|Completed|Archived)
 * @returns {Promise<{ data: Object[], total: number, page: number, limit: number }>}
 */
async function getAllEvents(filters = {}) {
  try {
    const page = Math.max(1, parseInt(filters.page, 10) || 1);
    const rawLimit = parseInt(filters.limit, 10) || 20;
    const limit = Math.max(1, Math.min(100, rawLimit));
    const offset = (page - 1) * limit;

    const pool = await db.getPool();

    const conditions = [];
    const countRequest = pool.request();
    const listRequest = pool.request();

    if (filters.status) {
      validateStatus(filters.status);
      conditions.push('e.Status = @status');
      countRequest.input('status', sql.NVarChar(50), filters.status);
      listRequest.input('status', sql.NVarChar(50), filters.status);
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    // Total count (matching the same filters)
    const countResult = await countRequest.query(`
      SELECT COUNT(*) AS Total
      FROM DoorprizeEvents e
      ${whereClause}
    `);
    const total = Number(countResult.recordset[0].Total) || 0;

    // Paginated list with computed counts via correlated subqueries
    listRequest.input('offset', sql.Int, offset);
    listRequest.input('limit', sql.Int, limit);

    const listResult = await listRequest.query(`
      SELECT
        e.DoorprizeEventId,
        e.Name,
        e.EventDate,
        e.ImagePath,
        e.Status,
        e.CreatedBy,
        e.CreatedAt,
        e.UpdatedAt,
        (SELECT COUNT(*) FROM DoorprizeGifts g
          WHERE g.DoorprizeEventId = e.DoorprizeEventId) AS GiftCount,
        (SELECT COUNT(*) FROM DoorprizeParticipants p
          WHERE p.DoorprizeEventId = e.DoorprizeEventId) AS ParticipantCount,
        (SELECT COUNT(*) FROM DoorprizeResults r
          WHERE r.DoorprizeEventId = e.DoorprizeEventId) AS ResultCount
      FROM DoorprizeEvents e
      ${whereClause}
      ORDER BY e.EventDate DESC, e.DoorprizeEventId DESC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `);

    return {
      data: listResult.recordset.map(mapEventRow),
      total,
      page,
      limit
    };
  } catch (error) {
    if (error.name === 'ValidationError') {
      throw error;
    }
    logger.error('Error listing doorprize events:', error);
    throw error;
  }
}

/**
 * Get a single doorprize event by ID with computed counts.
 *
 * @param {number|string} eventId
 * @returns {Promise<Object|null>} Event object or null when not found
 */
async function getEventById(eventId) {
  try {
    const id = Number(eventId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new ValidationError('eventId must be a positive integer');
    }

    const pool = await db.getPool();
    const result = await pool.request()
      .input('eventId', sql.BigInt, id)
      .query(`
        SELECT
          e.DoorprizeEventId,
          e.Name,
          e.EventDate,
          e.ImagePath,
          e.Status,
          e.CreatedBy,
          e.CreatedAt,
          e.UpdatedAt,
          e.ParentEventId,
          (SELECT COUNT(*) FROM DoorprizeGifts g
            WHERE g.DoorprizeEventId = e.DoorprizeEventId) AS GiftCount,
          (SELECT COUNT(*) FROM DoorprizeParticipants p
            WHERE p.DoorprizeEventId = e.DoorprizeEventId) AS ParticipantCount,
          (SELECT COUNT(*) FROM DoorprizeResults r
            WHERE r.DoorprizeEventId = e.DoorprizeEventId) AS ResultCount
        FROM DoorprizeEvents e
        WHERE e.DoorprizeEventId = @eventId
      `);

    if (result.recordset.length === 0) {
      return null;
    }

    return mapEventRow(result.recordset[0]);
  } catch (error) {
    if (error.name === 'ValidationError') {
      throw error;
    }
    logger.error('Error fetching doorprize event by id:', error);
    throw error;
  }
}

/**
 * Create a new doorprize event.
 *
 * @param {Object} data
 * @param {string} data.name - Event name (required, max 500 chars)
 * @param {string|Date} data.eventDate - Event date (required, valid datetime)
 * @param {string} [data.status='Draft'] - Initial status
 * @param {string} [data.imagePath] - Optional banner/image relative path
 * @param {number|string} data.createdBy - UserId of creator (required)
 * @returns {Promise<Object>} Created event object with computed counts (all zero)
 */
async function createEvent(data = {}) {
  try {
    const name = typeof data.name === 'string' ? data.name.trim() : '';
    if (!name) {
      throw new ValidationError('Name is required');
    }
    if (name.length > 500) {
      throw new ValidationError('Name must be at most 500 characters');
    }

    if (data.eventDate === undefined || data.eventDate === null || data.eventDate === '') {
      throw new ValidationError('eventDate is required');
    }
    const eventDate = parseEventDate(data.eventDate);

    const status = data.status || 'Draft';
    validateStatus(status);

    const createdBy = Number(data.createdBy);
    if (!Number.isInteger(createdBy) || createdBy <= 0) {
      throw new ValidationError('createdBy must be a positive integer');
    }

    const imagePath = data.imagePath ? String(data.imagePath) : null;
    if (imagePath && imagePath.length > 500) {
      throw new ValidationError('imagePath must be at most 500 characters');
    }

    const parentEventId = data.parentEventId != null ? Number(data.parentEventId) : null;
    if (parentEventId !== null && (!Number.isInteger(parentEventId) || parentEventId <= 0)) {
      throw new ValidationError('parentEventId must be a positive integer');
    }

    const pool = await db.getPool();
    const result = await pool.request()
      .input('name', sql.NVarChar(500), name)
      .input('eventDate', sql.DateTime2, eventDate)
      .input('imagePath', sql.NVarChar(500), imagePath)
      .input('status', sql.NVarChar(50), status)
      .input('createdBy', sql.BigInt, createdBy)
      .input('parentEventId', sql.BigInt, parentEventId)
      .query(`
        INSERT INTO DoorprizeEvents (Name, EventDate, ImagePath, Status, CreatedBy, ParentEventId, CreatedAt)
        OUTPUT INSERTED.*
        VALUES (@name, @eventDate, @imagePath, @status, @createdBy, @parentEventId, GETDATE())
      `);

    logger.info('Doorprize event created', {
      doorprizeEventId: result.recordset[0].DoorprizeEventId,
      createdBy
    });

    return mapEventRow({
      ...result.recordset[0],
      GiftCount: 0,
      ParticipantCount: 0,
      ResultCount: 0
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      throw error;
    }
    logger.error('Error creating doorprize event:', error);
    throw error;
  }
}

/**
 * Partial update of a doorprize event. Only provided fields are updated.
 * UpdatedAt is always refreshed to GETDATE().
 *
 * @param {number|string} eventId
 * @param {Object} data - Partial event data: name, eventDate, status, imagePath
 * @returns {Promise<Object>} Updated event with computed counts
 * @throws {NotFoundError} when the event does not exist
 */
async function updateEvent(eventId, data = {}) {
  try {
    const id = Number(eventId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new ValidationError('eventId must be a positive integer');
    }

    const pool = await db.getPool();

    // Ensure event exists
    const existing = await pool.request()
      .input('eventId', sql.BigInt, id)
      .query('SELECT DoorprizeEventId FROM DoorprizeEvents WHERE DoorprizeEventId = @eventId');

    if (existing.recordset.length === 0) {
      throw new NotFoundError('Doorprize event not found');
    }

    const updateFields = [];
    const request = pool.request();
    request.input('eventId', sql.BigInt, id);

    if (data.name !== undefined) {
      const name = typeof data.name === 'string' ? data.name.trim() : '';
      if (!name) {
        throw new ValidationError('Name is required');
      }
      if (name.length > 500) {
        throw new ValidationError('Name must be at most 500 characters');
      }
      updateFields.push('Name = @name');
      request.input('name', sql.NVarChar(500), name);
    }

    if (data.eventDate !== undefined) {
      if (data.eventDate === null || data.eventDate === '') {
        throw new ValidationError('eventDate is required');
      }
      const parsed = parseEventDate(data.eventDate);
      updateFields.push('EventDate = @eventDate');
      request.input('eventDate', sql.DateTime2, parsed);
    }

    if (data.status !== undefined) {
      validateStatus(data.status);
      updateFields.push('Status = @status');
      request.input('status', sql.NVarChar(50), data.status);
    }

    if (data.imagePath !== undefined) {
      const imagePath = data.imagePath === null ? null : String(data.imagePath);
      if (imagePath && imagePath.length > 500) {
        throw new ValidationError('imagePath must be at most 500 characters');
      }
      updateFields.push('ImagePath = @imagePath');
      request.input('imagePath', sql.NVarChar(500), imagePath);
    }

    if (updateFields.length === 0) {
      throw new ValidationError('No fields to update');
    }

    updateFields.push('UpdatedAt = GETDATE()');

    await request.query(`
      UPDATE DoorprizeEvents
      SET ${updateFields.join(', ')}
      WHERE DoorprizeEventId = @eventId
    `);

    logger.info('Doorprize event updated', { doorprizeEventId: id });
    return getEventById(id);
  } catch (error) {
    if (
      error.name === 'ValidationError' ||
      error.name === 'NotFoundError'
    ) {
      throw error;
    }
    logger.error('Error updating doorprize event:', error);
    throw error;
  }
}

/**
 * Delete a doorprize event with application-level cascade for results.
 *
 * Background: per migration 048, DoorprizeResults FKs DO NOT cascade
 * (DoorprizeGifts and DoorprizeParticipants already cascade from
 * DoorprizeEvents, so cascading from any of them to DoorprizeResults
 * would create multiple cascade paths in MSSQL). We must delete
 * DoorprizeResults rows first; DoorprizeGifts and DoorprizeParticipants
 * are then removed automatically by their cascade FKs to DoorprizeEvents.
 *
 * @param {number|string} eventId
 * @returns {Promise<void>}
 * @throws {NotFoundError} when the event does not exist
 */
async function deleteEvent(eventId) {
  try {
    const id = Number(eventId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new ValidationError('eventId must be a positive integer');
    }

    const pool = await db.getPool();

    // Verify the event exists first so callers get a clear NotFound
    const existing = await pool.request()
      .input('eventId', sql.BigInt, id)
      .query('SELECT DoorprizeEventId FROM DoorprizeEvents WHERE DoorprizeEventId = @eventId');

    if (existing.recordset.length === 0) {
      throw new NotFoundError('Doorprize event not found');
    }

    // Wrap in a transaction so partial deletes never leak
    const transaction = await db.beginTransaction();
    try {
      // 1. Delete results (no cascade from gifts/participants)
      await transaction.request()
        .input('eventId', sql.BigInt, id)
        .query('DELETE FROM DoorprizeResults WHERE DoorprizeEventId = @eventId');

      // 2. Delete the event itself; gifts and participants cascade automatically
      await transaction.request()
        .input('eventId', sql.BigInt, id)
        .query('DELETE FROM DoorprizeEvents WHERE DoorprizeEventId = @eventId');

      await transaction.commit();
    } catch (txError) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        logger.error('Rollback failed while deleting doorprize event:', rollbackError);
      }
      throw txError;
    }

    logger.info('Doorprize event deleted', { doorprizeEventId: id });
  } catch (error) {
    if (
      error.name === 'ValidationError' ||
      error.name === 'NotFoundError'
    ) {
      throw error;
    }
    logger.error('Error deleting doorprize event:', error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Gift methods (task 1.4)
// ---------------------------------------------------------------------------

/**
 * Map a DoorprizeGifts row (PascalCase columns + computed ResultCount) to a
 * camelCase plain object matching the DoorprizeGift type used by the
 * controller / frontend. Computes quotaRemaining = max(0, quota - resultCount).
 *
 * @param {Object} row - Raw recordset row
 * @returns {Object|null} Mapped gift object or null when row is missing
 */
function mapGiftRow(row) {
  if (!row) {
    return null;
  }

  const quota = row.Quota != null ? Number(row.Quota) : 0;
  const resultCount = row.ResultCount != null ? Number(row.ResultCount) : 0;
  const quotaRemaining = Math.max(0, quota - resultCount);
  const imagePath = row.ImagePath || null;
  const imageUrl = imagePath ? `/${imagePath}` : null;

  return {
    doorprizeGiftId: Number(row.DoorprizeGiftId),
    doorprizeEventId: Number(row.DoorprizeEventId),
    name: row.Name,
    quota,
    giftBy: row.GiftBy || null,
    drawTime: row.DrawTime || null,
    imagePath,
    imageUrl,
    displayOrder: row.DisplayOrder != null ? Number(row.DisplayOrder) : 0,
    createdAt: row.CreatedAt ? new Date(row.CreatedAt).toISOString() : null,
    updatedAt: row.UpdatedAt ? new Date(row.UpdatedAt).toISOString() : null,
    resultCount,
    quotaRemaining
  };
}

/**
 * Validate quota value: must be an integer > 0.
 * @param {*} value
 * @throws {ValidationError}
 */
function validateQuota(value) {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    throw new ValidationError('quota must be a positive integer greater than zero');
  }
  return num;
}

/**
 * Verify a doorprize event exists; throws NotFoundError otherwise.
 * Returns the verified eventId as a number for chaining.
 *
 * @param {sql.Request|null} request - Optional pool/transaction request to reuse
 * @param {number|string} eventId
 * @returns {Promise<number>}
 */
async function assertEventExists(eventId) {
  const id = Number(eventId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ValidationError('doorprizeEventId must be a positive integer');
  }

  const pool = await db.getPool();
  const result = await pool.request()
    .input('eventId', sql.BigInt, id)
    .query('SELECT DoorprizeEventId FROM DoorprizeEvents WHERE DoorprizeEventId = @eventId');

  if (result.recordset.length === 0) {
    throw new NotFoundError('Doorprize event not found');
  }
  return id;
}

/**
 * Fetch a single gift by ID with computed ResultCount.
 *
 * @param {number|string} giftId
 * @returns {Promise<Object|null>} Mapped gift or null when not found
 */
async function getGiftById(giftId) {
  try {
    const id = Number(giftId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new ValidationError('giftId must be a positive integer');
    }

    const pool = await db.getPool();
    const result = await pool.request()
      .input('giftId', sql.BigInt, id)
      .query(`
        SELECT
          g.DoorprizeGiftId,
          g.DoorprizeEventId,
          g.Name,
          g.Quota,
          g.GiftBy,
          g.DrawTime,
          g.ImagePath,
          g.DisplayOrder,
          g.CreatedAt,
          g.UpdatedAt,
          (SELECT COUNT(*) FROM DoorprizeResults r
            WHERE r.DoorprizeGiftId = g.DoorprizeGiftId) AS ResultCount
        FROM DoorprizeGifts g
        WHERE g.DoorprizeGiftId = @giftId
      `);

    if (result.recordset.length === 0) {
      return null;
    }
    return mapGiftRow(result.recordset[0]);
  } catch (error) {
    if (error.name === 'ValidationError') {
      throw error;
    }
    logger.error('Error fetching doorprize gift by id:', error);
    throw error;
  }
}

/**
 * List all gifts for a doorprize event, ordered by DisplayOrder ASC then by
 * DoorprizeGiftId ASC, with computed resultCount and quotaRemaining.
 *
 * @param {number|string} eventId
 * @returns {Promise<Object[]>}
 * @throws {NotFoundError} when the event does not exist
 */
async function getGiftsByEvent(eventId) {
  try {
    const id = await assertEventExists(eventId);

    const pool = await db.getPool();
    const result = await pool.request()
      .input('eventId', sql.BigInt, id)
      .query(`
        SELECT
          g.DoorprizeGiftId,
          g.DoorprizeEventId,
          g.Name,
          g.Quota,
          g.GiftBy,
          g.DrawTime,
          g.ImagePath,
          g.DisplayOrder,
          g.CreatedAt,
          g.UpdatedAt,
          (SELECT COUNT(*) FROM DoorprizeResults r
            WHERE r.DoorprizeGiftId = g.DoorprizeGiftId) AS ResultCount
        FROM DoorprizeGifts g
        WHERE g.DoorprizeEventId = @eventId
        ORDER BY g.DisplayOrder ASC, g.DoorprizeGiftId ASC
      `);

    return result.recordset.map(mapGiftRow);
  } catch (error) {
    if (
      error.name === 'ValidationError' ||
      error.name === 'NotFoundError'
    ) {
      throw error;
    }
    logger.error('Error listing doorprize gifts:', error);
    throw error;
  }
}

/**
 * Create a new doorprize gift for an existing event.
 *
 * @param {Object} data
 * @param {number|string} data.doorprizeEventId - Parent event (required)
 * @param {string} data.name - Gift name (required, max 500 chars)
 * @param {number} data.quota - Positive integer (required)
 * @param {string} [data.giftBy] - Sponsor name (max 200 chars)
 * @param {string} [data.drawTime] - Draw time label (max 100 chars)
 * @param {string} [data.imagePath] - Image relative path (max 500 chars)
 * @param {number} [data.displayOrder=0] - Display ordering
 * @returns {Promise<Object>} Created gift with computed resultCount=0 and quotaRemaining=quota
 */
async function createGift(data = {}) {
  try {
    if (data.doorprizeEventId === undefined || data.doorprizeEventId === null) {
      throw new ValidationError('doorprizeEventId is required');
    }
    const eventId = await assertEventExists(data.doorprizeEventId);

    const name = typeof data.name === 'string' ? data.name.trim() : '';
    if (!name) {
      throw new ValidationError('Name is required');
    }
    if (name.length > 500) {
      throw new ValidationError('Name must be at most 500 characters');
    }

    if (data.quota === undefined || data.quota === null || data.quota === '') {
      throw new ValidationError('quota is required');
    }
    const quota = validateQuota(data.quota);

    const giftBy = data.giftBy != null && data.giftBy !== '' ? String(data.giftBy) : null;
    if (giftBy && giftBy.length > 200) {
      throw new ValidationError('giftBy must be at most 200 characters');
    }

    const drawTime = data.drawTime != null && data.drawTime !== '' ? String(data.drawTime) : null;
    if (drawTime && drawTime.length > 100) {
      throw new ValidationError('drawTime must be at most 100 characters');
    }

    const imagePath = data.imagePath != null && data.imagePath !== '' ? String(data.imagePath) : null;
    if (imagePath && imagePath.length > 500) {
      throw new ValidationError('imagePath must be at most 500 characters');
    }

    let displayOrder = 0;
    if (data.displayOrder !== undefined && data.displayOrder !== null && data.displayOrder !== '') {
      const order = Number(data.displayOrder);
      if (!Number.isInteger(order)) {
        throw new ValidationError('displayOrder must be an integer');
      }
      displayOrder = order;
    }

    const pool = await db.getPool();
    const result = await pool.request()
      .input('eventId', sql.BigInt, eventId)
      .input('name', sql.NVarChar(500), name)
      .input('quota', sql.Int, quota)
      .input('giftBy', sql.NVarChar(200), giftBy)
      .input('drawTime', sql.NVarChar(100), drawTime)
      .input('imagePath', sql.NVarChar(500), imagePath)
      .input('displayOrder', sql.Int, displayOrder)
      .query(`
        INSERT INTO DoorprizeGifts
          (DoorprizeEventId, Name, Quota, GiftBy, DrawTime, ImagePath, DisplayOrder, CreatedAt)
        OUTPUT INSERTED.*
        VALUES
          (@eventId, @name, @quota, @giftBy, @drawTime, @imagePath, @displayOrder, GETDATE())
      `);

    logger.info('Doorprize gift created', {
      doorprizeGiftId: result.recordset[0].DoorprizeGiftId,
      doorprizeEventId: eventId
    });

    return mapGiftRow({
      ...result.recordset[0],
      ResultCount: 0
    });
  } catch (error) {
    if (
      error.name === 'ValidationError' ||
      error.name === 'NotFoundError'
    ) {
      throw error;
    }
    logger.error('Error creating doorprize gift:', error);
    throw error;
  }
}

/**
 * Partial update of a doorprize gift. Only provided fields are updated.
 * UpdatedAt is always refreshed to GETDATE().
 *
 * Allowed fields: name, quota, giftBy, drawTime, imagePath, displayOrder.
 * doorprizeEventId is intentionally NOT updatable (re-parenting a gift would
 * orphan its results).
 *
 * @param {number|string} giftId
 * @param {Object} data - Partial gift data
 * @returns {Promise<Object>} Updated gift with computed resultCount/quotaRemaining
 * @throws {NotFoundError} when the gift does not exist
 */
async function updateGift(giftId, data = {}) {
  try {
    const id = Number(giftId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new ValidationError('giftId must be a positive integer');
    }

    const pool = await db.getPool();

    // Ensure gift exists
    const existing = await pool.request()
      .input('giftId', sql.BigInt, id)
      .query('SELECT DoorprizeGiftId FROM DoorprizeGifts WHERE DoorprizeGiftId = @giftId');

    if (existing.recordset.length === 0) {
      throw new NotFoundError('Doorprize gift not found');
    }

    const updateFields = [];
    const request = pool.request();
    request.input('giftId', sql.BigInt, id);

    if (data.name !== undefined) {
      const name = typeof data.name === 'string' ? data.name.trim() : '';
      if (!name) {
        throw new ValidationError('Name is required');
      }
      if (name.length > 500) {
        throw new ValidationError('Name must be at most 500 characters');
      }
      updateFields.push('Name = @name');
      request.input('name', sql.NVarChar(500), name);
    }

    if (data.quota !== undefined) {
      const quota = validateQuota(data.quota);
      updateFields.push('Quota = @quota');
      request.input('quota', sql.Int, quota);
    }

    if (data.giftBy !== undefined) {
      const giftBy = data.giftBy === null || data.giftBy === '' ? null : String(data.giftBy);
      if (giftBy && giftBy.length > 200) {
        throw new ValidationError('giftBy must be at most 200 characters');
      }
      updateFields.push('GiftBy = @giftBy');
      request.input('giftBy', sql.NVarChar(200), giftBy);
    }

    if (data.drawTime !== undefined) {
      const drawTime = data.drawTime === null || data.drawTime === '' ? null : String(data.drawTime);
      if (drawTime && drawTime.length > 100) {
        throw new ValidationError('drawTime must be at most 100 characters');
      }
      updateFields.push('DrawTime = @drawTime');
      request.input('drawTime', sql.NVarChar(100), drawTime);
    }

    if (data.imagePath !== undefined) {
      const imagePath = data.imagePath === null || data.imagePath === '' ? null : String(data.imagePath);
      if (imagePath && imagePath.length > 500) {
        throw new ValidationError('imagePath must be at most 500 characters');
      }
      updateFields.push('ImagePath = @imagePath');
      request.input('imagePath', sql.NVarChar(500), imagePath);
    }

    if (data.displayOrder !== undefined) {
      if (data.displayOrder === null || data.displayOrder === '') {
        throw new ValidationError('displayOrder must be an integer');
      }
      const order = Number(data.displayOrder);
      if (!Number.isInteger(order)) {
        throw new ValidationError('displayOrder must be an integer');
      }
      updateFields.push('DisplayOrder = @displayOrder');
      request.input('displayOrder', sql.Int, order);
    }

    if (updateFields.length === 0) {
      throw new ValidationError('No fields to update');
    }

    updateFields.push('UpdatedAt = GETDATE()');

    await request.query(`
      UPDATE DoorprizeGifts
      SET ${updateFields.join(', ')}
      WHERE DoorprizeGiftId = @giftId
    `);

    logger.info('Doorprize gift updated', { doorprizeGiftId: id });
    return getGiftById(id);
  } catch (error) {
    if (
      error.name === 'ValidationError' ||
      error.name === 'NotFoundError'
    ) {
      throw error;
    }
    logger.error('Error updating doorprize gift:', error);
    throw error;
  }
}

/**
 * Delete a doorprize gift with application-level cascade for results.
 *
 * Background: per migration 048, DoorprizeResults FK to DoorprizeGifts does
 * NOT cascade (multiple cascade paths from DoorprizeEvents are not allowed
 * by MSSQL). We must delete DoorprizeResults rows for this gift first, then
 * delete the gift. Wrapped in a transaction so partial state never leaks.
 *
 * @param {number|string} giftId
 * @returns {Promise<void>}
 * @throws {NotFoundError} when the gift does not exist
 */
async function deleteGift(giftId) {
  try {
    const id = Number(giftId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new ValidationError('giftId must be a positive integer');
    }

    const pool = await db.getPool();

    // Verify the gift exists first so callers get a clear NotFound
    const existing = await pool.request()
      .input('giftId', sql.BigInt, id)
      .query('SELECT DoorprizeGiftId FROM DoorprizeGifts WHERE DoorprizeGiftId = @giftId');

    if (existing.recordset.length === 0) {
      throw new NotFoundError('Doorprize gift not found');
    }

    const transaction = await db.beginTransaction();
    try {
      // 1. Delete results for this gift (FK is non-cascade per migration 048)
      await transaction.request()
        .input('giftId', sql.BigInt, id)
        .query('DELETE FROM DoorprizeResults WHERE DoorprizeGiftId = @giftId');

      // 2. Delete the gift itself
      await transaction.request()
        .input('giftId', sql.BigInt, id)
        .query('DELETE FROM DoorprizeGifts WHERE DoorprizeGiftId = @giftId');

      await transaction.commit();
    } catch (txError) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        logger.error('Rollback failed while deleting doorprize gift:', rollbackError);
      }
      throw txError;
    }

    logger.info('Doorprize gift deleted', { doorprizeGiftId: id });
  } catch (error) {
    if (
      error.name === 'ValidationError' ||
      error.name === 'NotFoundError'
    ) {
      throw error;
    }
    logger.error('Error deleting doorprize gift:', error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Participant methods (task 1.5)
// ---------------------------------------------------------------------------

/**
 * Map a DoorprizeParticipants row (PascalCase columns + optional computed
 * HasWon) to a camelCase plain object matching the DoorprizeParticipant type
 * used by the controller / frontend.
 *
 * IsActive is stored as BIT in MSSQL; the mssql driver typically returns it
 * as a boolean already, but we coerce defensively to handle 0/1 numeric
 * values too. HasWon (when present) is a 0/1 from the correlated subquery
 * and is converted to a boolean.
 *
 * @param {Object} row - Raw recordset row
 * @returns {Object|null} Mapped participant object or null when row is missing
 */
function mapParticipantRow(row) {
  if (!row) {
    return null;
  }

  const imagePath = row.ImagePath != null && row.ImagePath !== '' ? row.ImagePath : null;
  const imageUrl = imagePath ? `/${imagePath}` : null;

  const mapped = {
    doorprizeParticipantId: Number(row.DoorprizeParticipantId),
    doorprizeEventId: Number(row.DoorprizeEventId),
    employeeCode: row.EmployeeCode != null && row.EmployeeCode !== '' ? row.EmployeeCode : null,
    name: row.Name,
    phone: row.Phone != null && row.Phone !== '' ? row.Phone : null,
    email: row.Email != null && row.Email !== '' ? row.Email : null,
    unit: row.Unit != null && row.Unit !== '' ? row.Unit : null,
    isActive: row.IsActive === true || row.IsActive === 1,
    imagePath,
    imageUrl,
    createdAt: row.CreatedAt ? new Date(row.CreatedAt).toISOString() : null,
    updatedAt: row.UpdatedAt ? new Date(row.UpdatedAt).toISOString() : null
  };

  if (row.HasWon !== undefined && row.HasWon !== null) {
    mapped.hasWon = row.HasWon === true || Number(row.HasWon) === 1;
  }

  return mapped;
}

/**
 * Validate / normalize an isActive flag. Accepts boolean or 0/1.
 * Returns a boolean. Throws ValidationError for any other value.
 *
 * @param {*} value
 * @returns {boolean}
 */
function parseIsActive(value) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (value === 1 || value === '1' || value === 'true') {
    return true;
  }
  if (value === 0 || value === '0' || value === 'false') {
    return false;
  }
  throw new ValidationError('isActive must be a boolean');
}

/**
 * Fetch a single participant by ID with computed HasWon flag.
 *
 * @param {number|string} participantId
 * @returns {Promise<Object|null>} Mapped participant or null when not found
 */
async function getParticipantById(participantId) {
  try {
    const id = Number(participantId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new ValidationError('participantId must be a positive integer');
    }

    const pool = await db.getPool();
    const result = await pool.request()
      .input('participantId', sql.BigInt, id)
      .query(`
        SELECT
          p.DoorprizeParticipantId,
          p.DoorprizeEventId,
          p.EmployeeCode,
          p.Name,
          p.Phone,
          p.Email,
          p.Unit,
          p.IsActive,
          p.ImagePath,
          p.CreatedAt,
          p.UpdatedAt,
          CASE WHEN EXISTS (
            SELECT 1 FROM DoorprizeResults r
            WHERE r.DoorprizeParticipantId = p.DoorprizeParticipantId
              AND r.DoorprizeEventId = p.DoorprizeEventId
          ) THEN 1 ELSE 0 END AS HasWon
        FROM DoorprizeParticipants p
        WHERE p.DoorprizeParticipantId = @participantId
      `);

    if (result.recordset.length === 0) {
      return null;
    }
    return mapParticipantRow(result.recordset[0]);
  } catch (error) {
    if (error.name === 'ValidationError') {
      throw error;
    }
    logger.error('Error fetching doorprize participant by id:', error);
    throw error;
  }
}

/**
 * List participants for a doorprize event with pagination, search, and
 * optional isActive filter. Each row includes a computed `hasWon` boolean
 * (true if the participant exists in DoorprizeResults for this event).
 *
 * @param {number|string} eventId
 * @param {Object} [filters]
 * @param {number} [filters.page=1] - 1-indexed page number
 * @param {number} [filters.limit=20] - Page size (max 100)
 * @param {string} [filters.search] - Matches Name or EmployeeCode (LIKE)
 * @param {boolean} [filters.isActive] - Optional active flag filter
 * @returns {Promise<{ data: Object[], total: number, page: number, limit: number }>}
 * @throws {NotFoundError} when the event does not exist
 */
async function getParticipantsByEvent(eventId, filters = {}) {
  try {
    const id = await assertEventExists(eventId);

    const page = Math.max(1, parseInt(filters.page, 10) || 1);
    const rawLimit = parseInt(filters.limit, 10) || 20;
    const limit = Math.max(1, Math.min(100, rawLimit));
    const offset = (page - 1) * limit;

    const conditions = ['p.DoorprizeEventId = @eventId'];

    const pool = await db.getPool();
    const countRequest = pool.request();
    const listRequest = pool.request();

    countRequest.input('eventId', sql.BigInt, id);
    listRequest.input('eventId', sql.BigInt, id);

    if (filters.search != null && String(filters.search).trim() !== '') {
      const searchTerm = `%${String(filters.search).trim()}%`;
      conditions.push('(p.Name LIKE @search OR p.EmployeeCode LIKE @search)');
      countRequest.input('search', sql.NVarChar(255), searchTerm);
      listRequest.input('search', sql.NVarChar(255), searchTerm);
    }

    if (filters.isActive !== undefined && filters.isActive !== null && filters.isActive !== '') {
      const isActive = parseIsActive(filters.isActive);
      conditions.push('p.IsActive = @isActive');
      countRequest.input('isActive', sql.Bit, isActive ? 1 : 0);
      listRequest.input('isActive', sql.Bit, isActive ? 1 : 0);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await countRequest.query(`
      SELECT COUNT(*) AS Total
      FROM DoorprizeParticipants p
      ${whereClause}
    `);
    const total = Number(countResult.recordset[0].Total) || 0;

    listRequest.input('offset', sql.Int, offset);
    listRequest.input('limit', sql.Int, limit);

    const listResult = await listRequest.query(`
      SELECT
        p.DoorprizeParticipantId,
        p.DoorprizeEventId,
        p.EmployeeCode,
        p.Name,
        p.Phone,
        p.Email,
        p.Unit,
        p.IsActive,
        p.ImagePath,
        p.CreatedAt,
        p.UpdatedAt,
        CASE WHEN EXISTS (
          SELECT 1 FROM DoorprizeResults r
          WHERE r.DoorprizeParticipantId = p.DoorprizeParticipantId
            AND r.DoorprizeEventId = p.DoorprizeEventId
        ) THEN 1 ELSE 0 END AS HasWon
      FROM DoorprizeParticipants p
      ${whereClause}
      ORDER BY p.Name ASC, p.DoorprizeParticipantId ASC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `);

    return {
      data: listResult.recordset.map(mapParticipantRow),
      total,
      page,
      limit
    };
  } catch (error) {
    if (
      error.name === 'ValidationError' ||
      error.name === 'NotFoundError'
    ) {
      throw error;
    }
    logger.error('Error listing doorprize participants:', error);
    throw error;
  }
}

/**
 * Create a new doorprize participant for an existing event.
 *
 * Enforces unique employeeCode per event when an employeeCode is supplied:
 * a duplicate (DoorprizeEventId, EmployeeCode) pair throws ConflictError.
 *
 * @param {Object} data
 * @param {number|string} data.doorprizeEventId - Parent event (required)
 * @param {string} data.name - Participant name (required, max 200 chars)
 * @param {string} [data.employeeCode] - Optional employee code (max 50 chars, unique per event)
 * @param {string} [data.phone] - Optional phone (max 50 chars)
 * @param {string} [data.email] - Optional email (max 255 chars)
 * @param {string} [data.unit] - Optional unit (max 200 chars)
 * @param {boolean} [data.isActive=true] - Active flag (default true)
 * @param {string} [data.imagePath] - Optional image relative path (max 500 chars)
 * @returns {Promise<Object>} Created participant with computed hasWon=false
 */
async function createParticipant(data = {}) {
  try {
    if (data.doorprizeEventId === undefined || data.doorprizeEventId === null) {
      throw new ValidationError('doorprizeEventId is required');
    }
    const eventId = await assertEventExists(data.doorprizeEventId);

    const name = typeof data.name === 'string' ? data.name.trim() : '';
    if (!name) {
      throw new ValidationError('Name is required');
    }
    if (name.length > 200) {
      throw new ValidationError('Name must be at most 200 characters');
    }

    let employeeCode = null;
    if (data.employeeCode != null && data.employeeCode !== '') {
      employeeCode = String(data.employeeCode).trim();
      if (employeeCode.length > 50) {
        throw new ValidationError('employeeCode must be at most 50 characters');
      }
      if (employeeCode === '') {
        employeeCode = null;
      }
    }

    const phone = data.phone != null && data.phone !== '' ? String(data.phone) : null;
    if (phone && phone.length > 50) {
      throw new ValidationError('phone must be at most 50 characters');
    }

    const email = data.email != null && data.email !== '' ? String(data.email) : null;
    if (email && email.length > 255) {
      throw new ValidationError('email must be at most 255 characters');
    }

    const unit = data.unit != null && data.unit !== '' ? String(data.unit) : null;
    if (unit && unit.length > 200) {
      throw new ValidationError('unit must be at most 200 characters');
    }

    const imagePath = data.imagePath != null && data.imagePath !== '' ? String(data.imagePath) : null;
    if (imagePath && imagePath.length > 500) {
      throw new ValidationError('imagePath must be at most 500 characters');
    }

    let isActive = true;
    if (data.isActive !== undefined && data.isActive !== null && data.isActive !== '') {
      isActive = parseIsActive(data.isActive);
    }

    const pool = await db.getPool();

    // Enforce unique employeeCode per event when supplied
    if (employeeCode) {
      const dupCheck = await pool.request()
        .input('eventId', sql.BigInt, eventId)
        .input('employeeCode', sql.NVarChar(50), employeeCode)
        .query(`
          SELECT TOP 1 1 AS Found
          FROM DoorprizeParticipants
          WHERE DoorprizeEventId = @eventId
            AND EmployeeCode = @employeeCode
        `);

      if (dupCheck.recordset.length > 0) {
        throw new ConflictError(
          `A participant with employeeCode "${employeeCode}" already exists for this event`
        );
      }
    }

    const result = await pool.request()
      .input('eventId', sql.BigInt, eventId)
      .input('employeeCode', sql.NVarChar(50), employeeCode)
      .input('name', sql.NVarChar(200), name)
      .input('phone', sql.NVarChar(50), phone)
      .input('email', sql.NVarChar(255), email)
      .input('unit', sql.NVarChar(200), unit)
      .input('isActive', sql.Bit, isActive ? 1 : 0)
      .input('imagePath', sql.NVarChar(500), imagePath)
      .query(`
        INSERT INTO DoorprizeParticipants
          (DoorprizeEventId, EmployeeCode, Name, Phone, Email, Unit, IsActive, ImagePath, CreatedAt)
        OUTPUT INSERTED.*
        VALUES
          (@eventId, @employeeCode, @name, @phone, @email, @unit, @isActive, @imagePath, GETDATE())
      `);

    logger.info('Doorprize participant created', {
      doorprizeParticipantId: result.recordset[0].DoorprizeParticipantId,
      doorprizeEventId: eventId
    });

    return mapParticipantRow({
      ...result.recordset[0],
      HasWon: 0
    });
  } catch (error) {
    if (
      error.name === 'ValidationError' ||
      error.name === 'NotFoundError' ||
      error.name === 'ConflictError'
    ) {
      throw error;
    }
    logger.error('Error creating doorprize participant:', error);
    throw error;
  }
}

/**
 * Partial update of a doorprize participant. Only provided fields are
 * updated. UpdatedAt is always refreshed to GETDATE().
 *
 * Allowed fields: name, employeeCode, phone, email, unit, isActive,
 * imagePath. doorprizeEventId is intentionally NOT updatable (re-parenting
 * a participant would orphan their results).
 *
 * If employeeCode is provided (non-null) and differs from any existing
 * participant in the same event (excluding self), throws ConflictError.
 *
 * @param {number|string} participantId
 * @param {Object} data - Partial participant data
 * @returns {Promise<Object>} Refreshed participant with computed hasWon
 * @throws {NotFoundError} when the participant does not exist
 * @throws {ConflictError} when employeeCode collides within the event
 */
async function updateParticipant(participantId, data = {}) {
  try {
    const id = Number(participantId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new ValidationError('participantId must be a positive integer');
    }

    const pool = await db.getPool();

    // Ensure participant exists and capture eventId for uniqueness scoping
    const existing = await pool.request()
      .input('participantId', sql.BigInt, id)
      .query(`
        SELECT DoorprizeParticipantId, DoorprizeEventId, EmployeeCode
        FROM DoorprizeParticipants
        WHERE DoorprizeParticipantId = @participantId
      `);

    if (existing.recordset.length === 0) {
      throw new NotFoundError('Doorprize participant not found');
    }

    const existingRow = existing.recordset[0];
    const eventId = Number(existingRow.DoorprizeEventId);

    const updateFields = [];
    const request = pool.request();
    request.input('participantId', sql.BigInt, id);

    if (data.name !== undefined) {
      const name = typeof data.name === 'string' ? data.name.trim() : '';
      if (!name) {
        throw new ValidationError('Name is required');
      }
      if (name.length > 200) {
        throw new ValidationError('Name must be at most 200 characters');
      }
      updateFields.push('Name = @name');
      request.input('name', sql.NVarChar(200), name);
    }

    if (data.employeeCode !== undefined) {
      let employeeCode = null;
      if (data.employeeCode !== null && data.employeeCode !== '') {
        employeeCode = String(data.employeeCode).trim();
        if (employeeCode.length > 50) {
          throw new ValidationError('employeeCode must be at most 50 characters');
        }
        if (employeeCode === '') {
          employeeCode = null;
        }
      }

      // Uniqueness check: only when employeeCode is non-null
      if (employeeCode) {
        const dupCheck = await pool.request()
          .input('eventId', sql.BigInt, eventId)
          .input('employeeCode', sql.NVarChar(50), employeeCode)
          .input('participantId', sql.BigInt, id)
          .query(`
            SELECT TOP 1 1 AS Found
            FROM DoorprizeParticipants
            WHERE DoorprizeEventId = @eventId
              AND EmployeeCode = @employeeCode
              AND DoorprizeParticipantId <> @participantId
          `);

        if (dupCheck.recordset.length > 0) {
          throw new ConflictError(
            `A participant with employeeCode "${employeeCode}" already exists for this event`
          );
        }
      }

      updateFields.push('EmployeeCode = @employeeCode');
      request.input('employeeCode', sql.NVarChar(50), employeeCode);
    }

    if (data.phone !== undefined) {
      const phone = data.phone === null || data.phone === '' ? null : String(data.phone);
      if (phone && phone.length > 50) {
        throw new ValidationError('phone must be at most 50 characters');
      }
      updateFields.push('Phone = @phone');
      request.input('phone', sql.NVarChar(50), phone);
    }

    if (data.email !== undefined) {
      const email = data.email === null || data.email === '' ? null : String(data.email);
      if (email && email.length > 255) {
        throw new ValidationError('email must be at most 255 characters');
      }
      updateFields.push('Email = @email');
      request.input('email', sql.NVarChar(255), email);
    }

    if (data.unit !== undefined) {
      const unit = data.unit === null || data.unit === '' ? null : String(data.unit);
      if (unit && unit.length > 200) {
        throw new ValidationError('unit must be at most 200 characters');
      }
      updateFields.push('Unit = @unit');
      request.input('unit', sql.NVarChar(200), unit);
    }

    if (data.isActive !== undefined) {
      if (data.isActive === null || data.isActive === '') {
        throw new ValidationError('isActive must be a boolean');
      }
      const isActive = parseIsActive(data.isActive);
      updateFields.push('IsActive = @isActive');
      request.input('isActive', sql.Bit, isActive ? 1 : 0);
    }

    if (data.imagePath !== undefined) {
      const imagePath = data.imagePath === null || data.imagePath === '' ? null : String(data.imagePath);
      if (imagePath && imagePath.length > 500) {
        throw new ValidationError('imagePath must be at most 500 characters');
      }
      updateFields.push('ImagePath = @imagePath');
      request.input('imagePath', sql.NVarChar(500), imagePath);
    }

    if (updateFields.length === 0) {
      throw new ValidationError('No fields to update');
    }

    updateFields.push('UpdatedAt = GETDATE()');

    await request.query(`
      UPDATE DoorprizeParticipants
      SET ${updateFields.join(', ')}
      WHERE DoorprizeParticipantId = @participantId
    `);

    logger.info('Doorprize participant updated', { doorprizeParticipantId: id });
    return getParticipantById(id);
  } catch (error) {
    if (
      error.name === 'ValidationError' ||
      error.name === 'NotFoundError' ||
      error.name === 'ConflictError'
    ) {
      throw error;
    }
    logger.error('Error updating doorprize participant:', error);
    throw error;
  }
}

/**
 * Delete a doorprize participant with application-level cascade for results.
 *
 * Background: per migration 048, DoorprizeResults FK to DoorprizeParticipants
 * does NOT cascade (multiple cascade paths from DoorprizeEvents are not
 * allowed by MSSQL). We must delete DoorprizeResults rows for this
 * participant first, then delete the participant. Wrapped in a transaction
 * so partial state never leaks.
 *
 * @param {number|string} participantId
 * @returns {Promise<void>}
 * @throws {NotFoundError} when the participant does not exist
 */
async function deleteParticipant(participantId) {
  try {
    const id = Number(participantId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new ValidationError('participantId must be a positive integer');
    }

    const pool = await db.getPool();

    // Verify the participant exists first so callers get a clear NotFound
    const existing = await pool.request()
      .input('participantId', sql.BigInt, id)
      .query(`
        SELECT DoorprizeParticipantId
        FROM DoorprizeParticipants
        WHERE DoorprizeParticipantId = @participantId
      `);

    if (existing.recordset.length === 0) {
      throw new NotFoundError('Doorprize participant not found');
    }

    const transaction = await db.beginTransaction();
    try {
      // 1. Delete results for this participant (FK is non-cascade per migration 048)
      await transaction.request()
        .input('participantId', sql.BigInt, id)
        .query('DELETE FROM DoorprizeResults WHERE DoorprizeParticipantId = @participantId');

      // 2. Delete the participant itself
      await transaction.request()
        .input('participantId', sql.BigInt, id)
        .query('DELETE FROM DoorprizeParticipants WHERE DoorprizeParticipantId = @participantId');

      await transaction.commit();
    } catch (txError) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        logger.error('Rollback failed while deleting doorprize participant:', rollbackError);
      }
      throw txError;
    }

    logger.info('Doorprize participant deleted', { doorprizeParticipantId: id });
  } catch (error) {
    if (
      error.name === 'ValidationError' ||
      error.name === 'NotFoundError'
    ) {
      throw error;
    }
    logger.error('Error deleting doorprize participant:', error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Draw methods (task 1.6)
// ---------------------------------------------------------------------------

const crypto = require('crypto');

/**
 * Map a DoorprizeResults row (PascalCase columns) to a camelCase plain object
 * matching the DoorprizeResult type used by the controller / frontend. When
 * the row also carries joined participant columns (ParticipantName, etc.) or
 * joined gift columns (GiftName, etc.) the corresponding `participant` /
 * `gift` sub-objects are attached.
 *
 * Joined participant columns expected (when present):
 *   ParticipantName, ParticipantUnit, EmployeeCode,
 *   ParticipantIsActive, ParticipantImagePath
 *
 * Joined gift columns expected (when present):
 *   GiftName, GiftQuota, GiftBy, DrawTime, GiftImagePath
 *
 * @param {Object} row - Raw recordset row
 * @returns {Object|null} Mapped result object or null when row is missing
 */
function mapResultRow(row) {
  if (!row) {
    return null;
  }

  const mapped = {
    doorprizeResultId: Number(row.DoorprizeResultId),
    doorprizeEventId: Number(row.DoorprizeEventId),
    doorprizeGiftId: Number(row.DoorprizeGiftId),
    doorprizeParticipantId: Number(row.DoorprizeParticipantId),
    drawnAt: row.DrawnAt ? new Date(row.DrawnAt).toISOString() : null,
    drawnBy: row.DrawnBy != null ? Number(row.DrawnBy) : null
  };

  // Optional joined participant fields
  if (row.ParticipantName != null) {
    mapped.participant = {
      doorprizeParticipantId: Number(row.DoorprizeParticipantId),
      doorprizeEventId: Number(row.DoorprizeEventId),
      employeeCode: row.EmployeeCode != null && row.EmployeeCode !== '' ? row.EmployeeCode : null,
      name: row.ParticipantName,
      unit: row.ParticipantUnit != null && row.ParticipantUnit !== '' ? row.ParticipantUnit : null,
      isActive: row.ParticipantIsActive === true || row.ParticipantIsActive === 1,
      imagePath: row.ParticipantImagePath != null && row.ParticipantImagePath !== '' ? row.ParticipantImagePath : null
    };
  }

  // Optional joined gift fields
  if (row.GiftName != null) {
    const quota = row.GiftQuota != null ? Number(row.GiftQuota) : 0;
    mapped.gift = {
      doorprizeGiftId: Number(row.DoorprizeGiftId),
      doorprizeEventId: Number(row.DoorprizeEventId),
      name: row.GiftName,
      quota,
      giftBy: row.GiftBy != null && row.GiftBy !== '' ? row.GiftBy : null,
      drawTime: row.DrawTime != null && row.DrawTime !== '' ? row.DrawTime : null,
      imagePath: row.GiftImagePath != null && row.GiftImagePath !== '' ? row.GiftImagePath : null
    };
  }

  return mapped;
}

/**
 * Get the complete draw state for a doorprize event.
 *
 * Returns the event, all gifts (with computed quotaRemaining), the list of
 * currently-eligible participants (active and not yet winners in this
 * event), and all existing draw results joined with their participant and
 * gift records (newest first). Pure read operation.
 *
 * @param {number|string} eventId
 * @returns {Promise<{ event: Object, gifts: Object[], eligibleParticipants: Object[], results: Object[] }>}
 * @throws {ValidationError} on invalid eventId
 * @throws {NotFoundError} when the event does not exist
 */
async function getDrawState(eventId) {
  try {
    const id = await assertEventExists(eventId);

    const event = await getEventById(id);
    const gifts = await getGiftsByEvent(id);

    const pool = await db.getPool();

    // Eligible participants: active AND not in DoorprizeResults for this event
    const eligibleResult = await pool.request()
      .input('eventId', sql.BigInt, id)
      .query(`
        SELECT *
        FROM DoorprizeParticipants
        WHERE DoorprizeEventId = @eventId
          AND IsActive = 1
          AND DoorprizeParticipantId NOT IN (
            SELECT DoorprizeParticipantId
            FROM DoorprizeResults
            WHERE DoorprizeEventId = @eventId
          )
        ORDER BY Name ASC
      `);

    const eligibleParticipants = eligibleResult.recordset.map(mapParticipantRow);

    // Results joined with participant + gift (newest first)
    const resultsResult = await pool.request()
      .input('eventId', sql.BigInt, id)
      .query(`
        SELECT
          r.DoorprizeResultId,
          r.DoorprizeEventId,
          r.DoorprizeGiftId,
          r.DoorprizeParticipantId,
          r.DrawnAt,
          r.DrawnBy,
          p.Name AS ParticipantName,
          p.Unit AS ParticipantUnit,
          p.EmployeeCode,
          p.IsActive AS ParticipantIsActive,
          p.ImagePath AS ParticipantImagePath,
          g.Name AS GiftName,
          g.Quota AS GiftQuota,
          g.GiftBy,
          g.DrawTime,
          g.ImagePath AS GiftImagePath
        FROM DoorprizeResults r
        INNER JOIN DoorprizeParticipants p
          ON p.DoorprizeParticipantId = r.DoorprizeParticipantId
        INNER JOIN DoorprizeGifts g
          ON g.DoorprizeGiftId = r.DoorprizeGiftId
        WHERE r.DoorprizeEventId = @eventId
        ORDER BY r.DrawnAt DESC, r.DoorprizeResultId DESC
      `);

    const results = resultsResult.recordset.map(mapResultRow);

    return {
      event,
      gifts,
      eligibleParticipants,
      results
    };
  } catch (error) {
    if (
      error.name === 'ValidationError' ||
      error.name === 'NotFoundError'
    ) {
      throw error;
    }
    logger.error('Error fetching doorprize draw state:', error);
    throw error;
  }
}

/**
 * Execute a single draw: pick exactly one random winner from the eligible
 * pool for the specified gift in the specified event.
 *
 * The randomization happens server-side using `crypto.randomInt` (CSPRNG).
 * Frontend animation is purely cosmetic and cannot influence the result.
 *
 * The entire operation runs inside a database transaction. The gift row is
 * locked with `(UPDLOCK, HOLDLOCK)` and the result count is read with
 * `(HOLDLOCK)` so two concurrent draws on the same gift are serialized and
 * cannot both pass the quota check (Requirement 12.3).
 *
 * Failure modes:
 *   - giftId does not belong to eventId      â†’ NotFoundError
 *   - resultCount(giftId) >= gift.Quota      â†’ ConflictError "Gift quota exhausted"
 *   - no eligible participants remaining     â†’ ConflictError "No eligible participants remaining"
 *
 * On any failure inside the transaction the transaction is rolled back so no
 * partial state is persisted (Requirement 9, atomicity).
 *
 * @param {number|string} eventId
 * @param {number|string} giftId
 * @param {number|string} userId - The admin user executing the draw
 * @returns {Promise<{ result: Object, winner: Object, gift: Object }>}
 */
async function executeDraw(eventId, giftId, userId) {
  // Validate inputs BEFORE opening a transaction so trivial bad input does
  // not consume connection-pool resources.
  const eId = Number(eventId);
  if (!Number.isInteger(eId) || eId <= 0) {
    throw new ValidationError('eventId must be a positive integer');
  }
  const gId = Number(giftId);
  if (!Number.isInteger(gId) || gId <= 0) {
    throw new ValidationError('giftId must be a positive integer');
  }
  const uId = Number(userId);
  if (!Number.isInteger(uId) || uId <= 0) {
    throw new ValidationError('userId must be a positive integer');
  }

  const transaction = await db.beginTransaction();
  try {
    // 1. Verify gift belongs to event and lock it. UPDLOCK + HOLDLOCK
    //    serialize concurrent draws on the same gift so the quota check
    //    cannot race.
    const giftResult = await transaction.request()
      .input('giftId', sql.BigInt, gId)
      .input('eventId', sql.BigInt, eId)
      .query(`
        SELECT *
        FROM DoorprizeGifts WITH (UPDLOCK, HOLDLOCK)
        WHERE DoorprizeGiftId = @giftId
          AND DoorprizeEventId = @eventId
      `);

    if (giftResult.recordset.length === 0) {
      throw new NotFoundError('Doorprize gift not found for this event');
    }
    const giftRow = giftResult.recordset[0];
    const quota = Number(giftRow.Quota);

    // 2. Count current results for the gift inside the transaction.
    //    HOLDLOCK ensures the count is stable until commit.
    const countResult = await transaction.request()
      .input('giftId', sql.BigInt, gId)
      .query(`
        SELECT COUNT(*) AS Count
        FROM DoorprizeResults WITH (HOLDLOCK)
        WHERE DoorprizeGiftId = @giftId
      `);
    const count = Number(countResult.recordset[0].Count) || 0;

    if (count >= quota) {
      throw new ConflictError('Gift quota exhausted');
    }

    // 3. Query eligible participants inside the transaction.
    const eligibleResult = await transaction.request()
      .input('eventId', sql.BigInt, eId)
      .query(`
        SELECT *
        FROM DoorprizeParticipants
        WHERE DoorprizeEventId = @eventId
          AND IsActive = 1
          AND DoorprizeParticipantId NOT IN (
            SELECT DoorprizeParticipantId
            FROM DoorprizeResults
            WHERE DoorprizeEventId = @eventId
          )
        ORDER BY Name ASC
      `);
    const eligible = eligibleResult.recordset;

    if (eligible.length === 0) {
      throw new ConflictError('No eligible participants remaining');
    }

    // 4. CSPRNG selection. crypto.randomInt(min, max) returns a uniformly
    //    distributed integer in the half-open interval [min, max).
    const randomIndex = crypto.randomInt(0, eligible.length);
    const winnerRow = eligible[randomIndex];

    // 5. Insert the result and capture the persisted row.
    const insertResult = await transaction.request()
      .input('eventId', sql.BigInt, eId)
      .input('giftId', sql.BigInt, gId)
      .input('participantId', sql.BigInt, Number(winnerRow.DoorprizeParticipantId))
      .input('drawnBy', sql.BigInt, uId)
      .query(`
        INSERT INTO DoorprizeResults
          (DoorprizeEventId, DoorprizeGiftId, DoorprizeParticipantId, DrawnAt, DrawnBy)
        OUTPUT INSERTED.*
        VALUES
          (@eventId, @giftId, @participantId, GETDATE(), @drawnBy)
      `);
    const resultRow = insertResult.recordset[0];

    await transaction.commit();

    logger.info('Doorprize draw executed', {
      doorprizeEventId: eId,
      doorprizeGiftId: gId,
      doorprizeParticipantId: Number(winnerRow.DoorprizeParticipantId),
      doorprizeResultId: Number(resultRow.DoorprizeResultId),
      drawnBy: uId
    });

    return {
      result: mapResultRow(resultRow),
      winner: mapParticipantRow(winnerRow),
      gift: mapGiftRow({ ...giftRow, ResultCount: count + 1 })
    };
  } catch (txError) {
    try {
      await transaction.rollback();
    } catch (rollbackError) {
      // Rollback can fail if the transaction was already committed (rare) or
      // already aborted by the server. Log and continue so the original
      // error is propagated to the caller.
      logger.error('Rollback failed during executeDraw:', rollbackError);
    }

    if (
      txError.name === 'ValidationError' ||
      txError.name === 'NotFoundError' ||
      txError.name === 'ConflictError'
    ) {
      throw txError;
    }
    logger.error('Error executing doorprize draw:', txError);
    throw txError;
  }
}

/**
 * Delete a single draw result row, restoring the participant to the
 * eligible pool (Requirement 4.6).
 *
 * @param {number|string} resultId
 * @returns {Promise<void>}
 * @throws {ValidationError} on invalid id
 * @throws {NotFoundError} when the result does not exist
 */
async function resetResult(resultId) {
  try {
    const id = Number(resultId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new ValidationError('resultId must be a positive integer');
    }

    const pool = await db.getPool();

    const existing = await pool.request()
      .input('resultId', sql.BigInt, id)
      .query(`
        SELECT DoorprizeResultId
        FROM DoorprizeResults
        WHERE DoorprizeResultId = @resultId
      `);

    if (existing.recordset.length === 0) {
      throw new NotFoundError('Draw result not found');
    }

    await pool.request()
      .input('resultId', sql.BigInt, id)
      .query('DELETE FROM DoorprizeResults WHERE DoorprizeResultId = @resultId');

    logger.info('Doorprize result deleted', { doorprizeResultId: id });
  } catch (error) {
    if (
      error.name === 'ValidationError' ||
      error.name === 'NotFoundError'
    ) {
      throw error;
    }
    logger.error('Error deleting doorprize result:', error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Excel I/O methods (task 1.8)
// ---------------------------------------------------------------------------

const ExcelJS = require('exceljs');

/**
 * Import participants from an Excel buffer into the specified event.
 *
 * Expected columns (1-indexed): A=EmployeeCode, B=Name, C=Phone, D=Email, E=Unit.
 * Row 1 is treated as header and skipped. Name (column B) is required; rows
 * without it are recorded as errors. Rows with an employeeCode that already
 * exists for the event are silently skipped (idempotent import).
 *
 * All imported participants are set to IsActive = true by default.
 *
 * Validates Requirements: 1.6, 1.7, 2.6
 *
 * @param {number|string} eventId
 * @param {Buffer} buffer - .xlsx file contents
 * @returns {Promise<{ totalRows: number, imported: number, skipped: number, errors: Array<{ row: number, message: string }> }>}
 */
async function importFromExcel(eventId, buffer) {
  const id = await assertEventExists(eventId);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new ValidationError('Excel file contains no worksheets');
  }

  const pool = await db.getPool();
  let imported = 0;
  let skipped = 0;
  const errors = [];

  const rowCount = worksheet.rowCount;
  for (let rowNumber = 2; rowNumber <= rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);

    // Extract cell values — exceljs may return rich text objects, so coerce
    const rawName = row.getCell(2).value;
    const name = rawName != null ? String(rawName).trim() : '';

    if (!name) {
      errors.push({ row: rowNumber, message: 'Name is required' });
      skipped++;
      continue;
    }

    const rawCode = row.getCell(1).value;
    const employeeCode = rawCode != null ? String(rawCode).trim() : null;

    // Check duplicate employeeCode within the same event
    if (employeeCode) {
      const dupCheck = await pool.request()
        .input('eventId', sql.BigInt, id)
        .input('code', sql.NVarChar(50), employeeCode)
        .query(`
          SELECT TOP 1 1 AS Found
          FROM DoorprizeParticipants
          WHERE DoorprizeEventId = @eventId
            AND EmployeeCode = @code
        `);

      if (dupCheck.recordset.length > 0) {
        skipped++;
        continue;
      }
    }

    const rawPhone = row.getCell(3).value;
    const phone = rawPhone != null ? String(rawPhone).trim() || null : null;

    const rawEmail = row.getCell(4).value;
    const email = rawEmail != null ? String(rawEmail).trim() || null : null;

    const rawUnit = row.getCell(5).value;
    const unit = rawUnit != null ? String(rawUnit).trim() || null : null;

    await pool.request()
      .input('eventId', sql.BigInt, id)
      .input('employeeCode', sql.NVarChar(50), employeeCode || null)
      .input('name', sql.NVarChar(200), name)
      .input('phone', sql.NVarChar(50), phone)
      .input('email', sql.NVarChar(255), email)
      .input('unit', sql.NVarChar(200), unit)
      .input('isActive', sql.Bit, 1)
      .query(`
        INSERT INTO DoorprizeParticipants
          (DoorprizeEventId, EmployeeCode, Name, Phone, Email, Unit, IsActive, CreatedAt)
        VALUES
          (@eventId, @employeeCode, @name, @phone, @email, @unit, @isActive, GETDATE())
      `);

    imported++;
  }

  const totalRows = imported + skipped;

  logger.info('Doorprize participants imported from Excel', {
    doorprizeEventId: id,
    totalRows,
    imported,
    skipped,
    errorCount: errors.length
  });

  return { totalRows, imported, skipped, errors };
}

/**
 * Export participants and draw results for an event to an Excel buffer (.xlsx).
 *
 * Generates a workbook with two worksheets:
 *   - "Participants": all participants with columns [EmployeeCode, Name, Phone, Email, Unit, IsActive, HasWon]
 *   - "Results": all draw results joined with participant + gift [ParticipantName, EmployeeCode, Unit, GiftName, DrawnAt]
 *
 * Validates Requirements: 1.6, 1.7, 2.6
 *
 * @param {number|string} eventId
 * @returns {Promise<Buffer>} .xlsx file buffer
 */
async function exportToExcel(eventId) {
  const id = await assertEventExists(eventId);

  const pool = await db.getPool();

  // Query participants with HasWon computed field
  const participantsResult = await pool.request()
    .input('eventId', sql.BigInt, id)
    .query(`
      SELECT
        p.EmployeeCode,
        p.Name,
        p.Phone,
        p.Email,
        p.Unit,
        p.IsActive,
        CASE WHEN EXISTS (
          SELECT 1 FROM DoorprizeResults r
          WHERE r.DoorprizeParticipantId = p.DoorprizeParticipantId
            AND r.DoorprizeEventId = p.DoorprizeEventId
        ) THEN 1 ELSE 0 END AS HasWon
      FROM DoorprizeParticipants p
      WHERE p.DoorprizeEventId = @eventId
      ORDER BY p.Name ASC
    `);

  // Query results joined with participant + gift
  const resultsResult = await pool.request()
    .input('eventId', sql.BigInt, id)
    .query(`
      SELECT
        p.Name AS ParticipantName,
        p.EmployeeCode,
        p.Unit,
        g.Name AS GiftName,
        r.DrawnAt
      FROM DoorprizeResults r
      INNER JOIN DoorprizeParticipants p
        ON p.DoorprizeParticipantId = r.DoorprizeParticipantId
      INNER JOIN DoorprizeGifts g
        ON g.DoorprizeGiftId = r.DoorprizeGiftId
      WHERE r.DoorprizeEventId = @eventId
      ORDER BY r.DrawnAt DESC
    `);

  const workbook = new ExcelJS.Workbook();

  // Participants worksheet
  const participantsSheet = workbook.addWorksheet('Participants');
  participantsSheet.columns = [
    { header: 'EmployeeCode', key: 'employeeCode', width: 15 },
    { header: 'Name', key: 'name', width: 25 },
    { header: 'Phone', key: 'phone', width: 15 },
    { header: 'Email', key: 'email', width: 25 },
    { header: 'Unit', key: 'unit', width: 20 },
    { header: 'IsActive', key: 'isActive', width: 10 },
    { header: 'HasWon', key: 'hasWon', width: 10 }
  ];

  for (const row of participantsResult.recordset) {
    participantsSheet.addRow({
      employeeCode: row.EmployeeCode || '',
      name: row.Name || '',
      phone: row.Phone || '',
      email: row.Email || '',
      unit: row.Unit || '',
      isActive: row.IsActive === true || row.IsActive === 1 ? 'Yes' : 'No',
      hasWon: Number(row.HasWon) === 1 ? 'Yes' : 'No'
    });
  }

  // Results worksheet
  const resultsSheet = workbook.addWorksheet('Results');
  resultsSheet.columns = [
    { header: 'ParticipantName', key: 'participantName', width: 25 },
    { header: 'EmployeeCode', key: 'employeeCode', width: 15 },
    { header: 'Unit', key: 'unit', width: 20 },
    { header: 'GiftName', key: 'giftName', width: 25 },
    { header: 'DrawnAt', key: 'drawnAt', width: 20 }
  ];

  for (const row of resultsResult.recordset) {
    resultsSheet.addRow({
      participantName: row.ParticipantName || '',
      employeeCode: row.EmployeeCode || '',
      unit: row.Unit || '',
      giftName: row.GiftName || '',
      drawnAt: row.DrawnAt ? new Date(row.DrawnAt).toISOString() : ''
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();

  logger.info('Doorprize data exported to Excel', { doorprizeEventId: id });

  return buffer;
}

/**
 * Generate an empty import template Excel buffer (.xlsx) with expected
 * column headers: [EmployeeCode, Name, Phone, Email, Unit].
 *
 * The header row is styled bold for clarity. This is a pure utility function
 * that does not require database access.
 *
 * @returns {Promise<Buffer>} .xlsx file buffer
 */
async function generateImportTemplate() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Participants');

  worksheet.columns = [
    { header: 'EmployeeCode', key: 'employeeCode', width: 15 },
    { header: 'Name', key: 'name', width: 25 },
    { header: 'Phone', key: 'phone', width: 15 },
    { header: 'Email', key: 'email', width: 25 },
    { header: 'Unit', key: 'unit', width: 20 }
  ];

  // Style header row bold
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

// ---------------------------------------------------------------------------
// Public endpoint methods (task 2.2)
// ---------------------------------------------------------------------------

/**
 * Get public results for display. Returns ONLY participant name, unit, and
 * gift name — no PII (email, phone, employeeCode) or internal IDs that could
 * be used for manipulation.
 *
 * Supports delta polling via optional `afterId` param: when provided, only
 * results with DoorprizeResultId > afterId are returned.
 *
 * @param {number|string} eventId
 * @param {Object} [options]
 * @param {number|string} [options.afterId] - Return only results after this ID (for delta polling)
 * @returns {Promise<{ results: Object[] }>}
 * @throws {NotFoundError} when the event does not exist
 */
async function getPublicResults(eventId, options = {}) {
  try {
    const id = Number(eventId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new ValidationError('eventId must be a positive integer');
    }

    const pool = await db.getPool();

    // Verify event exists
    const eventCheck = await pool.request()
      .input('eventId', sql.BigInt, id)
      .query('SELECT DoorprizeEventId FROM DoorprizeEvents WHERE DoorprizeEventId = @eventId');

    if (eventCheck.recordset.length === 0) {
      throw new NotFoundError('Doorprize event not found');
    }

    const request = pool.request();
    request.input('eventId', sql.BigInt, id);

    let afterClause = '';
    if (options.afterId !== undefined && options.afterId !== null && options.afterId !== '') {
      const afterId = Number(options.afterId);
      if (Number.isInteger(afterId) && afterId >= 0) {
        afterClause = 'AND r.DoorprizeResultId > @afterId';
        request.input('afterId', sql.BigInt, afterId);
      }
    }

    // Only select participant name + unit + gift name — no PII, no internal IDs
    const result = await request.query(`
      SELECT
        p.Name AS ParticipantName,
        p.Unit AS ParticipantUnit,
        g.Name AS GiftName,
        r.DrawnAt
      FROM DoorprizeResults r
      INNER JOIN DoorprizeParticipants p
        ON r.DoorprizeParticipantId = p.DoorprizeParticipantId
      INNER JOIN DoorprizeGifts g
        ON r.DoorprizeGiftId = g.DoorprizeGiftId
      WHERE r.DoorprizeEventId = @eventId
        ${afterClause}
      ORDER BY r.DoorprizeResultId ASC
    `);

    const results = result.recordset.map(row => ({
      participantName: row.ParticipantName,
      unit: row.ParticipantUnit || null,
      giftName: row.GiftName,
      drawnAt: row.DrawnAt ? new Date(row.DrawnAt).toISOString() : null
    }));

    return { results };
  } catch (error) {
    if (error.name === 'ValidationError' || error.name === 'NotFoundError') {
      throw error;
    }
    logger.error('Error fetching public results:', error);
    throw error;
  }
}

/**
 * Get public event info — event name and gifts summary only.
 * No PII, no internal IDs that could be used for manipulation.
 *
 * @param {number|string} eventId
 * @returns {Promise<{ eventName: string, gifts: Object[] }>}
 * @throws {NotFoundError} when the event does not exist
 */
async function getPublicEventInfo(eventId) {
  try {
    const id = Number(eventId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new ValidationError('eventId must be a positive integer');
    }

    const pool = await db.getPool();

    // Fetch event name
    const eventResult = await pool.request()
      .input('eventId', sql.BigInt, id)
      .query('SELECT Name, EventDate FROM DoorprizeEvents WHERE DoorprizeEventId = @eventId');

    if (eventResult.recordset.length === 0) {
      throw new NotFoundError('Doorprize event not found');
    }

    const eventRow = eventResult.recordset[0];

    // Fetch gifts summary (name + quota + result count only — no internal IDs)
    const giftsResult = await pool.request()
      .input('eventId', sql.BigInt, id)
      .query(`
        SELECT
          g.Name,
          g.Quota,
          (SELECT COUNT(*) FROM DoorprizeResults r
            WHERE r.DoorprizeGiftId = g.DoorprizeGiftId) AS ResultCount
        FROM DoorprizeGifts g
        WHERE g.DoorprizeEventId = @eventId
        ORDER BY g.DisplayOrder ASC, g.DoorprizeGiftId ASC
      `);

    const gifts = giftsResult.recordset.map(row => ({
      name: row.Name,
      quota: Number(row.Quota),
      winnersCount: Number(row.ResultCount) || 0
    }));

    return {
      eventName: eventRow.Name,
      eventDate: eventRow.EventDate ? new Date(eventRow.EventDate).toISOString() : null,
      gifts
    };
  } catch (error) {
    if (error.name === 'ValidationError' || error.name === 'NotFoundError') {
      throw error;
    }
    logger.error('Error fetching public event info:', error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Bulk photo upload from ZIP
// ---------------------------------------------------------------------------

// adm-zip loaded lazily to avoid crashing if not installed
let AdmZip;
try { AdmZip = require('adm-zip'); } catch { AdmZip = null; }
const path = require('path');
const fs = require('fs');

const DOORPRIZE_UPLOAD_DIR = path.join(__dirname, '../../public/uploads/doorprize');

// Ensure upload directory exists
if (!fs.existsSync(DOORPRIZE_UPLOAD_DIR)) {
  fs.mkdirSync(DOORPRIZE_UPLOAD_DIR, { recursive: true });
}

const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

/**
 * Extract a ZIP buffer containing participant photos, match filenames
 * (without extension) to participant EmployeeCode (case-insensitive),
 * save matched images to disk, and update ImagePath in DB.
 *
 * @param {number|string} eventId
 * @param {Buffer} zipBuffer - The ZIP file buffer
 * @returns {Promise<{total: number, matched: number, unmatched: string[], errors: string[]}>}
 */
async function uploadParticipantPhotos(eventId, zipBuffer) {
  if (!AdmZip) {
    throw new Error('adm-zip module is not installed. Run: npm install adm-zip');
  }
  const id = await assertEventExists(eventId);

  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();

  const pool = await db.getPool();

  // Pre-fetch all participants for this event (employeeCode -> participantId map)
  const participantsResult = await pool.request()
    .input('eventId', sql.BigInt, id)
    .query(`
      SELECT DoorprizeParticipantId, EmployeeCode
      FROM DoorprizeParticipants
      WHERE DoorprizeEventId = @eventId
        AND EmployeeCode IS NOT NULL
        AND EmployeeCode <> ''
    `);

  // Build a case-insensitive lookup map
  const participantMap = new Map();
  for (const row of participantsResult.recordset) {
    participantMap.set(row.EmployeeCode.toLowerCase(), {
      id: row.DoorprizeParticipantId,
      code: row.EmployeeCode
    });
  }

  let total = 0;
  let matched = 0;
  const unmatched = [];
  const errors = [];

  for (const entry of entries) {
    // Skip directories
    if (entry.isDirectory) continue;

    // Get just the filename (flatten nested folders)
    const fullName = entry.entryName;
    const baseName = path.basename(fullName);
    const ext = path.extname(baseName).toLowerCase();

    // Only process image files
    if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext)) continue;

    total++;

    const fileNameWithoutExt = path.basename(baseName, ext);
    const lookupKey = fileNameWithoutExt.toLowerCase().trim();

    if (!lookupKey) {
      errors.push(`Empty filename in ZIP: ${fullName}`);
      continue;
    }

    const participant = participantMap.get(lookupKey);

    if (!participant) {
      unmatched.push(fileNameWithoutExt);
      continue;
    }

    try {
      // Extract file data
      const fileData = entry.getData();

      // Generate unique filename
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const savedFileName = `participant-${participant.id}-${uniqueSuffix}${ext}`;
      const savedFilePath = path.join(DOORPRIZE_UPLOAD_DIR, savedFileName);

      // Write file to disk
      fs.writeFileSync(savedFilePath, fileData);

      // Update ImagePath in DB
      const imagePath = `/uploads/doorprize/${savedFileName}`;
      await pool.request()
        .input('participantId', sql.BigInt, participant.id)
        .input('imagePath', sql.NVarChar(500), imagePath)
        .query(`
          UPDATE DoorprizeParticipants
          SET ImagePath = @imagePath, UpdatedAt = GETDATE()
          WHERE DoorprizeParticipantId = @participantId
        `);

      matched++;
    } catch (err) {
      errors.push(`Failed to process ${baseName}: ${err.message}`);
    }
  }

  logger.info('Doorprize participant photos uploaded from ZIP', {
    doorprizeEventId: id,
    total,
    matched,
    unmatchedCount: unmatched.length,
    errorCount: errors.length
  });

  return { total, matched, unmatched, errors };
}

module.exports = {
  // Events
  getAllEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,

  // Gifts
  getGiftsByEvent,
  getGiftById,
  createGift,
  updateGift,
  deleteGift,

  // Participants
  getParticipantsByEvent,
  getParticipantById,
  createParticipant,
  updateParticipant,
  deleteParticipant,

  // Draw
  getDrawState,
  executeDraw,
  resetResult,

  // Excel I/O
  importFromExcel,
  exportToExcel,
  generateImportTemplate,

  // Photos
  uploadParticipantPhotos,

  // Public
  getPublicResults,
  getPublicEventInfo,

  // Helpers (exported for unit tests / reuse by future methods)
  mapEventRow,
  mapGiftRow,
  mapParticipantRow,
  mapResultRow,

  // Errors
  ValidationError,
  ConflictError,
  NotFoundError
};
