const { body, param, query, validationResult } = require('express-validator');
const doorprizeService = require('../services/doorprizeService');
const logger = require('../config/logger');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ---------------------------------------------------------------------------
// Multer configuration for doorprize image uploads
// ---------------------------------------------------------------------------

const allowedImageMimeTypes = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp'
];

const DOORPRIZE_UPLOAD_DIR = path.join(__dirname, '../../public/uploads/doorprize');

// Ensure upload directory exists
if (!fs.existsSync(DOORPRIZE_UPLOAD_DIR)) {
  fs.mkdirSync(DOORPRIZE_UPLOAD_DIR, { recursive: true });
}

const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, DOORPRIZE_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `doorprize-${uniqueSuffix}${ext}`);
  }
});

const imageUpload = multer({
  storage: imageStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1
  },
  fileFilter: (req, file, cb) => {
    if (!allowedImageMimeTypes.includes(file.mimetype)) {
      const error = new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed');
      error.statusCode = 400;
      return cb(error);
    }
    cb(null, true);
  }
});

const spreadsheetUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];
    if (!allowedMimes.includes(file.mimetype)) {
      const error = new Error('Invalid file type. Only Excel files (.xlsx, .xls) are allowed');
      error.statusCode = 400;
      return cb(error);
    }
    cb(null, true);
  }
});

// ---------------------------------------------------------------------------
// Multer configuration for ZIP photo uploads (memory storage, 50MB limit)
// ---------------------------------------------------------------------------

const zipUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 1
  },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === 'application/zip' ||
      file.mimetype === 'application/x-zip-compressed' ||
      file.originalname.endsWith('.zip')
    ) {
      cb(null, true);
    } else {
      const error = new Error('Only ZIP files are allowed');
      error.statusCode = 400;
      cb(error);
    }
  }
});

// ---------------------------------------------------------------------------
// Validation rules
// ---------------------------------------------------------------------------

const eventIdParam = param('id')
  .trim()
  .notEmpty().withMessage('Event ID is required')
  .isInt({ min: 1 }).withMessage('Event ID must be a positive integer');

const giftIdParam = param('id')
  .trim()
  .notEmpty().withMessage('Gift ID is required')
  .isInt({ min: 1 }).withMessage('Gift ID must be a positive integer');

const participantIdParam = param('id')
  .trim()
  .notEmpty().withMessage('Participant ID is required')
  .isInt({ min: 1 }).withMessage('Participant ID must be a positive integer');

const resultIdParam = param('id')
  .trim()
  .notEmpty().withMessage('Result ID is required')
  .isInt({ min: 1 }).withMessage('Result ID must be a positive integer');

const createEventValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ max: 500 }).withMessage('Name must be at most 500 characters'),
  body('eventDate')
    .notEmpty().withMessage('Event date is required')
    .isISO8601().withMessage('Event date must be a valid ISO 8601 date'),
  body('status')
    .optional()
    .isIn(['Draft', 'Active', 'Completed', 'Archived']).withMessage('Invalid status value')
];

const updateEventValidation = [
  eventIdParam,
  body('name')
    .optional()
    .trim()
    .notEmpty().withMessage('Name cannot be empty')
    .isLength({ max: 500 }).withMessage('Name must be at most 500 characters'),
  body('eventDate')
    .optional()
    .isISO8601().withMessage('Event date must be a valid ISO 8601 date'),
  body('status')
    .optional()
    .isIn(['Draft', 'Active', 'Completed', 'Archived']).withMessage('Invalid status value')
];

const createGiftValidation = [
  eventIdParam,
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ max: 500 }).withMessage('Name must be at most 500 characters'),
  body('quota')
    .notEmpty().withMessage('Quota is required')
    .isInt({ min: 1 }).withMessage('Quota must be a positive integer greater than 0'),
  body('giftBy')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('GiftBy must be at most 200 characters'),
  body('drawTime')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('DrawTime must be at most 100 characters'),
  body('displayOrder')
    .optional()
    .isInt().withMessage('DisplayOrder must be an integer')
];

