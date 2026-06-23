const { body, param, query, validationResult } = require('express-validator');
const userService = require('../services/userService');
const logger = require('../config/logger');
const ExcelJS = require('exceljs');
const { sendSuccess, sendCreated, sendError } = require('../utils/apiResponse');
const { handleControllerError, sendValidationErrors } = require('../utils/controllerError');

const userIdentifierValidation = param('id')
  .trim()
  .notEmpty().withMessage('User identifier is required')
  .isLength({ max: 50 }).withMessage('User identifier is too long');

/**
 * Validation rules for creating a user
 */
const createUserValidation = [
  body('username')
    .trim()
    .notEmpty().withMessage('Username is required')
    .isLength({ min: 3, max: 50 }).withMessage('Username must be between 3 and 50 characters')
    .matches(/^[a-zA-Z0-9._-]+$/).withMessage('Username can only contain letters, numbers, dot, underscore, and hyphen'),
  body('displayName')
    .trim()
    .notEmpty().withMessage('Display name is required')
    .isLength({ min: 1, max: 200 }).withMessage('Display name must be between 1 and 200 characters'),
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format'),
  body('phoneNumber')
    .optional({ nullable: true })
    .trim()
    .matches(/^[0-9+\-\s()]{8,20}$/).withMessage('Invalid phone number format'),
  body('role')
    .notEmpty().withMessage('Role is required')
    .isIn(['SuperAdmin', 'AdminEvent', 'ITLead', 'DepartmentHead']).withMessage('Invalid role'),
  body('useLDAP')
    .optional()
    .isBoolean().withMessage('useLDAP must be a boolean'),
  body('password')
    .optional()
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('npk')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 }).withMessage('NPK must be between 1 and 50 characters')
];

/**
 * Validation rules for updating a user
 */
const updateUserValidation = [
  userIdentifierValidation,
  body('username')
    .optional()
    .trim()
    .isLength({ min: 3, max: 50 }).withMessage('Username must be between 3 and 50 characters')
    .matches(/^[a-zA-Z0-9._-]+$/).withMessage('Username can only contain letters, numbers, dot, underscore, and hyphen'),
  body('displayName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 }).withMessage('Display name must be between 1 and 200 characters'),
  body('email')
    .optional()
    .trim()
    .isEmail().withMessage('Invalid email format'),
  body('phoneNumber')
    .optional({ nullable: true })
    .trim()
    .matches(/^[0-9+\-\s()]{8,20}$/).withMessage('Invalid phone number format'),
  body('role')
    .optional()
    .isIn(['SuperAdmin', 'AdminEvent', 'ITLead', 'DepartmentHead']).withMessage('Invalid role'),
  body('isActive')
    .optional()
    .isBoolean().withMessage('isActive must be a boolean'),
  body('npk')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 }).withMessage('NPK must be between 1 and 50 characters')
];

/**
 * Validation rules for toggling LDAP
 */
const toggleLDAPValidation = [
  userIdentifierValidation,
  body('useLDAP')
    .isBoolean().withMessage('useLDAP must be a boolean')
];

/**
 * Validation rules for setting password
 */
const setPasswordValidation = [
  userIdentifierValidation,
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
];

/**
 * Create a new user
 * POST /api/v1/users
 */
async function createUser(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendValidationErrors(res, errors);
    }

    const result = await userService.createUser(req.body);

    return sendCreated(res, result, { meta: { message: 'User created successfully' } });
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while creating user');
  }
}

/**
 * Get IT Lead users for public dropdown (requires auth only, no special permission)
 * GET /api/v1/public/users/it-leads
 */
async function getPublicITLeads(req, res) {
  try {
    const { includeInactive } = req.query;

    const filter = {
      role: 'ITLead',
      includeInactive: includeInactive === 'true'
    };

    const users = await userService.getUsers(filter);

    return sendSuccess(res, users.map(user => ({
      UserId: user.UserId,
      DisplayName: user.DisplayName,
      Username: user.Username,
      Email: user.Email,
      IsActive: user.IsActive
    })));
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while fetching IT Lead users');
  }
}

