const { body, param, validationResult } = require('express-validator');
const businessUnitService = require('../services/businessUnitService');
const { BulkImportService } = require('../services/bulkImportService');
const ExcelJS = require('exceljs');
const logger = require('../config/logger');
const { sendSuccess, sendCreated, sendError } = require('../utils/apiResponse');
const { handleControllerError, sendValidationErrors } = require('../utils/controllerError');

/**
 * Validation rules for creating a business unit
 */
const createBusinessUnitValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 1, max: 200 }).withMessage('Name must be between 1 and 200 characters')
];

/**
 * Validation rules for updating a business unit
 */
const updateBusinessUnitValidation = [
  param('id').isInt({ min: 1 }).withMessage('id must be a valid integer'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 }).withMessage('Name must be between 1 and 200 characters'),
  body('isActive')
    .optional()
    .isBoolean().withMessage('isActive must be boolean')
];

/**
 * Create a new business unit
 * POST /api/v1/business-units
 */
async function createBusinessUnit(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendValidationErrors(res, errors);
    }

    const { name } = req.body;
    const businessUnit = await businessUnitService.createBusinessUnit({ name });

    return sendCreated(res, businessUnit, { meta: { message: 'Business unit created successfully' } });
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while creating business unit');
  }
}

/**
 * Get all business units
 * GET /api/v1/business-units
 */
async function getBusinessUnits(req, res) {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const businessUnits = await businessUnitService.getBusinessUnits({ includeInactive });

    return sendSuccess(res, businessUnits);
  } catch (error) {
    return handleControllerError(res, error, 'Gagal memuat business units');
  }
}

/**
 * Get business unit by ID
 * GET /api/v1/business-units/:id
 */
async function getBusinessUnitById(req, res) {
  try {
    const buId = parseInt(req.params.id, 10);
    const businessUnit = await businessUnitService.getBusinessUnitById(buId);

    if (!businessUnit) {
      return sendError(res, { status: 404, code: 'NOT_FOUND', message: 'Business unit not found' });
    }

    return sendSuccess(res, businessUnit);
  } catch (error) {
    return handleControllerError(res, error, 'Gagal memuat business unit');
  }
}

/**
 * Update business unit
 * PUT /api/v1/business-units/:id
 */
async function updateBusinessUnit(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendValidationErrors(res, errors);
    }

    const buId = parseInt(req.params.id, 10);
    const businessUnit = await businessUnitService.updateBusinessUnit(buId, req.body);

    return sendSuccess(res, businessUnit, { meta: { message: 'Business unit updated successfully' } });
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while updating business unit');
  }
}

/**
 * Delete business unit
 * DELETE /api/v1/business-units/:id
 */
async function deleteBusinessUnit(req, res) {
  try {
    const buId = parseInt(req.params.id, 10);
    await businessUnitService.deleteBusinessUnit(buId);

    return sendSuccess(res, null, { meta: { message: 'Business unit deleted successfully' } });
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while deleting business unit');
  }
}

/**
 * Download Excel template for bulk upload
 * GET /api/v1/business-units/template
 */
async function downloadTemplate(req, res) {
  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Business Units');

    // Column order matches form modal: BU Name, Status
    sheet.columns = [
      { header: 'BU Name', key: 'name', width: 40 },
      { header: 'Status', key: 'status', width: 15 },
    ];

    // Header style
    sheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // Example rows
    sheet.addRow({ name: 'Corporate HO', status: 'Active' });
    sheet.addRow({ name: 'Main Dealer Jakarta', status: 'Active' });
    sheet.addRow({ name: 'Main Dealer Bandung', status: 'Active' });

    // Note row
    sheet.addRow([]);
    const noteRow = sheet.addRow(['Catatan: BU Name wajib diisi dan harus unik. Kolom Status diisi Active atau Inactive. BU Code di-generate otomatis.']);
    noteRow.getCell(1).font = { italic: true, color: { argb: 'FF6B7280' } };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="master-bu-template.xlsx"');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    logger.error('Download BU template error:', error);
    return sendError(res, { status: 500, message: 'Gagal generate template' });
  }
}

/**
 * Upload bulk business units from Excel
 * POST /api/v1/business-units/upload
 */
async function uploadBusinessUnits(req, res) {
  try {
    if (!req.file || !req.file.buffer) {
      return sendError(res, { status: 400, code: 'BAD_REQUEST', message: 'File tidak ditemukan' });
    }

    const importSvc = new BulkImportService();
    const result = await importSvc.importData(req.file.buffer, 'BusinessUnit');

    return sendSuccess(res, {
      imported: result.imported,
      updated: result.updated,
      failed: result.failed,
      errors: result.errors,
    }, {
      meta: { message: `Import selesai. Berhasil: ${result.imported + result.updated}, Gagal: ${result.failed}` }
    });
  } catch (error) {
    logger.error('Upload BU error:', error);
    const status = error.statusCode || 500;
    return sendError(res, {
      status,
      message: error.message || 'Gagal upload data Business Unit',
      details: error.details || error.errors || [],
    });
  }
}

module.exports = {
  createBusinessUnit,
  getBusinessUnits,
  getBusinessUnitById,
  updateBusinessUnit,
  deleteBusinessUnit,
  downloadTemplate,
  uploadBusinessUnits,
  createBusinessUnitValidation,
  updateBusinessUnitValidation
};
