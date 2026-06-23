-- Migration 049: Restructure Event-Survey Relationship (1 Event = Many Surveys)
-- Description: Creates a new Surveys table as child of Events, migrates survey-specific
-- columns from Events to Surveys, updates FK references in Questions/Responses/
-- EventConfiguration/EventPublishCycles/ScheduledOperations.
-- Existing data is preserved: each existing event gets 1 child survey automatically.

USE CSI;
GO

SET XACT_ABORT ON;
GO

-- Safety: skip if Surveys table already exists as a real table (not synonym)
IF OBJECT_ID(N'dbo.Surveys', N'U') IS NOT NULL
BEGIN
  PRINT 'Migration 049 skipped: Surveys table already exists as base table.';
  RETURN;
END;
GO

BEGIN TRY
  BEGIN TRANSACTION;

  -- ============================================================
  -- STEP 1: Drop old synonyms that conflict with new table name
  -- ============================================================
  IF OBJECT_ID(N'dbo.Surveys', N'SN') IS NOT NULL
    DROP SYNONYM dbo.Surveys;
  IF OBJECT_ID(N'dbo.SurveyConfiguration', N'SN') IS NOT NULL
    DROP SYNONYM dbo.SurveyConfiguration;
  IF OBJECT_ID(N'dbo.SurveyPublishCycles', N'SN') IS NOT NULL
    DROP SYNONYM dbo.SurveyPublishCycles;
  IF OBJECT_ID(N'dbo.SurveyAdminAssignments', N'SN') IS NOT NULL
    DROP SYNONYM dbo.SurveyAdminAssignments;

  PRINT 'Old synonyms dropped.';

  -- ============================================================
  -- STEP 2: Create Surveys table (child of Events)
  -- Use dynamic SQL for deferred name resolution (synonym was just dropped)
  -- ============================================================
  EXEC('CREATE TABLE dbo.Surveys (
    SurveyId                   BIGINT IDENTITY(1,1) PRIMARY KEY,
    EventId                    BIGINT        NOT NULL,
    Title                      NVARCHAR(500) NOT NULL,
    Description                NVARCHAR(MAX) NULL,
    SortOrder                  INT           NOT NULL DEFAULT 1,
    StartDate                  DATETIME2     NULL,
    EndDate                    DATETIME2     NULL,
    Status                     NVARCHAR(50)  NOT NULL DEFAULT ''Draft''
                               CHECK (Status IN (''Draft'',''Active'',''Closed'',''Archived'')),
    TargetRespondents          INT           NULL,
    TargetScore                DECIMAL(5,2)  NULL,
    CurrentScore               DECIMAL(5,2)  NULL,
    SurveyLink                 NVARCHAR(500) NULL,
    ShortenedLink              NVARCHAR(500) NULL,
    QRCodeDataUrl              NVARCHAR(MAX) NULL,
    EmbedCode                  NVARCHAR(MAX) NULL,
    DuplicatePreventionEnabled BIT           NOT NULL DEFAULT 1,
    CreatedAt                  DATETIME2     NOT NULL DEFAULT GETDATE(),
    CreatedBy                  BIGINT        NULL,
    UpdatedAt                  DATETIME2     NULL,
    UpdatedBy                  BIGINT        NULL,
    CONSTRAINT FK_Surveys_Events FOREIGN KEY (EventId) REFERENCES dbo.Events(SurveyId) ON DELETE CASCADE,
    CONSTRAINT FK_Surveys_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES dbo.Users(UserId),
    CONSTRAINT FK_Surveys_UpdatedBy FOREIGN KEY (UpdatedBy) REFERENCES dbo.Users(UserId)
  );
  CREATE INDEX IX_Surveys_EventId ON dbo.Surveys(EventId);
  CREATE INDEX IX_Surveys_Status ON dbo.Surveys(Status);
  CREATE INDEX IX_Surveys_StartDate_EndDate ON dbo.Surveys(StartDate, EndDate);');

  PRINT 'Surveys table created.';

  -- ============================================================
  -- STEP 3: Migrate existing Events data into Surveys (1:1)
  -- Each event becomes parent + gets 1 child survey
  -- Use dynamic SQL for deferred name resolution (new table in same batch)
  -- ============================================================
  EXEC('SET IDENTITY_INSERT dbo.Surveys ON;
  INSERT INTO dbo.Surveys (
    SurveyId, EventId, Title, Description, SortOrder,
    StartDate, EndDate, Status, TargetRespondents, TargetScore, CurrentScore,
    SurveyLink, ShortenedLink, QRCodeDataUrl, EmbedCode,
    DuplicatePreventionEnabled, CreatedAt, CreatedBy, UpdatedAt, UpdatedBy
  )
  SELECT
    e.SurveyId, e.SurveyId, e.Title, e.Description, 1,
    e.StartDate, e.EndDate, e.Status, e.TargetRespondents, e.TargetScore, e.CurrentScore,
    e.SurveyLink, e.ShortenedLink, e.QRCodeDataUrl, e.EmbedCode,
    e.DuplicatePreventionEnabled, e.CreatedAt, e.CreatedBy, e.UpdatedAt, e.UpdatedBy
  FROM dbo.Events e;
  SET IDENTITY_INSERT dbo.Surveys OFF;');

  PRINT 'Existing events migrated to Surveys table (1 survey per event).';

  -- ============================================================
  -- STEP 4: Update EventConfiguration FK from Events to Surveys
  -- ============================================================

  -- Drop existing FK and unique constraint on EventConfiguration.SurveyId
  DECLARE @fkName NVARCHAR(256);

  SELECT @fkName = fk.name
  FROM sys.foreign_keys fk
  JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
  JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
  WHERE fk.parent_object_id = OBJECT_ID('dbo.EventConfiguration')
    AND c.name = 'SurveyId';

  IF @fkName IS NOT NULL
    EXEC('ALTER TABLE dbo.EventConfiguration DROP CONSTRAINT [' + @fkName + ']');

  -- Drop unique constraint/index on SurveyId
  DECLARE @uxName NVARCHAR(256);
  SELECT @uxName = i.name
  FROM sys.indexes i
  JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
  JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
  WHERE i.object_id = OBJECT_ID('dbo.EventConfiguration')
    AND i.is_unique = 1
    AND c.name = 'SurveyId'
    AND i.is_primary_key = 0;

  IF @uxName IS NOT NULL
    EXEC('ALTER TABLE dbo.EventConfiguration DROP CONSTRAINT [' + @uxName + ']');

  -- Add new FK to Surveys (dynamic SQL for deferred name resolution)
  EXEC('ALTER TABLE dbo.EventConfiguration
    ADD CONSTRAINT FK_EventConfiguration_Surveys
    FOREIGN KEY (SurveyId) REFERENCES dbo.Surveys(SurveyId) ON DELETE CASCADE');

  -- Re-add unique constraint (1 config per survey)
  ALTER TABLE dbo.EventConfiguration
    ADD CONSTRAINT UQ_EventConfiguration_SurveyId UNIQUE (SurveyId);

  PRINT 'EventConfiguration FK updated to reference Surveys.';

  -- ============================================================
  -- STEP 5: Update Questions FK from Events to Surveys
  -- ============================================================
  DECLARE @qFkName NVARCHAR(256);
  SELECT @qFkName = fk.name
  FROM sys.foreign_keys fk
  JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
  JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
  WHERE fk.parent_object_id = OBJECT_ID('dbo.Questions')
    AND c.name = 'SurveyId';

  IF @qFkName IS NOT NULL
    EXEC('ALTER TABLE dbo.Questions DROP CONSTRAINT [' + @qFkName + ']');

  EXEC('ALTER TABLE dbo.Questions
    ADD CONSTRAINT FK_Questions_Surveys
    FOREIGN KEY (SurveyId) REFERENCES dbo.Surveys(SurveyId) ON DELETE CASCADE');

  PRINT 'Questions FK updated to reference Surveys.';

  -- ============================================================
  -- STEP 6: Update Responses FK from Events to Surveys
  -- ============================================================
  DECLARE @rFkName NVARCHAR(256);
  SELECT @rFkName = fk.name
  FROM sys.foreign_keys fk
  JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
  JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
  WHERE fk.parent_object_id = OBJECT_ID('dbo.Responses')
    AND c.name = 'SurveyId';

  IF @rFkName IS NOT NULL
    EXEC('ALTER TABLE dbo.Responses DROP CONSTRAINT [' + @rFkName + ']');

  EXEC('ALTER TABLE dbo.Responses
    ADD CONSTRAINT FK_Responses_Surveys
    FOREIGN KEY (SurveyId) REFERENCES dbo.Surveys(SurveyId)');

  PRINT 'Responses FK updated to reference Surveys.';

  -- ============================================================
  -- STEP 7: Update EventPublishCycles FK from Events to Surveys
  -- ============================================================
  IF OBJECT_ID(N'dbo.EventPublishCycles', N'U') IS NOT NULL
  BEGIN
    -- Clean up orphaned records (SurveyIds that don't exist in new Surveys table)
    EXEC('DELETE FROM dbo.EventPublishCycles WHERE SurveyId NOT IN (SELECT SurveyId FROM dbo.Surveys)');

    DECLARE @pcFkName NVARCHAR(256);
    SELECT @pcFkName = fk.name
    FROM sys.foreign_keys fk
    JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
    JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
    WHERE fk.parent_object_id = OBJECT_ID('dbo.EventPublishCycles')
      AND c.name = 'SurveyId';

    IF @pcFkName IS NOT NULL
      EXEC('ALTER TABLE dbo.EventPublishCycles DROP CONSTRAINT [' + @pcFkName + ']');

    EXEC('ALTER TABLE dbo.EventPublishCycles
      ADD CONSTRAINT FK_EventPublishCycles_Surveys
      FOREIGN KEY (SurveyId) REFERENCES dbo.Surveys(SurveyId) ON DELETE CASCADE');

    PRINT 'EventPublishCycles FK updated to reference Surveys.';
  END;

  -- ============================================================
  -- STEP 8: Update ScheduledOperations FK (if SurveyId column exists)
  -- ============================================================
  IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.ScheduledOperations') AND name = 'SurveyId')
  BEGIN
    DECLARE @soFkName NVARCHAR(256);
    SELECT @soFkName = fk.name
    FROM sys.foreign_keys fk
    JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
    JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
    WHERE fk.parent_object_id = OBJECT_ID('dbo.ScheduledOperations')
      AND c.name = 'SurveyId';

    IF @soFkName IS NOT NULL
      EXEC('ALTER TABLE dbo.ScheduledOperations DROP CONSTRAINT [' + @soFkName + ']');

    -- SurveyId in ScheduledOperations is nullable (standalone ops have no survey)
    EXEC('ALTER TABLE dbo.ScheduledOperations
      ADD CONSTRAINT FK_ScheduledOperations_Surveys
      FOREIGN KEY (SurveyId) REFERENCES dbo.Surveys(SurveyId)');

    PRINT 'ScheduledOperations FK updated to reference Surveys.';
  END;

  -- ============================================================
  -- STEP 9: Clean up Events table — remove survey-specific columns
  -- Keep: SurveyId (as EventId PK), Title, Description, AssignedAdminId,
  --        EventTypeId, RequireApproval, CreatedAt/By, UpdatedAt/By
  -- Remove: StartDate, EndDate, Status, TargetRespondents, TargetScore,
  --         CurrentScore, SurveyLink, ShortenedLink, QRCodeDataUrl,
  --         EmbedCode, DuplicatePreventionEnabled
  -- ============================================================

  -- Drop ALL default constraints on columns we want to drop
  DECLARE @dcSql NVARCHAR(MAX) = N'';
  SELECT @dcSql = @dcSql +
    N'ALTER TABLE dbo.Events DROP CONSTRAINT [' + dc.name + N']; '
  FROM sys.default_constraints dc
  JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
  WHERE dc.parent_object_id = OBJECT_ID('dbo.Events')
    AND c.name IN ('StartDate','EndDate','Status','TargetRespondents','TargetScore',
                   'CurrentScore','SurveyLink','ShortenedLink','QRCodeDataUrl',
                   'EmbedCode','DuplicatePreventionEnabled');

  IF LEN(@dcSql) > 0
  BEGIN
    EXEC(@dcSql);
    PRINT 'Default constraints on survey-specific columns dropped.';
  END;

  -- Drop ALL check constraints on Events (Status, Date, any others)
  DECLARE @ckSql NVARCHAR(MAX) = N'';
  SELECT @ckSql = @ckSql +
    N'ALTER TABLE dbo.Events DROP CONSTRAINT [' + cc.name + N']; '
  FROM sys.check_constraints cc
  WHERE cc.parent_object_id = OBJECT_ID('dbo.Events');

  IF LEN(@ckSql) > 0
  BEGIN
    EXEC(@ckSql);
    PRINT 'All check constraints on Events dropped.';
  END;

  -- Drop indexes that reference columns we're about to drop
  IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.Events') AND name = 'IX_Events_Status')
    DROP INDEX IX_Events_Status ON dbo.Events;
  IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.Events') AND name = 'IX_Events_StartDate_EndDate')
    DROP INDEX IX_Events_StartDate_EndDate ON dbo.Events;
  IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.Events') AND name = 'IX_Surveys_Status')
    DROP INDEX IX_Surveys_Status ON dbo.Events;
  IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.Events') AND name = 'IX_Surveys_StartDate')
    DROP INDEX IX_Surveys_StartDate ON dbo.Events;
  IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.Events') AND name = 'IX_Surveys_EndDate')
    DROP INDEX IX_Surveys_EndDate ON dbo.Events;
  IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.Events') AND name = 'IX_Events_Status_Dates')
    DROP INDEX IX_Events_Status_Dates ON dbo.Events;

  -- Drop any remaining statistics auto-created on those columns
  DECLARE @statSql NVARCHAR(MAX) = N'';
  SELECT @statSql = @statSql +
    N'DROP STATISTICS dbo.Events.[' + s.name + N']; '
  FROM sys.stats s
  JOIN sys.stats_columns sc ON sc.object_id = s.object_id AND sc.stats_id = s.stats_id
  JOIN sys.columns c ON c.object_id = sc.object_id AND c.column_id = sc.column_id
  WHERE s.object_id = OBJECT_ID('dbo.Events')
    AND c.name IN ('StartDate','EndDate','Status','TargetRespondents','TargetScore',
                   'CurrentScore','SurveyLink','ShortenedLink','QRCodeDataUrl',
                   'EmbedCode','DuplicatePreventionEnabled')
    AND s.auto_created = 1;

  IF LEN(@statSql) > 0
    EXEC(@statSql);

  -- Now drop the columns
  ALTER TABLE dbo.Events DROP COLUMN
    StartDate,
    EndDate,
    Status,
    TargetRespondents,
    TargetScore,
    CurrentScore,
    SurveyLink,
    ShortenedLink,
    QRCodeDataUrl,
    EmbedCode,
    DuplicatePreventionEnabled;

  PRINT 'Survey-specific columns removed from Events table.';

  -- ============================================================
  -- STEP 10: Add Status column to Events for event-level status
  -- (Overall event status: Draft, Active, Closed, Archived)
  -- ============================================================
  ALTER TABLE dbo.Events ADD
    Status NVARCHAR(50) NOT NULL
      CONSTRAINT DF_Events_Status DEFAULT 'Active'
      CONSTRAINT CK_Events_Status CHECK (Status IN ('Draft','Active','Closed','Archived'));

  PRINT 'Event-level Status column added.';

  CREATE INDEX IX_Events_Status ON dbo.Events(Status);

  PRINT 'Events Status index created.';

  -- Update event status based on surveys (use dynamic SQL for deferred name resolution)
  EXEC('UPDATE e SET e.Status = s.Status FROM dbo.Events e JOIN dbo.Surveys s ON s.EventId = e.SurveyId AND s.SortOrder = 1');

  PRINT 'Event statuses populated from migrated surveys.';

  -- ============================================================
  -- STEP 11: Recreate backward-compatibility synonyms
  -- SurveyAdminAssignments already points to EventAdminAssignments
  -- ============================================================
  -- Re-create SurveyPublishCycles synonym (still valid, points to EventPublishCycles)
  IF OBJECT_ID(N'dbo.SurveyPublishCycles', N'SN') IS NULL
    AND OBJECT_ID(N'dbo.EventPublishCycles', N'U') IS NOT NULL
    EXEC('CREATE SYNONYM dbo.SurveyPublishCycles FOR dbo.EventPublishCycles');

  IF OBJECT_ID(N'dbo.SurveyAdminAssignments', N'SN') IS NULL
    AND OBJECT_ID(N'dbo.EventAdminAssignments', N'U') IS NOT NULL
    EXEC('CREATE SYNONYM dbo.SurveyAdminAssignments FOR dbo.EventAdminAssignments');

  -- SurveyConfiguration synonym now points to EventConfiguration (still valid for reads)
  IF OBJECT_ID(N'dbo.SurveyConfiguration', N'SN') IS NULL
    AND OBJECT_ID(N'dbo.EventConfiguration', N'U') IS NOT NULL
    EXEC('CREATE SYNONYM dbo.SurveyConfiguration FOR dbo.EventConfiguration');

  PRINT 'Backward-compatibility synonyms recreated.';

  -- ============================================================
  -- STEP 12: Rename Events PK column for clarity (SurveyId -> EventId)
  -- NOTE: We keep SurveyId as-is to minimize FK cascade changes.
  -- Instead, add a computed column alias.
  -- ============================================================
  -- Not renaming PK to avoid massive FK refactoring across codebase.
  -- Backend code will use Events.SurveyId as EventId conceptually.

  COMMIT TRANSACTION;
  PRINT '=== Migration 049 completed successfully ===';
  PRINT 'Events table is now a parent container.';
  PRINT 'Surveys table holds survey-specific data (1 Event : N Surveys).';

END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  PRINT 'ERROR in Migration 049: ' + ERROR_MESSAGE();
  THROW;
END CATCH;
GO
