const sql = require('../database/sql-client');

  
const db = require('../database/connection');
const logger = require('../config/logger');
const { TemplateParser, ValidationError } = require('./templateParser');
const { BusinessUnitService } = require('./businessUnitService');
const { DivisionService } = require('./divisionService');
const { DepartmentService } = require('./departmentService');
const { FunctionService } = require('./functionService');
const { ApplicationService } = require('./applicationService');
const { hashPassword } = require('../utils/passwordHash');

/**
 * Bulk Import Service for batch processing of master data
 */
class BulkImportService {
  constructor() {
    this.parser = new TemplateParser();
    this.businessUnitService = new BusinessUnitService();
    this.divisionService = new DivisionService();
    this.departmentService = new DepartmentService();
    this.functionService = new FunctionService();
    this.applicationService = new ApplicationService();
  }

  normalizeBusinessUnitStatus(status) {
    const value = String(status || '').trim().toLowerCase();
    if (!value) return true;
    if (['active', '1', 'true', 'yes', 'y'].includes(value)) return true;
    if (['inactive', '0', 'false', 'no', 'n'].includes(value)) return false;
    throw new Error(`Invalid Business Unit status '${status}'. Use Active or Inactive`);
  }

  normalizeMasterStatus(status, entityLabel) {
    const value = String(status || '').trim().toLowerCase();
    if (!value) {
      return true;
    }
    if (['active', '1', 'true', 'yes', 'y'].includes(value)) return true;
    if (['inactive', '0', 'false', 'no', 'n'].includes(value)) return false;
    throw new Error(`Invalid ${entityLabel} status '${status}'. Use Active or Inactive`);
  }

  /**
   * Detect duplicate rows within the uploaded file for entities that require a unique key.
   * @private
   * @param {Array} validRecords
   * @param {Array<string>} uniqueKeyFields
   * @returns {Array}
   */
  _findDuplicateRecords(validRecords, uniqueKeyFields = []) {
    if (!Array.isArray(uniqueKeyFields) || uniqueKeyFields.length === 0) {
      return [];
    }

    const seen = new Map();
    const duplicates = [];

    for (const record of validRecords) {
      const key = uniqueKeyFields
        .map((field) => String(record.data?.[field] ?? '').trim().toLowerCase())
        .join('||');

      if (!key || key.split('||').some((part) => part === '')) {
        continue;
      }

      if (seen.has(key)) {
        const first = seen.get(key);
        duplicates.push({
          firstRow: first.row,
          row: record.row,
          key,
          data: record.data,
        });
      } else {
        seen.set(key, record);
      }
    }

    return duplicates;
  }

