-- Migration 034: Phase 1 — Migrate Master Data PKs from UUID to BIGINT IDENTITY
-- Tables: BusinessUnits, Divisions, Departments, Functions, Applications
-- Strategy: Drop ALL FK constraints referencing Phase 1 tables (from any table),
--           drop Phase 1 tables, recreate with BIGINT IDENTITY(1,1)
-- Note: Data reset is acceptable (development environment)

USE CSI;

SET XACT_ABORT ON;

PRINT '=== Migration 034: Phase 1 Master Data UUID -> BIGINT ===';

-- Safety: no-op if Phase 1 tables already use BIGINT IDENTITY PKs.
IF OBJECT_ID('dbo.BusinessUnits', 'U') IS NOT NULL
  AND OBJECT_ID('dbo.Divisions', 'U') IS NOT NULL
  AND OBJECT_ID('dbo.Departments', 'U') IS NOT NULL
  AND OBJECT_ID('dbo.Functions', 'U') IS NOT NULL
  AND OBJECT_ID('dbo.Applications', 'U') IS NOT NULL
  AND COLUMNPROPERTY(OBJECT_ID('dbo.BusinessUnits'), 'BusinessUnitId', 'IsIdentity') = 1
  AND COLUMNPROPERTY(OBJECT_ID('dbo.Divisions'), 'DivisionId', 'IsIdentity') = 1
  AND COLUMNPROPERTY(OBJECT_ID('dbo.Departments'), 'DepartmentId', 'IsIdentity') = 1
  AND COLUMNPROPERTY(OBJECT_ID('dbo.Functions'), 'FunctionId', 'IsIdentity') = 1
  AND COLUMNPROPERTY(OBJECT_ID('dbo.Applications'), 'ApplicationId', 'IsIdentity') = 1
  AND EXISTS (SELECT 1 FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id WHERE c.object_id = OBJECT_ID('dbo.BusinessUnits') AND c.name = 'BusinessUnitId' AND t.name = 'bigint')
  AND EXISTS (SELECT 1 FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id WHERE c.object_id = OBJECT_ID('dbo.Divisions') AND c.name = 'DivisionId' AND t.name = 'bigint')
  AND EXISTS (SELECT 1 FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id WHERE c.object_id = OBJECT_ID('dbo.Departments') AND c.name = 'DepartmentId' AND t.name = 'bigint')
  AND EXISTS (SELECT 1 FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id WHERE c.object_id = OBJECT_ID('dbo.Functions') AND c.name = 'FunctionId' AND t.name = 'bigint')
  AND EXISTS (SELECT 1 FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id WHERE c.object_id = OBJECT_ID('dbo.Applications') AND c.name = 'ApplicationId' AND t.name = 'bigint')
BEGIN
  PRINT 'Migration 034 skipped: BIGINT schema already present for Phase 1 tables.';
  RETURN;
END;

