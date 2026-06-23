const { body, param, query, validationResult } = require('express-validator');
const surveyService = require('../services/surveyService');
const logger = require('../config/logger');
const multer = require('multer');
const scheduledOperationsProcessor = require('../services/scheduledOperationsProcessor');

// Configure multer for file uploads
const allowedImageMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (!allowedImageMimeTypes.includes(file.mimetype)) {
      const error = new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed');
      error.statusCode = 400;
      return cb(error);
    }
    cb(null, true);
  }
});

const surveyIdentifierValidation = param('id')
  .trim()
  .notEmpty().withMessage('Survey identifier is required')
  .matches(/^\d+$/).withMessage('Survey identifier must be a positive integer');

/**
 * Validation rules for creating a survey
 */
const createSurveyValidation = [
  body('title')
    .trim()
    .notEmpty().withMessage('Title is required')
    .isLength({ min: 1, max: 200 }).withMessage('Title must be between 1 and 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Description must not exceed 1000 characters'),
  body('startDate')
    .optional()
    .isISO8601().withMessage('Invalid start date format'),
  body('endDate')
    .optional()
    .isISO8601().withMessage('Invalid end date format'),
  body('status')
    .optional()
    .isIn(['Draft', 'Active', 'Closed', 'Archived']).withMessage('Invalid status'),
  body('targetRespondents')
    .optional()
    .isInt({ min: 0 }).withMessage('Target respondents must be a positive integer'),
  body('targetScore')
    .optional()
    .isFloat({ min: 0, max: 10 }).withMessage('Target score must be between 0 and 10'),
  body('assignedAdminId')
    .optional()
    .isInt({ min: 1 }).withMessage('assignedAdminId must be a positive integer')
    .toInt(),
  body('assignedAdminIds')
    .optional()
    .isArray({ min: 1 }).withMessage('assignedAdminIds must be a non-empty array'),
  body('assignedAdminIds.*')
    .optional()
    .isInt({ min: 1 }).withMessage('Each assigned admin ID must be a positive integer')
    .toInt(),
];

/**
 * Validation rules for updating a survey
 */
const updateSurveyValidation = [
  surveyIdentifierValidation,
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 }).withMessage('Title must be between 1 and 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Description must not exceed 1000 characters'),
  body('startDate')
    .optional()
    .isISO8601().withMessage('Invalid start date format'),
  body('endDate')
    .optional()
    .isISO8601().withMessage('Invalid end date format'),
  body('status')
    .optional()
    .isIn(['Draft', 'Active', 'Closed', 'Archived']).withMessage('Invalid status'),
  body('targetRespondents')
    .optional()
    .isInt({ min: 0 }).withMessage('Target respondents must be a positive integer'),
  body('targetScore')
    .optional()
    .isFloat({ min: 0, max: 10 }).withMessage('Target score must be between 0 and 10'),
  body('assignedAdminId')
    .optional()
    .isInt({ min: 1 }).withMessage('assignedAdminId must be a positive integer')
    .toInt(),
  body('assignedAdminIds')
    .optional()
    .isArray({ min: 1 }).withMessage('assignedAdminIds must be a non-empty array'),
  body('assignedAdminIds.*')
    .optional()
    .isInt({ min: 1 }).withMessage('Each assigned admin ID must be a positive integer')
    .toInt(),
];