  /**
   * Import data from Excel file
   * @param {Buffer|Stream} fileBuffer - Excel file buffer or stream
   * @param {string} entityType - Type of entity to import
   * @param {Object} [options] - Import options (reserved for future behavior flags)
   * @returns {Promise<Object>} Import results
   */
  async importData(fileBuffer, entityType, options = {}) {
    const startTime = Date.now();
    const results = {
      success: false,
      totalRows: 0,
      imported: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
      duration: 0
    };

    let transaction;

    try {
      // Get column mapping for entity type
      logger.info('Getting entity config for:', entityType);
      const config = this._getEntityConfig(entityType);
      logger.info('Config retrieved:', config);
      
      // Parse Excel file
      logger.info('Starting bulk import', { entityType });
      const parseResult = await this.parser.parseExcelFile(fileBuffer, config);

      results.totalRows = parseResult.totalRows;

      const duplicateRecords = this._findDuplicateRecords(parseResult.validRecords, config.uniqueKeyFields);
      if (duplicateRecords.length > 0) {
        results.errors = duplicateRecords.map((dup) => ({
          row: dup.row,
          data: dup.data,
          errors: [`Duplicate data found in file. First occurrence at row ${dup.firstRow}.`]
        }));
        results.failed = duplicateRecords.length;
        throw new ValidationError(
          `Duplicate data found in upload: ${duplicateRecords.length} duplicate record(s)`,
          results.errors
        );
      }

      if (parseResult.errors.length > 0) {
        results.errors = parseResult.errors;
        results.failed = parseResult.errors.length;
        throw new ValidationError(
          `Validation failed for ${parseResult.errors.length} record(s)`,
          parseResult.errors
        );
      }

      // Start transaction
      const pool = await db.getPool();
      transaction = new sql.Transaction(pool);
      await transaction.begin();

      // Process valid records
      for (const record of parseResult.validRecords) {
        try {
          const importResult = await this._importRecord(
            record.data,
            entityType,
            transaction,
            options
          );

          if (importResult.action === 'imported') {
            results.imported++;
          } else if (importResult.action === 'updated') {
            results.updated++;
          } else if (importResult.action === 'skipped') {
            results.skipped++;
          }

          // Progress tracking
          const processed = results.imported + results.updated + results.skipped + results.failed;
          if (processed % 100 === 0) {
            logger.info('Import progress', {
              entityType,
              processed,
              total: parseResult.validRecords.length
            });
          }
        } catch (error) {
          results.failed++;
          results.errors.push({
            row: record.row,
            data: record.data,
            errors: [error.message]
          });
        }
      }

      if (results.errors.length > 0) {
        await transaction.rollback();
        transaction = null;
        throw new ValidationError(
          `Validation failed for ${results.errors.length} record(s)`,
          results.errors
        );
      }

      // Commit transaction
      await transaction.commit();
      results.success = true;

      results.duration = Date.now() - startTime;

      logger.info('Bulk import completed', {
        entityType,
        ...results
      });

      return results;
    } catch (error) {
      // Rollback transaction on error
      if (transaction) {
        try {
          await transaction.rollback();
          logger.info('Transaction rolled back due to error');
        } catch (rollbackError) {
          logger.error('Error rolling back transaction:', rollbackError);
        }
      }

      if (error.name === 'ValidationError') {
        throw error;
      }

      logger.error('Error during bulk import:', error);
      throw new ValidationError(`Bulk import failed: ${error.message}`);
    }
  }

  /**
   * Import a single record
   * @private
   * @param {Object} data - Record data
   * @param {string} entityType - Entity type
   * @param {Object} transaction - SQL transaction
   * @param {Object} options - Import options
   * @returns {Promise<Object>} Import result
   */
  async _importRecord(data, entityType, transaction, options) {
    switch (entityType) {
      case 'BusinessUnit':
        return await this._importBusinessUnit(data, transaction, options);
      case 'Division':
        return await this._importDivision(data, transaction, options);
      case 'Department':
        return await this._importDepartment(data, transaction, options);
      case 'Function':
        return await this._importFunction(data, transaction, options);
      case 'Application':
        return await this._importApplication(data, transaction, options);
      case 'FunctionAppMapping':
        return await this._importFunctionAppMapping(data, transaction, options);
      case 'AppDeptMapping':
        return await this._importAppDeptMapping(data, transaction, options);
      case 'users':
      case 'User':
        return await this._importUser(data, transaction, options);
      default:
        throw new Error(`Unknown entity type: ${entityType}`);
    }
  }

  /**
   * Import Business Unit
   * Code is now auto-increment — lookup by Name to detect duplicates
   * @private
   */
  async _importBusinessUnit(data, transaction, options) {
    const normalizedName = String(data.name || '').trim();
    // Check if exists by Name
    const checkReq = new sql.Request(transaction);
    const existing = await checkReq
      .input('name', sql.NVarChar(200), normalizedName)
      .query('SELECT BusinessUnitId FROM BusinessUnits WHERE LOWER(LTRIM(RTRIM(Name))) = LOWER(LTRIM(RTRIM(@name)))');
    const isActive = data.status !== undefined ? this.normalizeBusinessUnitStatus(data.status) : true;

    if (existing.recordset.length > 1) {
      throw new Error(`Multiple Business Units found with name '${normalizedName}'. Duplicate names must be cleaned up before import.`);
    }

    if (existing.recordset.length > 0) {
      throw new ValidationError(`Duplicate Business Unit: name '${normalizedName}' already exists`);
    }

    // Insert new without Code - Code is now optional and nullable
    const insertReq = new sql.Request(transaction);
    await insertReq
      .input('name', sql.NVarChar(200), normalizedName)
      .input('isActive', sql.Bit, isActive)
      .query(`
        INSERT INTO BusinessUnits (Name, IsActive, CreatedAt)
        VALUES (@name, @isActive, GETDATE())
      `);

    return { action: 'imported' };
  }