/**
 * Get all users
 * GET /api/v1/users
 */
async function getUsers(req, res) {
  try {
    const { role, isActive, search, includeInactive } = req.query;

    const filter = {};
    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (search) filter.search = search;
    if (includeInactive !== undefined) filter.includeInactive = includeInactive === 'true';

    const users = await userService.getUsers(filter);

    return sendSuccess(res, users);
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while fetching users');
  }
}

/**
 * Get user by ID
 * GET /api/v1/users/:id
 */
async function getUserById(req, res) {
  try {
    const user = await userService.getUserById(req.params.id);

    if (!user) {
      return sendError(res, { status: 404, code: 'NOT_FOUND', message: 'User not found' });
    }

    return sendSuccess(res, user);
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while fetching user');
  }
}

/**
 * Update user
 * PUT /api/v1/users/:id
 */
async function updateUser(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendValidationErrors(res, errors);
    }

    const result = await userService.updateUser(req.params.id, req.body);

    return sendSuccess(res, result, { meta: { message: 'User updated successfully' } });
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while updating user');
  }
}

/**
 * Deactivate user (soft delete)
 * DELETE /api/v1/users/:id
 */
async function deactivateUser(req, res) {
  try {
    const result = await userService.deactivateUser(req.params.id);

    return sendSuccess(res, result, { meta: { message: 'User deactivated successfully' } });
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while deactivating user');
  }
}

/**
 * Toggle user LDAP authentication
 * PATCH /api/v1/users/:id/ldap
 */
async function toggleUserLDAP(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendValidationErrors(res, errors);
    }

    const { useLDAP } = req.body;
    const result = await userService.toggleUserLDAP(req.params.id, useLDAP);

    return sendSuccess(res, result, { meta: { message: 'LDAP setting updated successfully' } });
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while toggling LDAP');
  }
}

/**
 * Set user password (for non-LDAP users)
 * PATCH /api/v1/users/:id/password
 */
async function setUserPassword(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendValidationErrors(res, errors);
    }

    const { password } = req.body;
    await userService.setUserPassword(req.params.id, password);

    return sendSuccess(res, null, { meta: { message: 'Password updated successfully' } });
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while setting password');
  }
}

