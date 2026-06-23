-- Migration 036: Phase 3 — Migrate Mapping Tables PKs from UUID to BIGINT IDENTITY
-- Tables: FunctionApplicationMappings, ApplicationDepartmentMappings
-- Strategy: Drop all FK constraints referencing mapping tables,
--           drop mapping tables, recreate with BIGINT IDENTITY(1,1)
-- Note: Data reset is acceptable (development environment)

USE CSI;

SET XACT_ABORT ON;

PRINT '=== Migration 036: Phase 3 Mapping Tables UUID -> BIGINT ===';

-- Safety: no-op if Phase 3 mapping tables already use BIGINT IDENTITY PKs.
IF OBJECT_ID('dbo.FunctionApplicationMappings', 'U') IS NOT NULL
  AND OBJECT_ID('dbo.ApplicationDepartmentMappings', 'U') IS NOT NULL
  AND COLUMNPROPERTY(OBJECT_ID('dbo.FunctionApplicationMappings'), 'MappingId', 'IsIdentity') = 1
  AND COLUMNPROPERTY(OBJECT_ID('dbo.ApplicationDepartmentMappings'), 'MappingId', 'IsIdentity') = 1
  AND EXISTS (SELECT 1 FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id WHERE c.object_id = OBJECT_ID('dbo.FunctionApplicationMappings') AND c.name = 'MappingId' AND t.name = 'bigint')
  AND EXISTS (SELECT 1 FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id WHERE c.object_id = OBJECT_ID('dbo.ApplicationDepartmentMappings') AND c.name = 'MappingId' AND t.name = 'bigint')
BEGIN
  PRINT 'Migration 036 skipped: BIGINT schema already present for Phase 3 mapping tables.';
  RETURN;
END;

BEGIN TRY
  BEGIN TRANSACTION;

  -- ============================================================
  -- STEP 1: Drop ALL FK constraints referencing mapping tables
  -- ============================================================

  DECLARE @sql NVARCHAR(MAX) = N'';

  SELECT @sql = @sql +
    N'ALTER TABLE ' + QUOTENAME(OBJECT_SCHEMA_NAME(fk.parent_object_id)) +
    N'.' + QUOTENAME(OBJECT_NAME(fk.parent_object_id)) +
    N' DROP CONSTRAINT ' + QUOTENAME(fk.name) + N'; '
  FROM sys.foreign_keys fk
  WHERE OBJECT_NAME(fk.referenced_object_id) IN (
    'FunctionApplicationMappings','ApplicationDepartmentMappings'
  );

  IF LEN(@sql) > 0
  BEGIN
    EXEC(@sql);
    PRINT 'All FK constraints referencing mapping tables dropped.';
  END;

  -- ============================================================
  -- STEP 2: Drop Phase 3 mapping tables
  -- ============================================================

  IF OBJECT_ID('dbo.FunctionApplicationMappings', 'U') IS NOT NULL
    DROP TABLE dbo.FunctionApplicationMappings;
  IF OBJECT_ID('dbo.ApplicationDepartmentMappings', 'U') IS NOT NULL
    DROP TABLE dbo.ApplicationDepartmentMappings;
  PRINT 'Phase 3 mapping tables dropped.';

  -- ============================================================
  -- STEP 3: Recreate FunctionApplicationMappings with BIGINT
  -- ============================================================

  CREATE TABLE dbo.FunctionApplicationMappings (
    MappingId     BIGINT    IDENTITY(1,1) PRIMARY KEY,
    FunctionId    BIGINT    NOT NULL REFERENCES dbo.Functions(FunctionId) ON DELETE CASCADE,
    ApplicationId BIGINT    NOT NULL REFERENCES dbo.Applications(ApplicationId) ON DELETE CASCADE,
    CreatedAt     DATETIME2 NOT NULL DEFAULT GETDATE(),
    CreatedBy     BIGINT    NULL,
    CONSTRAINT UQ_FunctionApplication UNIQUE (FunctionId, ApplicationId)
  );

  CREATE INDEX IX_FunctionApplicationMappings_FunctionId    ON dbo.FunctionApplicationMappings(FunctionId);
  CREATE INDEX IX_FunctionApplicationMappings_ApplicationId ON dbo.FunctionApplicationMappings(ApplicationId);
  PRINT 'FunctionApplicationMappings created (BIGINT)';

  -- ============================================================
  -- STEP 4: Recreate ApplicationDepartmentMappings with BIGINT
  -- ============================================================

  CREATE TABLE dbo.ApplicationDepartmentMappings (
    MappingId     BIGINT    IDENTITY(1,1) PRIMARY KEY,
    ApplicationId BIGINT    NOT NULL REFERENCES dbo.Applications(ApplicationId) ON DELETE CASCADE,
    DepartmentId  BIGINT    NOT NULL REFERENCES dbo.Departments(DepartmentId) ON DELETE CASCADE,
    CreatedAt     DATETIME2 NOT NULL DEFAULT GETDATE(),
    CreatedBy     BIGINT    NULL,
    CONSTRAINT UQ_ApplicationDepartment UNIQUE (ApplicationId, DepartmentId)
  );

  CREATE INDEX IX_ApplicationDepartmentMappings_ApplicationId ON dbo.ApplicationDepartmentMappings(ApplicationId);
  CREATE INDEX IX_ApplicationDepartmentMappings_DepartmentId  ON dbo.ApplicationDepartmentMappings(DepartmentId);
  PRINT 'ApplicationDepartmentMappings created (BIGINT)';

  COMMIT TRANSACTION;
  PRINT '=== Migration 036 Phase 3 completed successfully ===';

END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  PRINT 'ERROR in Migration 036: ' + ERROR_MESSAGE();
  THROW;
END CATCH;
