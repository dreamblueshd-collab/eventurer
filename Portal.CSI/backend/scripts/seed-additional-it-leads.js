/**
 * Seed additional IT Lead users for testing and demonstration
 * Creates IT Lead users that can be assigned to Functions
 */

const bcrypt = require('bcrypt');
const db = require('../src/database/connection');
const { sql } = require('../src/database/connection');
const logger = require('../src/config/logger');

/**
 * Additional IT Lead users for seeding
 * Each will be created with role 'ITLead' and IsActive = 1
 */
const ADDITIONAL_IT_LEADS = [
  { username: 'itlead3', displayName: 'Ahmad Ridwan', email: 'ahmad.ridwan@company.co.id', npk: '1001' },
  { username: 'itlead4', displayName: 'Dewi Kusuma', email: 'dewi.kusuma@company.co.id', npk: '1002' },
  { username: 'itlead5', displayName: 'Budi Santoso', email: 'budi.santoso@company.co.id', npk: '1003' },
];

const DEFAULT_PASSWORD = 'admin123';

async function seedAdditionalITLeads() {
  let pool;
  
  try {
    pool = await db.getPool();
    logger.info('Starting additional IT Lead users seeding...');

    // Get default BU, Division, Department for IT Leads
    const orgResult = await pool.request().query(`
      SELECT TOP 1 
        bu.BusinessUnitId,
        div.DivisionId,
        dept.DepartmentId
      FROM BusinessUnits bu
      INNER JOIN Divisions div ON bu.BusinessUnitId = div.BusinessUnitId
      INNER JOIN Departments dept ON div.DivisionId = dept.DivisionId
      WHERE bu.IsActive = 1 AND div.IsActive = 1 AND dept.IsActive = 1
      ORDER BY bu.BusinessUnitId, div.DivisionId, dept.DepartmentId
    `);

    if (orgResult.recordset.length === 0) {
      logger.error('No active BU/Division/Department found. Please seed master data first.');
      return;
    }

    const { BusinessUnitId, DivisionId, DepartmentId } = orgResult.recordset[0];
    logger.info(`Using BU: ${BusinessUnitId}, Division: ${DivisionId}, Department: ${DepartmentId}`);

    const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    let createdCount = 0;
    let skippedCount = 0;

    for (const user of ADDITIONAL_IT_LEADS) {
      // Check if user already exists
      const existingUser = await pool.request()
        .input('username', sql.NVarChar(50), user.username)
        .query('SELECT UserId FROM Users WHERE Username = @username');

      if (existingUser.recordset.length > 0) {
        logger.info(`User "${user.username}" (${user.displayName}) already exists, skipping`);
        skippedCount++;
        continue;
      }

      // Create IT Lead user
      await pool.request()
        .input('username', sql.NVarChar(50), user.username)
        .input('npk', sql.NVarChar(20), user.npk)
        .input('passwordHash', sql.NVarChar(255), hashedPassword)
        .input('displayName', sql.NVarChar(100), user.displayName)
        .input('email', sql.NVarChar(100), user.email)
        .input('phoneNumber', sql.NVarChar(20), null)
        .input('role', sql.NVarChar(50), 'ITLead')
        .input('useLDAP', sql.Bit, false)
        .input('businessUnitId', sql.BigInt, BusinessUnitId)
        .input('divisionId', sql.BigInt, DivisionId)
        .input('departmentId', sql.BigInt, DepartmentId)
        .query(`
          INSERT INTO Users (
            Username, NPK, PasswordHash, DisplayName, Email, PhoneNumber,
            Role, UseLDAP, BusinessUnitId, DivisionId, DepartmentId,
            IsActive, CreatedAt
          )
          VALUES (
            @username, @npk, @passwordHash, @displayName, @email, @phoneNumber,
            @role, @useLDAP, @businessUnitId, @divisionId, @departmentId,
            1, GETDATE()
          )
        `);

      logger.info(`✓ Created IT Lead: ${user.displayName} (${user.username})`);
      createdCount++;
    }

    logger.info(`\nIT Lead users seeding completed:`);
    logger.info(`  - Created: ${createdCount} users`);
    logger.info(`  - Skipped: ${skippedCount} users (already exist)`);
    logger.info(`  - Default Password: ${DEFAULT_PASSWORD}`);
    logger.info(`\nTotal active IT Lead users in system:`);
    
    const totalITLeads = await pool.request().query(`
      SELECT COUNT(*) as Total FROM Users 
      WHERE Role = 'ITLead' AND IsActive = 1
    `);
    logger.info(`  - ${totalITLeads.recordset[0].Total} active IT Lead users`);

  } catch (error) {
    logger.error('Error seeding additional IT Lead users:', error);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  seedAdditionalITLeads()
    .then(() => {
      logger.info('Seed script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Seed script failed:', error);
      process.exit(1);
    });
}

module.exports = { seedAdditionalITLeads };