/**
 * Create a new survey
 * POST /api/v1/surveys
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function createSurvey(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Validasi gagal'
      });
    }

    // Defensive: try multiple property names for userId
    const createdBy = req.user?.userId || req.user?.UserId || req.user?.id;
    
    if (!createdBy) {
      logger.error('CreateSurvey: Unable to determine userId from req.user', {
        reqUser: req.user,
        hasReqUser: !!req.user,
        userKeys: req.user ? Object.keys(req.user) : []
      });
      return res.status(401).json({ 
        error: 'Authentication error', 
        message: 'Autentikasi gagal'
      });
    }

    const surveyData = {
      ...req.body,
      createdBy
    };

    const result = await surveyService.createSurvey(surveyData);

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      survey: result
    });

  } catch (error) {
    logger.error('Create survey controller error:', error);
    if (error?.statusCode) {
      return res.status(error.statusCode).json({
        error: error.name || 'Request failed',
        message: 'Request gagal',
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'An error occurred while creating survey'
    });
  }
}

/**
 * Get all surveys
 * GET /api/v1/surveys
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getSurveys(req, res) {
  try {
    const { status, assignedAdminId, search } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (search) filter.search = search;
    if (req.user?.role === 'AdminEvent') {
      filter.assignedAdminId = req.user.userId;
      filter.assignedAdminUsername = req.user.username || null;
    } else if (assignedAdminId) {
      filter.assignedAdminId = assignedAdminId;
    }

    const surveys = await surveyService.getSurveys(filter);

    res.json({
      success: true,
      surveys
    });

  } catch (error) {
    logger.error('Get surveys controller error:', error);
    if (error?.statusCode) {
      return res.status(error.statusCode).json({
        error: error.name || 'Request failed',
        message: 'Request gagal',
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'An error occurred while fetching surveys'
    });
  }
}

/**
 * Get survey by ID
 * GET /api/v1/surveys/:id
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getSurveyById(req, res) {
  try {
    const surveyId = req.params.id;
    const survey = await surveyService.getSurveyById(surveyId);

    if (!survey) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Survey not found'
      });
    }

    res.json({
      success: true,
      survey
    });

  } catch (error) {
    logger.error('Get survey by ID controller error:', error);
    if (error?.statusCode) {
      return res.status(error.statusCode).json({
        error: error.name || 'Request failed',
        message: 'Request gagal',
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'An error occurred while fetching survey'
    });
  }
}

/**
 * Update survey
 * PUT /api/v1/surveys/:id
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function updateSurvey(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const surveyId = req.params.id;
    const updates = {
      ...req.body,
      updatedBy: req.user?.userId,
    };

    const result = await surveyService.updateSurvey(surveyId, updates);

    res.json({
      success: true,
      message: 'Event updated successfully',
      survey: result
    });

  } catch (error) {
    logger.error('Update survey controller error:', error);

    if (error?.statusCode) {
      return res.status(error.statusCode).json({
        error: error.name || 'Request failed',
        message: 'Request gagal',
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'An error occurred while updating survey'
    });
  }
}

/**
 * Delete survey
 * DELETE /api/v1/surveys/:id
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function deleteSurvey(req, res) {
  try {
    const surveyId = req.params.id;
    const result = await surveyService.deleteSurvey(surveyId);

    if (!result) {
      return res.status(400).json({
        error: 'Event deletion failed',
        message: 'Event deletion failed'
      });
    }

    res.json({
      success: true,
      message: 'Event deleted successfully'
    });

  } catch (error) {
    logger.error('Delete survey controller error:', error);

    if (error?.statusCode) {
      return res.status(error.statusCode).json({
        error: error.name || 'Request failed',
        message: 'Request gagal',
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'An error occurred while deleting survey'
    });
  }
}

/**
 * Update survey configuration
 * PATCH /api/v1/surveys/:id/config
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function updateSurveyConfig(req, res) {
  try {
    const surveyId = req.params.id;
    const config = req.body;

    const result = await surveyService.updateSurveyConfig(surveyId, config);

    res.json({
      success: true,
      message: 'Survey configuration updated successfully',
      config: result
    });

  } catch (error) {
    logger.error('Update survey config controller error:', error);

    if (error?.statusCode) {
      return res.status(error.statusCode).json({
        error: error.name || 'Request failed',
        message: error.message,
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'An error occurred while updating configuration'
    });
  }
}

/**
 * Generate survey preview
 * GET /api/v1/surveys/:id/preview
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function generatePreview(req, res) {
  try {
    const surveyId = req.params.id;
    const preview = await surveyService.generatePreview(surveyId);

    if (!preview) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Survey not found'
      });
    }

    res.json({
      success: true,
      preview
    });

  } catch (error) {
    logger.error('Generate preview controller error:', error);

    if (error?.statusCode) {
      return res.status(error.statusCode).json({
        error: error.name || 'Request failed',
        message: error.message,
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'An error occurred while generating preview'
    });
  }
}

/**
 * Generate survey link
 * POST /api/v1/surveys/:id/link
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function generateSurveyLink(req, res) {
  try {
    const surveyId = req.params.id;
    const { shortenUrl } = req.body;

    const result = await surveyService.generateSurveyLink(surveyId, shortenUrl);

    res.json({
      success: true,
      surveyLink: result.surveyLink,
      shortenedLink: result.shortenedLink
    });

  } catch (error) {
    logger.error('Generate survey link controller error:', error);
    if (error?.statusCode) {
      return res.status(error.statusCode).json({
        error: error.name || 'Request failed',
        message: error.message,
      });
    }
    res.status(500).json({
      error: 'Internal server error',
      message: 'An error occurred while generating link'
    });
  }
}

/**
 * Generate QR code
 * POST /api/v1/surveys/:id/qrcode
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function generateQRCode(req, res) {
  try {
    const surveyId = req.params.id;
    const result = await surveyService.generateQRCode(surveyId);

    res.json({
      success: true,
      qrCodeDataUrl: result
    });

  } catch (error) {
    logger.error('Generate QR code controller error:', error);
    if (error?.statusCode) {
      return res.status(error.statusCode).json({
        error: error.name || 'Request failed',
        message: error.message,
      });
    }
    res.status(500).json({
      error: 'Internal server error',
      message: 'An error occurred while generating QR code'
    });
  }
}

/**
 * Generate embed code
 * POST /api/v1/surveys/:id/embed
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function generateEmbedCode(req, res) {
  try {
    const surveyId = req.params.id;
    const result = await surveyService.generateEmbedCode(surveyId);

    res.json({
      success: true,
      embedCode: result
    });

  } catch (error) {
    logger.error('Generate embed code controller error:', error);
    if (error?.statusCode) {
      return res.status(error.statusCode).json({
        error: error.name || 'Request failed',
        message: error.message,
      });
    }
    res.status(500).json({
      error: 'Internal server error',
      message: 'An error occurred while generating embed code'
    });
  }
}

/**
 * Schedule blast
 * POST /api/v1/surveys/:id/schedule-blast
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function scheduleBlast(req, res) {
  try {
    const surveyId = req.params.id;
    const request = {
      ...req.body,
      surveyId,
      createdBy: req.user?.userId
    };

    const result = await surveyService.scheduleBlast(request);

    res.status(201).json({
      success: true,
      message: 'Blast scheduled successfully',
      operation: result
    });

  } catch (error) {
    logger.error('Schedule blast controller error:', error);
    if (error?.statusCode) {
      return res.status(error.statusCode).json({
        error: error.name || 'Request failed',
        message: error.message,
      });
    }
    res.status(500).json({
      error: 'Internal server error',
      message: 'An error occurred while scheduling blast'
    });
  }
}

/**
 * Schedule reminder
 * POST /api/v1/surveys/:id/schedule-reminder
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function scheduleReminder(req, res) {
  try {
    const surveyId = req.params.id;
    const request = {
      ...req.body,
      surveyId,
      createdBy: req.user?.userId
    };

    const result = await surveyService.scheduleReminder(request);

    res.status(201).json({
      success: true,
      message: 'Reminder scheduled successfully',
      operation: result
    });

  } catch (error) {
    logger.error('Schedule reminder controller error:', error);
    if (error?.statusCode) {
      return res.status(error.statusCode).json({
        error: error.name || 'Request failed',
        message: error.message,
      });
    }
    res.status(500).json({
      error: 'Internal server error',
      message: 'An error occurred while scheduling reminder'
    });
  }
}

/**
 * Get scheduled operations
 * GET /api/v1/surveys/:id/scheduled-operations
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getScheduledOperations(req, res) {
  try {
    const surveyId = req.params.id;
    const { type, status } = req.query;

    const filter = {};
    if (type) filter.operationType = type;
    if (status) filter.status = status;

    const operations = await surveyService.getScheduledOperations(surveyId, filter);

    res.json({
      success: true,
      operations
    });

  } catch (error) {
    logger.error('Get scheduled operations controller error:', error);
    if (error?.statusCode) {
      return res.status(error.statusCode).json({
        error: error.name || 'Request failed',
        message: error.message,
      });
    }
    res.status(500).json({
      error: 'Internal server error',
      message: 'An error occurred while fetching scheduled operations'
    });
  }
}

/**
 * Cancel scheduled operation
 * DELETE /api/v1/surveys/scheduled-operations/:operationId
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function cancelScheduledOperation(req, res) {
  try {
    const operationId = req.params.operationId;
    const result = await surveyService.cancelScheduledOperation(operationId);

    res.json({
      success: true,
      message: 'Scheduled operation cancelled successfully',
      operation: result
    });

  } catch (error) {
    logger.error('Cancel scheduled operation controller error:', error);
    if (error?.statusCode) {
      return res.status(error.statusCode).json({
        error: error.name || 'Request failed',
        message: error.message,
      });
    }
    res.status(500).json({
      error: 'Internal server error',
      message: 'An error occurred while cancelling operation'
    });
  }
}

async function retryScheduledOperation(req, res) {
  try {
    const operationId = req.params.operationId;
    const result = await surveyService.retryScheduledOperation(operationId);

    // Trigger processor immediately so email is sent right now
    scheduledOperationsProcessor.triggerProcessing().catch((err) => {
      logger.error('Immediate trigger after retry failed:', err);
    });

    res.json({
      success: true,
      message: 'Email sedang dikirim ulang',
      operation: result
    });

  } catch (error) {
    logger.error('Retry scheduled operation controller error:', error);
    if (error?.statusCode) {
      return res.status(error.statusCode).json({
        error: error.name || 'Request failed',
        message: error.message,
      });
    }
    res.status(500).json({
      error: 'Internal server error',
      message: 'An error occurred while retrying operation'
    });
  }
}

/**
 * Upload hero image
 * POST /api/v1/surveys/:id/upload/hero
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function uploadHeroImage(req, res) {
  try {
    const surveyId = req.params.id;
    
    if (!req.file) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Image file is required'
      });
    }

    const result = await surveyService.uploadHeroImage(surveyId, req.file);

    res.json({
      success: true,
      message: 'Hero image uploaded successfully',
      imageUrl: result.HeroImageUrl
    });

  } catch (error) {
    logger.error('Upload hero image controller error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'An error occurred while uploading image'
    });
  }
}

/**
 * Upload logo
 * POST /api/v1/surveys/:id/upload/logo
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function uploadLogo(req, res) {
  try {
    const surveyId = req.params.id;
    
    if (!req.file) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Image file is required'
      });
    }

    const result = await surveyService.uploadLogo(surveyId, req.file);

    res.json({
      success: true,
      message: 'Logo uploaded successfully',
      imageUrl: result.LogoUrl
    });

  } catch (error) {
    logger.error('Upload logo controller error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'An error occurred while uploading logo'
    });
  }
}

/**
 * Upload background image
 * POST /api/v1/surveys/:id/upload/background
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function uploadBackgroundImage(req, res) {
  try {
    const surveyId = req.params.id;
    
    if (!req.file) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Image file is required'
      });
    }

    const result = await surveyService.uploadBackgroundImage(surveyId, req.file);

    res.json({
      success: true,
      message: 'Background image uploaded successfully',
      imageUrl: result.BackgroundImageUrl
    });

  } catch (error) {
    logger.error('Upload background image controller error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'An error occurred while uploading background image'
    });
  }
}

/**
 * Resolve short link code to survey ID (public endpoint)
 * GET /api/v1/public/survey-link/:code
 */