const updateGiftValidation = [
  giftIdParam,
  body('name')
    .optional()
    .trim()
    .notEmpty().withMessage('Name cannot be empty')
    .isLength({ max: 500 }).withMessage('Name must be at most 500 characters'),
  body('quota')
    .optional()
    .isInt({ min: 1 }).withMessage('Quota must be a positive integer greater than 0'),
  body('giftBy')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('GiftBy must be at most 200 characters'),
  body('drawTime')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('DrawTime must be at most 100 characters'),
  body('displayOrder')
    .optional()
    .isInt().withMessage('DisplayOrder must be an integer')
];

const createParticipantValidation = [
  eventIdParam,
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ max: 200 }).withMessage('Name must be at most 200 characters'),
  body('employeeCode')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('Employee code must be at most 50 characters'),
  body('phone')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('Phone must be at most 50 characters'),
  body('email')
    .optional()
    .trim()
    .isLength({ max: 255 }).withMessage('Email must be at most 255 characters'),
  body('unit')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('Unit must be at most 200 characters'),
  body('isActive')
    .optional()
    .isBoolean().withMessage('IsActive must be a boolean')
];

const updateParticipantValidation = [
  participantIdParam,
  body('name')
    .optional()
    .trim()
    .notEmpty().withMessage('Name cannot be empty')
    .isLength({ max: 200 }).withMessage('Name must be at most 200 characters'),
  body('employeeCode')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('Employee code must be at most 50 characters'),
  body('phone')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('Phone must be at most 50 characters'),
  body('email')
    .optional()
    .trim()
    .isLength({ max: 255 }).withMessage('Email must be at most 255 characters'),
  body('unit')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('Unit must be at most 200 characters'),
  body('isActive')
    .optional()
    .isBoolean().withMessage('IsActive must be a boolean')
];

const executeDrawValidation = [
  eventIdParam,
  body('giftId')
    .notEmpty().withMessage('Gift ID is required')
    .isInt({ min: 1 }).withMessage('Gift ID must be a positive integer')
];

// ---------------------------------------------------------------------------
// Helper: Handle service errors with consistent status codes
// ---------------------------------------------------------------------------

function handleServiceError(res, error, defaultMessage) {
  if (error?.statusCode) {
    return res.status(error.statusCode).json({
      success: false,
      error: error.name || 'Request failed',
      message: error.message
    });
  }

  logger.error(defaultMessage, error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: defaultMessage
  });
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

/**
 * GET /api/doorprize/events
 * List all doorprize events (paginated)
 */
async function getDoorprizeEvents(req, res) {
  try {
    const { page, limit, status } = req.query;
    const result = await doorprizeService.getAllEvents({ page, limit, status });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    handleServiceError(res, error, 'An error occurred while fetching doorprize events');
  }
}

/**
 * GET /api/doorprize/events/:id
 * Get doorprize event by ID
 */
async function getDoorprizeEventById(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const event = await doorprizeService.getEventById(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Not found',
        message: 'Doorprize event not found'
      });
    }

    res.json({
      success: true,
      event
    });
  } catch (error) {
    handleServiceError(res, error, 'An error occurred while fetching doorprize event');
  }
}

/**
 * POST /api/doorprize/events
 * Create a new doorprize event
 */
async function createDoorprizeEvent(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const imagePath = req.file
      ? `uploads/doorprize/${req.file.filename}`
      : null;

    const eventData = {
      name: req.body.name,
      eventDate: req.body.eventDate,
      status: req.body.status || 'Draft',
      imagePath,
      createdBy: req.user?.userId,
      parentEventId: req.body.parentEventId || null
    };

    const event = await doorprizeService.createEvent(eventData);

    res.status(201).json({
      success: true,
      message: 'Doorprize event created successfully',
      event
    });
  } catch (error) {
    handleServiceError(res, error, 'An error occurred while creating doorprize event');
  }
}

/**
 * PUT /api/doorprize/events/:id
 * Update a doorprize event
 */
