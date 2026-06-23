const sql = require('mssql');

const TABLES = [
  'Users',
  'BusinessUnits',
  'Divisions',
  'Departments',
  'Functions',
  'Applications',
  'FunctionApplicationMappings',
  'ApplicationDepartmentMappings',
  'Events',
  'EventConfiguration',
  'Responses',
  'ScheduledOperations',
  'DoorprizeEvents',
  'DoorprizeParticipants',
  'DoorprizeGifts',
  'DoorprizeResults'
];

function buildConfig(prefix) {
  const server = process.env[`${prefix}_DB_SERVER`];
  const user = process.env[`${prefix}_DB_USER`];
  const password = process.env[`${prefix}_DB_PASSWORD`];
  const database = process.env[`${prefix}_DB_NAME`] || 'CSI';
  const port = Number(process.env[`${prefix}_DB_PORT`] || 1433);
  const encrypt = String(process.env[`${prefix}_DB_ENCRYPT`] || 'false').toLowerCase() === 'true';
  const trustServerCertificate = String(process.env[`${prefix}_DB_TRUST_SERVER_CERTIFICATE`] || 'true').toLowerCase() === 'true';

  if (!server || !database) {
    return null;
  }

  return {
    server,
    user,
    password,
    database,
    port,
    options: {
      encrypt,
      trustServerCertificate,
      enableArithAbort: true,
    },
    connectionTimeout: 5000,
    requestTimeout: 5000,
    pool: {
      max: 1,
      min: 0,
      idleTimeoutMillis: 1000,
    },
  };
}

async function fetchColumns(pool) {
  const request = pool.request();
  TABLES.forEach((table, index) => request.input(`table${index}`, sql.NVarChar(128), table));

  const result = await request.query(`
    SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE, ORDINAL_POSITION
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME IN (${TABLES.map((_, index) => `@table${index}`).join(', ')})
    ORDER BY TABLE_NAME, ORDINAL_POSITION
  `);

  const grouped = {};
  for (const row of result.recordset) {
    (grouped[row.TABLE_NAME] ||= []).push(
      `${row.COLUMN_NAME}:${row.DATA_TYPE}:${row.IS_NULLABLE}`,
    );
  }
  return grouped;
}

async function fetchPrimaryKeys(pool) {
  const result = await pool.request().query(`
    SELECT
      t.name AS TableName,
      kc.name AS ConstraintName,
      c.name AS ColumnName,
      ic.key_ordinal AS KeyOrdinal
    FROM sys.key_constraints kc
    INNER JOIN sys.tables t ON t.object_id = kc.parent_object_id
    INNER JOIN sys.index_columns ic ON ic.object_id = kc.parent_object_id AND ic.index_id = kc.unique_index_id
    INNER JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
    WHERE kc.type = 'PK'
      AND t.name IN (${TABLES.map((table) => `'${table}'`).join(', ')})
    ORDER BY t.name, kc.name, ic.key_ordinal
  `);

  const grouped = {};
  for (const row of result.recordset) {
    (grouped[row.TableName] ||= []).push(`${row.ColumnName}:${row.KeyOrdinal}`);
  }
  return grouped;
}

async function fetchForeignKeys(pool) {
  const result = await pool.request().query(`
    SELECT
      OBJECT_NAME(fkc.parent_object_id) AS TableName,
      fk.name AS ConstraintName,
      COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS ColumnName,
      OBJECT_NAME(fkc.referenced_object_id) AS RefTableName,
      COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS RefColumnName
    FROM sys.foreign_keys fk
    INNER JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
    WHERE OBJECT_NAME(fkc.parent_object_id) IN (${TABLES.map((table) => `'${table}'`).join(', ')})
    ORDER BY OBJECT_NAME(fkc.parent_object_id), fk.name
  `);

  const grouped = {};
  for (const row of result.recordset) {
    (grouped[row.TableName] ||= []).push(
      `${row.ColumnName}->${row.RefTableName}.${row.RefColumnName}`,
    );
  }
  return grouped;
}

async function fetchEnvironmentSnapshot(name, config) {
  let pool;
  try {
    pool = await new sql.ConnectionPool(config).connect();
    const columns = await fetchColumns(pool);
    const primaryKeys = await fetchPrimaryKeys(pool);
    const foreignKeys = await fetchForeignKeys(pool);
    return { ok: true, name, columns, primaryKeys, foreignKeys };
  } catch (error) {
    return { ok: false, name, error: error.message };
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

function printSection(title) {
  process.stdout.write(`\n=== ${title} ===\n`);
}

function printDiff(label, baselineEnv, compareEnv, baselineValue, compareValue) {
  process.stdout.write(`\n[DIFF] ${label} | ${baselineEnv} vs ${compareEnv}\n`);
  process.stdout.write(`${baselineEnv}: ${(baselineValue || ['<missing>']).join(' | ')}\n`);
  process.stdout.write(`${compareEnv}: ${(compareValue || ['<missing>']).join(' | ')}\n`);
}

async function main() {
  const envOrder = ['LOCAL', 'DEV', 'GCP', 'PROD'];
  const configs = Object.fromEntries(
    envOrder
      .map((env) => [env, buildConfig(env)])
      .filter(([, config]) => Boolean(config)),
  );

  if (Object.keys(configs).length === 0) {
    process.stderr.write('No environment configuration found. Set *_DB_SERVER env vars before running.\n');
    process.exit(1);
  }

  const snapshots = [];
  for (const [name, config] of Object.entries(configs)) {
    snapshots.push(await fetchEnvironmentSnapshot(name, config));
  }

  printSection('Connectivity');
  for (const snapshot of snapshots) {
    if (snapshot.ok) {
      process.stdout.write(`[OK]   ${snapshot.name}\n`);
    } else {
      process.stdout.write(`[FAIL] ${snapshot.name} | ${snapshot.error}\n`);
    }
  }

  const connected = snapshots.filter((snapshot) => snapshot.ok);
  if (connected.length < 2) {
    process.stdout.write('\nNeed at least two reachable environments to compare.\n');
    return;
  }

  const baseline = connected.find((snapshot) => snapshot.name === 'DEV') || connected[0];
  printSection(`Schema Diff Baseline = ${baseline.name}`);

  for (const snapshot of connected) {
    if (snapshot.name === baseline.name) continue;

    for (const table of TABLES) {
      const baseColumns = JSON.stringify(baseline.columns[table] || []);
      const nextColumns = JSON.stringify(snapshot.columns[table] || []);
      if (baseColumns !== nextColumns) {
        printDiff(`${table} columns`, baseline.name, snapshot.name, baseline.columns[table], snapshot.columns[table]);
      }

      const basePrimaryKeys = JSON.stringify(baseline.primaryKeys[table] || []);
      const nextPrimaryKeys = JSON.stringify(snapshot.primaryKeys[table] || []);
      if (basePrimaryKeys !== nextPrimaryKeys) {
        printDiff(`${table} primary keys`, baseline.name, snapshot.name, baseline.primaryKeys[table], snapshot.primaryKeys[table]);
      }

      const baseForeignKeys = JSON.stringify(baseline.foreignKeys[table] || []);
      const nextForeignKeys = JSON.stringify(snapshot.foreignKeys[table] || []);
      if (baseForeignKeys !== nextForeignKeys) {
        printDiff(`${table} foreign keys`, baseline.name, snapshot.name, baseline.foreignKeys[table], snapshot.foreignKeys[table]);
      }
    }
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