  /**
   * Import Division
   * Code is now auto-increment — lookup by Name + BusinessUnit to detect duplicates
   * @private
   */
  async _importDivision(data, transaction, options) {
    const normalizedName = String(data.name || '').trim();
    const normalizedBusinessUnitName = String(data.businessUnitName || '').trim();
    // Get Business Unit ID by Name
    const buReq = new sql.Request(transaction);
    const buResult = await buReq
      .input('buName', sql.NVarChar(200), normalizedBusinessUnitName)
      .query('SELECT BusinessUnitId FROM BusinessUnits WHERE LOWER(LTRIM(RTRIM(Name))) = LOWER(LTRIM(RTRIM(@buName))) AND IsActive = 1');

    if (buResult.recordset.length === 0) {
      throw new Error(`Business Unit with name '${normalizedBusinessUnitName}' not found`);
    }

    const businessUnitId = buResult.recordset[0].BusinessUnitId;

    const isActive = this.normalizeMasterStatus(data.status, 'Division');

    // Check if exists by Name + BusinessUnitId
    const checkReq = new sql.Request(transaction);
    const existing = await checkReq
      .input('name', sql.NVarChar(200), normalizedName)
      .input('businessUnitId', sql.BigInt, businessUnitId)
      .query('SELECT DivisionId FROM Divisions WHERE LOWER(LTRIM(RTRIM(Name))) = LOWER(LTRIM(RTRIM(@name))) AND BusinessUnitId = @businessUnitId');

    if (existing.recordset.length > 0) {
      throw new ValidationError(`Duplicate Division: name '${normalizedName}' already exists in this Business Unit`);
    }

    // Insert new without Code - Code is now optional and nullable
    const insertReq = new sql.Request(transaction);
    await insertReq
      .input('name', sql.NVarChar(200), normalizedName)
      .input('businessUnitId', sql.BigInt, businessUnitId)
      .input('isActive', sql.Bit, isActive)
      .query(`
        INSERT INTO Divisions (Name, BusinessUnitId, IsActive, CreatedAt)
        VALUES (@name, @businessUnitId, @isActive, GETDATE())
      `);

    return { action: 'imported' };
  }

  /**
   * Import Department
   * Code is now auto-increment — lookup by Name + DivisionId to detect duplicates
   * @private
   */
  async _importDepartment(data, transaction, options) {
    const normalizedName = String(data.name || '').trim();
    const normalizedDivisionName = String(data.divisionName || '').trim();
    // Get Division ID by Name
    const divReq = new sql.Request(transaction);
    const divResult = await divReq
      .input('divName', sql.NVarChar(200), normalizedDivisionName)
      .query('SELECT DivisionId FROM Divisions WHERE LOWER(LTRIM(RTRIM(Name))) = LOWER(LTRIM(RTRIM(@divName))) AND IsActive = 1');

    if (divResult.recordset.length === 0) {
      throw new Error(`Division with name '${normalizedDivisionName}' not found`);
    }

    const divisionId = divResult.recordset[0].DivisionId;

    const isActive = this.normalizeMasterStatus(data.status, 'Department');

    // Check if exists by Name + DivisionId
    const checkReq = new sql.Request(transaction);
    const existing = await checkReq
      .input('name', sql.NVarChar(200), normalizedName)
      .input('divisionId', sql.BigInt, divisionId)
      .query('SELECT DepartmentId FROM Departments WHERE LOWER(LTRIM(RTRIM(Name))) = LOWER(LTRIM(RTRIM(@name))) AND DivisionId = @divisionId');

    if (existing.recordset.length > 0) {
      throw new ValidationError(`Duplicate Department: name '${normalizedName}' already exists in this Division`);
    }

    // Insert new without Code - Code is now optional and nullable
    const insertReq = new sql.Request(transaction);
    await insertReq
      .input('name', sql.NVarChar(200), normalizedName)
      .input('divisionId', sql.BigInt, divisionId)
      .input('isActive', sql.Bit, isActive)
      .query(`
        INSERT INTO Departments (Name, DivisionId, IsActive, CreatedAt)
        VALUES (@name, @divisionId, @isActive, GETDATE())
      `);

    return { action: 'imported' };
  }