async function updateDoorprizeEvent(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const updateData = {};
    if (req.body.name !== undefined) updateData.name = req.body.name;
    if (req.body.eventDate !== undefined) updateData.eventDate = req.body.eventDate;
    if (req.body.status !== undefined) updateData.status = req.body.status;

    if (req.file) {
      updateData.imagePath = `uploads/doorprize/${req.file.filename}`;
    } else if (req.body.imagePath !== undefined) {
      updateData.imagePath = req.body.imagePath;
    }

    const event = await doorprizeService.updateEvent(req.params.id, updateData);

    res.json({
      success: true,
      message: 'Doorprize event updated successfully',
      event
    });
  } catch (error) {
    handleServiceError(res, error, 'An error occurred while updating doorprize event');
  }
}

/**
 * DELETE /api/doorprize/events/:id
 * Delete a doorprize event
 */
async function deleteDoorprizeEvent(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    await doorprizeService.deleteEvent(req.params.id);

    res.json({
      success: true,
      message: 'Doorprize event deleted successfully'
    });
  } catch (error) {
    handleServiceError(res, error, 'An error occurred while deleting doorprize event');
  }
}

// ---------------------------------------------------------------------------
// Gift handlers
// ---------------------------------------------------------------------------

/**
 * GET /api/doorprize/events/:id/gifts
 * List gifts for an event
 */
async function getGifts(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const gifts = await doorprizeService.getGiftsByEvent(req.params.id);

    res.json({
      success: true,
      gifts
    });
  } catch (error) {
    handleServiceError(res, error, 'An error occurred while fetching gifts');
  }
}

/**
 * POST /api/doorprize/events/:id/gifts
 * Create a gift for an event
 */
async function createGift(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const imagePath = req.file
      ? `uploads/doorprize/${req.file.filename}`
      : null;

    const giftData = {
      doorprizeEventId: req.params.id,
      name: req.body.name,
      quota: req.body.quota,
      giftBy: req.body.giftBy || null,
      drawTime: req.body.drawTime || null,
      displayOrder: req.body.displayOrder || 0,
      imagePath
    };

    const gift = await doorprizeService.createGift(giftData);

    res.status(201).json({
      success: true,
      message: 'Gift created successfully',
      gift
    });
  } catch (error) {
    handleServiceError(res, error, 'An error occurred while creating gift');
  }
}

/**
 * PUT /api/doorprize/gifts/:id
 * Update a gift
 */
async function updateGift(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const updateData = {};
    if (req.body.name !== undefined) updateData.name = req.body.name;
    if (req.body.quota !== undefined) updateData.quota = req.body.quota;
    if (req.body.giftBy !== undefined) updateData.giftBy = req.body.giftBy;
    if (req.body.drawTime !== undefined) updateData.drawTime = req.body.drawTime;
    if (req.body.displayOrder !== undefined) updateData.displayOrder = req.body.displayOrder;

    if (req.file) {
      updateData.imagePath = `uploads/doorprize/${req.file.filename}`;
    } else if (req.body.imagePath !== undefined) {
      updateData.imagePath = req.body.imagePath;
    }

    const gift = await doorprizeService.updateGift(req.params.id, updateData);

    res.json({
      success: true,
      message: 'Gift updated successfully',
      gift
    });
  } catch (error) {
    handleServiceError(res, error, 'An error occurred while updating gift');
  }
}

/**
 * DELETE /api/doorprize/gifts/:id
 * Delete a gift
 */
async function deleteGift(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    await doorprizeService.deleteGift(req.params.id);

    res.json({
      success: true,
      message: 'Gift deleted successfully'
    });
  } catch (error) {
    handleServiceError(res, error, 'An error occurred while deleting gift');
  }
}

// ---------------------------------------------------------------------------
// Participant handlers
// ---------------------------------------------------------------------------

/**
 * GET /api/doorprize/events/:id/participants
 * List participants for an event (paginated)
 */
