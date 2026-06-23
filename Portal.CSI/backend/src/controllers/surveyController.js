const { body, param, query, validationResult } = require('express-validator');
const surveyService = require('../services/surveyService');
const logger = require('../config/logger');
const multer = require('multer');
const scheduledOperationsProcessor = require('../services/scheduledOperationsProcessor');
const { sendSuccess, sendCreated, sendError } = require('../utils/apiResponse');
const { handleControllerError, sendValidationErrors } = require('../utils/controllerError');

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
 */
async function createSurvey(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendValidationErrors(res, errors);
    }

    // Defensive: try multiple property names for userId
    const createdBy = req.user?.userId || req.user?.UserId || req.user?.id;

    if (!createdBy) {
      logger.error('CreateSurvey: Unable to determine userId from req.user', {
        reqUser: req.user,
        hasReqUser: !!req.user,
        userKeys: req.user ? Object.keys(req.user) : []
      });
      return sendError(res, { status: 401, code: 'UNAUTHENTICATED', message: 'Autentikasi gagal' });
    }

    const surveyData = {
      ...req.body,
      createdBy
    };

    const result = await surveyService.createSurvey(surveyData);

    return sendCreated(res, result, { meta: { message: 'Event created successfully' } });
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while creating survey');
  }
}

/**
 * Get all surveys
 * GET /api/v1/surveys
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

    return sendSuccess(res, surveys);
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while fetching surveys');
  }
}

/**
 * Get survey by ID
 * GET /api/v1/surveys/:id
 */
async function getSurveyById(req, res) {
  try {
    const survey = await surveyService.getSurveyById(req.params.id);

    if (!survey) {
      return sendError(res, { status: 404, code: 'NOT_FOUND', message: 'Survey not found' });
    }

    return sendSuccess(res, survey);
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while fetching survey');
  }
}

/**
 * Update survey
 * PUT /api/v1/surveys/:id
 */
async function updateSurvey(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendValidationErrors(res, errors);
    }

    const updates = {
      ...req.body,
      updatedBy: req.user?.userId,
    };

    const result = await surveyService.updateSurvey(req.params.id, updates);

    return sendSuccess(res, result, { meta: { message: 'Event updated successfully' } });
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while updating survey');
  }
}

/**
 * Delete survey
 * DELETE /api/v1/surveys/:id
 */
async function deleteSurvey(req, res) {
  try {
    const result = await surveyService.deleteSurvey(req.params.id);

    if (!result) {
      return sendError(res, { status: 400, code: 'BAD_REQUEST', message: 'Event deletion failed' });
    }

    return sendSuccess(res, null, { meta: { message: 'Event deleted successfully' } });
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while deleting survey');
  }
}

/**
 * Update survey configuration
 * PATCH /api/v1/surveys/:id/config
 */
async function updateSurveyConfig(req, res) {
  try {
    const result = await surveyService.updateSurveyConfig(req.params.id, req.body);

    return sendSuccess(res, result, { meta: { message: 'Survey configuration updated successfully' } });
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while updating configuration');
  }
}

/**
 * Generate survey preview
 * GET /api/v1/surveys/:id/preview
 */
async function generatePreview(req, res) {
  try {
    const preview = await surveyService.generatePreview(req.params.id);

    if (!preview) {
      return sendError(res, { status: 404, code: 'NOT_FOUND', message: 'Survey not found' });
    }

    return sendSuccess(res, preview);
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while generating preview');
  }
}

/**
 * Generate survey link
 * POST /api/v1/surveys/:id/link
 */
async function generateSurveyLink(req, res) {
  try {
    const { shortenUrl } = req.body;
    const result = await surveyService.generateSurveyLink(req.params.id, shortenUrl);

    return sendSuccess(res, { surveyLink: result.surveyLink, shortenedLink: result.shortenedLink });
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while generating link');
  }
}

/**
 * Generate QR code
 * POST /api/v1/surveys/:id/qrcode
 */
async function generateQRCode(req, res) {
  try {
    const result = await surveyService.generateQRCode(req.params.id);

    return sendSuccess(res, { qrCodeDataUrl: result });
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while generating QR code');
  }
}

/**
 * Generate embed code
 * POST /api/v1/surveys/:id/embed
 */
async function generateEmbedCode(req, res) {
  try {
    const result = await surveyService.generateEmbedCode(req.params.id);

    return sendSuccess(res, { embedCode: result });
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while generating embed code');
  }
}

/**
 * Schedule blast
 * POST /api/v1/surveys/:id/schedule-blast
 */
async function scheduleBlast(req, res) {
  try {
    const request = {
      ...req.body,
      surveyId: req.params.id,
      createdBy: req.user?.userId
    };

    const result = await surveyService.scheduleBlast(request);

    return sendCreated(res, result, { meta: { message: 'Blast scheduled successfully' } });
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while scheduling blast');
  }
}

/**
 * Schedule reminder
 * POST /api/v1/surveys/:id/schedule-reminder
 */
async function scheduleReminder(req, res) {
  try {
    const request = {
      ...req.body,
      surveyId: req.params.id,
      createdBy: req.user?.userId
    };

    const result = await surveyService.scheduleReminder(request);

    return sendCreated(res, result, { meta: { message: 'Reminder scheduled successfully' } });
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while scheduling reminder');
  }
}

/**
 * Get scheduled operations
 * GET /api/v1/surveys/:id/scheduled-operations
 */