  /**
   * Import Function
   * Code is now auto-increment — lookup by Name to detect duplicates
   * @private
   */
  async _importFunction(data, transaction, options) {
    const normalizedName = String(data.name || '').trim();
    const normalizedItLeadName = String(data.itLeadName || '').trim();
    // Lookup IT Lead user by DisplayName if provided
    let itLeadUserId = null;
    if (normalizedItLeadName) {
      const userReq = new sql.Request(transaction);
      const userResult = await userReq
        .input('itLeadName', sql.NVarChar(200), normalizedItLeadName)
        .query('SELECT UserId FROM Users WHERE LOWER(LTRIM(RTRIM(DisplayName))) = LOWER(LTRIM(RTRIM(@itLeadName))) AND Role = \'ITLead\' AND IsActive = 1');

      if (userResult.recordset.length === 0) {
        throw new Error(`IT Lead user with display name '${normalizedItLeadName}' not found or not active`);
      }

      itLeadUserId = userResult.recordset[0].UserId;
    }

    const isActive = this.normalizeMasterStatus(data.status, 'Function');

    // Check if exists by Name
    const checkReq = new sql.Request(transaction);
    const existing = await checkReq
      .input('name', sql.NVarChar(200), normalizedName)
      .query('SELECT FunctionId FROM Functions WHERE LOWER(LTRIM(RTRIM(Name))) = LOWER(LTRIM(RTRIM(@name)))');

    if (existing.recordset.length > 0) {
      throw new ValidationError(`Duplicate Function: name '${normalizedName}' already exists`);
    }

    // Insert new without Code - Code is now optional and nullable
    const insertReq = new sql.Request(transaction);
    await insertReq
      .input('name', sql.NVarChar(200), normalizedName)
      .input('itLeadUserId', sql.BigInt, itLeadUserId)
      .input('isActive', sql.Bit, isActive)
      .query(`
        INSERT INTO Functions (Name, ITLeadUserId, IsActive, CreatedAt)
        VALUES (@name, @itLeadUserId, @isActive, GETDATE())
      `);

    return { action: 'imported' };
  }

  /**
   * Import Application
   * Code is now auto-increment — lookup by Name to detect duplicates
   * @private
   */
  async _importApplication(data, transaction, options) {
    const normalizedName = String(data.name || '').trim();
    const isActive = this.normalizeMasterStatus(data.status, 'Application');

    // Check if exists by Name
    const checkReq = new sql.Request(transaction);
    const existing = await checkReq
      .input('name', sql.NVarChar(200), normalizedName)
      .query('SELECT ApplicationId FROM Applications WHERE LOWER(LTRIM(RTRIM(Name))) = LOWER(LTRIM(RTRIM(@name)))');

    if (existing.recordset.length > 0) {
      throw new ValidationError(`Duplicate Application: name '${normalizedName}' already exists`);
    }

    // Insert new without Code - Code is now optional and nullable
    const insertReq = new sql.Request(transaction);
    await insertReq
      .input('name', sql.NVarChar(200), normalizedName)
      .input('description', sql.NVarChar(500), data.description || null)
      .input('isActive', sql.Bit, isActive)
      .query(`
        INSERT INTO Applications (Name, Description, IsActive, CreatedAt)
        VALUES (@name, @description, @isActive, GETDATE())
      `);

    return { action: 'imported' };
  }

