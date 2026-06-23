const ExcelJS = require('exceljs');
const logger = require('../config/logger');

function normalizeHeader(value) {
  return String(value || '').trim().toLowerCase();
}

/**
 * Custom error classes
 */
class ValidationError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 422;
    this.details = details;
  }
}

/**
 * Template Parser Service for Excel file processing
 */
class TemplateParser {
  /**
   * Parse Excel file and validate data
   * @param {Buffer|Stream} fileBuffer - Excel file buffer or stream
   * @param {Object} config - Configuration for parsing
   * @param {string} config.entityType - Type of entity (BusinessUnit, Division, Department, Function, Application, FunctionAppMapping, AppDeptMapping)
   * @param {number} [config.headerRow=1] - Row number containing headers (1-based)
   * @param {number} [config.startRow=2] - First data row (1-based)
   * @param {Object} config.columnMapping - Mapping of column names to field names
   * @param {Function} [config.validator] - Custom validation function for each row
   * @returns {Promise<Object>} Parsed data with validation results
   */
  async parseExcelFile(fileBuffer, config) {
    try {
      // Validate input buffer
      if (!fileBuffer) {
        throw new ValidationError('No file data provided');
      }

      if (Buffer.isBuffer(fileBuffer)) {
        logger.info(`Parsing Excel buffer, size: ${fileBuffer.length} bytes`);
        
        // Validate minimum file size (Excel files are at least a few KB)
        if (fileBuffer.length < 100) {
          throw new ValidationError('File is too small to be a valid Excel file');
        }
      }

      const workbook = new ExcelJS.Workbook();
      
      // Load workbook from buffer or stream with better error handling
      try {
        if (Buffer.isBuffer(fileBuffer)) {
          await workbook.xlsx.load(fileBuffer);
        } else {
          await workbook.xlsx.read(fileBuffer);
        }
      } catch (parseError) {
        logger.error('ExcelJS parse error:', parseError);
        throw new ValidationError(
          'Failed to parse Excel file. Please ensure the file is a valid Excel (.xlsx) file and not corrupted.'
        );
      }

      // Get first worksheet
      const worksheet = workbook.worksheets[0];
      
      if (!worksheet) {
        throw new ValidationError('Excel file is empty or invalid');
      }

      const headerRow = config.headerRow || 1;
      const startRow = config.startRow || 2;
      const columnMapping = config.columnMapping || {};
      
      // Read headers
      const headers = [];
      const headerRowData = worksheet.getRow(headerRow);
      headerRowData.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        headers[colNumber] = cell.value ? cell.value.toString().trim() : '';
      });

      const headerAliases = config.headerAliases || {};
      const allowExtraColumns = config.allowExtraColumns !== false;
      const headerLookup = new Map();
      const headerNamesByField = new Map();
      const allowedHeaders = new Set();

      for (const [headerName, fieldName] of Object.entries(columnMapping)) {
        const aliases = [headerName, ...(Array.isArray(headerAliases[headerName]) ? headerAliases[headerName] : headerAliases[headerName] ? [headerAliases[headerName]] : [])];
        headerNamesByField.set(fieldName, aliases);
        for (const alias of aliases) {
          const normalizedAlias = normalizeHeader(alias);
          headerLookup.set(normalizedAlias, fieldName);
          allowedHeaders.add(normalizedAlias);
        }
      }

      // Validate required columns (skip optional ones)
      const optionalColumns = new Set((config.optionalColumns || []).map(normalizeHeader));
      const requiredColumns = Object.keys(columnMapping).filter(col => !optionalColumns.has(normalizeHeader(col)));
      const missingColumns = [];

      for (const requiredCol of requiredColumns) {
        const aliases = headerNamesByField.get(columnMapping[requiredCol]) || [requiredCol];
        const hasMatch = aliases.some((alias) => headers.some((header) => normalizeHeader(header) === normalizeHeader(alias)));
        if (!hasMatch) {
          missingColumns.push(requiredCol);
        }
      }

      if (missingColumns.length > 0) {
        throw new ValidationError(
          `Missing required columns: ${missingColumns.join(', ')}`,
          [{ row: headerRow, error: `Missing columns: ${missingColumns.join(', ')}` }]
        );
      }

