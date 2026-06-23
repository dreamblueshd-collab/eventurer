/**
 * Migrate legacy MD5 password hashes to bcrypt
 * This script updates users with legacy password hashes to use bcrypt
 * 
 * Legacy hash format: Base64 encoded MD5 (e.g., w2cl3mpxr0owK1XAq0+rzA==)
 * Modern hash format: bcrypt (e.g., $2b$10$...)
 * 
 * IMPORTANT: This script requires knowing the original plaintext passwords
 * Default password for migrated users: admin123
 */

const bcrypt = require('bcrypt');
const db = require('../src/database/connection');
const { sql } = require('../src/database/connection');
const logger = require('../src/config/logger');

const DEFAULT_PASSWORD = 'admin123';

/**
 * Check if a hash is bcrypt format
 */
function isBcryptHash(hash) {
  return typeof hash === 'string' && /^\$2[aby]\$/.test(hash);
}

/**
 * Migrate legacy password hashes to bcrypt
 */
async function migrateLegacyPasswords() {
  let pool;
  
  try {
    pool = await db.getPool();
    logger.info('Starting legacy password migration to bcrypt...');

    // Get all users with legacy password hashes (not bcrypt)
    const result = await pool.request().query(`
      SELECT UserId, Username, DisplayName, PasswordHash
      FROM Users
      WHERE IsActive = 1
    `);

    if (result.recordset.length === 0) {
      logger.info('No users found');
      return;
    }

    logger.info(`Found ${result.recordset.length} active users`);

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Hash the default password once
    const newBcryptHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    for (const user of result.recordset) {
      // Check if already using bcrypt
      if (isBcryptHash(user.PasswordHash)) {
        logger.info(`User "${user.Username}" (${user.DisplayName}) already using bcrypt, skipping`);
        skippedCount++;
        continue;
      }

      try {
        // Update to bcrypt hash
        await pool.request()
          .input('userId', sql.BigInt, user.UserId)
          .input('passwordHash', sql.NVarChar(255), newBcryptHash)
          .query(`
            UPDATE Users
            SET PasswordHash = @passwordHash,
                UpdatedAt = GETDATE()
            WHERE UserId = @userId
          `);

        logger.info(`✓ Migrated "${user.Username}" (${user.DisplayName}) from legacy hash to bcrypt`);
        migratedCount++;
      } catch (error) {
        logger.error(`✗ Failed to migrate user "${user.Username}":`, error.message);
        errorCount++;
      }
    }

    logger.info(`\nPassword migration completed:`);
    logger.info(`  - Migrated: ${migratedCount} users`);
    logger.info(`  - Skipped: ${skippedCount} users (already bcrypt)`);
    logger.info(`  - Errors: ${errorCount} users`);
    logger.info(`\nAll migrated users now use password: ${DEFAULT_PASSWORD}`);
    logger.info(`\nSecurity Note: bcrypt automatically adds random salt to each hash,`);
    logger.info(`so even users with the same password will have different hashes.`);

  } catch (error) {
    logger.error('Error migrating legacy passwords:', error);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  migrateLegacyPasswords()
    .then(() => {
      logger.info('Migration script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateLegacyPasswords };
