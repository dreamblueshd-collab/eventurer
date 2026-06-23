const logger = require('../config/logger');

/**
 * Middleware to handle connection errors and timeouts
 * Prevents ECONNRESET and ensures proper response handling
 */
function connectionErrorHandler(req, res, next) {
  let isRequestCompleted = false;
  
  // Mark request as completed when response finishes
  res.on('finish', () => {
    isRequestCompleted = true;
  });

  res.on('close', () => {
    if (!isRequestCompleted) {
      logger.warn('Connection closed before response completed', {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userId: req.user?.userId
      });
    }
  });

  // Handle client abort
  req.on('aborted', () => {
    logger.warn('Request aborted by client', {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userId: req.user?.userId
    });
  });

  // Handle socket errors
  if (req.socket) {
    req.socket.on('error', (error) => {
      if (error.code === 'ECONNRESET') {
        logger.warn('Socket connection reset', {
          method: req.method,
          path: req.path,
          ip: req.ip,
          code: error.code
        });
      } else {
        logger.error('Socket error', {
          method: req.method,
          path: req.path,
          ip: req.ip,
          error: error.message,
          code: error.code
        });
      }
    });
  }

  // Override res.json to ensure it only sends once
  const originalJson = res.json.bind(res);
  res.json = function(data) {
    if (res.headersSent) {
      logger.warn('Attempted to send response after headers sent', {
        method: req.method,
        path: req.path
      });
      return res;
    }
    return originalJson(data);
  };

  // Override res.send to ensure it only sends once
  const originalSend = res.send.bind(res);
  res.send = function(data) {
    if (res.headersSent) {
      logger.warn('Attempted to send response after headers sent', {
        method: req.method,
        path: req.path
      });
      return res;
    }
    return originalSend(data);
  };

  next();
}

/**
 * Middleware to handle upload timeouts
 * Should be applied specifically to upload routes
 */
function uploadTimeoutHandler(timeoutMs = 300000) {
  return (req, res, next) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        logger.error('Upload timeout', {
          method: req.method,
          path: req.path,
          timeout: timeoutMs,
          ip: req.ip
        });
        
        res.status(504).json({
          success: false,
          error: 'Upload timeout',
          message: 'File upload took too long. Please try with a smaller file.'
        });
      }
    }, timeoutMs);

    // Clear timeout when response finishes
    res.on('finish', () => {
      clearTimeout(timeout);
    });

    res.on('close', () => {
      clearTimeout(timeout);
    });

    next();
  };
}

/**
 * Wrapper for upload handlers to ensure proper error handling
 */
function safeUploadHandler(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      // Ensure response is sent even on error
      if (!res.headersSent) {
        logger.error('Upload handler error', {
          method: req.method,
          path: req.path,
          error: error.message,
          code: error.code,
          stack: error.stack
        });

        const statusCode = error.statusCode || 500;
        res.status(statusCode).json({
          success: false,
          message: error.message || 'Upload failed',
          errors: error.errors || [],
          code: error.code
        });
      } else {
        logger.error('Upload error after headers sent', {
          method: req.method,
          path: req.path,
          error: error.message
        });
      }
    }
  };
}

module.exports = {
  connectionErrorHandler,
  uploadTimeoutHandler,
  safeUploadHandler
};