      if (!allowExtraColumns) {
        const unexpectedColumns = headers
          .map((header) => String(header || '').trim())
          .filter((header) => header.length > 0)
          .filter((header) => !allowedHeaders.has(normalizeHeader(header)));

        if (unexpectedColumns.length > 0) {
          throw new ValidationError(
            `Unexpected columns found: ${unexpectedColumns.join(', ')}`,
            [{ row: headerRow, error: `Unexpected columns: ${unexpectedColumns.join(', ')}` }]
          );
        }
      }

      // Parse data rows
      const validRecords = [];
      const errors = [];
      let parsedRowCount = 0;

      for (let i = startRow; i <= worksheet.rowCount; i++) {
        const row = worksheet.getRow(i);

        // Skip empty rows
        if (this._isRowEmpty(row)) {
          continue;
        }

        const firstValue = this._getFirstNonEmptyCellValue(row);
        if (firstValue && this._isInstructionRow(firstValue)) {
          continue;
        }

        const record = {};
        const rowErrors = [];

        // Map columns to fields
        // Use eachCell with { includeEmpty: true } to include empty cells
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const columnName = headers[colNumber];
          const fieldName = headerLookup.get(normalizeHeader(columnName));

          if (fieldName) {
            const cellValue = this._getCellValue(cell);
            record[fieldName] = cellValue;
          }
        });

        // Validate record
        const validationResult = this._validateRecord(record, config.entityType, i);

        if (validationResult.errors.length > 0) {
          rowErrors.push(...validationResult.errors);
        }

        // Custom validator
        if (config.validator && typeof config.validator === 'function') {
          try {
            const customValidation = await config.validator(record, i);
            if (customValidation && customValidation.errors) {
              rowErrors.push(...customValidation.errors);
            }
          } catch (error) {
            rowErrors.push(`Custom validation failed: ${error.message}`);
          }
        }

        if (rowErrors.length > 0) {
          errors.push({
            row: i,
            data: record,
            errors: rowErrors
          });
        } else {
          validRecords.push({
            row: i,
            data: record
          });
        }

        parsedRowCount++;
      }

      logger.info('Excel file parsed', {
        entityType: config.entityType,
        totalRows: parsedRowCount,
        validRecords: validRecords.length,
        errorRecords: errors.length
      });

      return {
        success: errors.length === 0,
        totalRows: parsedRowCount,
        validRecords,
        errors,
        summary: {
          valid: validRecords.length,
          invalid: errors.length,
          total: parsedRowCount
        }
      };
    } catch (error) {
      if (error.name === 'ValidationError') {
        throw error;
      }
      logger.error('Error parsing Excel file:', error);
      throw new ValidationError(`Failed to parse Excel file: ${error.message}`);
    }
  }

  /**
   * Get cell value with type handling
   * @private
   * @param {Object} cell - Excel cell
   * @returns {*} Cell value
   */
  _getCellValue(cell) {
    if (!cell || cell.value === null || cell.value === undefined) {
      return null;
    }

    // Handle formula cells
    if (cell.type === ExcelJS.ValueType.Formula) {
      return cell.result;
    }

    // Handle date cells
    if (cell.type === ExcelJS.ValueType.Date) {
      return cell.value;
    }

    // Handle rich text
    if (cell.value && typeof cell.value === 'object' && cell.value.richText) {
      return cell.value.richText.map(rt => rt.text).join('').trim();
    }

    // Handle hyperlinks (ExcelJS stores mailto: links as {text, hyperlink})
    if (cell.value && typeof cell.value === 'object' && cell.value.text) {
      return cell.value.text.trim();
    }

    // Convert to string and trim
    return cell.value.toString().trim();
  }

  /**
   * Check if row is empty
   * @private
   * @param {Object} row - Excel row
   * @returns {boolean} True if empty
   */
  _isRowEmpty(row) {
    let isEmpty = true;
    row.eachCell((cell) => {
      if (cell.value !== null && cell.value !== undefined && cell.value !== '') {
        isEmpty = false;
      }
    });
    return isEmpty;
  }

  /**
   * Get first non-empty cell value from a row
   * @private
   * @param {Object} row - Excel row
   * @returns {string} First non-empty cell value
   */
  _getFirstNonEmptyCellValue(row) {
    let firstValue = '';
    row.eachCell({ includeEmpty: true }, (cell) => {
      if (firstValue) return;
      const value = this._getCellValue(cell);
      if (value !== null && value !== undefined && String(value).trim() !== '') {
        firstValue = String(value).trim();
      }
    });
    return firstValue;
  }

  /**
   * Detect instruction/note rows in uploaded templates
   * @private
   * @param {string} value - Cell value
   * @returns {boolean} True if row should be skipped
   */
  _isInstructionRow(value) {
    const lower = String(value || '').trim().toLowerCase();
    return lower.startsWith('catatan:') ||
      lower.startsWith('note:') ||
      lower.startsWith('instruksi:') ||
      lower.startsWith('keterangan:') ||
      lower.startsWith('contoh:') ||
      lower.startsWith('example:');
  }

  /**
   * Validate record based on entity type
   * @private
   * @param {Object} record - Record to validate
   * @param {string} entityType - Entity type
   * @param {number} rowNumber - Row number for error reporting
   * @returns {Object} Validation result
   */
  _validateRecord(record, entityType, rowNumber) {
    const errors = [];

    switch (entityType) {
      case 'BusinessUnit':
        errors.push(...this._validateBusinessUnit(record));
        break;
      case 'Division':
        errors.push(...this._validateDivision(record));
        break;
      case 'Department':
        errors.push(...this._validateDepartment(record));
        break;
      case 'Function':
        errors.push(...this._validateFunction(record));
        break;
      case 'Application':
        errors.push(...this._validateApplication(record));
        break;
      case 'FunctionAppMapping':
        errors.push(...this._validateFunctionAppMapping(record));
        break;
      case 'AppDeptMapping':
        errors.push(...this._validateAppDeptMapping(record));
        break;
      case 'users':
      case 'User':
        errors.push(...this._validateUser(record));
        break;
      default:
        errors.push(`Unknown entity type: ${entityType}`);
    }

    return { errors };
  }

  /**
   * Validate Business Unit record
   * Code is now auto-generated — only Name is required
   * @private
   */
  _validateBusinessUnit(record) {
    const errors = [];

    // Validate name
    if (!record.name || record.name.trim() === '') {
      errors.push('Name is required');
    } else if (record.name.length > 200) {
      errors.push('Name must be 1-200 characters');
    }

    if (record.status && String(record.status).trim() !== '') {
      const normalized = String(record.status).trim().toLowerCase();
      if (!['active', 'inactive'].includes(normalized)) {
        errors.push('Status must be Active or Inactive');
      }
    }

    return errors;
  }

  /**
   * Validate Division record
   * Code is now auto-generated — Name + Business Unit Name required
   * @private
   */
  _validateDivision(record) {
    const errors = [];

    // Validate name
    if (!record.name || record.name.trim() === '') {
      errors.push('Name is required');
    } else if (record.name.length > 200) {
      errors.push('Name must be 1-200 characters');
    }

    // Validate Business Unit Name
    if (!record.businessUnitName || record.businessUnitName.trim() === '') {
      errors.push('Business Unit Name is required');
    }

    if (record.status && String(record.status).trim() !== '') {
      const normalized = String(record.status).trim().toLowerCase();
      if (!['active', 'inactive'].includes(normalized)) {
        errors.push('Status must be Active or Inactive');
      }
    }

    return errors;
  }

  /**
   * Validate Department record
   * Code is now auto-generated — Name + Division Name required
   * @private
   */
  _validateDepartment(record) {
    const errors = [];

    // Validate name
    if (!record.name || record.name.trim() === '') {
      errors.push('Name is required');
    } else if (record.name.length > 200) {
      errors.push('Name must be 1-200 characters');
    }

    // Validate Division Name
    if (!record.divisionName || record.divisionName.trim() === '') {
      errors.push('Division Name is required');
    }

    if (record.status && String(record.status).trim() !== '') {
      const normalized = String(record.status).trim().toLowerCase();
      if (!['active', 'inactive'].includes(normalized)) {
        errors.push('Status must be Active or Inactive');
      }
    }

    return errors;
  }

  /**
   * Validate Function record
   * Code is now auto-generated — Name and Status are required; IT Lead Name is optional
   * @private
   */
  _validateFunction(record) {
    const errors = [];

    // Validate name
    if (!record.name || record.name.trim() === '') {
      errors.push('Name is required');
    } else if (record.name.length > 200) {
      errors.push('Name must be 1-200 characters');
    }

    if (record.status && String(record.status).trim() !== '') {
      const normalized = String(record.status).trim().toLowerCase();
      if (!['active', 'inactive'].includes(normalized)) {
        errors.push('Status must be Active or Inactive');
      }
    }

    return errors;
  }

  /**
   * Validate Application record
   * Code is now auto-generated — only Name is required; Description is optional
   * @private
   */
  _validateApplication(record) {
    const errors = [];

    // Validate name
    if (!record.name || record.name.trim() === '') {
      errors.push('Name is required');
    } else if (record.name.length > 200) {
      errors.push('Name must be 1-200 characters');
    }

    if (record.status && String(record.status).trim() !== '') {
      const normalized = String(record.status).trim().toLowerCase();
      if (!['active', 'inactive'].includes(normalized)) {
        errors.push('Status must be Active or Inactive');
      }
    }

    // Description is optional but has max length
    if (record.description && record.description.length > 500) {
      errors.push('Description must be 500 characters or less');
    }

    return errors;
  }

  /**
   * Validate Function-Application Mapping record
   * Now uses Name instead of Code
   * @private
   */
  _validateFunctionAppMapping(record) {
    const errors = [];

    // Validate function name
    if (!record.functionName || record.functionName.trim() === '') {
      errors.push('Function Name is required');
    }

    // Validate application name
    if (!record.applicationName || record.applicationName.trim() === '') {
      errors.push('Application Name is required');
    }

    return errors;
  }

  /**
   * Validate User record
   * @private
   */
  _validateUser(record) {
    const errors = [];
    
    if (!record.username || record.username.trim() === '') {
      errors.push('Username is required');
    }

    if (!record.displayName || record.displayName.trim() === '') {
      errors.push('DisplayName is required');
    }

    if (!record.email || record.email.trim() === '') {
      errors.push('Email is required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email)) {
      errors.push('Invalid email format');
    }

    if (record.phoneNumber && !/^[0-9+\-\s()]{8,20}$/.test(record.phoneNumber)) {
      errors.push('Invalid phone number format');
    }

    if (!record.role || !['SuperAdmin', 'AdminEvent', 'ITLead', 'DepartmentHead'].includes(record.role)) {
      errors.push('Role must be SuperAdmin, AdminEvent, ITLead, or DepartmentHead');
    }

    const useLdap = record.useLdap === 'true' || record.useLdap === true;
    if (!useLdap && (!record.password || record.password.length < 8)) {
      errors.push('Password must be at least 8 characters for non-LDAP users');
    }

    return errors;
  }

  /**
   * Validate Application-Department Mapping record
   * Now uses Name instead of Code
   * @private
   */
  _validateAppDeptMapping(record) {
    const errors = [];

    // Validate department name
    if (!record.departmentName || record.departmentName.trim() === '') {
      errors.push('Department Name is required');
    }

    // Validate application name
    if (!record.applicationName || record.applicationName.trim() === '') {
      errors.push('Application Name is required');
    }

    return errors;
  }

  /**
   * Generate error report
   * @param {Array} errors - Array of error objects
   * @returns {string} Formatted error report
   */
  generateErrorReport(errors) {
    if (!errors || errors.length === 0) {
      return 'No errors';
    }

    let report = `Found ${errors.length} error(s):\n\n`;
    
    errors.forEach((error, index) => {
      report += `Error ${index + 1} (Row ${error.row}):\n`;
      report += `  Data: ${JSON.stringify(error.data)}\n`;
      report += `  Issues:\n`;
      error.errors.forEach(err => {
        report += `    - ${err}\n`;
      });
      report += '\n';
    });

    return report;
  }
}

module.exports = { TemplateParser, ValidationError };
