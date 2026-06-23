const auditService = require('../services/auditService');
const logger = require('../config/logger');
const { sanitizeAuditPayload, getUserAgent } = require('../utils/auditHelpers');

/**
 * Fetch existing entity data before update/delete for audit trail
 * @param {string} entityType - Entity type name
 * @param {string|number} entityId - Entity identifier
 * @returns {Object|null} Existing entity data or null
 */
async function fetchOldEntityData(entityType, entityId) {
    if (!entityId) return null;
    try {
        const db = require('../database/connection');
        const sql = require('../database/sql-client');
        const pool = await db.getPool();

        const tableMap = {
            'User': { table: 'Users', idCol: 'UserId', cols: 'UserId, Username, DisplayName, Email, Role, IsActive, PhoneNumber, NPK, UseLDAP' },
            'BusinessUnit': { table: 'BusinessUnits', idCol: 'BusinessUnitId', cols: 'BusinessUnitId, Name, Code, IsActive' },
            'Division': { table: 'Divisions', idCol: 'DivisionId', cols: 'DivisionId, Name, Code, BusinessUnitId, IsActive' },
            'Department': { table: 'Departments', idCol: 'DepartmentId', cols: 'DepartmentId, Name, Code, DivisionId, IsActive' },
            'Function': { table: 'Functions', idCol: 'FunctionId', cols: 'FunctionId, Name, Code, IsActive' },
            'Application': { table: 'Applications', idCol: 'ApplicationId', cols: 'ApplicationId, Name, Code, IsActive' },
            'Event': { table: 'Surveys', idCol: 'SurveyId', cols: 'SurveyId, Title, Description, Status, StartDate, EndDate, TargetRespondents, TargetScore' },
            'Question': { table: 'Questions', idCol: 'QuestionId', cols: 'QuestionId, SurveyId, Type, PromptText, IsMandatory, DisplayOrder, PageNumber' },
        };

        const config = tableMap[entityType];
        if (!config) return null;

        const idNum = parseInt(entityId, 10);
        if (!Number.isFinite(idNum)) return null;

        const result = await pool.request()
            .input('id', sql.BigInt, idNum)
            .query(`SELECT ${config.cols} FROM ${config.table} WHERE ${config.idCol} = @id`);

        if (result.recordset.length === 0) return null;
        return result.recordset[0];
    } catch (error) {
        logger.warn('Failed to fetch old entity data for audit', { entityType, entityId, error: error.message });
        return null;
    }
}

/**
 * Extract IP address from request
 * @param {Object} req - Express request object
 * @returns {string} IP address
 */
function getIpAddress(req) {
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
 * Determine entity type from request path
 * @param {string} path - Request path
 * @returns {string} Entity type
 */
function getEntityTypeFromPath(path) {
    const pathMap = {
        '/auth': 'Authentication',
        '/users': 'User',
        '/business-units': 'BusinessUnit',
        '/divisions': 'Division',
        '/departments': 'Department',
        '/functions': 'Function',
        '/applications': 'Application',
        '/events': 'Event',
        '/surveys': 'Event',
        '/event-types': 'EventType',
        '/questions': 'Question',
        '/responses': 'Response',
        '/mappings': 'Mapping',
        '/approvals': 'Approval',
        '/reports': 'Report',
        '/operations': 'Operation',
        '/audit': 'AuditLog'
    };

    for (const [key, value] of Object.entries(pathMap)) {
        if (path.includes(key)) {
            return value;
        }
    }

    const apiPrefix = '/api/v1/';
    const normalizedPath = String(path || '');
    const pathWithoutPrefix = normalizedPath.startsWith(apiPrefix)
      ? normalizedPath.slice(apiPrefix.length)
      : normalizedPath.replace(/^\/+/, '');
    const firstSegment = pathWithoutPrefix.split('/').find(Boolean);
    if (firstSegment) {
      return firstSegment
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join('');
    }

    return 'System';
}

/**
 * Determine action type from HTTP method
 * @param {string} method - HTTP method
 * @returns {string} Action type
 */
function getActionFromMethod(method) {
    const methodMap = {
        'POST': 'Create',
        'PUT': 'Update',
        'PATCH': 'Update',
        'DELETE': 'Delete',
        'GET': 'Access'
    };

    return methodMap[method] || 'Access';
}

/**
 * Middleware to automatically log state-changing operations
 * This middleware should be applied after authentication middleware
 * so that req.user is available
 */
const auditLoggerMiddleware = (options = {}) => {
    return async (req, res, next) => {
        // Skip audit logging for certain paths
        const skipPaths = options.skipPaths || [
            '/api/v1/auth/login',
            '/api/v1/auth/logout',
            '/api/v1/auth/refresh',
            '/api/v1/auth/validate',
            '/api/v1/health',
            '/api/v1/audit' // Don't log audit log queries
        ];

        if (skipPaths.some(path => req.path.startsWith(path))) {
            return next();
        }

        // Only log state-changing operations (POST, PUT, PATCH, DELETE)
        // and sensitive data access (GET for specific resources)
        const shouldLog = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) ||
                         (req.method === 'GET' && options.logGetRequests);

        if (!shouldLog) {
            return next();
        }

        // Pre-fetch old entity data for update/delete operations
        if (['PUT', 'PATCH', 'DELETE'].includes(req.method) && !req.originalData) {
            const entityType = getEntityTypeFromPath(req.path);
            const entityId = req.params?.id || null;
            if (entityId) {
                req.originalData = await fetchOldEntityData(entityType, entityId);
            }
        }

        // Store original res.json to intercept response
        const originalJson = res.json.bind(res);

        res.json = function(data) {
            // Only log successful operations (2xx status codes)
            if (res.statusCode >= 200 && res.statusCode < 300) {
                // Extract user info from request (set by auth middleware)
                const userId = req.user?.userId || null;
                const username = String(req.user?.username || req.user?.displayName || '').trim() || 'system';

                // Determine entity type and action
                const entityType = getEntityTypeFromPath(req.path);
                const action = getActionFromMethod(req.method);

                // Extract entity ID from response or request params
                const entityId = data?.data?.id || 
                               data?.id || 
                               req.params?.id || 
                               null;

                // Get IP and user agent
                const ipAddress = getIpAddress(req);
                const userAgent = getUserAgent(req);

                // Prepare audit log data
                const auditData = {
                    userId: userId,
                    username: username,
                    action: action,
                    entityType: entityType,
                    entityId: entityId,
                    ipAddress: ipAddress,
                    userAgent: userAgent
                };

                // Add old/new values for updates
                if (action === 'Create') {
                    auditData.newValues = sanitizeAuditPayload(req.body);
                } else if (action === 'Update') {
                    auditData.oldValues = sanitizeAuditPayload(req.originalData || null); // Set by controller if available
                    auditData.newValues = sanitizeAuditPayload(req.body);
                } else if (action === 'Delete') {
                    auditData.oldValues = sanitizeAuditPayload(req.originalData || null); // Set by controller if available
                }

                // Log asynchronously without blocking response
                auditService.logAction(auditData).catch(error => {
                    logger.error('Failed to log audit entry', {
                        error: error.message,
                        auditData: auditData
                    });
                });
            }

            // Call original json method
            return originalJson(data);
        };

        next();
    };
};