async function resolveSurveyShortCode(req, res) {
  try {
    const { code } = req.params;

    if (!code || !/^[A-Za-z0-9]{6}$/.test(code)) {
      return res.status(400).json({ success: false, message: 'Invalid short code' });
    }

    const result = await surveyService.resolveSurveyShortCode(code);

    if (!result) {
      return res.status(404).json({ success: false, message: 'Survey not found' });
    }

    res.json({ success: true, surveyId: result.surveyId, slug: result.slug });
  } catch (error) {
    logger.error('Resolve short code error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * Get all events (event-level list)
 * GET /api/v1/events
 */
async function getEvents(req, res) {
  try {
    const { status, assignedAdminId } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (req.user?.role === 'AdminEvent') {
      filter.assignedAdminId = req.user.userId;
      filter.assignedAdminUsername = req.user.username || null;
    } else if (assignedAdminId) {
      filter.assignedAdminId = assignedAdminId;
    }

    const events = await surveyService.getEvents(filter);
    res.json({ success: true, events, surveys: events });
  } catch (error) {
    logger.error('Get events controller error:', error);
    res.status(500).json({ error: 'Internal server error', message: 'Gagal memuat events' });
  }
}

/**
 * Get event by ID with its surveys
 * GET /api/v1/events/:id
 */
async function getEventById(req, res) {
  try {
    const event = await surveyService.getEventById(req.params.id);
    
    // Permission check for AdminEvent: only allow access to assigned events
    if (req.user?.role === 'AdminEvent') {
      const userId = Number(req.user.userId);
      const assignedAdminIds = event.AssignedAdminIds || [];
      
      // Check if user is assigned to this event (either directly or via EventAdminAssignments)
      if (!assignedAdminIds.includes(userId) && Number(event.AssignedAdminId) !== userId) {
        return res.status(404).json({ 
          error: 'Not found', 
          message: 'Event not found or you do not have access to this event' 
        });
      }
    }
    
    res.json({ success: true, event });
  } catch (error) {
    if (error.name === 'NotFoundError') {
      return res.status(404).json({ error: 'Not found', message: 'Event tidak ditemukan' });
    }
    logger.error('Get event by ID controller error:', error);
    res.status(500).json({ error: 'Internal server error', message: 'Gagal memuat event' });
  }
}

/**
 * Create a new event
 * POST /api/v1/events
 */
async function createEvent(req, res) {
  try {
    // Log incoming request for debugging
    logger.info('CreateEvent request received', {
      userId: req.user?.userId || req.user?.UserId || req.user?.id,
      userRole: req.user?.role,
      bodyKeys: Object.keys(req.body || {}),
      title: req.body?.title,
      hasAssignedAdminIds: !!req.body?.assignedAdminIds,
      assignedAdminIdsCount: Array.isArray(req.body?.assignedAdminIds) ? req.body.assignedAdminIds.length : 0
    });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('CreateEvent validation failed', {
        errors: errors.array(),
        body: req.body
      });
      return res.status(400).json({ error: 'Validation failed', message: 'Validasi gagal' });
    }

    // Defensive: try multiple property names for userId
    const createdBy = req.user?.userId || req.user?.UserId || req.user?.id;

    if (!createdBy) {
      logger.error('CreateEvent: Unable to determine userId from req.user', {
        reqUser: req.user,
        hasReqUser: !!req.user,
        userKeys: req.user ? Object.keys(req.user) : []
      });
      return res.status(401).json({
        error: 'Authentication error',
        message: 'Autentikasi gagal'
      });
    }

    const eventData = { ...req.body, createdBy };
    
    logger.info('Calling surveyService.createEvent', {
      createdBy,
      title: eventData.title,
      eventTypeId: eventData.eventTypeId
    });
    
    const result = await surveyService.createEvent(eventData);
    
    logger.info('Event created successfully', {
      eventId: result.EventId,
      title: result.Title
    });
    
    res.status(201).json({ success: true, message: 'Event created successfully', event: result });
  } catch (error) {
    // Enhanced error logging with full context
    logger.error('Create event controller error', {
      errorMessage: error.message,
      errorName: error.name,
      errorStack: error.stack,
      statusCode: error?.statusCode,
      userId: req.user?.userId || req.user?.UserId || req.user?.id,
      userRole: req.user?.role,
      requestBody: req.body,
      bodyKeys: Object.keys(req.body || {})
    });
    
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ error: error.name || 'Request failed', message: 'Request gagal' });
    }
    res.status(500).json({ error: 'Internal server error', message: 'Gagal membuat event' });
  }
}

