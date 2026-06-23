const sql = require('../database/sql-client');

  
const BaseRepository = require('./baseRepository');
const db = require('../database/connection');
const logger = require('../config/logger');
const { ValidationError, ConflictError, NotFoundError } = require('../utils/errors');

/**
 * Application Service
 */
class ApplicationService {
  constructor() {
    this.repository = new BaseRepository('Applications', 'ApplicationId');
  }

  /**
   * Validate code format — no longer needed, Code is auto-increment
   * Kept for backward compatibility
   */
  validateCode(code) {
    return true;
  }

  /**
   * Create a new Application
   * @param {Object} data - Application data
   * @param {string} data.name - Application name (1-200 chars)
   * @param {string} [data.description] - Application description
   * @returns {Promise<Object>} Created Application
   */
  async createApplication(data) {
    try {
      // Validate name
      if (!data.name || data.name.trim().length === 0 || data.name.length > 200) {
        throw new ValidationError('Name is required and must be 1-200 characters');
      }

      const pool = await db.getPool();

      const normalizedName = String(data.name || '').trim();
      const duplicate = await pool.request()
        .input('name', sql.NVarChar(200), normalizedName)
        .query(`
          SELECT TOP 1 ApplicationId
          FROM Applications
          WHERE LOWER(LTRIM(RTRIM(Name))) = LOWER(LTRIM(RTRIM(@name)))
        `);

      if (duplicate.recordset.length > 0) {
        throw new ConflictError(`Application with name '${normalizedName}' already exists`);
      }

      // Create Application without Code - Code is now optional and nullable
      const result = await pool.request()
        .input('name', sql.NVarChar(200), normalizedName)
        .input('description', sql.NVarChar(500), data.description || null)
        .query(`
          INSERT INTO Applications (Name, Description, IsActive, CreatedAt)
          OUTPUT INSERTED.*
          VALUES (@name, @description, 1, GETDATE())
        `);

      logger.info('Application created', { name: data.name });
      return result.recordset[0];
    } catch (error) {
      if (error.name === 'ValidationError' || error.name === 'ConflictError') {
        throw error;
      }
      logger.error('Error creating Application:', error);
      throw error;
    }
  }

  /**
   * Update Application
   * @param {string} applicationId - Application ID
   * @param {Object} data - Updated data
   * @returns {Promise<Object>} Updated Application
   */
  async updateApplication(applicationId, data) {
    try {
      const pool = await db.getPool();

      // Check if Application exists
      const appCheck = await pool.request()
        .input('applicationId', sql.BigInt, applicationId)
        .query('SELECT ApplicationId FROM Applications WHERE ApplicationId = @applicationId');

      if (appCheck.recordset.length === 0) {
        throw new NotFoundError('Application not found');
      }

      // Validate code if provided — no-op since Code is auto-increment
      // (kept for backward compatibility, no validation needed)

      // Check for duplicate code if code is being changed — no-op since Code is auto-increment

      // Validate name if provided
      if (data.name !== undefined && (!data.name || data.name.trim().length === 0 || data.name.length > 200)) {
        throw new ValidationError('Name is required and must be 1-200 characters');
      }

      if (data.isActive !== undefined && typeof data.isActive !== 'boolean') {
        throw new ValidationError('isActive must be boolean');
      }

      if (data.name !== undefined) {
        const normalizedName = String(data.name || '').trim();
        const duplicate = await pool.request()
          .input('name', sql.NVarChar(200), normalizedName)
          .input('applicationId', sql.BigInt, applicationId)
          .query(`
            SELECT TOP 1 ApplicationId
            FROM Applications
            WHERE LOWER(LTRIM(RTRIM(Name))) = LOWER(LTRIM(RTRIM(@name)))
              AND ApplicationId <> @applicationId
          `);

        if (duplicate.recordset.length > 0) {
          throw new ConflictError(`Application with name '${normalizedName}' already exists`);
        }
      }

      // Build update query — Code is auto-increment, never updated
      const updateFields = [];
      const request = pool.request();
      request.input('applicationId', sql.BigInt, applicationId);

      if (data.name !== undefined) {
        updateFields.push('Name = @name');
        request.input('name', sql.NVarChar(200), String(data.name || '').trim());
      }
      if (data.description !== undefined) {
        updateFields.push('Description = @description');
        request.input('description', sql.NVarChar(sql.MAX), data.description);
      }
      if (data.isActive !== undefined) {
        updateFields.push('IsActive = @isActive');
        request.input('isActive', sql.Bit, data.isActive);
      }

      if (updateFields.length === 0) {
        throw new ValidationError('No fields to update');
      }

      updateFields.push('UpdatedAt = GETDATE()');

      const result = await request.query(`
        UPDATE Applications
        SET ${updateFields.join(', ')}
        OUTPUT INSERTED.*
        WHERE ApplicationId = @applicationId
      `);

      logger.info('Application updated', { applicationId });
      return result.recordset[0];
    } catch (error) {
      if (error.name === 'ValidationError' || error.name === 'ConflictError' || error.name === 'NotFoundError') {
        throw error;
      }
      logger.error('Error updating Application:', error);
      throw error;
    }
  }