/**
 * Middleware to log authentication attempts
 * Should be used specifically on login endpoints
 */
const auditAuthMiddleware = async (req, res, next) => {
    // Store original res.json to intercept response
    const originalJson = res.json.bind(res);

    res.json = function(data) {
        const username = req.body?.username || 'unknown';
        const success = res.statusCode === 200 && data?.success;
        const userId = data?.user?.userId || null;
        const ipAddress = getIpAddress(req);
        const userAgent = getUserAgent(req);

        // Log authentication attempt asynchronously
        auditService.logAuthAttempt(username, success, ipAddress, userAgent, userId)
            .catch(error => {
                logger.error('Failed to log auth attempt', {
                    error: error.message,
                    username: username
                });
            });

        // Call original json method
        return originalJson(data);
    };

    next();
};

/**
 * Middleware to log logout actions
 * Should be used specifically on logout endpoints
 */
const auditLogoutMiddleware = async (req, res, next) => {
    // Store original res.json to intercept response
    const originalJson = res.json.bind(res);

    res.json = function(data) {
        if (res.statusCode === 200 && req.user) {
            const userId = req.user.userId;
            const username = req.user.username;
            const ipAddress = getIpAddress(req);
            const userAgent = getUserAgent(req);

            // Log logout asynchronously
            auditService.logLogout(userId, username, ipAddress, userAgent)
                .catch(error => {
                    logger.error('Failed to log logout', {
                        error: error.message,
                        username: username
                    });
                });
        }

        // Call original json method
        return originalJson(data);
    };

    next();
};

/**
 * Middleware to log data exports
 * Should be used on export endpoints
 */
const auditExportMiddleware = (entityType) => {
    return async (req, res, next) => {
        // Store original methods to intercept response
        const originalSend = res.send.bind(res);
        const originalJson = res.json.bind(res);

        const logExport = () => {
            if (res.statusCode === 200 && req.user) {
                const userId = req.user.userId;
                const username = req.user.username;
                const ipAddress = getIpAddress(req);
                const userAgent = getUserAgent(req);

                const exportDetails = {
                    format: req.query.format || 'unknown',
                    filters: req.query,
                    timestamp: new Date()
                };

                // Log export asynchronously
                auditService.logExport(userId, username, entityType, exportDetails, ipAddress, userAgent)
                    .catch(error => {
                        logger.error('Failed to log export', {
                            error: error.message,
                            username: username
                        });
                    });
            }
        };

        res.send = function(data) {
            logExport();
            return originalSend(data);
        };

        res.json = function(data) {
            logExport();
            return originalJson(data);
        };

        next();
    };
};

module.exports = {
    auditLoggerMiddleware,
    auditAuthMiddleware,
    auditLogoutMiddleware,
    auditExportMiddleware,
    getIpAddress,
    getUserAgent
};
