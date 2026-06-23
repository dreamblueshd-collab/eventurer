const { body, param, validationResult } = require('express-validator');
const functionService = require('../services/functionService');
const ExcelJS = require('exceljs');
const logger = require('../config/logger');
const { sendSuccess, sendCreated, sendError } = require('../utils/apiResponse');
const { handleControllerError, sendValidationErrors } = require('../utils/controllerError');

/**
 * Validation rules for creating a function
 */
const createFunctionValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 1, max: 200 }).withMessage('Name must be between 1 and 200 characters'),
  body('deptId')
    .optional({ nullable: true })
    .isInt({ min: 1 }).withMessage('Department ID must be a valid integer')
];

/**
 * Validation rules for updating a function
 */
const updateFunctionValidation = [
  param('id').isInt({ min: 1 }).withMessage('id must be a valid integer'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 }).withMessage('Name must be between 1 and 200 characters'),
  body('isActive')
    .optional()
    .isBoolean().withMessage('isActive must be boolean'),
  body('deptId')
    .optional({ nullable: true })
    .isInt({ min: 1 }).withMessage('Department ID must be a valid integer')
];

/**
 * Create a new function
 * POST /api/v1/functions
 */
async function createFunction(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendValidationErrors(res, errors);
    }

    const { name, deptId, itLeadUserId } = req.body;
    const result = await functionService.createFunction({ name, deptId, itLeadUserId: itLeadUserId || null });

    return sendCreated(res, result, { meta: { message: 'Function created successfully' } });
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while creating function');
  }
}

/**
 * Get all functions
 * GET /api/v1/functions
 */
async function getFunctions(req, res) {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const myFunctionsOnly = req.query.myFunctionsOnly === 'true';
    const itLeadUserId = (myFunctionsOnly && req.user?.role === 'ITLead') ? req.user.userId : undefined;
    const functions = await functionService.getFunctions({ includeInactive, itLeadUserId });

    return sendSuccess(res, functions);
  } catch (error) {
    return handleControllerError(res, error, 'Gagal memuat functions');
  }
}

/**
 * Get function by ID
 * GET /api/v1/functions/:id
 */
async function getFunctionById(req, res) {
  try {
    const functionId = parseInt(req.params.id, 10);
    const func = await functionService.getFunctionById(functionId);

    if (!func) {
      return sendError(res, { status: 404, code: 'NOT_FOUND', message: 'Function not found' });
    }

    return sendSuccess(res, func);
  } catch (error) {
    return handleControllerError(res, error, 'Gagal memuat function');
  }
}

/**
 * Update function
 * PUT /api/v1/functions/:id
 */
async function updateFunction(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendValidationErrors(res, errors);
    }

    const functionId = parseInt(req.params.id, 10);
    const result = await functionService.updateFunction(functionId, req.body);

    return sendSuccess(res, result, { meta: { message: 'Function updated successfully' } });
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while updating function');
  }
}

/**
 * Delete function
 * DELETE /api/v1/functions/:id
 */
async function deleteFunction(req, res) {
  try {
    const functionId = parseInt(req.params.id, 10);
    await functionService.deleteFunction(functionId);

    return sendSuccess(res, null, { meta: { message: 'Function deleted successfully' } });
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while deleting function');
  }
}

/**
 * Download Excel template for bulk upload
 * GET /api/v1/functions/template
 */
async function downloadTemplate(req, res) {
  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Functions');

    // Column order matches form modal: Function Name, IT Lead Name (optional), Status
    sheet.columns = [
      { header: 'IT Lead Name', key: 'itLeadName', width: 40 },
      { header: 'Function Name', key: 'name', width: 40 },
      { header: 'Status', key: 'status', width: 15 },
    ];

    sheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // Sample data
    sheet.addRow({ itLeadName: 'John Doe', name: 'Infrastructure', status: 'Active' });
    sheet.addRow({ itLeadName: 'Jane Smith', name: 'Development', status: 'Active' });
    sheet.addRow({ itLeadName: '', name: 'BRM', status: 'Active' });

    sheet.addRow([]);
    const noteRow = sheet.addRow(['Catatan: IT Lead Name bersifat opsional (boleh kosong). Function Name wajib diisi. Kolom Status diisi Active atau Inactive. IT Lead Name harus sesuai dengan Display Name user yang memiliki role ITLead. Function Code di-generate otomatis.']);
    noteRow.getCell(1).font = { italic: true, color: { argb: 'FF6B7280' } };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="master-function-template.xlsx"');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    logger.error('Download Function template error:', error);
    return sendError(res, { status: 500, message: 'Gagal generate template' });
  }
}

/**
 * Upload bulk functions from Excel
 * POST /api/v1/functions/upload
 */
async function uploadFunctions(req, res) {
  try {
    if (!req.file || !req.file.buffer) {
      return sendError(res, { status: 400, code: 'BAD_REQUEST', message: 'File tidak ditemukan' });
    }

    const { BulkImportService } = require('../services/bulkImportService');
    const importSvc = new BulkImportService();
    const result = await importSvc.importData(req.file.buffer, 'Function');

    return sendSuccess(res, {
      imported: result.imported,
      updated: result.updated,
      failed: result.failed,
      errors: result.errors,
    }, {
      meta: { message: `Import selesai. Berhasil: ${result.imported + result.updated}, Gagal: ${result.failed}` }
    });
  } catch (error) {
    logger.error('Upload Function error:', error);
    const status = error.statusCode || 500;
    return sendError(res, {
      status,
      message: error.message || 'Gagal upload data Function',
      details: error.details || error.errors || [],
    });
  }
}

module.exports = {
  createFunction,
  getFunctions,
  getFunctionById,
  updateFunction,
  deleteFunction,
  downloadTemplate,
  uploadFunctions,
  createFunctionValidation,
  updateFunctionValidation
};
