/**
 * Seed IT Lead assignments for existing Functions
 * Run this script to assign IT Lead users to Functions for approval workflow
 * 
 * Usage:
 *   node scripts/seed-function-it-leads.js           // Assign only Functions without IT Lead
 *   node scripts/seed-function-it-leads.js --force   // Re-assign all Functions (redistribute)
 */

const db = require('../src/database/connection');
const { sql } = require('../src/database/connection');
const logger = require('../src/config/logger');

/**
 * Assign IT Leads to Functions
 * @param {boolean} forceReassign - If true, re-assign all Functions even if they already have IT Lead
 * Maps Function names to IT Lead display names
 * Ensures Functions have IT Lead for approval routing
 */
async function seedFunctionITLeads(forceReassign = false) {
  let pool;
  
  try {
    pool = await db.getPool();
    logger.info('Starting IT Lead assignment for Functions...');

    // First, get all IT Lead users
    const itLeadsResult = await pool.request().query(`
      SELECT UserId, DisplayName, Username 
      FROM Users 
      WHERE Role = 'ITLead' AND IsActive = 1
    `);

    if (itLeadsResult.recordset.length === 0) {
      logger.warn('No active IT Lead users found in database');
      return;
    }

    logger.info(`Found ${itLeadsResult.recordset.length} active IT Lead users`);
    itLeadsResult.recordset.forEach(user => {
      logger.info(`  - ${user.DisplayName} (${user.Username})`);
    });

    // Get all Functions
    const functionsResult = await pool.request().query(`
      SELECT FunctionId, Name, ITLeadUserId
      FROM Functions
      WHERE IsActive = 1
    `);

    if (functionsResult.recordset.length === 0) {
      logger.warn('No active Functions found in database');
      return;
    }

    logger.info(`Found ${functionsResult.recordset.length} active Functions`);

    // Strategy: Distribute Functions evenly among IT Leads
    // If there's only one IT Lead, assign all to that user
    const itLeads = itLeadsResult.recordset;
    let assignedCount = 0;
    let skippedCount = 0;
    let reassignedCount = 0;

    if (forceReassign) {
      logger.info('Force re-assign mode: Will redistribute all Functions to IT Leads');
    } else {
      logger.info('Normal mode: Will only assign Functions without IT Lead');
    }

    for (let i = 0; i < functionsResult.recordset.length; i++) {
      const func = functionsResult.recordset[i];
      
      // Skip if already has IT Lead (unless force reassign)
      if (func.ITLeadUserId && !forceReassign) {
        logger.info(`Function "${func.Name}" already has IT Lead, skipping`);
        skippedCount++;
        continue;
      }

      // Round-robin assignment: distribute evenly among IT Leads
      const itLead = itLeads[i % itLeads.length];

      await pool.request()
        .input('functionId', sql.BigInt, func.FunctionId)
        .input('itLeadUserId', sql.BigInt, itLead.UserId)
        .query(`
          UPDATE Functions
          SET ITLeadUserId = @itLeadUserId,
              UpdatedAt = GETDATE()
          WHERE FunctionId = @functionId
        `);

      if (func.ITLeadUserId) {
        logger.info(`✓ Re-assigned "${func.Name}" → ${itLead.DisplayName}`);
        reassignedCount++;
      } else {
        logger.info(`✓ Assigned "${func.Name}" → ${itLead.DisplayName}`);
        assignedCount++;
      }
    }

    logger.info(`\nIT Lead assignment completed:`);
    if (forceReassign) {
      logger.info(`  - Re-assigned: ${reassignedCount} Functions`);
      logger.info(`  - Newly assigned: ${assignedCount} Functions`);
    } else {
      logger.info(`  - Assigned: ${assignedCount} Functions`);
      logger.info(`  - Skipped: ${skippedCount} Functions (already have IT Lead)`);
    }
    logger.info(`  - Total IT Leads: ${itLeads.length}`);

  } catch (error) {
    logger.error('Error seeding Function IT Leads:', error);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  // Check for --force flag in command line arguments
  const forceReassign = process.argv.includes('--force');
  
  if (forceReassign) {
    logger.info('Running in FORCE mode: Will re-assign all Functions');
  }
  
  seedFunctionITLeads(forceReassign)
    .then(() => {
      logger.info('Seed script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Seed script failed:', error);
      process.exit(1);
    });
}

module.exports = { seedFunctionITLeads };
