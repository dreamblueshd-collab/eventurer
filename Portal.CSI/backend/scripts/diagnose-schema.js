/**
 * Diagnostic Script: Check AssignedAdminId Column Type
 * Purpose: Query database directly to determine schema state
 */

const sql = require('mssql');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Output array to collect all messages
const output = [];
function log(message) {
  console.log(message);
  output.push(message);
}

const config = {
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
    enableArithAbort: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

async function diagnoseSchema() {
  let pool;
  const startTime = new Date().toISOString();
  
  // Write start marker immediately
  try {
    const startMarker = `DIAGNOSTIC STARTED AT: ${startTime}\nConnecting to: ${config.server} / ${config.database}\n\n`;
    fs.writeFileSync(path.join(__dirname, 'diagnostic-result.txt'), startMarker, 'utf8');
  } catch (err) {
    console.error('Failed to write start marker:', err.message);
  }
  
  try {
    console.log('=================================================================');
    console.log('DIAGNOSTIC: Events.AssignedAdminId Column Type');
    console.log('=================================================================');
    console.log(`Connecting to: ${config.server} / ${config.database}`);
    console.log('');

    pool = await sql.connect(config);

    // Check column type
    console.log('--- Column Type Check ---');
    const columnQuery = `
      SELECT 
        t.name AS TableName,
        c.name AS ColumnName,
        ty.name AS DataType,
        c.max_length AS MaxLength,
        c.is_nullable AS IsNullable,
        CASE 
          WHEN ty.name = 'bigint' THEN 'BIGINT (Migration 050 NOT applied - Original schema)'
          WHEN ty.name = 'nvarchar' THEN 'NVARCHAR (Migration 050 WAS applied - Conflict!)'
          ELSE 'UNEXPECTED TYPE'
        END AS Status
      FROM sys.tables t
      INNER JOIN sys.columns c ON c.object_id = t.object_id
      INNER JOIN sys.types ty ON ty.user_type_id = c.user_type_id
      WHERE t.name = 'Events' AND c.name = 'AssignedAdminId'
    `;
    
    const columnResult = await pool.request().query(columnQuery);
    
    if (columnResult.recordset.length === 0) {
      console.log('ERROR: Column Events.AssignedAdminId not found!');
      process.exit(1);
    }

    const column = columnResult.recordset[0];
    log('Table: ' + column.TableName);
    log('Column: ' + column.ColumnName);
    log('DataType: ' + column.DataType);
    log('MaxLength: ' + column.MaxLength);
    log('IsNullable: ' + column.IsNullable);
    log('Status: ' + column.Status);
    log('');

    // Check FK constraint
    console.log('--- Foreign Key Constraint Check ---');
    const fkQuery = `
      SELECT 
        fk.name AS FKName,
        OBJECT_NAME(fk.parent_object_id) AS ParentTable,
        c.name AS ParentColumn,
        OBJECT_NAME(fk.referenced_object_id) AS ReferencedTable,
        rc.name AS ReferencedColumn
      FROM sys.foreign_keys fk
      INNER JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
      INNER JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
      INNER JOIN sys.columns rc ON rc.object_id = fkc.referenced_object_id AND rc.column_id = fkc.referenced_column_id
      WHERE fk.parent_object_id = OBJECT_ID('dbo.Events')
        AND c.name = 'AssignedAdminId'
    `;

    const fkResult = await pool.request().query(fkQuery);
    if (fkResult.recordset.length > 0) {
      console.log('FK Constraint Found:');
      fkResult.recordset.forEach(fk => {
        console.log(`  ${fk.FKName}: ${fk.ParentTable}.${fk.ParentColumn} -> ${fk.ReferencedTable}.${fk.ReferencedColumn}`);
      });
    } else {
      console.log('No FK constraint found on Events.AssignedAdminId');
    }
    console.log('');

    // Sample data check
    console.log('--- Sample Data Check (Top 5) ---');
    const dataQuery = `
      SELECT TOP 5
        SurveyId,
        Title,
        AssignedAdminId,
        CASE 
          WHEN AssignedAdminId IS NULL THEN 'NULL'
          WHEN ISNUMERIC(CAST(AssignedAdminId AS NVARCHAR(MAX))) = 1 THEN 'Numeric (ID)'
          ELSE 'String (Username/CSV)'
        END AS DataFormat
      FROM Events
      WHERE AssignedAdminId IS NOT NULL
      ORDER BY CreatedAt DESC
    `;

    const dataResult = await pool.request().query(dataQuery);
    if (dataResult.recordset.length > 0) {
      dataResult.recordset.forEach(row => {
        console.log(`  SurveyId: ${row.SurveyId}, AssignedAdminId: ${row.AssignedAdminId}, Format: ${row.DataFormat}`);
      });
    } else {
      console.log('  No events with AssignedAdminId found');
    }
    console.log('');

    // EventAdminAssignments check
    console.log('--- EventAdminAssignments Table Check ---');
    const assignmentsQuery = `
      SELECT 
        COUNT(DISTINCT SurveyId) AS EventsWithAdminAssignments,
        COUNT(*) AS TotalAssignments,
        COUNT(DISTINCT AdminUserId) AS UniqueAdmins
      FROM EventAdminAssignments
    `;

    const assignmentsResult = await pool.request().query(assignmentsQuery);
    const stats = assignmentsResult.recordset[0];
    console.log(`Events with assignments: ${stats.EventsWithAdminAssignments}`);
    console.log(`Total assignments: ${stats.TotalAssignments}`);
    console.log(`Unique admins: ${stats.UniqueAdmins}`);
    console.log('');

    log('=================================================================');
    log('DIAGNOSIS COMPLETE');
    log('=================================================================');
    log('');
    log('RESULT: ' + column.DataType.toUpperCase());
    log('');
    
    if (column.DataType === 'bigint') {
      log('✓ Schema is BIGINT - Current code fix is CORRECT');
      log('✓ No migration needed');
      log('✓ Ready to commit and deploy');
    } else if (column.DataType === 'nvarchar') {
      log('⚠ Schema is NVARCHAR - Need to rollback migration 050');
      log('→ Run: node backend/scripts/run-migration-054.js');
      log('→ Or: sqlcmd -i backend/src/database/migrations/054_rollback_assigned_admin_to_bigint.sql');
    } else {
      log('❌ Unexpected data type - Manual investigation required');
    }

    // Write results to file
    const outputPath = path.join(__dirname, 'diagnostic-result.txt');
    fs.writeFileSync(outputPath, output.join('\n'), 'utf8');
    console.log('\n✓ Results written to: ' + outputPath);

    await pool.close();
    process.exit(0);

  } catch (error) {
    console.error('ERROR:', error.message);
    console.error('Stack:', error.stack);
    
    // Write error to file
    try {
      const errorOutput = `ERROR OCCURRED:\n${error.message}\n\nStack Trace:\n${error.stack}\n\nConfig:\nServer: ${config.server}\nDatabase: ${config.database}\nUser: ${config.user}`;
      fs.writeFileSync(path.join(__dirname, 'diagnostic-error.txt'), errorOutput, 'utf8');
      console.log('Error details written to diagnostic-error.txt');
    } catch (writeErr) {
      console.error('Failed to write error file:', writeErr.message);
    }
    
    if (pool) await pool.close();
    process.exit(1);
  }
}

diagnoseSchema();