async function getParticipants(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { page, limit, search, isActive } = req.query;
    const result = await doorprizeService.getParticipantsByEvent(req.params.id, {
      page,
      limit,
      search,
      isActive
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    handleServiceError(res, error, 'An error occurred while fetching participants');
  }
}

/**
 * POST /api/doorprize/events/:id/participants
 * Create a participant for an event
 */
async function createParticipant(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const imagePath = req.file
      ? `uploads/doorprize/${req.file.filename}`
      : null;

    const participantData = {
      doorprizeEventId: req.params.id,
      name: req.body.name,
      employeeCode: req.body.employeeCode || null,
      phone: req.body.phone || null,
      email: req.body.email || null,
      unit: req.body.unit || null,
      isActive: req.body.isActive !== undefined ? req.body.isActive : true,
      imagePath
    };

    const participant = await doorprizeService.createParticipant(participantData);

    res.status(201).json({
      success: true,
      message: 'Participant created successfully',
      participant
    });
  } catch (error) {
    handleServiceError(res, error, 'An error occurred while creating participant');
  }
}

/**
 * PUT /api/doorprize/participants/:id
 * Update a participant
 */
async function updateParticipant(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const updateData = {};
    if (req.body.name !== undefined) updateData.name = req.body.name;
    if (req.body.employeeCode !== undefined) updateData.employeeCode = req.body.employeeCode;
    if (req.body.phone !== undefined) updateData.phone = req.body.phone;
    if (req.body.email !== undefined) updateData.email = req.body.email;
    if (req.body.unit !== undefined) updateData.unit = req.body.unit;
    if (req.body.isActive !== undefined) updateData.isActive = req.body.isActive;

    if (req.file) {
      updateData.imagePath = `uploads/doorprize/${req.file.filename}`;
    } else if (req.body.imagePath !== undefined) {
      updateData.imagePath = req.body.imagePath;
    }

    const participant = await doorprizeService.updateParticipant(req.params.id, updateData);

    res.json({
      success: true,
      message: 'Participant updated successfully',
      participant
    });
  } catch (error) {
    handleServiceError(res, error, 'An error occurred while updating participant');
  }
}

/**
 * DELETE /api/doorprize/participants/:id
 * Delete a participant
 */
async function deleteParticipant(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    await doorprizeService.deleteParticipant(req.params.id);

    res.json({
      success: true,
      message: 'Participant deleted successfully'
    });
  } catch (error) {
    handleServiceError(res, error, 'An error occurred while deleting participant');
  }
}

/**
 * POST /api/doorprize/events/:id/participants/import
 * Import participants from Excel file
 */
async function importParticipants(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: 'Excel file is required'
      });
    }

    const result = await doorprizeService.importFromExcel(req.params.id, req.file.buffer);

    res.json({
      success: true,
      message: `Import completed: ${result.imported} imported, ${result.skipped} skipped`,
      ...result
    });
  } catch (error) {
    handleServiceError(res, error, 'An error occurred while importing participants');
  }
}

/**
 * POST /api/doorprize/events/:id/participants/photos
 * Upload a ZIP file containing participant photos.
 * Filenames (without extension) are matched to participant EmployeeCode.
 */
async function uploadParticipantPhotos(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: 'ZIP file is required'
      });
    }

    const result = await doorprizeService.uploadParticipantPhotos(req.params.id, req.file.buffer);

    res.json({
      success: true,
      message: `Photo upload completed: ${result.matched} matched, ${result.unmatched.length} unmatched`,
      ...result
    });
  } catch (error) {
    handleServiceError(res, error, 'An error occurred while uploading participant photos');
  }
}

/**
 * GET /api/doorprize/events/:id/participants/template
 * Download import template (Excel)
 */
async function downloadImportTemplate(req, res) {
  try {
    const buffer = await doorprizeService.generateImportTemplate();

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="doorprize-participant-template.xlsx"'
    );

    res.send(buffer);
  } catch (error) {
    handleServiceError(res, error, 'An error occurred while generating import template');
  }
}

// ---------------------------------------------------------------------------
// Draw handlers
// ---------------------------------------------------------------------------

