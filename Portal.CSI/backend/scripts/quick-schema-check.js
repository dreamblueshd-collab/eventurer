const sql = require('mssql');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const config = {
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
};

(async () => {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query(`
      SELECT ty.name AS DataType 
      FROM sys.tables t
      INNER JOIN sys.columns c ON c.object_id = t.object_id
      INNER JOIN sys.types ty ON ty.user_type_id = c.user_type_id
      WHERE t.name = 'Events' AND c.name = 'AssignedAdminId'
    `);
    
    const dataType = result.recordset[0]?.DataType;
    console.log('SCHEMA_TYPE:', dataType);
    
    if (dataType === 'bigint') {
      console.log('STATUS: OK - Schema is BIGINT');
      console.log('ACTION: None needed - Code is correct');
    } else if (dataType === 'nvarchar') {
      console.log('STATUS: CONFLICT - Schema is NVARCHAR but code expects BIGINT');
      console.log('ACTION: Must run migration 054 to rollback to BIGINT');
    } else {
      console.log('STATUS: UNKNOWN - Unexpected type');
    }
    
    await pool.close();
  } catch (err) {
    console.log('ERROR:', err.message);
  }
})();