  /**
   * Import Function-Application Mapping
   * Now uses Name instead of Code (Code is nullable/optional)
   * @private
   */
  async _importFunctionAppMapping(data, transaction, options) {
    const normalizedFunctionName = String(data.functionName || '').trim();
    const normalizedApplicationName = String(data.applicationName || '').trim();
    const funcQuery = 'SELECT FunctionId FROM Functions WHERE Name = @funcName AND IsActive = 1';

    // Get Function ID by Name
    const funcReq = new sql.Request(transaction);
    funcReq.input('funcName', sql.NVarChar(200), normalizedFunctionName);
    const funcQueryResult = await funcReq.query(funcQuery);

    if (funcQueryResult.recordset.length === 0) {
      throw new ValidationError(`Function with name '${normalizedFunctionName}' not found`);
    }

    const functionId = funcQueryResult.recordset[0].FunctionId;

    // Get Application ID by Name
    const appReq = new sql.Request(transaction);
    const appResult = await appReq
      .input('appName', sql.NVarChar(200), normalizedApplicationName)
      .query('SELECT ApplicationId FROM Applications WHERE LOWER(LTRIM(RTRIM(Name))) = LOWER(LTRIM(RTRIM(@appName))) AND IsActive = 1');

    if (appResult.recordset.length === 0) {
      throw new ValidationError(`Application with name '${normalizedApplicationName}' not found`);
    }

    const applicationId = appResult.recordset[0].ApplicationId;

    // Check if application is already mapped to a different function (ownership rule)
    const ownershipReq = new sql.Request(transaction);
    const ownershipCheck = await ownershipReq
      .input('ownershipApplicationId', sql.BigInt, applicationId)
      .query(`
        SELECT TOP 1 fam.MappingId, f.Name AS FunctionName
        FROM FunctionApplicationMappings fam
        INNER JOIN Functions f ON fam.FunctionId = f.FunctionId
        WHERE fam.ApplicationId = @ownershipApplicationId
      `);

    if (ownershipCheck.recordset.length > 0) {
      const existingOwner = ownershipCheck.recordset[0];
      if (String(existingOwner.FunctionName || '').trim().toLowerCase() !== normalizedFunctionName.toLowerCase()) {
        throw new ValidationError(`Application '${normalizedApplicationName}' is already mapped to Function '${existingOwner.FunctionName}'. One application can only belong to one function.`);
      }
    }

    // Check if mapping exists
    const checkReq = new sql.Request(transaction);
    const existing = await checkReq
      .input('functionId', sql.BigInt, functionId)
      .input('applicationId', sql.BigInt, applicationId)
      .query(`
        SELECT MappingId FROM FunctionApplicationMappings
        WHERE FunctionId = @functionId AND ApplicationId = @applicationId
      `);

    if (existing.recordset.length > 0) {
      throw new ValidationError(`Duplicate mapping: Function '${normalizedFunctionName}' and Application '${normalizedApplicationName}' already exists`);
    }

    // Insert new mapping
    const insertReq = new sql.Request(transaction);
    await insertReq
      .input('functionId', sql.BigInt, functionId)
      .input('applicationId', sql.BigInt, applicationId)
      .query(`
        INSERT INTO FunctionApplicationMappings (FunctionId, ApplicationId, CreatedAt)
        VALUES (@functionId, @applicationId, GETDATE())
      `);

    return { action: 'imported' };
  }

  /**
   * Import User
   * @private
   */
  async _importUser(data, transaction, options) {
    const normalizedUsername = String(data.username || '').trim();
    const normalizedDisplayName = String(data.displayName || '').trim();
    const normalizedEmail = String(data.email || '').trim();
    const checkReq = new sql.Request(transaction);
    const existing = await checkReq
      .input('username', sql.NVarChar(50), normalizedUsername)
      .query('SELECT UserId FROM Users WHERE LOWER(LTRIM(RTRIM(Username))) = LOWER(LTRIM(RTRIM(@username)))');

    if (existing.recordset.length > 0) {
      throw new ValidationError(`Duplicate User: username '${normalizedUsername}' already exists`);
    }

    const useLdap = data.useLdap === 'true' || data.useLdap === true;
    const isActive = data.isActive === 'true' || data.isActive === true;
    let passwordHash = null;

    if (!useLdap && data.password) {
      passwordHash = await hashPassword(data.password);
    }

    const insertReq = new sql.Request(transaction);
    await insertReq
      .input('username', sql.NVarChar(50), normalizedUsername)
      .input('npk', sql.NVarChar(50), String(data.npk || '').trim() || null)
      .input('displayName', sql.NVarChar(200), normalizedDisplayName)
      .input('email', sql.NVarChar(200), normalizedEmail)
      .input('phoneNumber', sql.NVarChar(30), String(data.phoneNumber || '').trim() || null)
      .input('role', sql.NVarChar(50), String(data.role || '').trim())
      .input('useLdap', sql.Bit, useLdap)
      .input('isActive', sql.Bit, isActive)
      .input('passwordHash', sql.NVarChar(255), passwordHash)
      .query(`
        INSERT INTO Users (Username, NPK, DisplayName, Email, PhoneNumber, Role, UseLDAP, IsActive, PasswordHash, CreatedAt)
        VALUES (@username, @npk, @displayName, @email, @phoneNumber, @role, @useLdap, @isActive, @passwordHash, GETDATE())
      `);

    return { action: 'imported' };
  }

