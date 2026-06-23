const sql = require('mssql');
const fs = require('fs').promises;
const path = require('path');

/**
 * Script to run migration 055 on multiple database environments
 * Skips GCP database (already migrated)
 */

// Database configurations
const databases = {
  LOCAL: {
    name: 'LOCAL (localhost)',
    server: 'localhost',
    user: 'csi_dev',
    password: 'CsiLocal123!',
    database: 'CSI',
    port: 1433,
    options: {
      encrypt: false,
      trustServerCertificate: true,
      enableArithAbort: true,
      connectionTimeout: 30000,
      requestTimeout: 30000
    }
  },
  DEV: {
    name: 'DEVELOPMENT (office DEV)',
    server: '10.14.90.210\\DEV',
    user: 'userdev',
    password: 'AopPortal123!',
    database: 'CSI',
    port: 1433,
    options: {
      encrypt: false,
      trustServerCertificate: true,
      enableArithAbort: true,
      connectionTimeout: 30000,
      requestTimeout: 30000
    }
  },
  PROD: {
    name: 'PRODUCTION (office PROD/Main)',
    server: '10.14.99.122\\webmedical',
    user: 'dataretrieve',
    password: 'dataretrieve',
    database: 'CSI',
    port: 1433,
    options: {
      encrypt: false,
      trustServerCertificate: true,
      enableArithAbort: true,
      connectionTimeout: 30000,
      requestTimeout: 30000
    }
  }
  // GCP database is SKIPPED (already migrated)
};

/**
 * Read migration file
 */
async function readMigrationFile() {
  const migrationPath = path.join(__dirname, '../src/database/migrations/055_move_require_approval_to_surveys.sql');
  try {
    const content = await fs.readFile(migrationPath, 'utf8');
    return content;
  } catch (error) {
    throw new Error(`Failed to read migration file: ${error.message}`);
  }
}

/**
 * Check if migration has already been applied
 */
async function isMigrationApplied(pool, migrationName) {
  try {
    // Check if Migrations table exists
    const tableCheck = await pool.request().query(`
      SELECT 1 FROM sys.tables WHERE name = 'Migrations'
    `);
    
    if (tableCheck.recordset.length === 0) {
      return false; // Table doesn't exist, migration not applied
    }

    // Check if migration is recorded
    const result = await pool.request()
      .input('migrationName', sql.NVarChar, migrationName)
      .query('SELECT 1 FROM Migrations WHERE MigrationName = @migrationName');
    
    return result.recordset.length > 0;
  } catch (error) {
    console.error('Error checking migration status:', error.message);
    return false;
  }
}

/**
 * Create Migrations table if not exists
 */
async function createMigrationsTable(pool) {
  const query = `
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Migrations')
    BEGIN
      CREATE TABLE Migrations (
        MigrationId INT IDENTITY(1,1) PRIMARY KEY,
        MigrationName NVARCHAR(255) NOT NULL UNIQUE,
        AppliedAt DATETIME2 NOT NULL DEFAULT GETDATE()
      );
    END
  `;

  try {
    await pool.request().query(query);
  } catch (error) {
    throw new Error(`Failed to create migrations table: ${error.message}`);
  }
}

/**
 * Run migration on a specific database
 */
async function runMigrationOnDatabase(dbConfig, migrationContent, migrationName) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Running migration on: ${dbConfig.name}`);
  console.log(`Server: ${dbConfig.server}`);
  console.log(`Database: ${dbConfig.database}`);
  console.log(`${'='.repeat(60)}\n`);

  let pool;

  try {
    // Connect to database
    console.log('Connecting to database...');
    pool = await new sql.ConnectionPool(dbConfig).connect();
    console.log('✓ Connected successfully\n');

    // Create Migrations table if needed
    await createMigrationsTable(pool);

    // Check if migration already applied
    const alreadyApplied = await isMigrationApplied(pool, migrationName);
    
    if (alreadyApplied) {
      console.log(`⚠ Migration ${migrationName} already applied - SKIPPING`);
      return { success: true, skipped: true };
    }

    // Execute migration
    console.log('Executing migration 055...');
    
    // Split by GO statements and execute each batch
    const batches = migrationContent
      .split(/^\s*GO\s*$/mi)
      .map(batch => batch.trim())
      .filter(batch => batch.length > 0);

    for (let i = 0; i < batches.length; i++) {
      console.log(`Executing batch ${i + 1}/${batches.length}...`);
      await pool.request().query(batches[i]);
    }

    // Record migration as applied
    await pool.request()
      .input('migrationName', sql.NVarChar, migrationName)
      .query('INSERT INTO Migrations (MigrationName) VALUES (@migrationName)');

    console.log('✓ Migration completed successfully\n');
    return { success: true, skipped: false };

  } catch (error) {
    console.error(`✗ Migration failed: ${error.message}\n`);
    return { success: false, error: error.message };
  } finally {
    if (pool) {
      await pool.close();
      console.log('Database connection closed\n');
    }
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   Migration 055: Move RequireApproval to Surveys          ║');
  console.log('║   Running on: LOCAL, DEV, PROD                             ║');
  console.log('║   Skipping: GCP (already migrated)                         ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('\n');

  const migrationName = '055_move_require_approval_to_surveys.sql';
  const results = {};

  try {
    // Read migration file
    console.log('Reading migration file...');
    const migrationContent = await readMigrationFile();
    console.log('✓ Migration file loaded\n');

    // Run migration on each database
    for (const [key, dbConfig] of Object.entries(databases)) {
      const result = await runMigrationOnDatabase(dbConfig, migrationContent, migrationName);
      results[key] = result;
    }

    // Print summary
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                    MIGRATION SUMMARY                       ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('\n');

    for (const [key, result] of Object.entries(results)) {
      const dbName = databases[key].name;
      if (result.success) {
        if (result.skipped) {
          console.log(`✓ ${dbName}: Already applied (skipped)`);
        } else {
          console.log(`✓ ${dbName}: Successfully migrated`);
        }
      } else {
        console.log(`✗ ${dbName}: FAILED - ${result.error}`);
      }
    }

    console.log('\n');
    console.log('GCP database: SKIPPED (already migrated as confirmed by user)');
    console.log('\n');

    // Check if any failed
    const failures = Object.entries(results).filter(([_, result]) => !result.success);
    if (failures.length > 0) {
      console.log(`\n⚠ ${failures.length} database(s) failed. Please check errors above.\n`);
      process.exit(1);
    } else {
      console.log('\n✓ All migrations completed successfully!\n');
      process.exit(0);
    }

  } catch (error) {
    console.error('\n✗ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main();