  /**
   * Delete Application (with dependency check)
   * @param {string} applicationId - Application ID
   * @returns {Promise<boolean>} True if deleted
   */
  async deleteApplication(applicationId) {
    try {
      const pool = await db.getPool();

      // Check if Application exists
      const appCheck = await pool.request()
        .input('applicationId', sql.BigInt, applicationId)
        .query('SELECT ApplicationId FROM Applications WHERE ApplicationId = @applicationId');

      if (appCheck.recordset.length === 0) {
        throw new NotFoundError('Application not found');
      }

      // Check for active Function-Application mappings
      const funcMappingCheck = await pool.request()
        .input('applicationId', sql.BigInt, applicationId)
        .query('SELECT COUNT(*) as count FROM FunctionApplicationMappings WHERE ApplicationId = @applicationId');

      if (funcMappingCheck.recordset[0].count > 0) {
        throw new ValidationError('Cannot delete Application: active Function mappings exist');
      }

      // Check for active Application-Department mappings
      const deptMappingCheck = await pool.request()
        .input('applicationId', sql.BigInt, applicationId)
        .query('SELECT COUNT(*) as count FROM ApplicationDepartmentMappings WHERE ApplicationId = @applicationId');

      if (deptMappingCheck.recordset[0].count > 0) {
        throw new ValidationError('Cannot delete Application: active Department mappings exist');
      }

      // Check for survey responses
      const responseCheck = await pool.request()
        .input('applicationId', sql.BigInt, applicationId)
        .query('SELECT COUNT(*) as count FROM Responses WHERE ApplicationId = @applicationId');

      if (responseCheck.recordset[0].count > 0) {
        throw new ValidationError('Cannot delete Application: associated survey responses exist');
      }

      // Delete Application
      const result = await pool.request()
        .input('applicationId', sql.BigInt, applicationId)
        .query('DELETE FROM Applications WHERE ApplicationId = @applicationId');

      logger.info('Application deleted', { applicationId });
      return result.rowsAffected[0] > 0;
    } catch (error) {
      if (error.name === 'ValidationError' || error.name === 'NotFoundError') {
        throw error;
      }
      logger.error('Error deleting Application:', error);
      throw error;
    }
  }

  /**
   * Get all Applications
   * @param {Object} [filter] - Filter options
   * @param {boolean} [filter.includeInactive=false] - Include inactive Applications
   * @returns {Promise<Array>} Array of Applications
   */
  async getApplications(filter = {}) {
    try {
      const pool = await db.getPool();
      let query = 'SELECT * FROM Applications';

      if (!filter.includeInactive) {
        query += ' WHERE IsActive = 1';
      }

      query += ' ORDER BY Name';

      const result = await pool.request().query(query);
      return result.recordset;
    } catch (error) {
      logger.error('Error getting Applications:', error);
      throw error;
    }
  }

  /**
   * Get Application by ID
   * @param {string} applicationId - Application ID
   * @returns {Promise<Object>} Application
   */
  async getApplicationById(applicationId) {
    try {
      const pool = await db.getPool();
      const result = await pool.request()
        .input('applicationId', sql.BigInt, applicationId)
        .query('SELECT * FROM Applications WHERE ApplicationId = @applicationId');

      if (result.recordset.length === 0) {
        throw new NotFoundError('Application not found');
      }

      return result.recordset[0];
    } catch (error) {
      if (error.name === 'NotFoundError') {
        throw error;
      }
      logger.error('Error getting Application:', error);
      throw error;
    }
  }
}

const applicationService = new ApplicationService();

module.exports = applicationService;
module.exports.ApplicationService = ApplicationService;
module.exports.ValidationError = ValidationError;
module.exports.ConflictError = ConflictError;
module.exports.NotFoundError = NotFoundError;

