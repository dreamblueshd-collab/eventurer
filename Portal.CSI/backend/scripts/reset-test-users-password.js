/**
 * Reset Test Users Password to Standard Hash
 * 
 * For development/testing: All test users will use the SAME password hash
 * This makes it easy for support team to:
 * 1. Test login with standard password
 * 2. Reset password by copying the same hash to database
 * 3. Restore original hash after testing
 * 
 * Password: admin123
 * Standard Hash (bcrypt): $2b$10$rQZ5vZ0cZ5Z5Z5Z5Z5Z5Z.5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5
 * 
 * IMPORTANT: This is for DEVELOPMENT/TESTING only!
 * In production, each user should have unique hash even with same password.
 */

const db = require('../src/database/connection');
const { sql } = require('../src/database/connection');
const logger = require('../src/config/logger');

// Pre-generated bcrypt hash for password "admin123"
// This hash will be REUSED for all test users for easy support
// Generated once with: bcrypt.hash('admin123', 10)
const STANDARD_TEST_HASH = '$2b$10$UzqeEMr.JzbYp3ZLXoKfD.3trMKBT7YaqkxY1fqqtGzMWdvy2VSfa';

const TEST_PASSWORD = 'admin123';

/**
 * Reset all active users to use standard test password hash
 * @param {string[]} excludeUsers - Usernames to exclude from reset (e.g., production users)
 */
async function resetTestUsersPassword(excludeUsers = []) {
  let pool;
  
  try {
    pool = await db.getPool();
    logger.info('Starting test users password reset to standard hash...');
    logger.info(`Standard test password: ${TEST_PASSWORD}`);
    logger.info(`Standard hash: ${STANDARD_TEST_HASH}`);
    
    if (excludeUsers.length > 0) {
      logger.info(`Excluding users: ${excludeUsers.join(', ')}`);
    }

    // Get all active users (excluding specified users and LDAP users)
    // LDAP users authenticate via LDAP service, their passwords are NOT in database
    let query = `
      SELECT UserId, Username, DisplayName, Role, PasswordHash, UseLDAP
      FROM Users
      WHERE IsActive = 1
        AND UseLDAP = 0
    `;
    
    if (excludeUsers.length > 0) {
      const placeholders = excludeUsers.map((_, i) => `@exclude${i}`).join(', ');
      query += ` AND Username NOT IN (${placeholders})`;
    }
    
    const request = pool.request();
    excludeUsers.forEach((username, i) => {
      request.input(`exclude${i}`, sql.NVarChar(50), username);
    });
    
    const result = await request.query(query);

    if (result.recordset.length === 0) {
      logger.info('No users found to reset');
      return;
    }

    logger.info(`Found ${result.recordset.length} non-LDAP users to reset\n`);

    // Check how many LDAP users were skipped
    const ldapUsersResult = await pool.request().query(`
      SELECT COUNT(*) as LdapCount FROM Users WHERE IsActive = 1 AND UseLDAP = 1
    `);
    const ldapCount = ldapUsersResult.recordset[0].LdapCount;
    if (ldapCount > 0) {
      logger.info(`ℹ️  Skipping ${ldapCount} LDAP users (authenticate via LDAP service, not database)\n`);
    }

    let resetCount = 0;
    let skippedCount = 0;

    for (const user of result.recordset) {
      // Skip if already using the standard hash
      if (user.PasswordHash === STANDARD_TEST_HASH) {
        logger.info(`User "${user.Username}" (${user.DisplayName}) already using standard hash, skipping`);
        skippedCount++;
        continue;
      }

      // Update to standard test hash
      await pool.request()
        .input('userId', sql.BigInt, user.UserId)
        .input('passwordHash', sql.NVarChar(255), STANDARD_TEST_HASH)
        .query(`
          UPDATE Users
          SET PasswordHash = @passwordHash,
              UpdatedAt = GETDATE()
          WHERE UserId = @userId
        `);

      logger.info(`✓ Reset "${user.Username}" (${user.DisplayName}, ${user.Role}) to standard test password`);
      resetCount++;
    }

    logger.info(`\nPassword reset completed:`);
    logger.info(`  - Reset: ${resetCount} users (non-LDAP)`);
    logger.info(`  - Skipped: ${skippedCount} users (already standard hash)`);
    if (ldapCount > 0) {
      logger.info(`  - LDAP users: ${ldapCount} (not managed in database)`);
    }
    logger.info(`\n✅ All non-LDAP test users now use the SAME password hash`);
    logger.info(`\n📋 For Support Team:`);
    logger.info(`   Password: ${TEST_PASSWORD}`);
    logger.info(`   Hash to copy for reset: ${STANDARD_TEST_HASH}`);
    logger.info(`\n   To reset any non-LDAP user in database:`);
    logger.info(`   UPDATE Users SET PasswordHash = '${STANDARD_TEST_HASH}' WHERE Username = 'username' AND UseLDAP = 0`);

  } catch (error) {
    logger.error('Error resetting test users password:', error);
    throw error;
  }
}

/**
 * Generate new standard hash (if needed to change password)
 */
async function generateNewStandardHash(password = TEST_PASSWORD) {
  const bcrypt = require('bcrypt');
  const hash = await bcrypt.hash(password, 10);
  logger.info(`New standard hash for password "${password}":`);
  logger.info(hash);
  logger.info(`\nUpdate STANDARD_TEST_HASH constant in this file with this hash.`);
  return hash;
}

// Run if executed directly
if (require.main === module) {
  // Check for command line arguments
  const args = process.argv.slice(2);
  
  if (args.includes('--generate-hash')) {
    const password = args[args.indexOf('--generate-hash') + 1] || TEST_PASSWORD;
    generateNewStandardHash(password)
      .then(() => process.exit(0))
      .catch(err => {
        logger.error('Failed to generate hash:', err);
        process.exit(1);
      });
    return;
  }
  
  // Parse exclude users from command line: --exclude user1 user2 user3
  let excludeUsers = [];
  if (args.includes('--exclude')) {
    const excludeIndex = args.indexOf('--exclude');
    excludeUsers = args.slice(excludeIndex + 1).filter(arg => !arg.startsWith('--'));
  }
  
  resetTestUsersPassword(excludeUsers)
    .then(() => {
      logger.info('Reset script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Reset script failed:', error);
      process.exit(1);
    });
}

module.exports = { resetTestUsersPassword, generateNewStandardHash };