async function getScheduledOperations(req, res) {
  try {
    const { type, status } = req.query;

    const filter = {};
    if (type) filter.operationType = type;
    if (status) filter.status = status;

    const operations = await surveyService.getScheduledOperations(req.params.id, filter);

    return sendSuccess(res, operations);
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while fetching scheduled operations');
  }
}

/**
 * Cancel scheduled operation
 * DELETE /api/v1/surveys/scheduled-operations/:operationId
 */
async function cancelScheduledOperation(req, res) {
  try {
    const result = await surveyService.cancelScheduledOperation(req.params.operationId);

    return sendSuccess(res, result, { meta: { message: 'Scheduled operation cancelled successfully' } });
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while cancelling operation');
  }
}

async function retryScheduledOperation(req, res) {
  try {
    const result = await surveyService.retryScheduledOperation(req.params.operationId);

    // Trigger processor immediately so email is sent right now
    scheduledOperationsProcessor.triggerProcessing().catch((err) => {
      logger.error('Immediate trigger after retry failed:', err);
    });

    return sendSuccess(res, result, { meta: { message: 'Email sedang dikirim ulang' } });
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while retrying operation');
  }
}

/**
 * Upload hero image
 * POST /api/v1/surveys/:id/upload/hero
 */
async function uploadHeroImage(req, res) {
  try {
    if (!req.file) {
      return sendError(res, { status: 400, code: 'BAD_REQUEST', message: 'Image file is required' });
    }

    const result = await surveyService.uploadHeroImage(req.params.id, req.file);

    return sendSuccess(res, { imageUrl: result.HeroImageUrl }, { meta: { message: 'Hero image uploaded successfully' } });
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while uploading image');
  }
}

/**
 * Upload logo
 * POST /api/v1/surveys/:id/upload/logo
 */
async function uploadLogo(req, res) {
  try {
    if (!req.file) {
      return sendError(res, { status: 400, code: 'BAD_REQUEST', message: 'Image file is required' });
    }

    const result = await surveyService.uploadLogo(req.params.id, req.file);

    return sendSuccess(res, { imageUrl: result.LogoUrl }, { meta: { message: 'Logo uploaded successfully' } });
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while uploading logo');
  }
}

/**
 * Upload background image
 * POST /api/v1/surveys/:id/upload/background
 */
async function uploadBackgroundImage(req, res) {
  try {
    if (!req.file) {
      return sendError(res, { status: 400, code: 'BAD_REQUEST', message: 'Image file is required' });
    }

    const result = await surveyService.uploadBackgroundImage(req.params.id, req.file);

    return sendSuccess(res, { imageUrl: result.BackgroundImageUrl }, { meta: { message: 'Background image uploaded successfully' } });
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while uploading background image');
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
      return sendError(res, { status: 400, code: 'BAD_REQUEST', message: 'Invalid short code' });
    }

    const result = await surveyService.resolveSurveyShortCode(code);

    if (!result) {
      return sendError(res, { status: 404, code: 'NOT_FOUND', message: 'Survey not found' });
    }

    return sendSuccess(res, { surveyId: result.surveyId, slug: result.slug });
  } catch (error) {
    logger.error('Resolve short code error:', error);
    return sendError(res, { status: 500, message: 'Internal server error' });
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
    return sendSuccess(res, events);
  } catch (error) {
    return handleControllerError(res, error, 'Gagal memuat events');
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
        return sendError(res, { status: 404, code: 'NOT_FOUND', message: 'Event not found or you do not have access to this event' });
      }
    }

    return sendSuccess(res, event);
  } catch (error) {
    return handleControllerError(res, error, 'Gagal memuat event');
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
      return sendValidationErrors(res, errors);
    }

    // Defensive: try multiple property names for userId
    const createdBy = req.user?.userId || req.user?.UserId || req.user?.id;

    if (!createdBy) {
      logger.error('CreateEvent: Unable to determine userId from req.user', {
        reqUser: req.user,
        hasReqUser: !!req.user,
        userKeys: req.user ? Object.keys(req.user) : []
      });
      return sendError(res, { status: 401, code: 'UNAUTHENTICATED', message: 'Autentikasi gagal' });
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

    return sendCreated(res, result, { meta: { message: 'Event created successfully' } });
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

    return handleControllerError(res, error, 'Gagal membuat event');
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
      return sendValidationErrors(res, errors);
    }

    const updates = {
      ...req.body,
      updatedBy: req.user?.userId,
    };

    const result = await surveyService.updateEvent(req.params.id, updates);

    return sendSuccess(res, result, { meta: { message: 'Event updated successfully' } });
  } catch (error) {
    return handleControllerError(res, error, 'Gagal mengubah event');
  }
}

/**
 * Delete an event
 * DELETE /api/v1/events/:id
 */
async function deleteEvent(req, res) {
  try {
    await surveyService.deleteEvent(req.params.id);
    return sendSuccess(res, null, { meta: { message: 'Event deleted successfully' } });
  } catch (error) {
    return handleControllerError(res, error, 'Gagal menghapus event');
  }
}

async function getEventSurveys(req, res) {
  try {
    const { eventId } = req.params;
    const filter = { eventId };
    if (req.query.status) filter.status = req.query.status;
    const surveys = await surveyService.getSurveys(filter);
    return sendSuccess(res, surveys);
  } catch (error) {
    return handleControllerError(res, error, 'Gagal memuat survey event');
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
      return sendValidationErrors(res, errors);
    }

    const surveyData = {
      ...req.body,
      eventId: req.params.eventId,
      createdBy: req.user?.userId
    };

    const result = await surveyService.createSurvey(surveyData);
    return sendCreated(res, result, { meta: { message: 'Survey created successfully' } });
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while creating survey');
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
