/**
 * Shared controller error helpers.
 *
 * Bridges thrown/returned exceptions to the standard error envelope defined in
 * apiResponse.js. Controllers that still use try/catch should funnel their error
 * responses through `handleControllerError` so every endpoint emits the same shape:
 *
 *   { "success": false, "error": { "code", "message", "details"? } }
 *
 * See docs/API-STANDARDIZATION-PLAN.md (repo root).
 */

const logger = require('../config/logger');
const { sendError, defaultErrorCode } = require('./apiResponse');

// Map known error class names -> HTTP status.
const NAME_TO_STATUS = {
  ValidationError: 422,
  NotFoundError: 404,
  ConflictError: 409,
  DuplicateError: 409,
  UnauthorizedError: 401,
  AuthenticationError: 401,
  AuthorizationError: 403,
  ForbiddenError: 403,
  JsonWebTokenError: 401,
  TokenExpiredError: 401,
  MulterError: 400
};

/**
 * Resolve an HTTP status code from an arbitrary error.
 * @param {Error} error
 * @returns {number}
 */
function statusFromError(error) {
  if (!error) return 500;
  if (error.statusCode) return error.statusCode;
  if (error.name && NAME_TO_STATUS[error.name]) return NAME_TO_STATUS[error.name];
  if (error.code === 'EREQUEST' || error.code === 'ECONNREFUSED') return 503;
  return 500;
}

/**
 * Detect raw DB/SQL/stack noise that must never reach the client.
 * @param {string} message
 * @returns {boolean}
 */
function looksTechnical(message) {
  if (!message) return false;
  return [
    /\bSQL\b/i, /\bMSSQL\b/i, /\bEREQUEST\b/, /\bECONNREFUSED\b/, /\bODBC\b/i,
    /CONSTRAINT.*VIOLATION/i, /FOREIGN KEY/i, /PRIMARY KEY/i, /UNIQUE KEY/i,
    /at Object\./, /at Function\./, /\.js:\d+:\d+/
  ].some((re) => re.test(message));
}

/**
 * Send a standardized error response derived from a caught exception.
 *
 * @param {import('express').Response} res
 * @param {Error} error
 * @param {string} fallbackMessage - User-facing message used for 5xx / sanitized errors.
 * @param {Object} [options]
 * @param {string} [options.code] - Override the error code.
 * @returns {import('express').Response}
 */
function handleControllerError(res, error, fallbackMessage, options = {}) {
  const status = statusFromError(error);

  if (status >= 500) {
    logger.error(fallbackMessage || 'Controller error', error);
  }

  const code = options.code || error?.errorCode || defaultErrorCode(status);

  let message;
  if (status >= 500 || looksTechnical(error?.message)) {
    message = fallbackMessage || 'Terjadi kesalahan pada server. Silakan coba lagi atau hubungi administrator.';
  } else {
    message = error?.message || fallbackMessage || 'Permintaan gagal diproses';
  }

  const details = error?.details || error?.errors;

  return sendError(res, { status, code, message, details });
}

/**
 * Send a standardized 422 response from express-validator results.
 *
 * @param {import('express').Response} res
 * @param {import('express-validator').Result} result - validationResult(req)
 * @param {string} [message]
 * @returns {import('express').Response}
 */
function sendValidationErrors(res, result, message = 'Validasi gagal') {
  const details = typeof result?.array === 'function' ? result.array() : result;
  return sendError(res, { status: 422, code: 'VALIDATION_ERROR', message, details });
}

module.exports = {
  statusFromError,
  handleControllerError,
  sendValidationErrors
};
