/**
 * Standard API response envelope helpers.
 *
 * These helpers are the single source of truth for the SHAPE of every JSON
 * response returned by the API. They are introduced as the foundation for the
 * API standardization effort (see docs/API-STANDARDIZATION-PLAN.md at the repo root).
 *
 * Standard shapes
 * ---------------
 * Success:
 *   {
 *     "success": true,
 *     "data": <object | array | primitive | null>,
 *     "meta": { ... }            // optional (pagination, counts, etc.)
 *   }
 *
 * Error:
 *   {
 *     "success": false,
 *     "error": {
 *       "code": "VALIDATION_ERROR",   // stable, machine-readable
 *       "message": "Human readable message",
 *       "details": [ ... ]            // optional (field errors, etc.)
 *     }
 *   }
 *
 * Notes
 * -----
 * - Always send the resource under `data` (never an ad-hoc key like
 *   `applications`, `logs`, `user`, ...). Lists go under `data` as an array,
 *   with counts/pagination under `meta`.
 * - `code` is a stable UPPER_SNAKE_CASE string the frontend can switch on. The
 *   human-readable `message` may change/localize without breaking clients.
 * - Do not leak raw SQL/stack details in `message`; the global error handler
 *   already sanitizes those.
 */

/**
 * Map an HTTP status code to a default stable error code.
 * @param {number} statusCode
 * @returns {string}
 */
function defaultErrorCode(statusCode) {
  const map = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHENTICATED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    405: 'METHOD_NOT_ALLOWED',
    406: 'NOT_ACCEPTABLE',
    409: 'CONFLICT',
    413: 'PAYLOAD_TOO_LARGE',
    415: 'UNSUPPORTED_MEDIA_TYPE',
    422: 'VALIDATION_ERROR',
    429: 'RATE_LIMITED',
    500: 'INTERNAL_ERROR',
    503: 'SERVICE_UNAVAILABLE'
  };
  return map[statusCode] || (statusCode >= 500 ? 'INTERNAL_ERROR' : 'ERROR');
}

/**
 * Send a standardized success response.
 *
 * @param {import('express').Response} res
 * @param {*} data - Payload to return under `data`.
 * @param {Object} [options]
 * @param {number} [options.status=200] - HTTP status code.
 * @param {Object} [options.meta] - Optional metadata (pagination, counts...).
 * @returns {import('express').Response}
 */
function sendSuccess(res, data = null, options = {}) {
  const { status = 200, meta } = options;
  const body = { success: true, data };
  if (meta !== undefined) {
    body.meta = meta;
  }
  return res.status(status).json(body);
}

/**
 * Send a standardized "201 Created" response.
 *
 * @param {import('express').Response} res
 * @param {*} data
 * @param {Object} [options]
 * @returns {import('express').Response}
 */
function sendCreated(res, data = null, options = {}) {
  return sendSuccess(res, data, { ...options, status: 201 });
}

/**
 * Send a standardized paginated list response.
 *
 * @param {import('express').Response} res
 * @param {Array} items
 * @param {Object} pagination
 * @param {number} pagination.page - 1-based page number.
 * @param {number} pagination.pageSize - Items per page.
 * @param {number} pagination.total - Total item count across all pages.
 * @param {Object} [options]
 * @returns {import('express').Response}
 */
function sendPaginated(res, items, pagination, options = {}) {
  const { page = 1, pageSize = Array.isArray(items) ? items.length : 0, total = 0 } = pagination || {};
  const totalPages = pageSize > 0 ? Math.ceil(total / pageSize) : 0;
  return sendSuccess(res, items, {
    ...options,
    meta: {
      ...(options.meta || {}),
      pagination: { page, pageSize, total, totalPages }
    }
  });
}

/**
 * Send a standardized error response.
 *
 * @param {import('express').Response} res
 * @param {Object} options
 * @param {number} [options.status=500] - HTTP status code.
 * @param {string} [options.code] - Stable machine-readable error code.
 * @param {string} [options.message] - Human-readable message.
 * @param {*} [options.details] - Optional extra detail (e.g. field errors).
 * @returns {import('express').Response}
 */
function sendError(res, options = {}) {
  const { status = 500, code, message, details } = options;
  const error = {
    code: code || defaultErrorCode(status),
    message: message || 'Terjadi kesalahan'
  };
  if (details !== undefined) {
    error.details = details;
  }
  return res.status(status).json({ success: false, error });
}

module.exports = {
  defaultErrorCode,
  sendSuccess,
  sendCreated,
  sendPaginated,
  sendError
};
