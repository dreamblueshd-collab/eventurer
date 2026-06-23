const { body, param, validationResult } = require('express-validator');
const divisionService = require('../services/divisionService');
const ExcelJS = require('exceljs');
const logger = require('../config/logger');
const { sendSuccess, sendCreated, sendError } = require('../utils/apiResponse');
const { handleControllerError, sendValidationErrors } = require('../utils/controllerError');

/**
 * Validation rules for creating a division
 */
const createDivisionValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 1, max: 200 }).withMessage('Name must be between 1 and 200 characters'),
  body('businessUnitId')
    .notEmpty().withMessage('Business Unit ID is required')
    .isInt({ min: 1 }).withMessage('Business Unit ID must be a valid integer')
];

/**
 * Validation rules for updating a division
 */
const updateDivisionValidation = [
  param('id').isInt({ min: 1 }).withMessage('id must be a valid integer'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 }).withMessage('Name must be between 1 and 200 characters'),
  body('businessUnitId')
    .optional()
    .isInt({ min: 1 }).withMessage('Business Unit ID must be a valid integer'),
  body('isActive')
    .optional()
    .isBoolean().withMessage('isActive must be boolean')
];

/**
 * Create a new division
 * POST /api/v1/divisions
 */
async function createDivision(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendValidationErrors(res, errors);
    }

    const division = await divisionService.createDivision(req.body);

    return sendCreated(res, division, { meta: { message: 'Division created successfully' } });
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while creating division');
  }
}

/**
 * Get all divisions or divisions by business unit
 * GET /api/v1/divisions?businessUnitId=1
 */
async function getDivisions(req, res) {
  try {
    const { businessUnitId } = req.query;
    const includeInactive = req.query.includeInactive === 'true';

    let divisions;
    if (businessUnitId) {
      divisions = await divisionService.getDivisionsByBusinessUnit(businessUnitId, { includeInactive });
    } else {
      divisions = await divisionService.getDivisions({ includeInactive });
    }

    return sendSuccess(res, divisions);
  } catch (error) {
    return handleControllerError(res, error, 'Gagal memuat divisions');
  }
}

/**
 * Get division by ID
 * GET /api/v1/divisions/:id
 */
async function getDivisionById(req, res) {
  try {
    const divisionId = parseInt(req.params.id, 10);
    const division = await divisionService.getDivisionById(divisionId);

    if (!division) {
      return sendError(res, { status: 404, code: 'NOT_FOUND', message: 'Division not found' });
    }

    return sendSuccess(res, division);
  } catch (error) {
    return handleControllerError(res, error, 'Gagal memuat division');
  }
}

/**
 * Update division
 * PUT /api/v1/divisions/:id
 */
async function updateDivision(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendValidationErrors(res, errors);
    }

    const divisionId = parseInt(req.params.id, 10);
    const division = await divisionService.updateDivision(divisionId, req.body);

    return sendSuccess(res, division, { meta: { message: 'Division updated successfully' } });
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while updating division');
  }
}

/**
 * Delete division
 * DELETE /api/v1/divisions/:id
 */
async function deleteDivision(req, res) {
  try {
    const divisionId = parseInt(req.params.id, 10);
    await divisionService.deleteDivision(divisionId);

    return sendSuccess(res, null, { meta: { message: 'Division deleted successfully' } });
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while deleting division');
  }
}

/**
 * Download Excel template for bulk upload
 * GET /api/v1/divisions/template
 */
async function downloadTemplate(req, res) {
  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Divisions');

    // Column order matches form modal: BU, Divisi Name, Status
    sheet.columns = [
      { header: 'BU Name', key: 'buName', width: 30 },
      { header: 'Divisi Name', key: 'name', width: 40 },
      { header: 'Status', key: 'status', width: 15 },
    ];

    sheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // Sample data from different BUs
    sheet.addRow({ buName: 'Corporate HO', name: 'IT Digital', status: 'Active' });
    sheet.addRow({ buName: 'Corporate HO', name: 'Finance', status: 'Active' });
    sheet.addRow({ buName: 'Main Dealer Jakarta', name: 'Main Dealer Jakarta', status: 'Active' });

    sheet.addRow([]);
    const noteRow = sheet.addRow(['Catatan: BU Name harus sesuai dengan data Business Unit yang ada. Divisi Name wajib diisi. Kolom Status diisi Active atau Inactive. Divisi Code di-generate otomatis.']);
    noteRow.getCell(1).font = { italic: true, color: { argb: 'FF6B7280' } };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="master-divisi-template.xlsx"');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    logger.error('Download Division template error:', error);
    return sendError(res, { status: 500, message: 'Gagal generate template' });
  }
}

/**
 * Upload bulk divisions from Excel
 * POST /api/v1/divisions/upload
 */
async function uploadDivisions(req, res) {
  try {
    if (!req.file || !req.file.buffer) {
      return sendError(res, { status: 400, code: 'BAD_REQUEST', message: 'File tidak ditemukan' });
    }

    const { BulkImportService } = require('../services/bulkImportService');
    const importSvc = new BulkImportService();
    const result = await importSvc.importData(req.file.buffer, 'Division');

    return sendSuccess(res, {
      imported: result.imported,
      updated: result.updated,
      failed: result.failed,
      errors: result.errors,
    }, {
      meta: { message: `Import selesai. Berhasil: ${result.imported + result.updated}, Gagal: ${result.failed}` }
    });
  } catch (error) {
    logger.error('Upload Division error:', error);
    const status = error.statusCode || 500;
    return sendError(res, {
      status,
      message: error.message || 'Gagal upload data Divisi',
      details: error.details || error.errors || [],
    });
  }
}

module.exports = {
  createDivision,
  getDivisions,
  getDivisionById,
  updateDivision,
  deleteDivision,
  downloadTemplate,
  uploadDivisions,
  createDivisionValidation,
  updateDivisionValidation
};
