const sql = require('../database/sql-client');

  
const BaseRepository = require('./baseRepository');
const db = require('../database/connection');
const logger = require('../config/logger');
const { hashPassword, verifyPassword } = require('../utils/passwordHash');

/**
 * Custom error classes
 */
class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 422;
  }
}

class ConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConflictError';
    this.statusCode = 409;
  }
}

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

/**
 * User Management Service with LDAP toggle support
 */
class UserService {
  constructor() {
    this.repository = new BaseRepository('Users', 'UserId');
  }

  isUuid(value) {
    return false; // UUID no longer used — all IDs are BIGINT
  }

  mapUserRecord(user) {
    if (!user) {
      return user;
    }

    const mappedUser = { ...user };
    mappedUser.UserKey = mappedUser.Username;
    delete mappedUser.PasswordHash;
    return mappedUser;
  }

  async resolveUserId(userIdentifier) {
    const normalizedIdentifier = String(userIdentifier || '').trim();
    if (!normalizedIdentifier) {
      throw new ValidationError('User identifier is required');
    }

    const numericId = Number(normalizedIdentifier);
    if (Number.isInteger(numericId) && numericId > 0) {
      return numericId;
    }

    // Fallback: lookup by username
    const pool = await db.getPool();
    const result = await pool.request()
      .input('username', sql.NVarChar(50), normalizedIdentifier)
      .query(`
        SELECT TOP 1 UserId
        FROM Users
        WHERE Username = @username
      `);

    if (result.recordset.length === 0) {
      throw new NotFoundError('User not found');
    }

    return result.recordset[0].UserId;
  }

  /**
   * Validate email format
   * @param {string} email - Email address
   * @returns {boolean} True if valid
   */
  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  normalizePhoneNumber(phoneNumber) {
    const digits = String(phoneNumber || '').replace(/\D/g, '');
    if (!digits) {
      return null;
    }

    if (digits.startsWith('62')) {
      return digits;
    }

    if (digits.startsWith('0')) {
      return `62${digits.slice(1)}`;
    }

    return digits;
  }

  validatePhoneNumber(phoneNumber) {
    const normalized = this.normalizePhoneNumber(phoneNumber);
    return !normalized || (normalized.length >= 10 && normalized.length <= 15);
  }

  /**
   * Validate username format
   * @param {string} username - Username
   * @returns {boolean} True if valid
   */
  validateUsername(username) {
    // 3-50 characters, allow dot/underscore/hyphen for LDAP-style usernames (e.g. adam.cid00676)
    const usernameRegex = /^[a-zA-Z0-9._-]{3,50}$/;
    return usernameRegex.test(username);
  }