/**
 * Update an event
 * PUT /api/v1/events/:id
 */
async function updateEvent(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', message: 'Validasi gagal' });
    }

    const eventId = req.params.id;
    const updates = {
      ...req.body,
      updatedBy: req.user?.userId,
    };

    const result = await surveyService.updateEvent(eventId, updates);

    res.json({
      success: true,
      message: 'Event updated successfully',
      event: result
    });

  } catch (error) {
    if (error?.statusCode || error?.name === 'NotFoundError' || error?.name === 'ValidationError') {
      const statusCode = error.statusCode || (error.name === 'NotFoundError' ? 404 : 400);
      return res.status(statusCode).json({
        error: error.name || 'Request failed',
        message: 'Request gagal',
      });
    }
    logger.error('Update event controller error:', error);
    res.status(500).json({ error: 'Internal server error', message: 'Gagal mengubah event' });
  }
}

/**
 * Delete an event
 * DELETE /api/v1/events/:id
 */
async function deleteEvent(req, res) {
  try {
    await surveyService.deleteEvent(req.params.id);
    res.json({ success: true, message: 'Event deleted successfully' });
  } catch (error) {
    if (error.name === 'NotFoundError') {
      return res.status(404).json({ error: 'Not found', message: 'Event tidak ditemukan' });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: 'Validation failed', message: 'Validasi gagal' });
    }
    logger.error('Delete event controller error:', error);
    res.status(500).json({ error: 'Internal server error', message: 'Gagal menghapus event' });
  }
}

