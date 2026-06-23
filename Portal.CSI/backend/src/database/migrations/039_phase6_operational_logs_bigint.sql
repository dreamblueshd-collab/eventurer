-- Migration 039: Phase 6 — Migrate Operational & Logs Tables PKs from UUID to BIGINT IDENTITY
-- Tables: ScheduledOperations, AuditLogs, EmailLogs
-- Strategy: Drop all FK constraints, drop tables, recreate with BIGINT IDENTITY(1,1)
-- Note: Data reset is acceptable (development environment)

USE CSI;

SET XACT_ABORT ON;

PRINT '=== Migration 039: Phase 6 Operational & Logs UUID -> BIGINT ===';

-- Safety: no-op if Phase 6 tables already use BIGINT IDENTITY PKs.
IF OBJECT_ID('dbo.ScheduledOperations', 'U') IS NOT NULL
  AND OBJECT_ID('dbo.AuditLogs', 'U') IS NOT NULL
  AND OBJECT_ID('dbo.EmailLogs', 'U') IS NOT NULL
  AND COLUMNPROPERTY(OBJECT_ID('dbo.ScheduledOperations'), 'OperationId', 'IsIdentity') = 1
  AND COLUMNPROPERTY(OBJECT_ID('dbo.AuditLogs'), 'LogId', 'IsIdentity') = 1
  AND COLUMNPROPERTY(OBJECT_ID('dbo.EmailLogs'), 'EmailLogId', 'IsIdentity') = 1
  AND EXISTS (SELECT 1 FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id WHERE c.object_id = OBJECT_ID('dbo.ScheduledOperations') AND c.name = 'OperationId' AND t.name = 'bigint')
  AND EXISTS (SELECT 1 FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id WHERE c.object_id = OBJECT_ID('dbo.AuditLogs') AND c.name = 'LogId' AND t.name = 'bigint')
  AND EXISTS (SELECT 1 FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id WHERE c.object_id = OBJECT_ID('dbo.EmailLogs') AND c.name = 'EmailLogId' AND t.name = 'bigint')
BEGIN
  PRINT 'Migration 039 skipped: BIGINT schema already present for Phase 6 tables.';
  RETURN;
END;

