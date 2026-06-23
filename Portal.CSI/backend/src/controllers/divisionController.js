const { body, param, query, validationResult } = require('express-validator');
const divisionService = require('../services/divisionService');
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
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function createDivision(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Validasi tidak valid'
      });
    }

    const divisionData = req.body;
    const division = await divisionService.createDivision(divisionData);

    res.status(201).json({
      success: true,
      message: 'Division created successfully',
      division
    });

  } catch (error) {
    return handleServiceError(res, error, 'An error occurred while creating division');
  }
}

/**
 * Get all divisions or divisions by business unit
 * GET /api/v1/divisions?businessUnitId=1
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
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

    res.json({
      success: true,
      divisions
    });

  } catch (error) {
    logger.error('Get divisions controller error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Gagal memuat divisions'
    });
  }
}

/**
 * Get division by ID
 * GET /api/v1/divisions/:id
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getDivisionById(req, res) {
  try {
    const divisionId = parseInt(req.params.id, 10);
    const division = await divisionService.getDivisionById(divisionId);

    if (!division) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Division not found'
      });
    }

    res.json({
      success: true,
      division
    });

  } catch (error) {
    logger.error('Get division by ID controller error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Gagal memuat division'
    });
  }
}

/**
 * Update division
 * PUT /api/v1/divisions/:id
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function updateDivision(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Validasi tidak valid'
      });
    }

    const divisionId = parseInt(req.params.id, 10);
    const updates = req.body;

    const division = await divisionService.updateDivision(divisionId, updates);

    res.json({
      success: true,
      message: 'Division updated successfully',
      division
    });

  } catch (error) {
    return handleServiceError(res, error, 'An error occurred while updating division');
  }
}

/**
 * Delete division
 * DELETE /api/v1/divisions/:id
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function deleteDivision(req, res) {
  try {
    const divisionId = parseInt(req.params.id, 10);
    await divisionService.deleteDivision(divisionId);

    res.json({
      success: true,
      message: 'Division deleted successfully'
    });

  } catch (error) {
    return handleServiceError(res, error, 'An error occurred while deleting division');
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
    res.status(500).json({ success: false, message: 'Gagal generate template' });
  }
}

/**
 * Upload bulk divisions from Excel
 * POST /api/v1/divisions/upload
 */
async function uploadDivisions(req, res) {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, message: 'File tidak ditemukan' });
    }

    const { BulkImportService } = require('../services/bulkImportService');
    const importSvc = new BulkImportService();
    const result = await importSvc.importData(req.file.buffer, 'Division');

    return res.json({
      success: true,
      message: `Import selesai. Berhasil: ${result.imported + result.updated}, Gagal: ${result.failed}`,
      imported: result.imported,
      updated: result.updated,
      failed: result.failed,
      errors: result.errors,
    });
  } catch (error) {
    logger.error('Upload Division error:', error);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Gagal upload data Divisi',
      errors: error.details || error.errors || [],
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