  /**
   * Create a new user
   * @param {Object} data - User data
   * @param {string} data.username - Username (3-50 chars, alphanumeric + underscore)
   * @param {string} data.displayName - Display name
   * @param {string} data.email - Email address
   * @param {string} data.role - User role (SuperAdmin, AdminEvent, ITLead, DepartmentHead)
   * @param {boolean} [data.useLDAP=true] - Whether to use LDAP authentication
   * @param {string} [data.password] - Password (required if useLDAP is false)
   * @returns {Promise<Object>} Created user
   */
  async createUser(data) {
    try {
      // Validate username
      if (!this.validateUsername(data.username)) {
        throw new ValidationError('Username must be 3-50 characters and only contain letters, numbers, dot, underscore, or hyphen');
      }

      // Validate email
      if (!this.validateEmail(data.email)) {
        throw new ValidationError('Invalid email format');
      }

      // Validate role
      const validRoles = ['SuperAdmin', 'AdminEvent', 'ITLead', 'DepartmentHead'];
      if (!validRoles.includes(data.role)) {
        throw new ValidationError(`Role must be one of: ${validRoles.join(', ')}`);
      }

      if (data.phoneNumber !== undefined && !this.validatePhoneNumber(data.phoneNumber)) {
        throw new ValidationError('Invalid phone number format');
      }

      const pool = await db.getPool();

      // Check for duplicate username
      const usernameCheck = await pool.request()
        .input('username', sql.NVarChar(50), data.username)
        .query('SELECT UserId FROM Users WHERE Username = @username');

      if (usernameCheck.recordset.length > 0) {
        throw new ConflictError(`Username '${data.username}' already exists`);
      }

      // Check for duplicate email
      const emailCheck = await pool.request()
        .input('email', sql.NVarChar(200), data.email)
        .query('SELECT UserId FROM Users WHERE Email = @email');

      if (emailCheck.recordset.length > 0) {
        throw new ConflictError(`Email '${data.email}' already exists`);
      }

      const normalizedPhoneNumber = this.normalizePhoneNumber(data.phoneNumber);
      if (normalizedPhoneNumber) {
        const phoneCheck = await pool.request()
          .input('phoneNumber', sql.NVarChar(30), normalizedPhoneNumber)
          .query('SELECT UserId FROM Users WHERE PhoneNumber = @phoneNumber');

        if (phoneCheck.recordset.length > 0) {
          throw new ConflictError(`Phone number '${normalizedPhoneNumber}' already exists`);
        }
      }

      // Handle password hashing for non-LDAP users
      let passwordHash = null;
      const useLDAP = data.useLDAP !== false; // Default to true

      if (!useLDAP) {
        if (!data.password) {
          throw new ValidationError('Password is required for non-LDAP users');
        }
        if (data.password.length < 8) {
          throw new ValidationError('Password must be at least 8 characters');
        }
        passwordHash = await hashPassword(data.password);
      }

      // Create user
      const result = await pool.request()
        .input('username', sql.NVarChar(50), data.username)
        .input('displayName', sql.NVarChar(200), data.displayName)
        .input('npk', sql.NVarChar(50), data.npk || null)
        .input('email', sql.NVarChar(200), data.email)
        .input('phoneNumber', sql.NVarChar(30), normalizedPhoneNumber)
        .input('role', sql.NVarChar(50), data.role)
        .input('useLDAP', sql.Bit, useLDAP)
        .input('passwordHash', sql.NVarChar(255), passwordHash)
        .query(`
          INSERT INTO Users (
            Username, NPK, DisplayName, Email, PhoneNumber, Role, UseLDAP, PasswordHash,
            IsActive, CreatedAt
          )
          OUTPUT INSERTED.*
          VALUES (
            @username, @npk, @displayName, @email, @phoneNumber, @role, @useLDAP, @passwordHash,
            1, GETDATE()
          )
        `);

      logger.info('User created', { username: data.username, useLDAP });
      
      // Remove password hash from response
      return this.mapUserRecord(result.recordset[0]);
    } catch (error) {
      if (error.name === 'ValidationError' || error.name === 'ConflictError') {
        throw error;
      }
      logger.error('Error creating user:', error);
      throw error;
    }
  }