/**
 * GET /api/doorprize/events/:id/draw-state
 * Get the draw state for an event
 */
async function getDrawState(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const drawState = await doorprizeService.getDrawState(req.params.id);

    res.json({
      success: true,
      ...drawState
    });
  } catch (error) {
    handleServiceError(res, error, 'An error occurred while fetching draw state');
  }
}

/**
 * POST /api/doorprize/events/:id/draw
 * Execute a draw for a specific gift
 */
async function executeDraw(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { giftId } = req.body;
    const eventId = req.params.id;
    const userId = req.user?.userId;

    const drawResult = await doorprizeService.executeDraw(eventId, giftId, userId);

    res.status(201).json({
      success: true,
      message: 'Draw executed successfully',
      ...drawResult
    });
  } catch (error) {
    handleServiceError(res, error, 'An error occurred while executing draw');
  }
}

/**
 * DELETE /api/doorprize/results/:id
 * Reset (delete) a draw result
 */
async function resetDrawResult(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    await doorprizeService.resetResult(req.params.id);

    res.json({
      success: true,
      message: 'Draw result reset successfully'
    });
  } catch (error) {
    handleServiceError(res, error, 'An error occurred while resetting draw result');
  }
}

// ---------------------------------------------------------------------------
// Export handler
// ---------------------------------------------------------------------------

/**
 * GET /api/doorprize/events/:id/export
 * Export event data to Excel
 */
async function exportEventData(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const buffer = await doorprizeService.exportToExcel(req.params.id);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="doorprize-export-${req.params.id}.xlsx"`
    );

    res.send(buffer);
  } catch (error) {
    handleServiceError(res, error, 'An error occurred while exporting event data');
  }
}

// ---------------------------------------------------------------------------
// Public handlers (no auth required)
// ---------------------------------------------------------------------------

/**
 * GET /api/public/doorprize/events/:id/results
 * Get public draw results — participant name + unit + gift name only (no PII)
 * Supports delta polling via ?after={lastId}
 */
async function getPublicResults(req, res) {
  try {
    const eventId = req.params.id;

    // Validate eventId is a positive integer
    const id = Number(eventId);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: 'Event ID must be a positive integer'
      });
    }

    const options = {};
    if (req.query.after !== undefined) {
      options.afterId = req.query.after;
    }

    const result = await doorprizeService.getPublicResults(eventId, options);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    handleServiceError(res, error, 'An error occurred while fetching public results');
  }
}

/**
 * GET /api/public/doorprize/events/:id/info
 * Get public event info — event name + gifts summary only (no PII, no internal IDs)
 */
async function getPublicEventInfo(req, res) {
  try {
    const eventId = req.params.id;

    // Validate eventId is a positive integer
    const id = Number(eventId);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: 'Event ID must be a positive integer'
      });
    }

    const result = await doorprizeService.getPublicEventInfo(eventId);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    handleServiceError(res, error, 'An error occurred while fetching public event info');
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  // Event handlers
  getDoorprizeEvents,
  getDoorprizeEventById,
  createDoorprizeEvent,
  updateDoorprizeEvent,
  deleteDoorprizeEvent,

  // Gift handlers
  getGifts,
  createGift,
  updateGift,
  deleteGift,

  // Participant handlers
  getParticipants,
  createParticipant,
  updateParticipant,
  deleteParticipant,
  importParticipants,
  uploadParticipantPhotos,
  downloadImportTemplate,

  // Draw handlers
  getDrawState,
  executeDraw,
  resetDrawResult,

  // Export handler
  exportEventData,

  // Public handlers (no auth)
  getPublicResults,
  getPublicEventInfo,

  // Multer middlewares (for route registration)
  imageUpload,
  spreadsheetUpload,
  zipUpload,

  // Validation rules (for route registration)
  eventIdParam,
  giftIdParam,
  participantIdParam,
  resultIdParam,
  createEventValidation,
  updateEventValidation,
  createGiftValidation,
  updateGiftValidation,
  createParticipantValidation,
  updateParticipantValidation,
  executeDrawValidation
};
