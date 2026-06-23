/**
 * Seed EventTypes Table
 * 
 * This script ensures the EventTypes table has the required SURVEY event type.
 * It's safe to run multiple times (idempotent).
 * 
 * Usage:
 *   node backend/scripts/seed-event-types.js
 * 
 * Or via npm:
 *   npm run db:seed:event-types
 */

const db = require('../src/config/database');
const sql = require('mssql');
const logger = require('../src/config/logger');

async function seedEventTypes() {
  let pool;
  
  try {
    console.log('Connecting to database...');
    pool = await db.getPool();
    
    console.log('Checking EventTypes table...');
    
    // Check if SURVEY event type already exists
    const checkResult = await pool.request()
      .query(`
        SELECT EventTypeId, Code, Name, IsActive 
        FROM EventTypes 
        WHERE Code = 'SURVEY'
      `);
    
    if (checkResult.recordset.length > 0) {
      const existing = checkResult.recordset[0];
      console.log(`✓ SURVEY EventType already exists (ID: ${existing.EventTypeId})`);
      
      // Update to ensure it's active
      if (!existing.IsActive) {
        await pool.request()
          .input('code', sql.NVarChar(50), 'SURVEY')
          .query(`
            UPDATE EventTypes 
            SET IsActive = 1, UpdatedAt = GETDATE() 
            WHERE Code = @code
          `);
        console.log('✓ SURVEY EventType reactivated');
      }
      
      return;
    }
    
    // Insert SURVEY event type
    console.log('Inserting SURVEY EventType...');
    const insertResult = await pool.request()
      .input('code', sql.NVarChar(50), 'SURVEY')
      .input('name', sql.NVarChar(200), 'Survey Event')
      .input('description', sql.NVarChar(sql.MAX), 'Standard survey event type for collecting feedback and responses')
      .input('isActive', sql.Bit, 1)
      .query(`
        INSERT INTO EventTypes (Code, Name, Description, IsActive, CreatedAt, UpdatedAt)
        OUTPUT INSERTED.EventTypeId
        VALUES (@code, @name, @description, @isActive, GETDATE(), GETDATE())
      `);
    
    const newId = insertResult.recordset[0].EventTypeId;
    console.log(`✓ SURVEY EventType created successfully (ID: ${newId})`);
    
    // Verify the insert
    const verifyResult = await pool.request()
      .query('SELECT COUNT(*) as count FROM EventTypes WHERE Code = \'SURVEY\' AND IsActive = 1');
    
    if (verifyResult.recordset[0].count === 1) {
      console.log('✓ Verification passed');
      logger.info('EventTypes table seeded successfully', { eventTypeId: newId });
    } else {
      throw new Error('Verification failed: SURVEY EventType not found after insert');
    }
    
  } catch (error) {
    console.error('✗ Error seeding EventTypes:', error.message);
    logger.error('EventTypes seed error', { error: error.message, stack: error.stack });
    process.exit(1);
  } finally {
    if (pool) {
      await pool.close();
      console.log('Database connection closed');
    }
  }
}

// Run the seed function
seedEventTypes()
  .then(() => {
    console.log('\n=== EventTypes Seed Complete ===\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n=== EventTypes Seed Failed ===');
    console.error(error);
    process.exit(1);
  });
