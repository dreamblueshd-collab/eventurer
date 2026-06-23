/**
 * Audit Helper Functions
 * Utilities for extracting audit context from requests
 */

/**
 * Extract audit context from Express request
 * @param {Object} req - Express request object
 * @returns {Object} Audit context with userId, username, ipAddress, userAgent
 */
function getAuditContext(req) {
  return {
    userId: req.user?.userId || null,
    username: String(req.user?.username || req.user?.displayName || req.body?.username || '').trim() || 'system',
    ipAddress: getIpAddress(req),
    userAgent: getUserAgent(req)
  };
}

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'currentpassword',
  'newpassword',
  'confirmpassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'secret'
]);

function sanitizeAuditPayload(value) {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeAuditPayload);
  }

  if (typeof value === 'object') {
    return Object.entries(value).reduce((acc, [key, nestedValue]) => {
      const normalizedKey = String(key || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
      acc[key] = SENSITIVE_KEYS.has(normalizedKey)
        ? '[REDACTED]'
        : sanitizeAuditPayload(nestedValue);
      return acc;
    }, {});
  }

  return value;
}

/**
 * Extract IP address from request
 * @param {Object} req - Express request object
 * @returns {string} IP address
 */
function getIpAddress(req) {
  // x-real-ip is set by frontend proxy with the true client IP
  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return String(realIp).trim();
  }
  const forwarded = req.headers['x-forwarded-for']
    || req.headers['x-original-forwarded-for'];
  if (forwarded) {
    return String(forwarded).split(',')[0].trim();
  }
  const ip = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown';
  return ip === '::1' ? '127.0.0.1' : ip.replace(/^::ffff:/, '');
}

/**
 * Extract user agent from request
 * @param {Object} req - Express request object
 * @returns {string} User agent
 */
function getUserAgent(req) {
  const raw = String(req.headers['user-agent'] || '').trim();
  if (!raw) return 'System Service';

  const ua = raw.toLowerCase();
  const browser = (() => {
    if (ua.includes('edg/')) return 'Edge';
    if (ua.includes('opr/') || ua.includes('opera')) return 'Opera';
    if (ua.includes('firefox/')) return 'Firefox';
    if (ua.includes('chrome/') && !ua.includes('edg/')) return 'Chrome';
    if (ua.includes('safari/') && !ua.includes('chrome/')) return 'Safari';
    return '';
  })();
  const os = (() => {
    if (ua.includes('windows nt')) return 'Windows';
    if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios')) return 'iOS';
    if (ua.includes('android')) return 'Android';
    if (ua.includes('mac os x') || ua.includes('macintosh')) return 'macOS';
    if (ua.includes('linux')) return 'Linux';
    return '';
  })();
  const device = (() => {
    if (ua.includes('ipad') || ua.includes('tablet')) return 'Tablet';
    if (ua.includes('mobi') || ua.includes('iphone') || ua.includes('android')) return 'Mobile';
    return 'Desktop';
  })();

  const label = [browser, os, device].filter(Boolean).join(' / ').trim();
  if (label) return label;
  return raw.slice(0, 500);
}

/**
 * Extract user info from request
 * @param {Object} req - Express request object
 * @returns {Object} User info with userId and username
 */
function getUserInfo(req) {
  return {
    userId: req.user?.userId || null,
    username: String(req.user?.username || req.user?.displayName || req.body?.username || '').trim() || 'system'
  };
}

module.exports = {
  getAuditContext,
  getIpAddress,
  getUserAgent,
  getUserInfo,
  sanitizeAuditPayload
};