async function downloadUserTemplate(req, res) {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CSI Portal';
    workbook.created = new Date();

    // ============================================================
    // SHEET 1: Data User (Main sheet for bulk upload)
    // ============================================================
    const sheet = workbook.addWorksheet('Data User');

    sheet.columns = [
      { header: 'Username *', key: 'username', width: 22 },
      { header: 'NPK', key: 'npk', width: 14 },
      { header: 'DisplayName *', key: 'displayName', width: 30 },
      { header: 'Email *', key: 'email', width: 34 },
      { header: 'PhoneNumber', key: 'phoneNumber', width: 18 },
      { header: 'Role *', key: 'role', width: 18 },
      { header: 'IsActive *', key: 'isActive', width: 12 },
      { header: 'UseLDAP *', key: 'useLdap', width: 12 },
      { header: 'Password', key: 'password', width: 22 },
    ];

    // Style header row (bold white text on dark blue background)
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 24;

    // Add header comments for guidance
    sheet.getCell('A1').note = 'Wajib diisi.\nUsername login (3-50 karakter).\nHanya huruf, angka, titik, underscore, dan strip.\nContoh: firman.adam';
    sheet.getCell('B1').note = 'Opsional.\nNomor NPK karyawan.';
    sheet.getCell('C1').note = 'Wajib diisi.\nNama lengkap user (1-200 karakter).';
    sheet.getCell('D1').note = 'Wajib diisi.\nFormat email valid.\nContoh: user@company.co.id';
    sheet.getCell('E1').note = 'Opsional.\nFormat: 628xxxxxxxxx (8-15 digit angka).';
    sheet.getCell('F1').note = 'Wajib diisi.\nNilai yang valid:\n- SuperAdmin\n- AdminEvent\n- ITLead\n- DepartmentHead';
    sheet.getCell('G1').note = 'Wajib diisi.\nNilai: true atau false.\nStatus aktif user.';
    sheet.getCell('H1').note = 'Wajib diisi.\nNilai: true atau false.\ntrue = menggunakan LDAP perusahaan.\nfalse = menggunakan password lokal.';
    sheet.getCell('I1').note = 'WAJIB diisi jika UseLDAP = false.\nMinimal 8 karakter.\nAbaikan jika UseLDAP = true.';

    // Add example rows showing different scenarios
    sheet.addRow({
      username: 'firman.adam',
      npk: '0676',
      displayName: 'Firman Adam',
      email: 'firman.adam@company.co.id',
      phoneNumber: '6281234567001',
      role: 'AdminEvent',
      isActive: 'true',
      useLdap: 'true',
      password: '',
    });

    sheet.addRow({
      username: 'budi.santoso',
      npk: '0677',
      displayName: 'Budi Santoso',
      email: 'budi.santoso@company.co.id',
      phoneNumber: '6281234567002',
      role: 'ITLead',
      isActive: 'true',
      useLdap: 'false',
      password: 'password123',
    });

    sheet.addRow({
      username: 'siti.nurhaliza',
      npk: '0678',
      displayName: 'Siti Nurhaliza',
      email: 'siti.nurhaliza@company.co.id',
      phoneNumber: '6281234567003',
      role: 'DepartmentHead',
      isActive: 'true',
      useLdap: 'false',
      password: 'password123',
    });

    // Add data validation (dropdown) for Role, IsActive, and UseLDAP columns
    for (let rowNumber = 2; rowNumber <= 1000; rowNumber += 1) {
      sheet.getCell(`F${rowNumber}`).dataValidation = {
        type: 'list',
        allowBlank: false,
        formulae: ['"SuperAdmin,AdminEvent,ITLead,DepartmentHead"'],
        showErrorMessage: true,
        errorStyle: 'error',
        errorTitle: 'Role tidak valid',
        error: 'Role harus salah satu dari: SuperAdmin, AdminEvent, ITLead, DepartmentHead',
      };
      sheet.getCell(`G${rowNumber}`).dataValidation = {
        type: 'list',
        allowBlank: false,
        formulae: ['"true,false"'],
        showErrorMessage: true,
        errorStyle: 'error',
        errorTitle: 'IsActive tidak valid',
        error: 'IsActive harus bernilai true atau false',
      };
      sheet.getCell(`H${rowNumber}`).dataValidation = {
        type: 'list',
        allowBlank: false,
        formulae: ['"true,false"'],
        showErrorMessage: true,
        errorStyle: 'error',
        errorTitle: 'UseLDAP tidak valid',
        error: 'UseLDAP harus bernilai true atau false',
      };
    }

    // Highlight example rows in light yellow so user knows they should be deleted
    for (let rowNumber = 2; rowNumber <= 4; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
      row.font = { italic: true, color: { argb: 'FF7F6000' } };
    }

    // Freeze header row
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    // ============================================================
    // SHEET 2: Petunjuk (Instructions)
    // ============================================================
    const infoSheet = workbook.addWorksheet('Petunjuk');
    infoSheet.getColumn('A').width = 28;
    infoSheet.getColumn('B').width = 75;

    infoSheet.getCell('A1').value = 'Petunjuk Pengisian Template Master User';
    infoSheet.mergeCells('A1:B1');
    infoSheet.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FF1F4E79' } };
    infoSheet.getCell('A1').alignment = { vertical: 'middle' };
    infoSheet.getRow(1).height = 26;

    infoSheet.getCell('A3').value = 'Tujuan';
    infoSheet.getCell('A3').font = { bold: true, size: 12 };
    infoSheet.getCell('B3').value = 'Template ini digunakan untuk melakukan upload data master user secara bulk. Isi pada sheet "Data User" sesuai dengan format yang telah ditentukan.';

    infoSheet.getCell('A5').value = 'Kolom Wajib (bertanda *)';
    infoSheet.getCell('A5').font = { bold: true, size: 12, color: { argb: 'FFC00000' } };
    infoSheet.getCell('A6').value = 'Username';
    infoSheet.getCell('B6').value = 'Username untuk login (3-50 karakter). Hanya boleh berisi huruf, angka, titik (.), underscore (_), dan strip (-). Harus unik (tidak boleh sama dengan user lain).';
    infoSheet.getCell('A7').value = 'DisplayName';
    infoSheet.getCell('B7').value = 'Nama lengkap user (1-200 karakter).';
    infoSheet.getCell('A8').value = 'Email';
    infoSheet.getCell('B8').value = 'Alamat email user. Harus valid dan unik. Contoh: user@company.co.id';
    infoSheet.getCell('A9').value = 'Role';
    infoSheet.getCell('B9').value = 'Hak akses user. Pilih salah satu:\n- SuperAdmin    : Administrator penuh\n- AdminEvent    : Admin untuk mengelola event\n- ITLead        : Lead IT (untuk approval)\n- DepartmentHead: Kepala Departemen (untuk approval)';
    infoSheet.getCell('A10').value = 'IsActive';
    infoSheet.getCell('B10').value = 'Status aktif user. Nilai: true (aktif) atau false (nonaktif).';
    infoSheet.getCell('A11').value = 'UseLDAP';
    infoSheet.getCell('B11').value = 'Metode autentikasi. Nilai: true atau false.\n- true  : menggunakan LDAP perusahaan (login pakai akun Windows/Active Directory)\n- false : menggunakan password lokal yang disimpan di sistem';

    infoSheet.getCell('A13').value = 'Kolom Opsional';
    infoSheet.getCell('A13').font = { bold: true, size: 12, color: { argb: 'FF1F4E79' } };
    infoSheet.getCell('A14').value = 'NPK';
    infoSheet.getCell('B14').value = 'Nomor NPK karyawan. Boleh dikosongkan.';
    infoSheet.getCell('A15').value = 'PhoneNumber';
    infoSheet.getCell('B15').value = 'Nomor telepon user. Format: 628xxxxxxxxx (8-15 digit angka). Boleh dikosongkan.';
    infoSheet.getCell('A16').value = 'Password';
    infoSheet.getCell('B16').value = 'Password untuk login lokal. WAJIB diisi jika UseLDAP = false. Minimal 8 karakter. Abaikan/kosongkan jika UseLDAP = true (menggunakan LDAP perusahaan).';

    infoSheet.getCell('A18').value = 'Catatan Penting';
    infoSheet.getCell('A18').font = { bold: true, size: 12, color: { argb: 'FFC00000' } };
    infoSheet.getCell('A19').value = '1.';
    infoSheet.getCell('B19').value = 'HAPUS 3 baris contoh berwarna kuning di sheet "Data User" sebelum upload.';
    infoSheet.getCell('A20').value = '2.';
    infoSheet.getCell('B20').value = 'Satu baris pada sheet "Data User" mewakili satu user.';
    infoSheet.getCell('A21').value = '3.';
    infoSheet.getCell('B21').value = 'Username dan Email harus unik. Duplikat akan dilewati (skip) saat upload.';
    infoSheet.getCell('A22').value = '4.';
    infoSheet.getCell('B22').value = 'Untuk user LDAP (UseLDAP = true), password TIDAK digunakan. User akan login menggunakan akun LDAP perusahaan.';
    infoSheet.getCell('A23').value = '5.';
    infoSheet.getCell('B23').value = 'Untuk user non-LDAP (UseLDAP = false), kolom Password WAJIB diisi minimal 8 karakter.';
    infoSheet.getCell('A24').value = '6.';
    infoSheet.getCell('B24').value = 'Format file yang didukung: .xlsx dan .xls (Microsoft Excel).';
    infoSheet.getCell('A25').value = '7.';
    infoSheet.getCell('B25').value = 'Pastikan semua kolom wajib (bertanda *) sudah terisi sebelum upload. Baris yang tidak valid akan dilaporkan di notifikasi.';

    // Make note rows bold for the numbers
    for (let i = 19; i <= 25; i += 1) {
      infoSheet.getCell(`A${i}`).font = { bold: true };
    }

    // Enable text wrap on column B for readability
    for (let i = 3; i <= 25; i += 1) {
      infoSheet.getCell(`B${i}`).alignment = { wrapText: true, vertical: 'top' };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="master-user-template.xlsx"');
    res.send(Buffer.from(buffer));
  } catch (error) {
    logger.error('Download user template controller error:', error);
    return sendError(res, { status: 500, message: 'An error occurred while generating template' });
  }
}

