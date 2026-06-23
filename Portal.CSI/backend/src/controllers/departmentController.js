const { body, param, query, validationResult } = require('express-validator');
const departmentService = require('../services/departmentService');
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
 * Validation rules for creating a department
 */
const createDepartmentValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 1, max: 200 }).withMessage('Name must be between 1 and 200 characters'),
  body('divisionId')
    .notEmpty().withMessage('Division ID is required')
    .isInt({ min: 1 }).withMessage('Division ID must be a valid integer')
];

/**
 * Validation rules for updating a department
 */
const updateDepartmentValidation = [
  param('id').isInt({ min: 1 }).withMessage('id must be a valid integer'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 }).withMessage('Name must be between 1 and 200 characters'),
  body('divisionId')
    .optional()
    .isInt({ min: 1 }).withMessage('Division ID must be a valid integer'),
  body('isActive')
    .optional()
    .isBoolean().withMessage('isActive must be boolean')
];

/**
 * Create a new department
 * POST /api/v1/departments
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function createDepartment(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Validasi tidak valid'
      });
    }

    const departmentData = req.body;
    const department = await departmentService.createDepartment(departmentData);

    res.status(201).json({
      success: true,
      message: 'Department created successfully',
      department
    });

  } catch (error) {
    return handleServiceError(res, error, 'An error occurred while creating department');
  }
}

/**
 * Get all departments or departments by division
 * GET /api/v1/departments?divisionId=1
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getDepartments(req, res) {
  try {
    const { divisionId } = req.query;
    const includeInactive = req.query.includeInactive === 'true';

    let departments;
    if (divisionId) {
      departments = await departmentService.getDepartmentsByDivision(divisionId, { includeInactive });
    } else {
      departments = await departmentService.getDepartments({ includeInactive });
    }

    res.json({
      success: true,
      departments
    });

  } catch (error) {
    logger.error('Get departments controller error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Gagal memuat departments'
    });
  }
}

/**
 * Get department by ID
 * GET /api/v1/departments/:id
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getDepartmentById(req, res) {
  try {
    const departmentId = parseInt(req.params.id, 10);
    const department = await departmentService.getDepartmentById(departmentId);

    if (!department) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Department not found'
      });
    }

    res.json({
      success: true,
      department
    });

  } catch (error) {
    logger.error('Get department by ID controller error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Gagal memuat department'
    });
  }
}

/**
 * Update department
 * PUT /api/v1/departments/:id
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function updateDepartment(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Validasi tidak valid'
      });
    }

    const departmentId = parseInt(req.params.id, 10);
    const updates = req.body;

    const department = await departmentService.updateDepartment(departmentId, updates);

    res.json({
      success: true,
      message: 'Department updated successfully',
      department
    });

  } catch (error) {
    return handleServiceError(res, error, 'An error occurred while updating department');
  }
}

/**
 * Delete department
 * DELETE /api/v1/departments/:id
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function deleteDepartment(req, res) {
  try {
    const departmentId = parseInt(req.params.id, 10);
    await departmentService.deleteDepartment(departmentId);

    res.json({
      success: true,
      message: 'Department deleted successfully'
    });

  } catch (error) {
    return handleServiceError(res, error, 'An error occurred while deleting department');
  }
}

/**
 * Download Excel template for bulk upload
 * GET /api/v1/departments/template
 */
async function downloadTemplate(req, res) {
  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Departments');

    sheet.columns = [
      { header: 'BU Name', key: 'buName', width: 30 },
      { header: 'Divisi Name', key: 'divisiName', width: 30 },
      { header: 'Department Name', key: 'name', width: 40 },
      { header: 'Status', key: 'status', width: 15 },
    ];

    sheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    sheet.addRow({ buName: 'Corporate HO', divisiName: 'IT Digital', name: 'IT Digital Development', status: 'Active' });
    sheet.addRow({ buName: 'Corporate HO', divisiName: 'Finance', name: 'Finance Operations', status: 'Active' });
    sheet.addRow({ buName: 'Main Dealer Jakarta', divisiName: 'Main Dealer Jakarta', name: 'Main Dealer Jakarta', status: 'Active' });

    sheet.addRow([]);
    const noteRow = sheet.addRow(['Catatan: BU Name untuk informasi saja. Divisi Name harus sesuai dengan data Divisi yang ada (digunakan untuk validasi). Department Name wajib diisi. Kolom Status diisi Active atau Inactive. Department Code di-generate otomatis.']);
    noteRow.getCell(1).font = { italic: true, color: { argb: 'FF6B7280' } };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="master-department-template.xlsx"');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    logger.error('Download Department template error:', error);
    res.status(500).json({ success: false, message: 'Gagal generate template' });
  }
}

/**
 * Upload bulk departments from Excel
 * POST /api/v1/departments/upload
 */
async function uploadDepartments(req, res) {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, message: 'File tidak ditemukan' });
    }

    const { BulkImportService } = require('../services/bulkImportService');
    const importSvc = new BulkImportService();
    const result = await importSvc.importData(req.file.buffer, 'Department');

    return res.json({
      success: true,
      message: `Import selesai. Berhasil: ${result.imported + result.updated}, Gagal: ${result.failed}`,
      imported: result.imported,
      updated: result.updated,
      failed: result.failed,
      errors: result.errors,
    });
  } catch (error) {
    logger.error('Upload Department error:', error);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Gagal upload data Department',
      errors: error.details || error.errors || [],
    });
  }
}

module.exports = {
  createDepartment,
  getDepartments,
  getDepartmentById,
  updateDepartment,
  deleteDepartment,
  downloadTemplate,
  uploadDepartments,
  createDepartmentValidation,
  updateDepartmentValidation
};