BEGIN TRY
  BEGIN TRANSACTION;

  -- ============================================================
  -- STEP 1: Drop ALL FK constraints referencing Phase 6 tables
  -- ============================================================

  DECLARE @sql NVARCHAR(MAX) = N'';

  SELECT @sql = @sql +
    N'ALTER TABLE ' + QUOTENAME(OBJECT_SCHEMA_NAME(fk.parent_object_id)) +
    N'.' + QUOTENAME(OBJECT_NAME(fk.parent_object_id)) +
    N' DROP CONSTRAINT ' + QUOTENAME(fk.name) + N'; '
  FROM sys.foreign_keys fk
  WHERE OBJECT_NAME(fk.referenced_object_id) IN (
    'ScheduledOperations','AuditLogs','EmailLogs'
  );

  IF LEN(@sql) > 0
  BEGIN
    EXEC(@sql);
    PRINT 'All FK constraints referencing Phase 6 tables dropped.';
  END;

  -- Also drop FK constraints WITHIN Phase 6 tables
  SET @sql = N'';
  SELECT @sql = @sql +
    N'ALTER TABLE ' + QUOTENAME(OBJECT_SCHEMA_NAME(fk.parent_object_id)) +
    N'.' + QUOTENAME(OBJECT_NAME(fk.parent_object_id)) +
    N' DROP CONSTRAINT ' + QUOTENAME(fk.name) + N'; '
  FROM sys.foreign_keys fk
  WHERE OBJECT_NAME(fk.parent_object_id) IN (
    'ScheduledOperations','AuditLogs','EmailLogs'
  );

  IF LEN(@sql) > 0
  BEGIN
    EXEC(@sql);
    PRINT 'Internal FK constraints within Phase 6 tables dropped.';
  END;

  -- ============================================================
  -- STEP 2: Drop Phase 6 tables
  -- ============================================================

  IF OBJECT_ID('dbo.EmailLogs',            'U') IS NOT NULL DROP TABLE dbo.EmailLogs;
  IF OBJECT_ID('dbo.AuditLogs',            'U') IS NOT NULL DROP TABLE dbo.AuditLogs;
  IF OBJECT_ID('dbo.ScheduledOperations',  'U') IS NOT NULL DROP TABLE dbo.ScheduledOperations;
  PRINT 'Phase 6 tables dropped.';

  -- ============================================================
  -- STEP 3: Recreate ScheduledOperations with BIGINT IDENTITY
  -- ============================================================

  CREATE TABLE dbo.ScheduledOperations (
    OperationId    BIGINT IDENTITY(1,1) PRIMARY KEY,
    SurveyId       BIGINT        NOT NULL REFERENCES dbo.Events(SurveyId) ON DELETE CASCADE,
    OperationType  NVARCHAR(50)  NOT NULL CHECK (OperationType IN ('Blast','Reminder')),
    Frequency      NVARCHAR(50)  NOT NULL CHECK (Frequency IN ('once','daily','weekly','monthly')),
    ScheduledDate  DATETIME2     NOT NULL,
    ScheduledTime  TIME          NULL,
    DayOfWeek      INT           NULL,
    EmailTemplate  NVARCHAR(MAX) NOT NULL,
    EmbedCover     BIT           NOT NULL DEFAULT 0,
    TargetCriteria NVARCHAR(MAX) NULL,
    Status         NVARCHAR(50)  NOT NULL DEFAULT 'Pending'
                   CHECK (Status IN ('Pending','Running','Completed','Failed','Cancelled')),
    NextExecutionAt DATETIME2    NULL,
    LastExecutedAt  DATETIME2    NULL,
    ExecutionCount  INT          NOT NULL DEFAULT 0,
    ErrorMessage    NVARCHAR(MAX) NULL,
    CreatedAt       DATETIME2    NOT NULL DEFAULT GETDATE(),
    CreatedBy       BIGINT       NULL REFERENCES dbo.Users(UserId)
  );

  CREATE INDEX IX_ScheduledOperations_SurveyId    ON dbo.ScheduledOperations(SurveyId);
  CREATE INDEX IX_ScheduledOperations_Status      ON dbo.ScheduledOperations(Status);
  CREATE INDEX IX_ScheduledOperations_OperationType ON dbo.ScheduledOperations(OperationType);
  CREATE INDEX IX_ScheduledOperations_NextExecutionAt ON dbo.ScheduledOperations(NextExecutionAt);
  PRINT 'ScheduledOperations created (BIGINT)';

  -- ============================================================
  -- STEP 4: Recreate AuditLogs with BIGINT IDENTITY
  -- ============================================================

  CREATE TABLE dbo.AuditLogs (
    LogId      BIGINT IDENTITY(1,1) PRIMARY KEY,
    Timestamp  DATETIME2    NOT NULL DEFAULT GETDATE(),
    UserId     BIGINT       NULL REFERENCES dbo.Users(UserId),
    Username   NVARCHAR(50) NULL,
    Action     NVARCHAR(50) NOT NULL CHECK (Action IN (
               'Create','Update','Delete','Access','Login','Logout',
               'LoginFailed','Approve','Reject','Export')),
    EntityType NVARCHAR(100) NULL,
    EntityId   BIGINT        NULL,
    OldValues  NVARCHAR(MAX) NULL,
    NewValues  NVARCHAR(MAX) NULL,
    IPAddress  NVARCHAR(50)  NULL,
    UserAgent  NVARCHAR(500) NULL
  );

  CREATE INDEX IX_AuditLogs_Timestamp      ON dbo.AuditLogs(Timestamp);
  CREATE INDEX IX_AuditLogs_UserId         ON dbo.AuditLogs(UserId);
  CREATE INDEX IX_AuditLogs_Action         ON dbo.AuditLogs(Action);
  CREATE INDEX IX_AuditLogs_EntityType     ON dbo.AuditLogs(EntityType);
  CREATE INDEX IX_AuditLogs_EntityId       ON dbo.AuditLogs(EntityId);
  PRINT 'AuditLogs created (BIGINT)';

  -- ============================================================
  -- STEP 5: Recreate EmailLogs with BIGINT IDENTITY
  -- ============================================================

  CREATE TABLE dbo.EmailLogs (
    EmailLogId     BIGINT IDENTITY(1,1) PRIMARY KEY,
    SurveyId       BIGINT        NULL REFERENCES dbo.Events(SurveyId),
    RecipientEmail NVARCHAR(255) NOT NULL,
    RecipientName  NVARCHAR(200) NULL,
    Subject        NVARCHAR(500) NOT NULL,
    EmailType      NVARCHAR(50)  NOT NULL CHECK (EmailType IN ('Blast','Reminder','Notification')),
    Status         NVARCHAR(50)  NOT NULL CHECK (Status IN ('Sent','Failed','Pending')),
    ErrorMessage   NVARCHAR(MAX) NULL,
    SentAt         DATETIME2     NOT NULL DEFAULT GETDATE()
  );

  CREATE INDEX IX_EmailLogs_SurveyId       ON dbo.EmailLogs(SurveyId);
  CREATE INDEX IX_EmailLogs_Status         ON dbo.EmailLogs(Status);
  CREATE INDEX IX_EmailLogs_EmailType      ON dbo.EmailLogs(EmailType);
  CREATE INDEX IX_EmailLogs_SentAt         ON dbo.EmailLogs(SentAt);
  PRINT 'EmailLogs created (BIGINT)';

  COMMIT TRANSACTION;
  PRINT '=== Migration 039 Phase 6 completed successfully ===';

END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  PRINT 'ERROR in Migration 039: ' + ERROR_MESSAGE();
  THROW;
END CATCH;