async function downloadUserList(req, res) {
  try {
    const users = await userService.getUsers({ includeInactive: true });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Users');

    worksheet.columns = [
      { header: 'Username', key: 'username', width: 20 },
      { header: 'NPK', key: 'npk', width: 15 },
      { header: 'DisplayName', key: 'displayName', width: 28 },
      { header: 'Email', key: 'email', width: 32 },
      { header: 'PhoneNumber', key: 'phoneNumber', width: 18 },
      { header: 'Role', key: 'role', width: 18 },
      { header: 'IsActive', key: 'isActive', width: 12 },
      { header: 'UseLDAP', key: 'useLdap', width: 12 }
    ];

    users.forEach(user => {
      worksheet.addRow({
        username: user.Username,
        npk: user.NPK || '',
        displayName: user.DisplayName,
        email: user.Email,
        phoneNumber: user.PhoneNumber || '',
        role: user.Role,
        isActive: user.IsActive ? 'true' : 'false',
        useLdap: user.UseLDAP ? 'true' : 'false'
      });
    });

    worksheet.getRow(1).font = { bold: true };

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename="user-list.xlsx"');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    logger.error('Download user list controller error:', error);
    return sendError(res, { status: 500, message: 'An error occurred while generating user list' });
  }
}

async function uploadUserFile(req, res) {
  try {
    if (!req.file) {
      return sendError(res, { status: 400, code: 'BAD_REQUEST', message: 'File is required' });
    }

    const { BulkImportService } = require('../services/bulkImportService');
    const service = new BulkImportService();
    const result = await service.importData(req.file.buffer, 'users');

    return sendSuccess(res, {
      imported: result.imported,
      failed: result.failed,
      errors: result.errors
    }, {
      meta: { message: `Import completed. Imported: ${result.imported}, Failed: ${result.failed}` }
    });
  } catch (error) {
    logger.error('Upload user file controller error:', error);

    if (error.name === 'ValidationError') {
      return sendError(res, {
        status: error.statusCode || 422,
        code: 'VALIDATION_ERROR',
        message: error.message || 'Format file tidak sesuai dengan template yang disediakan. Silakan download template terbaru dan coba lagi.',
        details: error.details || undefined
      });
    }

    return handleControllerError(res, error, 'An error occurred while uploading file');
  }
}

module.exports = {
  createUser,
  getUsers,
  getPublicITLeads,
  downloadUserTemplate,
  downloadUserList,
  uploadUserFile,
  getUserById,
  updateUser,
  deactivateUser,
  toggleUserLDAP,
  setUserPassword,
  createUserValidation,
  updateUserValidation,
  toggleLDAPValidation,
  setPasswordValidation
};
