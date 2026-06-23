-- Migration 035: Phase 2 — Migrate Users, Sessions, PasswordResetTokens PKs from UUID to BIGINT IDENTITY
-- Strategy: Drop all FK constraints referencing Users, drop dependent tables,
--           recreate Users with BIGINT IDENTITY, recreate Sessions and PasswordResetTokens
-- Note: Data reset is acceptable (development environment)

USE CSI;

SET XACT_ABORT ON;

PRINT '=== Migration 035: Phase 2 Users & Auth UUID -> BIGINT ===';

-- Safety: no-op if Phase 2 tables already use BIGINT IDENTITY PKs.
IF OBJECT_ID('dbo.Users', 'U') IS NOT NULL
  AND OBJECT_ID('dbo.Sessions', 'U') IS NOT NULL
  AND OBJECT_ID('dbo.PasswordResetTokens', 'U') IS NOT NULL
  AND COLUMNPROPERTY(OBJECT_ID('dbo.Users'), 'UserId', 'IsIdentity') = 1
  AND COLUMNPROPERTY(OBJECT_ID('dbo.Sessions'), 'SessionId', 'IsIdentity') = 1
  AND COLUMNPROPERTY(OBJECT_ID('dbo.PasswordResetTokens'), 'PasswordResetTokenId', 'IsIdentity') = 1
  AND EXISTS (SELECT 1 FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id WHERE c.object_id = OBJECT_ID('dbo.Users') AND c.name = 'UserId' AND t.name = 'bigint')
  AND EXISTS (SELECT 1 FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id WHERE c.object_id = OBJECT_ID('dbo.Sessions') AND c.name = 'SessionId' AND t.name = 'bigint')
  AND EXISTS (SELECT 1 FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id WHERE c.object_id = OBJECT_ID('dbo.PasswordResetTokens') AND c.name = 'PasswordResetTokenId' AND t.name = 'bigint')
BEGIN
  PRINT 'Migration 035 skipped: BIGINT schema already present for Phase 2 tables.';
  RETURN;
END;