  /**
   * Import Application-Department Mapping
   * Now uses Name instead of Code (Code is nullable/optional)
   * Supports full hierarchy: BU Name → Division Name → Department Name (matches modal form)
   * @private
   */
  async _importAppDeptMapping(data, transaction, options) {
    const normalizedBuName = String(data.buName || '').trim();
    const normalizedDivisionName = String(data.divisionName || '').trim();
    const normalizedDepartmentName = String(data.departmentName || '').trim();
    const normalizedApplicationName = String(data.applicationName || '').trim();
    let businessUnitId = null;
    let divisionId = null;

    // If BU Name provided, lookup BU first (for context/validation)
    if (normalizedBuName !== '') {
      const buReq = new sql.Request(transaction);
      const buResult = await buReq
        .input('buName', sql.NVarChar(200), normalizedBuName)
        .query('SELECT BusinessUnitId FROM BusinessUnits WHERE LOWER(LTRIM(RTRIM(Name))) = LOWER(LTRIM(RTRIM(@buName))) AND IsActive = 1');

      if (buResult.recordset.length === 0) {
        throw new ValidationError(`Business Unit with name '${normalizedBuName}' not found`);
      }

      businessUnitId = buResult.recordset[0].BusinessUnitId;
    }

    // Division Name is now REQUIRED (matches modal form requirement)
    if (!normalizedDivisionName) {
      throw new ValidationError('Division Name is required');
    }

    // Lookup Division (with optional BU filter)
    let divQuery = 'SELECT DivisionId FROM Divisions WHERE Name = @divName AND IsActive = 1';
    if (businessUnitId) {
      divQuery += ' AND BusinessUnitId = @businessUnitId';
    }

    const divReq = new sql.Request(transaction);
    divReq.input('divName', sql.NVarChar(200), normalizedDivisionName);

    if (businessUnitId) {
      divReq.input('businessUnitId', sql.BigInt, businessUnitId);
    }

    const divQueryResult = await divReq.query(divQuery);

    if (divQueryResult.recordset.length === 0) {
      if (data.buName) {
        throw new ValidationError(`Division with name '${normalizedDivisionName}' not found in Business Unit '${normalizedBuName}'`);
      } else {
        throw new ValidationError(`Division with name '${normalizedDivisionName}' not found`);
      }
    }

    if (!businessUnitId && divQueryResult.recordset.length > 1) {
      throw new ValidationError(`Multiple Divisions found with name '${normalizedDivisionName}'. Please specify BU Name to disambiguate.`);
    }

    divisionId = divQueryResult.recordset[0].DivisionId;

    // Get Department ID by Name and DivisionId
    const deptReq = new sql.Request(transaction);
    const deptQueryResult = await deptReq
      .input('deptName', sql.NVarChar(200), normalizedDepartmentName)
      .input('divisionId', sql.BigInt, divisionId)
      .query('SELECT DepartmentId FROM Departments WHERE LOWER(LTRIM(RTRIM(Name))) = LOWER(LTRIM(RTRIM(@deptName))) AND DivisionId = @divisionId AND IsActive = 1');

    if (deptQueryResult.recordset.length === 0) {
      throw new ValidationError(`Department with name '${normalizedDepartmentName}' not found in Division '${normalizedDivisionName}'`);
    }

    if (deptQueryResult.recordset.length > 1) {
      throw new ValidationError(`Multiple Departments found with name '${normalizedDepartmentName}' in Division '${normalizedDivisionName}'`);
    }

    const departmentId = deptQueryResult.recordset[0].DepartmentId;

    // Get Application ID by Name
    const appReq = new sql.Request(transaction);
    const appResult = await appReq
      .input('appName', sql.NVarChar(200), normalizedApplicationName)
      .query('SELECT ApplicationId FROM Applications WHERE LOWER(LTRIM(RTRIM(Name))) = LOWER(LTRIM(RTRIM(@appName))) AND IsActive = 1');

    if (appResult.recordset.length === 0) {
      throw new ValidationError(`Application with name '${normalizedApplicationName}' not found`);
    }

    const applicationId = appResult.recordset[0].ApplicationId;

    // Check if mapping exists
    const checkReq = new sql.Request(transaction);
    const existing = await checkReq
      .input('applicationId', sql.BigInt, applicationId)
      .input('departmentId', sql.BigInt, departmentId)
      .query(`
        SELECT MappingId FROM ApplicationDepartmentMappings
        WHERE ApplicationId = @applicationId AND DepartmentId = @departmentId
      `);

    if (existing.recordset.length > 0) {
      throw new ValidationError(`Duplicate mapping: Department '${normalizedDepartmentName}' and Application '${normalizedApplicationName}' already exists`);
    }

    // Insert new mapping
    const insertReq = new sql.Request(transaction);
    await insertReq
      .input('applicationId', sql.BigInt, applicationId)
      .input('departmentId', sql.BigInt, departmentId)
      .query(`
        INSERT INTO ApplicationDepartmentMappings (ApplicationId, DepartmentId, CreatedAt)
        VALUES (@applicationId, @departmentId, GETDATE())
      `);

    return { action: 'imported' };
  }

