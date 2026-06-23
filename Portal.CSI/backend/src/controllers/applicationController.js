const { body, param, validationResult } = require('express-validator');
const applicationService = require('../services/applicationService');
const ExcelJS = require('exceljs');
const logger = require('../config/logger');

function handleServiceError(res, error, fallbackMessage) {
  const statusCode = error.statusCode || 500;
  if (statusCode >= 500) {
    logger.error(fallbackMessage, error);
    return res.status(500).json({
      error: 'Internal server error',
      message: fallbackMessage
    });
  }

  return res.status(statusCode).json({
    error: error.name || 'Request failed',
    message: fallbackMessage
  });
}

/**
 * Validation rules for creating an application
 */
const createApplicationValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 1, max: 200 }).withMessage('Name must be between 1 and 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Description must not exceed 500 characters'),
  body('isActive')
    .optional()
    .isBoolean().withMessage('isActive must be boolean')
];

/**
 * Validation rules for updating an application
 */
const updateApplicationValidation = [
  param('id').isInt({ min: 1 }).withMessage('id must be a valid integer'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 }).withMessage('Name must be between 1 and 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Description must not exceed 500 characters')
];

/**
 * Create a new application
 * POST /api/v1/applications
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function createApplication(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Validasi tidak valid'
      });
    }

    const applicationData = req.body;
    const application = await applicationService.createApplication(applicationData);

    res.status(201).json({
      success: true,
      message: 'Application created successfully',
      application
    });

  } catch (error) {
    return handleServiceError(res, error, 'An error occurred while creating application');
  }
}

/**
 * Get all applications
 * GET /api/v1/applications
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getApplications(req, res) {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const applications = await applicationService.getApplications({ includeInactive });

    res.json({
      success: true,
      applications
    });

  } catch (error) {
    logger.error('Get applications controller error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Gagal memuat applications'
    });
  }
}

/**
 * Get application by ID
 * GET /api/v1/applications/:id
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getApplicationById(req, res) {
  try {
    const applicationId = parseInt(req.params.id, 10);
    const application = await applicationService.getApplicationById(applicationId);

    if (!application) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Application not found'
      });
    }

    res.json({
      success: true,
      application
    });

  } catch (error) {
    logger.error('Get application by ID controller error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Gagal memuat application'
    });
  }
}

/**
 * Update application
 * PUT /api/v1/applications/:id
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function updateApplication(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Validasi tidak valid'
      });
    }

    const applicationId = parseInt(req.params.id, 10);
    const updates = req.body;

    const application = await applicationService.updateApplication(applicationId, updates);

    res.json({
      success: true,
      message: 'Application updated successfully',
      application
    });

  } catch (error) {
    return handleServiceError(res, error, 'An error occurred while updating application');
  }
}

/**
 * Delete application
 * DELETE /api/v1/applications/:id
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function deleteApplication(req, res) {
  try {
    const applicationId = parseInt(req.params.id, 10);
    await applicationService.deleteApplication(applicationId);

    res.json({
      success: true,
      message: 'Application deleted successfully'
    });

  } catch (error) {
    return handleServiceError(res, error, 'An error occurred while deleting application');
  }
}

/**
 * Download Excel template for bulk upload
 * GET /api/v1/applications/template
 */
async function downloadTemplate(req, res) {
  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Applications');

    // Column order matches form modal: App Name, Description, Status
    sheet.columns = [
      { header: 'App Name', key: 'name', width: 40 },
      { header: 'Description', key: 'description', width: 50 },
      { header: 'Status', key: 'status', width: 15 },
    ];

    sheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // Sample data
    sheet.addRow({ name: 'B2B Ordering', description: 'Business to Business ordering system', status: 'Active' });
    sheet.addRow({ name: 'ERP System', description: 'Enterprise Resource Planning', status: 'Active' });
    sheet.addRow({ name: 'AOP Portal', description: '', status: 'Active' }); // App without description

    sheet.addRow([]);
    const noteRow = sheet.addRow(['Catatan: App Name wajib diisi dan harus unik. Description bersifat opsional (boleh kosong). Kolom Status diisi Active atau Inactive. App Code di-generate otomatis.']);
    noteRow.getCell(1).font = { italic: true, color: { argb: 'FF6B7280' } };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="master-aplikasi-template.xlsx"');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    logger.error('Download Application template error:', error);
    res.status(500).json({ success: false, message: 'Gagal generate template' });
  }
}

/**
 * Upload bulk applications from Excel
 * POST /api/v1/applications/upload
 */
async function uploadApplications(req, res) {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, message: 'File tidak ditemukan' });
    }

    const { BulkImportService } = require('../services/bulkImportService');
    const importSvc = new BulkImportService();
    const result = await importSvc.importData(req.file.buffer, 'Application');

    return res.json({
      success: true,
      message: `Import selesai. Berhasil: ${result.imported + result.updated}, Gagal: ${result.failed}`,
      imported: result.imported,
      updated: result.updated,
      failed: result.failed,
      errors: result.errors,
    });
  } catch (error) {
    logger.error('Upload Application error:', error);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Gagal upload data Aplikasi',
      errors: error.details || error.errors || [],
    });
  }
}

module.exports = {
  createApplication,
  getApplications,
  getApplicationById,
  updateApplication,
  deleteApplication,
  downloadTemplate,
  uploadApplications,
  createApplicationValidation,
  updateApplicationValidation
};
