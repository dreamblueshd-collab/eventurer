const { body, param, validationResult } = require('express-validator');
const applicationService = require('../services/applicationService');
const ExcelJS = require('exceljs');
const logger = require('../config/logger');
const { sendSuccess, sendCreated, sendError } = require('../utils/apiResponse');
const { handleControllerError, sendValidationErrors } = require('../utils/controllerError');

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
 */
async function createApplication(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendValidationErrors(res, errors);
    }

    const application = await applicationService.createApplication(req.body);

    return sendCreated(res, application, { meta: { message: 'Application created successfully' } });
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while creating application');
  }
}

/**
 * Get all applications
 * GET /api/v1/applications
 */
async function getApplications(req, res) {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const applications = await applicationService.getApplications({ includeInactive });

    return sendSuccess(res, applications);
  } catch (error) {
    return handleControllerError(res, error, 'Gagal memuat applications');
  }
}

/**
 * Get application by ID
 * GET /api/v1/applications/:id
 */
async function getApplicationById(req, res) {
  try {
    const applicationId = parseInt(req.params.id, 10);
    const application = await applicationService.getApplicationById(applicationId);

    if (!application) {
      return sendError(res, { status: 404, code: 'NOT_FOUND', message: 'Application not found' });
    }

    return sendSuccess(res, application);
  } catch (error) {
    return handleControllerError(res, error, 'Gagal memuat application');
  }
}

/**
 * Update application
 * PUT /api/v1/applications/:id
 */
async function updateApplication(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendValidationErrors(res, errors);
    }

    const applicationId = parseInt(req.params.id, 10);
    const application = await applicationService.updateApplication(applicationId, req.body);

    return sendSuccess(res, application, { meta: { message: 'Application updated successfully' } });
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while updating application');
  }
}

/**
 * Delete application
 * DELETE /api/v1/applications/:id
 */
async function deleteApplication(req, res) {
  try {
    const applicationId = parseInt(req.params.id, 10);
    await applicationService.deleteApplication(applicationId);

    return sendSuccess(res, null, { meta: { message: 'Application deleted successfully' } });
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while deleting application');
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
    return sendError(res, { status: 500, message: 'Gagal generate template' });
  }
}

/**
 * Upload bulk applications from Excel
 * POST /api/v1/applications/upload
 */
async function uploadApplications(req, res) {
  try {
    if (!req.file || !req.file.buffer) {
      return sendError(res, { status: 400, code: 'BAD_REQUEST', message: 'File tidak ditemukan' });
    }

    const { BulkImportService } = require('../services/bulkImportService');
    const importSvc = new BulkImportService();
    const result = await importSvc.importData(req.file.buffer, 'Application');

    return sendSuccess(res, {
      imported: result.imported,
      updated: result.updated,
      failed: result.failed,
      errors: result.errors,
    }, {
      meta: { message: `Import selesai. Berhasil: ${result.imported + result.updated}, Gagal: ${result.failed}` }
    });
  } catch (error) {
    logger.error('Upload Application error:', error);
    const status = error.statusCode || 500;
    return sendError(res, {
      status,
      message: error.message || 'Gagal upload data Aplikasi',
      details: error.details || error.errors || [],
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