  /**
   * Update user information
   * @param {string} userId - User ID
   * @param {Object} data - Updated user data
   * @returns {Promise<Object>} Updated user
   */
  async updateUser(userId, data) {
    try {
      const resolvedUserId = await this.resolveUserId(userId);
      const pool = await db.getPool();

      // Check if user exists
      const userCheck = await pool.request()
        .input('userId', sql.BigInt, resolvedUserId)
        .query(`
          SELECT UserId, Username, NPK
          FROM Users
          WHERE UserId = @userId
        `);

      if (userCheck.recordset.length === 0) {
        throw new NotFoundError('User not found');
      }

      // Validate email if provided
      if (data.email && !this.validateEmail(data.email)) {
        throw new ValidationError('Invalid email format');
      }

      if (data.phoneNumber !== undefined && !this.validatePhoneNumber(data.phoneNumber)) {
        throw new ValidationError('Invalid phone number format');
      }

      // Validate username if provided
      if (data.username !== undefined) {
        const normalizedUsername = String(data.username || '').trim();
        if (!this.validateUsername(normalizedUsername)) {
          throw new ValidationError('Username must be 3-50 characters and only contain letters, numbers, dot, underscore, or hyphen');
        }

        const usernameCheck = await pool.request()
          .input('username', sql.NVarChar(50), normalizedUsername)
          .input('userId', sql.BigInt, resolvedUserId)
          .query('SELECT UserId FROM Users WHERE Username = @username AND UserId != @userId');

        if (usernameCheck.recordset.length > 0) {
          throw new ConflictError(`Username '${normalizedUsername}' already exists`);
        }
      }

      // Check for duplicate email if email is being changed
      if (data.email) {
        const emailCheck = await pool.request()
          .input('email', sql.NVarChar(200), data.email)
          .input('userId', sql.BigInt, resolvedUserId)
          .query('SELECT UserId FROM Users WHERE Email = @email AND UserId != @userId');

        if (emailCheck.recordset.length > 0) {
          throw new ConflictError(`Email '${data.email}' already exists`);
        }
      }

      const normalizedPhoneNumber = data.phoneNumber !== undefined
        ? this.normalizePhoneNumber(data.phoneNumber)
        : undefined;
      if (normalizedPhoneNumber) {
        const phoneCheck = await pool.request()
          .input('phoneNumber', sql.NVarChar(30), normalizedPhoneNumber)
          .input('userId', sql.BigInt, resolvedUserId)
          .query('SELECT UserId FROM Users WHERE PhoneNumber = @phoneNumber AND UserId != @userId');

        if (phoneCheck.recordset.length > 0) {
          throw new ConflictError(`Phone number '${normalizedPhoneNumber}' already exists`);
        }
      }

      // Validate role if provided
      if (data.role) {
        const validRoles = ['SuperAdmin', 'AdminEvent', 'ITLead', 'DepartmentHead'];
        if (!validRoles.includes(data.role)) {
          throw new ValidationError(`Role must be one of: ${validRoles.join(', ')}`);
        }
      }

      // Build update query dynamically
      const updateFields = [];
      const request = pool.request();
      request.input('userId', sql.BigInt, resolvedUserId);

      if (data.npk !== undefined) {
        updateFields.push('NPK = @npk');
        request.input('npk', sql.NVarChar(50), data.npk || null);
      }
      if (data.username !== undefined) {
        updateFields.push('Username = @username');
        request.input('username', sql.NVarChar(50), String(data.username).trim());
      }
      if (data.displayName !== undefined) {
        updateFields.push('DisplayName = @displayName');
        request.input('displayName', sql.NVarChar(200), data.displayName);
      }
      if (data.email !== undefined) {
        updateFields.push('Email = @email');
        request.input('email', sql.NVarChar(200), data.email);
      }
      if (data.phoneNumber !== undefined) {
        updateFields.push('PhoneNumber = @phoneNumber');
        request.input('phoneNumber', sql.NVarChar(30), normalizedPhoneNumber);
      }
      if (data.role !== undefined) {
        updateFields.push('Role = @role');
        request.input('role', sql.NVarChar(50), data.role);
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
        UPDATE Users
        SET ${updateFields.join(', ')}
        OUTPUT INSERTED.*
        WHERE UserId = @userId
      `);

      logger.info('User updated', { userId: resolvedUserId, userIdentifier: userId });
      return this.mapUserRecord(result.recordset[0]);
    } catch (error) {
      if (error.name === 'ValidationError' || error.name === 'ConflictError' || error.name === 'NotFoundError') {
        throw error;
      }
      logger.error('Error updating user:', error);
      throw error;
    }
  }

  /**
   * Deactivate a user (soft delete)
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Deactivated user
   */
  async deactivateUser(userId) {
    try {
      const resolvedUserId = await this.resolveUserId(userId);
      const pool = await db.getPool();

      const result = await pool.request()
        .input('userId', sql.BigInt, resolvedUserId)
        .query(`
          UPDATE Users
          SET IsActive = 0, UpdatedAt = GETDATE()
          OUTPUT INSERTED.*
          WHERE UserId = @userId
        `);

      if (result.recordset.length === 0) {
        throw new NotFoundError('User not found');
      }

      logger.info('User deactivated', { userId: resolvedUserId, userIdentifier: userId });
      return this.mapUserRecord(result.recordset[0]);
    } catch (error) {
      if (error.name === 'NotFoundError') {
        throw error;
      }
      logger.error('Error deactivating user:', error);
      throw error;
    }
  }

  /**
   * Get user by ID
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} User data or null
   */
  async getUserById(userId) {
    try {
      const resolvedUserId = await this.resolveUserId(userId);
      const pool = await db.getPool();
      const result = await pool.request()
        .input('userId', sql.BigInt, resolvedUserId)
        .query(`
          SELECT
            u.UserId,
            u.Username,
            u.NPK,
            u.DisplayName,
            u.Email,
            u.PhoneNumber,
            u.Role,
            u.UseLDAP,
            u.IsActive,
            u.CreatedAt,
            u.UpdatedAt
          FROM Users u
          WHERE u.UserId = @userId
        `);

      if (result.recordset.length === 0) {
        return null;
      }

      return this.mapUserRecord(result.recordset[0]);
    } catch (error) {
      logger.error('Error getting user by ID:', error);
      throw error;
    }
  }

  /**
   * Get users with optional filtering
   * @param {Object} [filter] - Filter options
   * @param {boolean} [filter.includeInactive=false] - Include inactive users
   * @param {string} [filter.role] - Filter by role
   * @returns {Promise<Array>} Array of users
   */
  async getUsers(filter = {}) {
    try {
      const pool = await db.getPool();
      const conditions = [];
      const request = pool.request();

      if (typeof filter.isActive === 'boolean') {
        conditions.push('u.IsActive = @isActive');
        request.input('isActive', sql.Bit, filter.isActive);
      } else if (!filter.includeInactive) {
        conditions.push('u.IsActive = 1');
      }

      if (filter.role) {
        conditions.push('u.Role = @role');
        request.input('role', sql.NVarChar(50), filter.role);
      }

      if (filter.search) {
        conditions.push("(u.Username LIKE @search OR ISNULL(u.NPK,'') LIKE @search OR u.DisplayName LIKE @search OR u.Email LIKE @search OR ISNULL(u.PhoneNumber,'') LIKE @search)");
        request.input('search', sql.NVarChar(210), `%${filter.search}%`);
      }

      let query = `
        SELECT
          u.UserId,
          u.Username,
          u.NPK,
          u.DisplayName,
          u.Email,
          u.PhoneNumber,
          u.Role,
          u.UseLDAP,
          u.IsActive,
          u.CreatedAt,
          u.UpdatedAt
        FROM Users u
      `;
      
      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }

      query += ' ORDER BY u.DisplayName';

      const result = await request.query(query);
      return result.recordset.map((user) => this.mapUserRecord(user));
    } catch (error) {
      logger.error('Error getting users:', error);
      throw error;
    }
  }

  /**
   * Toggle LDAP authentication for a user
   * @param {string} userId - User ID
   * @param {boolean} useLDAP - Whether to use LDAP
   * @returns {Promise<Object>} Updated user
   */
  async toggleUserLDAP(userId, useLDAP) {
    try {
      const resolvedUserId = await this.resolveUserId(userId);
      const pool = await db.getPool();

      // If switching to non-LDAP, ensure password is set
      if (!useLDAP) {
        const userCheck = await pool.request()
          .input('userId', sql.BigInt, resolvedUserId)
          .query('SELECT PasswordHash FROM Users WHERE UserId = @userId');

        if (userCheck.recordset.length === 0) {
          throw new NotFoundError('User not found');
        }

        if (!userCheck.recordset[0].PasswordHash) {
          throw new ValidationError('Cannot disable LDAP: user has no password set. Set a password first.');
        }
      }

      const result = await pool.request()
        .input('userId', sql.BigInt, resolvedUserId)
        .input('useLDAP', sql.Bit, useLDAP)
        .query(`
          UPDATE Users
          SET UseLDAP = @useLDAP, UpdatedAt = GETDATE()
          OUTPUT INSERTED.*
          WHERE UserId = @userId
        `);

      if (result.recordset.length === 0) {
        throw new NotFoundError('User not found');
      }

      logger.info('User LDAP toggle updated', { userId: resolvedUserId, userIdentifier: userId, useLDAP });
      return this.mapUserRecord(result.recordset[0]);
    } catch (error) {
      if (error.name === 'ValidationError' || error.name === 'NotFoundError') {
        throw error;
      }
      logger.error('Error toggling user LDAP:', error);
      throw error;
    }
  }

  /**
   * Set or update user password (for non-LDAP users)
   * @param {string} userId - User ID
   * @param {string} password - New password
   * @returns {Promise<Object>} Updated user
   */
  async setUserPassword(userId, password) {
    try {
      const resolvedUserId = await this.resolveUserId(userId);
      if (!password || password.length < 8) {
        throw new ValidationError('Password must be at least 8 characters');
      }

      const pool = await db.getPool();

      // Check if user exists
      const userCheck = await pool.request()
        .input('userId', sql.BigInt, resolvedUserId)
        .query('SELECT UserId FROM Users WHERE UserId = @userId');

      if (userCheck.recordset.length === 0) {
        throw new NotFoundError('User not found');
      }

      // Hash password
      const passwordHash = await hashPassword(password);

      const result = await pool.request()
        .input('userId', sql.BigInt, resolvedUserId)
        .input('passwordHash', sql.NVarChar(255), passwordHash)
        .query(`
          UPDATE Users
          SET PasswordHash = @passwordHash, UpdatedAt = GETDATE()
          OUTPUT INSERTED.*
          WHERE UserId = @userId
        `);

      logger.info('User password updated', { userId: resolvedUserId, userIdentifier: userId });
      return this.mapUserRecord(result.recordset[0]);
    } catch (error) {
      if (error.name === 'ValidationError' || error.name === 'NotFoundError') {
        throw error;
      }
      logger.error('Error setting user password:', error);
      throw error;
    }
  }

  /**
   * Verify user password (for non-LDAP users)
   * @param {string} userId - User ID
   * @param {string} password - Password to verify
   * @returns {Promise<boolean>} True if password matches
   */
  async verifyPassword(userId, password) {
    try {
      const resolvedUserId = await this.resolveUserId(userId);
      const pool = await db.getPool();

      const result = await pool.request()
        .input('userId', sql.BigInt, resolvedUserId)
        .query('SELECT PasswordHash, UseLDAP FROM Users WHERE UserId = @userId AND IsActive = 1');

      if (result.recordset.length === 0) {
        return false;
      }

      const user = result.recordset[0];

      if (user.UseLDAP) {
        throw new ValidationError('User is configured for LDAP authentication');
      }

      if (!user.PasswordHash) {
        return false;
      }

      return await verifyPassword(password, user.PasswordHash);
    } catch (error) {
      if (error.name === 'ValidationError') {
        throw error;
      }
      logger.error('Error verifying password:', error);
      throw error;
    }
  }
}

const userService = new UserService();

module.exports = userService;
module.exports.UserService = UserService;
module.exports.ValidationError = ValidationError;
module.exports.ConflictError = ConflictError;
module.exports.NotFoundError = NotFoundError;