  /**
   * Get entity configuration for parsing
   * @private
   * @param {string} entityType - Entity type
   * @returns {Object} Configuration object
   */
  _getEntityConfig(entityType) {
    const configs = {
      BusinessUnit: {
        entityType: 'BusinessUnit',
        allowExtraColumns: false,
        columnMapping: {
          'Name': 'name',
          'Status': 'status'
        },
        optionalColumns: ['Status'],
        headerAliases: {
          Name: ['BU Name']
        },
        uniqueKeyFields: ['name']
      },
      Division: {
        entityType: 'Division',
        allowExtraColumns: false,
        columnMapping: {
          'Name': 'name',
          'Business Unit Name': 'businessUnitName',
          'Status': 'status'
        },
        optionalColumns: ['Status'],
        headerAliases: {
          Name: ['Divisi Name'],
          'Business Unit Name': ['BU Name']
        },
        uniqueKeyFields: ['name', 'businessUnitName']
      },
      Department: {
        entityType: 'Department',
        allowExtraColumns: false,
        columnMapping: {
          'Name': 'name',
          'Division Name': 'divisionName',
          'BU Name': 'buName',
          'Status': 'status'
        },
        optionalColumns: ['Status', 'BU Name'],
        headerAliases: {
          Name: ['Department Name'],
          'Division Name': ['Divisi Name'],
          'BU Name': ['Business Unit Name']
        },
        uniqueKeyFields: ['name', 'divisionName']
      },
      Function: {
        entityType: 'Function',
        allowExtraColumns: false,
        columnMapping: {
          'Name': 'name',
          'IT Lead Name': 'itLeadName',
          'Status': 'status'
        },
        optionalColumns: ['Status', 'IT Lead Name'],
        headerAliases: {
          Name: ['Function Name']
        },
        uniqueKeyFields: ['name']
      },
      Application: {
        entityType: 'Application',
        allowExtraColumns: false,
        columnMapping: {
          'Name': 'name',
          'Description': 'description',
          'Status': 'status'
        },
        optionalColumns: ['Status', 'Description'],
        headerAliases: {
          Name: ['App Name']
        },
        uniqueKeyFields: ['name']
      },
      FunctionAppMapping: {
        entityType: 'FunctionAppMapping',
        allowExtraColumns: false,
        columnMapping: {
          'Function Name': 'functionName',
          'Application Name': 'applicationName'
        },
        uniqueKeyFields: ['functionName', 'applicationName']
      },
      AppDeptMapping: {
        entityType: 'AppDeptMapping',
        allowExtraColumns: false,
        columnMapping: {
          'BU Name': 'buName',
          'Division Name': 'divisionName',
          'Department Name': 'departmentName',
          'Application Name': 'applicationName'
        },
        headerAliases: {
          'BU Name': ['Business Unit Name'],
          'Division Name': ['Divisi Name']
        },
        uniqueKeyFields: ['divisionName', 'departmentName', 'applicationName']
      },
      users: {
        entityType: 'users',
        allowExtraColumns: false,
        columnMapping: {
          'Username *': 'username',
          'NPK': 'npk',
          'DisplayName *': 'displayName',
          'Email *': 'email',
          'PhoneNumber': 'phoneNumber',
          'Role *': 'role',
          'IsActive *': 'isActive',
          'UseLDAP *': 'useLdap',
          'Password': 'password'
        },
        uniqueKeyFields: ['username']
      }
    };

    const config = configs[entityType];
    if (!config) {
      throw new Error(`Unknown entity type: ${entityType}`);
    }

    return config;
  }