BEGIN TRY
  BEGIN TRANSACTION;

  -- ============================================================
  -- STEP 1: Drop ALL FK constraints referencing Phase 1 tables
  --         from ANY table in the database
  -- ============================================================

  DECLARE @sql NVARCHAR(MAX) = N'';

  SELECT @sql = @sql +
    N'ALTER TABLE ' + QUOTENAME(OBJECT_SCHEMA_NAME(fk.parent_object_id)) +
    N'.' + QUOTENAME(OBJECT_NAME(fk.parent_object_id)) +
    N' DROP CONSTRAINT ' + QUOTENAME(fk.name) + N'; '
  FROM sys.foreign_keys fk
  WHERE OBJECT_NAME(fk.referenced_object_id) IN (
    'BusinessUnits','Divisions','Departments','Functions','Applications'
  );

  IF LEN(@sql) > 0
  BEGIN
    EXEC(@sql);
    PRINT 'All FK constraints referencing Phase 1 tables dropped.';
  END;

  -- Also drop FK constraints WITHIN Phase 1 tables (e.g. Divisions -> BusinessUnits)
  SET @sql = N'';
  SELECT @sql = @sql +
    N'ALTER TABLE ' + QUOTENAME(OBJECT_SCHEMA_NAME(fk.parent_object_id)) +
    N'.' + QUOTENAME(OBJECT_NAME(fk.parent_object_id)) +
    N' DROP CONSTRAINT ' + QUOTENAME(fk.name) + N'; '
  FROM sys.foreign_keys fk
  WHERE OBJECT_NAME(fk.parent_object_id) IN (
    'BusinessUnits','Divisions','Departments','Functions','Applications'
  );

  IF LEN(@sql) > 0
  BEGIN
    EXEC(@sql);
    PRINT 'Internal FK constraints within Phase 1 tables dropped.';
  END;

  -- ============================================================
  -- STEP 2: Drop Phase 1 tables (order: leaf first)
  -- ============================================================

  IF OBJECT_ID('dbo.Applications', 'U') IS NOT NULL DROP TABLE dbo.Applications;
  IF OBJECT_ID('dbo.Functions',    'U') IS NOT NULL DROP TABLE dbo.Functions;
  IF OBJECT_ID('dbo.Departments',  'U') IS NOT NULL DROP TABLE dbo.Departments;
  IF OBJECT_ID('dbo.Divisions',    'U') IS NOT NULL DROP TABLE dbo.Divisions;
  IF OBJECT_ID('dbo.BusinessUnits','U') IS NOT NULL DROP TABLE dbo.BusinessUnits;
  PRINT 'Phase 1 tables dropped.';

  -- ============================================================
  -- STEP 3: Recreate Phase 1 tables with BIGINT IDENTITY(1,1)
  -- ============================================================

  CREATE TABLE dbo.BusinessUnits (
    BusinessUnitId BIGINT        IDENTITY(1,1) PRIMARY KEY,
    Code           NVARCHAR(20)  NOT NULL UNIQUE,
    Name           NVARCHAR(200) NOT NULL,
    IsActive       BIT           NOT NULL DEFAULT 1,
    CreatedAt      DATETIME2     NOT NULL DEFAULT GETDATE(),
    CreatedBy      BIGINT        NULL,
    UpdatedAt      DATETIME2     NULL,
    UpdatedBy      BIGINT        NULL
  );
  CREATE INDEX IX_BusinessUnits_Code     ON dbo.BusinessUnits(Code);
  CREATE INDEX IX_BusinessUnits_IsActive ON dbo.BusinessUnits(IsActive);
  PRINT 'BusinessUnits created (BIGINT)';

  CREATE TABLE dbo.Divisions (
    DivisionId     BIGINT        IDENTITY(1,1) PRIMARY KEY,
    BusinessUnitId BIGINT        NOT NULL REFERENCES dbo.BusinessUnits(BusinessUnitId),
    Code           NVARCHAR(20)  NOT NULL UNIQUE,
    Name           NVARCHAR(200) NOT NULL,
    IsActive       BIT           NOT NULL DEFAULT 1,
    CreatedAt      DATETIME2     NOT NULL DEFAULT GETDATE(),
    CreatedBy      BIGINT        NULL,
    UpdatedAt      DATETIME2     NULL,
    UpdatedBy      BIGINT        NULL
  );
  CREATE INDEX IX_Divisions_BusinessUnitId ON dbo.Divisions(BusinessUnitId);
  CREATE INDEX IX_Divisions_Code           ON dbo.Divisions(Code);
  CREATE INDEX IX_Divisions_IsActive       ON dbo.Divisions(IsActive);
  PRINT 'Divisions created (BIGINT)';

  CREATE TABLE dbo.Departments (
    DepartmentId BIGINT        IDENTITY(1,1) PRIMARY KEY,
    DivisionId   BIGINT        NOT NULL REFERENCES dbo.Divisions(DivisionId),
    Code         NVARCHAR(20)  NOT NULL UNIQUE,
    Name         NVARCHAR(200) NOT NULL,
    IsActive     BIT           NOT NULL DEFAULT 1,
    CreatedAt    DATETIME2     NOT NULL DEFAULT GETDATE(),
    CreatedBy    BIGINT        NULL,
    UpdatedAt    DATETIME2     NULL,
    UpdatedBy    BIGINT        NULL
  );
  CREATE INDEX IX_Departments_DivisionId ON dbo.Departments(DivisionId);
  CREATE INDEX IX_Departments_Code       ON dbo.Departments(Code);
  CREATE INDEX IX_Departments_IsActive   ON dbo.Departments(IsActive);
  PRINT 'Departments created (BIGINT)';

  CREATE TABLE dbo.Functions (
    FunctionId   BIGINT        IDENTITY(1,1) PRIMARY KEY,
    Code         NVARCHAR(20)  NOT NULL UNIQUE,
    Name         NVARCHAR(200) NOT NULL,
    ITLeadUserId BIGINT        NULL,
    DeptId       BIGINT        NULL REFERENCES dbo.Departments(DepartmentId),
    IsActive     BIT           NOT NULL DEFAULT 1,
    CreatedAt    DATETIME2     NOT NULL DEFAULT GETDATE(),
    CreatedBy    BIGINT        NULL,
    UpdatedAt    DATETIME2     NULL,
    UpdatedBy    BIGINT        NULL
  );
  CREATE INDEX IX_Functions_Code     ON dbo.Functions(Code);
  CREATE INDEX IX_Functions_IsActive ON dbo.Functions(IsActive);
  CREATE INDEX IX_Functions_DeptId   ON dbo.Functions(DeptId);
  PRINT 'Functions created (BIGINT)';

  CREATE TABLE dbo.Applications (
    ApplicationId BIGINT        IDENTITY(1,1) PRIMARY KEY,
    Code          NVARCHAR(20)  NOT NULL UNIQUE,
    Name          NVARCHAR(200) NOT NULL,
    Description   NVARCHAR(500) NULL,
    IsActive      BIT           NOT NULL DEFAULT 1,
    CreatedAt     DATETIME2     NOT NULL DEFAULT GETDATE(),
    CreatedBy     BIGINT        NULL,
    UpdatedAt     DATETIME2     NULL,
    UpdatedBy     BIGINT        NULL
  );
  CREATE INDEX IX_Applications_Code     ON dbo.Applications(Code);
  CREATE INDEX IX_Applications_IsActive ON dbo.Applications(IsActive);
  PRINT 'Applications created (BIGINT)';

  -- ============================================================
  -- STEP 4: Update Users table FK columns to BIGINT
  -- ============================================================

  IF OBJECT_ID('dbo.Users', 'U') IS NOT NULL
  BEGIN
    IF COL_LENGTH('dbo.Users', 'BusinessUnitId') IS NOT NULL
      ALTER TABLE dbo.Users DROP COLUMN BusinessUnitId;
    IF COL_LENGTH('dbo.Users', 'DivisionId') IS NOT NULL
      ALTER TABLE dbo.Users DROP COLUMN DivisionId;
    IF COL_LENGTH('dbo.Users', 'DepartmentId') IS NOT NULL
      ALTER TABLE dbo.Users DROP COLUMN DepartmentId;

    ALTER TABLE dbo.Users ADD BusinessUnitId BIGINT NULL;
    ALTER TABLE dbo.Users ADD DivisionId     BIGINT NULL;
    ALTER TABLE dbo.Users ADD DepartmentId   BIGINT NULL;

    ALTER TABLE dbo.Users ADD CONSTRAINT FK_Users_BusinessUnits
      FOREIGN KEY (BusinessUnitId) REFERENCES dbo.BusinessUnits(BusinessUnitId);
    ALTER TABLE dbo.Users ADD CONSTRAINT FK_Users_Divisions
      FOREIGN KEY (DivisionId) REFERENCES dbo.Divisions(DivisionId);
    ALTER TABLE dbo.Users ADD CONSTRAINT FK_Users_Departments
      FOREIGN KEY (DepartmentId) REFERENCES dbo.Departments(DepartmentId);

    PRINT 'Users FK columns updated to BIGINT';
  END;

  -- ============================================================
  -- STEP 5: Update Responses table FK columns to BIGINT
  --         (Responses references BusinessUnits, Divisions,
  --          Departments, Applications)
  -- ============================================================

  IF OBJECT_ID('dbo.Responses', 'U') IS NOT NULL
  BEGIN
    IF COL_LENGTH('dbo.Responses', 'BusinessUnitId') IS NOT NULL
      ALTER TABLE dbo.Responses DROP COLUMN BusinessUnitId;
    IF COL_LENGTH('dbo.Responses', 'DivisionId') IS NOT NULL
      ALTER TABLE dbo.Responses DROP COLUMN DivisionId;
    IF COL_LENGTH('dbo.Responses', 'DepartmentId') IS NOT NULL
      ALTER TABLE dbo.Responses DROP COLUMN DepartmentId;
    IF COL_LENGTH('dbo.Responses', 'ApplicationId') IS NOT NULL
      ALTER TABLE dbo.Responses DROP COLUMN ApplicationId;

    ALTER TABLE dbo.Responses ADD BusinessUnitId BIGINT NULL;
    ALTER TABLE dbo.Responses ADD DivisionId     BIGINT NULL;
    ALTER TABLE dbo.Responses ADD DepartmentId   BIGINT NULL;
    ALTER TABLE dbo.Responses ADD ApplicationId  BIGINT NULL;

    PRINT 'Responses FK columns updated to BIGINT (FK will be re-added in Phase 5)';
  END;

  COMMIT TRANSACTION;
  PRINT '=== Migration 034 Phase 1 completed successfully ===';

END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  PRINT 'ERROR in Migration 034: ' + ERROR_MESSAGE();
  THROW;
END CATCH;