async function getEventSurveys(req, res) {
  try {
    const { eventId } = req.params;
    const filter = { eventId };
    if (req.query.status) filter.status = req.query.status;
    const surveys = await surveyService.getSurveys(filter);
    res.json({ success: true, surveys });
  } catch (error) {
    logger.error('Get event surveys controller error:', error);
    res.status(500).json({ error: 'Internal server error', message: 'Gagal memuat survey event' });
  }
}

/**
 * Create a survey under a specific event
 * POST /api/v1/events/:eventId/surveys
 */
async function createEventSurvey(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const surveyData = {
      ...req.body,
      eventId: req.params.eventId,
      createdBy: req.user?.userId
    };

    const result = await surveyService.createSurvey(surveyData);
    res.status(201).json({ success: true, message: 'Survey created successfully', survey: result });
  } catch (error) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ error: error.name || 'Request failed', message: error.message });
    }
    logger.error('Create event survey controller error:', error);
    res.status(500).json({ error: 'Internal server error', message: 'An error occurred while creating survey' });
  }
}

const createEventValidation = [
  body('title')
    .trim()
    .notEmpty().withMessage('Title is required')
    .isLength({ min: 1, max: 200 }).withMessage('Title must be between 1 and 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Description must not exceed 1000 characters'),
  body('assignedAdminId')
    .optional()
    .isInt({ min: 1 }).withMessage('assignedAdminId must be a positive integer')
    .toInt(),
  body('assignedAdminIds')
    .optional()
    .isArray({ min: 1 }).withMessage('assignedAdminIds must be a non-empty array'),
  body('assignedAdminIds.*')
    .optional()
    .isInt({ min: 1 }).withMessage('Each assigned admin ID must be a positive integer')
    .toInt(),
];