  /**
   * Generate import summary report
   * @param {Object} results - Import results
   * @returns {string} Formatted report
   */
  generateReport(results) {
    let report = '=== Bulk Import Report ===\n\n';
    report += `Status: ${results.success ? 'SUCCESS' : 'FAILED'}\n`;
    report += `Duration: ${results.duration}ms\n\n`;
    report += `Total Rows: ${results.totalRows}\n`;
    report += `Imported: ${results.imported}\n`;
    report += `Updated: ${results.updated}\n`;
    report += `Skipped: ${results.skipped}\n`;
    report += `Failed: ${results.failed}\n\n`;

    if (results.errors.length > 0) {
      report += `Errors (${results.errors.length}):\n`;
      results.errors.forEach((error, index) => {
        report += `\n${index + 1}. Row ${error.row}:\n`;
        report += `   Data: ${JSON.stringify(error.data)}\n`;
        report += `   Issues:\n`;
        error.errors.forEach(err => {
          report += `     - ${err}\n`;
        });
      });
    }

    return report;
  }

  /**
   * Import mappings from Excel file
   * Wrapper method for importData with proper entity type conversion
   * @param {Buffer} fileBuffer - Excel file buffer
   * @param {string} mappingType - Type of mapping ('function-application' or 'application-department')
   * @param {number} [userId] - User ID who initiated the import
   * @returns {Promise<Object>} Import results
   */
  async importMappings(fileBuffer, mappingType, userId = null) {
    try {
      // Convert mapping type to entity type
      let entityType;
      if (mappingType === 'function-application') {
        entityType = 'FunctionAppMapping';
      } else if (mappingType === 'application-department') {
        entityType = 'AppDeptMapping';
      } else {
        throw new Error(`Invalid mapping type: ${mappingType}. Must be 'function-application' or 'application-department'`);
      }

      // Call importData with appropriate entity type
      const result = await this.importData(fileBuffer, entityType);

      return {
        success: result.success,
        message: result.success ? 'Mappings imported successfully' : 'Import failed',
        errorMessage: result.success ? null : 'Some mappings could not be imported',
        imported: result.imported,
        updated: result.updated,
        skipped: result.skipped,
        failed: result.failed,
        errors: result.errors
      };
    } catch (error) {
      logger.error('Import mappings error:', error);
      if (error.name === 'ValidationError') {
        return {
          success: false,
          statusCode: 422,
          message: error.message || 'Import failed',
          errorMessage: error.message || 'An error occurred during import',
          imported: 0,
          updated: 0,
          skipped: 0,
          failed: 0,
          errors: error.details || []
        };
      }
      return {
        success: false,
        statusCode: 500,
        message: 'Import failed',
        errorMessage: error.message || 'An error occurred during import',
        imported: 0,
        updated: 0,
        skipped: 0,
        failed: 0,
        errors: []
      };
    }
  }
}

module.exports = { BulkImportService, ValidationError };

