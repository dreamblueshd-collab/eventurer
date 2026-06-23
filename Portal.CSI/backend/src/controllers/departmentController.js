const { body, param, validationResult } = require('express-validator');
const departmentService = require('../services/departmentService');
const ExcelJS = require('exceljs');
const logger = require('../config/logger');
const { sendSuccess, sendCreated, sendError } = require('../utils/apiResponse');
const { handleControllerError, sendValidationErrors } = require('../utils/controllerError');

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
 */
async function createDepartment(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendValidationErrors(res, errors);
    }

    const department = await departmentService.createDepartment(req.body);

    return sendCreated(res, department, { meta: { message: 'Department created successfully' } });
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while creating department');
  }
}

/**
 * Get all departments or departments by division
 * GET /api/v1/departments?divisionId=1
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

    return sendSuccess(res, departments);
  } catch (error) {
    return handleControllerError(res, error, 'Gagal memuat departments');
  }
}

/**
 * Get department by ID
 * GET /api/v1/departments/:id
 */
async function getDepartmentById(req, res) {
  try {
    const departmentId = parseInt(req.params.id, 10);
    const department = await departmentService.getDepartmentById(departmentId);

    if (!department) {
      return sendError(res, { status: 404, code: 'NOT_FOUND', message: 'Department not found' });
    }

    return sendSuccess(res, department);
  } catch (error) {
    return handleControllerError(res, error, 'Gagal memuat department');
  }
}

/**
 * Update department
 * PUT /api/v1/departments/:id
 */
async function updateDepartment(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendValidationErrors(res, errors);
    }

    const departmentId = parseInt(req.params.id, 10);
    const department = await departmentService.updateDepartment(departmentId, req.body);

    return sendSuccess(res, department, { meta: { message: 'Department updated successfully' } });
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while updating department');
  }
}

/**
 * Delete department
 * DELETE /api/v1/departments/:id
 */
async function deleteDepartment(req, res) {
  try {
    const departmentId = parseInt(req.params.id, 10);
    await departmentService.deleteDepartment(departmentId);

    return sendSuccess(res, null, { meta: { message: 'Department deleted successfully' } });
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while deleting department');
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
    return sendError(res, { status: 500, message: 'Gagal generate template' });
  }
}

/**
 * Upload bulk departments from Excel
 * POST /api/v1/departments/upload
 */
async function uploadDepartments(req, res) {
  try {
    if (!req.file || !req.file.buffer) {
      return sendError(res, { status: 400, code: 'BAD_REQUEST', message: 'File tidak ditemukan' });
    }

    const { BulkImportService } = require('../services/bulkImportService');
    const importSvc = new BulkImportService();
    const result = await importSvc.importData(req.file.buffer, 'Department');

    return sendSuccess(res, {
      imported: result.imported,
      updated: result.updated,
      failed: result.failed,
      errors: result.errors,
    }, {
      meta: { message: `Import selesai. Berhasil: ${result.imported + result.updated}, Gagal: ${result.failed}` }
    });
  } catch (error) {
    logger.error('Upload Department error:', error);
    const status = error.statusCode || 500;
    return sendError(res, {
      status,
      message: error.message || 'Gagal upload data Department',
      details: error.details || error.errors || [],
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