const updateEventValidation = [
  surveyIdentifierValidation,
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 }).withMessage('Title must be between 1 and 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Description must not exceed 1000 characters'),
  body('status')
    .optional()
    .isIn(['Draft', 'Active', 'Closed', 'Archived']).withMessage('Invalid status'),
  body('requireApproval')
    .optional()
    .isBoolean().withMessage('requireApproval must be a boolean'),
  body('assignedAdminId')
    .optional()
    .isInt({ min: 1 }).withMessage('assignedAdminId must be a positive integer')
    .toInt(),
  body('assignedAdminIds')
    .optional()
    .isArray({ min: 1 }).withMessage('assignedAdminIds must be a non-empty array'),
  body('assignedAdminIds.*')
    .optional()
    .isInt({ min: 1 }).withMessage('Each assigned admin ID must be a positive integer')
    .toInt(),
];

module.exports = {
  createSurvey,
  getSurveys,
  getSurveyById,
  updateSurvey,
  deleteSurvey,
  updateSurveyConfig,
  generatePreview,
  generateSurveyLink,
  generateQRCode,
  generateEmbedCode,
  resolveSurveyShortCode,
  scheduleBlast,
  scheduleReminder,
  getScheduledOperations,
  cancelScheduledOperation,
  retryScheduledOperation,
  uploadHeroImage,
  uploadLogo,
  uploadBackgroundImage,
  createSurveyValidation,
  updateSurveyValidation,
  createEventValidation,
  updateEventValidation,
  getEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  getEventSurveys,
  createEventSurvey,
  upload
};





