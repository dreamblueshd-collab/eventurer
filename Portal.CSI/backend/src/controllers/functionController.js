const { body, param, validationResult } = require('express-validator');
const functionService = require('../services/functionService');
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
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function createFunction(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Validasi tidak valid'
      });
    }

    const { name, deptId, itLeadUserId } = req.body;
    const result = await functionService.createFunction({ name, deptId, itLeadUserId: itLeadUserId || null });

    res.status(201).json({
      success: true,
      message: 'Function created successfully',
      function: result
    });

  } catch (error) {
    return handleServiceError(res, error, 'An error occurred while creating function');
  }
}

/**
 * Get all functions
 * GET /api/v1/functions
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getFunctions(req, res) {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const myFunctionsOnly = req.query.myFunctionsOnly === 'true';
    const itLeadUserId = (myFunctionsOnly && req.user?.role === 'ITLead') ? req.user.userId : undefined;
    const functions = await functionService.getFunctions({ includeInactive, itLeadUserId });

    res.json({
      success: true,
      functions
    });

  } catch (error) {
    logger.error('Get functions controller error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Gagal memuat functions'
    });
  }
}

/**
 * Get function by ID
 * GET /api/v1/functions/:id
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getFunctionById(req, res) {
  try {
    const functionId = parseInt(req.params.id, 10);
    const func = await functionService.getFunctionById(functionId);

    if (!func) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Function not found'
      });
    }

    res.json({
      success: true,
      function: func
    });

  } catch (error) {
    logger.error('Get function by ID controller error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Gagal memuat function'
    });
  }
}

/**
 * Update function
 * PUT /api/v1/functions/:id
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function updateFunction(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Validasi tidak valid'
      });
    }

    const functionId = parseInt(req.params.id, 10);
    const updates = req.body;

    const result = await functionService.updateFunction(functionId, updates);

    res.json({
      success: true,
      message: 'Function updated successfully',
      function: result
    });

  } catch (error) {
    return handleServiceError(res, error, 'An error occurred while updating function');
  }
}

/**
 * Delete function
 * DELETE /api/v1/functions/:id
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function deleteFunction(req, res) {
  try {
    const functionId = parseInt(req.params.id, 10);
    await functionService.deleteFunction(functionId);

    res.json({
      success: true,
      message: 'Function deleted successfully'
    });

  } catch (error) {
    return handleServiceError(res, error, 'An error occurred while deleting function');
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
    res.status(500).json({ success: false, message: 'Gagal generate template' });
  }
}

/**
 * Upload bulk functions from Excel
 * POST /api/v1/functions/upload
 */
async function uploadFunctions(req, res) {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, message: 'File tidak ditemukan' });
    }

    const { BulkImportService } = require('../services/bulkImportService');
    const importSvc = new BulkImportService();
    const result = await importSvc.importData(req.file.buffer, 'Function');

    return res.json({
      success: true,
      message: `Import selesai. Berhasil: ${result.imported + result.updated}, Gagal: ${result.failed}`,
      imported: result.imported,
      updated: result.updated,
      failed: result.failed,
      errors: result.errors,
    });
  } catch (error) {
    logger.error('Upload Function error:', error);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Gagal upload data Function',
      errors: error.details || error.errors || [],
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