BEGIN TRY
  BEGIN TRANSACTION;

  -- ============================================================
  -- STEP 1: Drop ALL FK constraints referencing Users table
  -- ============================================================

  DECLARE @sql NVARCHAR(MAX) = N'';

  SELECT @sql = @sql +
    N'ALTER TABLE ' + QUOTENAME(OBJECT_SCHEMA_NAME(fk.parent_object_id)) +
    N'.' + QUOTENAME(OBJECT_NAME(fk.parent_object_id)) +
    N' DROP CONSTRAINT ' + QUOTENAME(fk.name) + N'; '
  FROM sys.foreign_keys fk
  WHERE OBJECT_NAME(fk.referenced_object_id) = 'Users';

  IF LEN(@sql) > 0
  BEGIN
    EXEC(@sql);
    PRINT 'All FK constraints referencing Users dropped.';
  END;

  -- Also drop FK constraints within Users itself (CreatedBy, UpdatedBy)
  SET @sql = N'';
  SELECT @sql = @sql +
    N'ALTER TABLE ' + QUOTENAME(OBJECT_SCHEMA_NAME(fk.parent_object_id)) +
    N'.' + QUOTENAME(OBJECT_NAME(fk.parent_object_id)) +
    N' DROP CONSTRAINT ' + QUOTENAME(fk.name) + N'; '
  FROM sys.foreign_keys fk
  WHERE OBJECT_NAME(fk.parent_object_id) = 'Users';

  IF LEN(@sql) > 0
  BEGIN
    EXEC(@sql);
    PRINT 'Internal FK constraints within Users dropped.';
  END;

  -- ============================================================
  -- STEP 2: Drop Phase 2 tables (Sessions, PasswordResetTokens first)
  -- ============================================================

  IF OBJECT_ID('dbo.PasswordResetTokens', 'U') IS NOT NULL DROP TABLE dbo.PasswordResetTokens;
  IF OBJECT_ID('dbo.Sessions',            'U') IS NOT NULL DROP TABLE dbo.Sessions;
  IF OBJECT_ID('dbo.Users',               'U') IS NOT NULL DROP TABLE dbo.Users;
  PRINT 'Phase 2 tables dropped.';

  -- ============================================================
  -- STEP 3: Recreate Users with BIGINT IDENTITY(1,1)
  -- ============================================================

  CREATE TABLE dbo.Users (
    UserId        BIGINT        IDENTITY(1,1) PRIMARY KEY,
    Username      NVARCHAR(50)  NOT NULL UNIQUE,
    NPK           NVARCHAR(50)  NULL,
    DisplayName   NVARCHAR(200) NOT NULL,
    Email         NVARCHAR(255) NOT NULL,
    PhoneNumber   NVARCHAR(30)  NULL,
    Role          NVARCHAR(50)  NOT NULL CHECK (Role IN ('SuperAdmin', 'AdminEvent', 'ITLead', 'DepartmentHead')),
    UseLDAP       BIT           NOT NULL DEFAULT 1,
    PasswordHash  NVARCHAR(255) NULL,
    BusinessUnitId BIGINT       NULL REFERENCES dbo.BusinessUnits(BusinessUnitId),
    DivisionId    BIGINT        NULL REFERENCES dbo.Divisions(DivisionId),
    DepartmentId  BIGINT        NULL REFERENCES dbo.Departments(DepartmentId),
    IsActive      BIT           NOT NULL DEFAULT 1,
    CreatedAt     DATETIME2     NOT NULL DEFAULT GETDATE(),
    CreatedBy     BIGINT        NULL,
    UpdatedAt     DATETIME2     NULL,
    UpdatedBy     BIGINT        NULL
  );

  CREATE INDEX IX_Users_Username     ON dbo.Users(Username);
  CREATE INDEX IX_Users_Email        ON dbo.Users(Email);
  CREATE INDEX IX_Users_Role         ON dbo.Users(Role);
  CREATE INDEX IX_Users_IsActive     ON dbo.Users(IsActive);
  CREATE INDEX IX_Users_BusinessUnit ON dbo.Users(BusinessUnitId);
  CREATE INDEX IX_Users_Division     ON dbo.Users(DivisionId);
  CREATE INDEX IX_Users_Department   ON dbo.Users(DepartmentId);
  PRINT 'Users created (BIGINT)';

  -- ============================================================
  -- STEP 4: Recreate Sessions with BIGINT IDENTITY(1,1)
  -- ============================================================

  CREATE TABLE dbo.Sessions (
    SessionId        BIGINT        IDENTITY(1,1) PRIMARY KEY,
    UserId           BIGINT        NOT NULL REFERENCES dbo.Users(UserId),
    TokenHash        NVARCHAR(64)  NOT NULL,
    RefreshTokenHash NVARCHAR(64)  NULL,
    IpAddress        NVARCHAR(45)  NULL,
    UserAgent        NVARCHAR(500) NULL,
    LastActivity     DATETIME2     NOT NULL DEFAULT GETDATE(),
    ExpiresAt        DATETIME2     NOT NULL,
    MaxExpiresAt     DATETIME2     NULL,
    IsActive         BIT           NOT NULL DEFAULT 1,
    InvalidatedAt    DATETIME2     NULL,
    CreatedAt        DATETIME2     NOT NULL DEFAULT GETDATE()
  );

  CREATE INDEX IX_Sessions_UserId           ON dbo.Sessions(UserId);
  CREATE INDEX IX_Sessions_TokenHash        ON dbo.Sessions(TokenHash);
  CREATE INDEX IX_Sessions_RefreshTokenHash ON dbo.Sessions(RefreshTokenHash);
  CREATE INDEX IX_Sessions_IsActive         ON dbo.Sessions(IsActive);
  PRINT 'Sessions created (BIGINT)';

  -- ============================================================
  -- STEP 5: Recreate PasswordResetTokens with BIGINT IDENTITY(1,1)
  -- ============================================================

  CREATE TABLE dbo.PasswordResetTokens (
    PasswordResetTokenId BIGINT        IDENTITY(1,1) PRIMARY KEY,
    UserId               BIGINT        NOT NULL REFERENCES dbo.Users(UserId),
    TokenHash            NVARCHAR(64)  NOT NULL,
    RequestedByMethod    NVARCHAR(50)  NOT NULL DEFAULT 'email',
    RequestedTo          NVARCHAR(255) NULL,
    ExpiresAt            DATETIME2     NOT NULL,
    UsedAt               DATETIME2     NULL,
    CreatedByIp          NVARCHAR(45)  NULL,
    CreatedAt            DATETIME2     NOT NULL DEFAULT GETDATE()
  );

  CREATE INDEX IX_PasswordResetTokens_UserId    ON dbo.PasswordResetTokens(UserId);
  CREATE INDEX IX_PasswordResetTokens_TokenHash ON dbo.PasswordResetTokens(TokenHash);
  PRINT 'PasswordResetTokens created (BIGINT)';

  -- ============================================================
  -- STEP 6: Update Functions.ITLeadUserId FK to Users (BIGINT)
  -- ============================================================

  IF OBJECT_ID('dbo.Functions', 'U') IS NOT NULL
    AND COL_LENGTH('dbo.Functions', 'ITLeadUserId') IS NOT NULL
  BEGIN
    ALTER TABLE dbo.Functions ADD CONSTRAINT FK_Functions_ITLeadUser
      FOREIGN KEY (ITLeadUserId) REFERENCES dbo.Users(UserId);
    PRINT 'Functions.ITLeadUserId FK re-added to Users (BIGINT)';
  END;

  -- ============================================================
  -- STEP 7: Seed superadmin user
  -- ============================================================

  INSERT INTO dbo.Users (
    Username, NPK, DisplayName, Email, Role, UseLDAP, PasswordHash, IsActive, CreatedAt
  )
  VALUES (
    'superadmin', NULL, 'Super Administrator', 'superadmin@csi.local',
    'SuperAdmin', 0,
    -- bcrypt hash of 'Admin@1234' (legacy hash format)
    '$2b$10$YourHashHere',
    1, GETDATE()
  );
  PRINT 'Superadmin user seeded (update PasswordHash manually if needed)';

  COMMIT TRANSACTION;
  PRINT '=== Migration 035 Phase 2 completed successfully ===';

END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  PRINT 'ERROR in Migration 035: ' + ERROR_MESSAGE();
  THROW;
END CATCH;
