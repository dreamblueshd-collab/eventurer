-- Migration 037: Phase 4 — Migrate Survey Core Tables PKs from UUID to BIGINT IDENTITY
-- Tables: Events, EventConfiguration, Questions, EventAdminAssignments
-- Strategy: Drop all FK constraints, drop tables, recreate with BIGINT IDENTITY(1,1)
-- Note: Data reset is acceptable (development environment)

USE CSI;

SET XACT_ABORT ON;

PRINT '=== Migration 037: Phase 4 Survey Core UUID -> BIGINT ===';

-- Safety: no-op if Phase 4 tables already use BIGINT IDENTITY PKs.
IF OBJECT_ID('dbo.Events', 'U') IS NOT NULL
  AND OBJECT_ID('dbo.EventConfiguration', 'U') IS NOT NULL
  AND OBJECT_ID('dbo.Questions', 'U') IS NOT NULL
  AND OBJECT_ID('dbo.EventAdminAssignments', 'U') IS NOT NULL
  AND COLUMNPROPERTY(OBJECT_ID('dbo.Events'), 'SurveyId', 'IsIdentity') = 1
  AND COLUMNPROPERTY(OBJECT_ID('dbo.EventConfiguration'), 'ConfigId', 'IsIdentity') = 1
  AND COLUMNPROPERTY(OBJECT_ID('dbo.Questions'), 'QuestionId', 'IsIdentity') = 1
  AND EXISTS (SELECT 1 FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id WHERE c.object_id = OBJECT_ID('dbo.Events') AND c.name = 'SurveyId' AND t.name = 'bigint')
  AND EXISTS (SELECT 1 FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id WHERE c.object_id = OBJECT_ID('dbo.EventConfiguration') AND c.name = 'ConfigId' AND t.name = 'bigint')
  AND EXISTS (SELECT 1 FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id WHERE c.object_id = OBJECT_ID('dbo.Questions') AND c.name = 'QuestionId' AND t.name = 'bigint')
BEGIN
  PRINT 'Migration 037 skipped: BIGINT schema already present for Phase 4 core tables.';
  RETURN;
END;

BEGIN TRY
  BEGIN TRANSACTION;

  -- ============================================================
  -- STEP 1: Drop ALL FK constraints referencing Phase 4 tables
  -- ============================================================

  DECLARE @sql NVARCHAR(MAX) = N'';

  SELECT @sql = @sql +
    N'ALTER TABLE ' + QUOTENAME(OBJECT_SCHEMA_NAME(fk.parent_object_id)) +
    N'.' + QUOTENAME(OBJECT_NAME(fk.parent_object_id)) +
    N' DROP CONSTRAINT ' + QUOTENAME(fk.name) + N'; '
  FROM sys.foreign_keys fk
  WHERE OBJECT_NAME(fk.referenced_object_id) IN (
    'Events','EventConfiguration','Questions','EventAdminAssignments'
  );

  IF LEN(@sql) > 0
  BEGIN
    EXEC(@sql);
    PRINT 'All FK constraints referencing Phase 4 tables dropped.';
  END;

  -- Also drop FK constraints WITHIN Phase 4 tables
  SET @sql = N'';
  SELECT @sql = @sql +
    N'ALTER TABLE ' + QUOTENAME(OBJECT_SCHEMA_NAME(fk.parent_object_id)) +
    N'.' + QUOTENAME(OBJECT_NAME(fk.parent_object_id)) +
    N' DROP CONSTRAINT ' + QUOTENAME(fk.name) + N'; '
  FROM sys.foreign_keys fk
  WHERE OBJECT_NAME(fk.parent_object_id) IN (
    'Events','EventConfiguration','Questions','EventAdminAssignments'
  );

  IF LEN(@sql) > 0
  BEGIN
    EXEC(@sql);
    PRINT 'Internal FK constraints within Phase 4 tables dropped.';
  END;

  -- ============================================================
  -- STEP 2: Drop Phase 4 tables (order: leaf first)
  -- ============================================================

  IF OBJECT_ID('dbo.EventAdminAssignments',   'U') IS NOT NULL DROP TABLE dbo.EventAdminAssignments;
  IF OBJECT_ID('dbo.Questions',               'U') IS NOT NULL DROP TABLE dbo.Questions;
  IF OBJECT_ID('dbo.EventConfiguration',      'U') IS NOT NULL DROP TABLE dbo.EventConfiguration;
  IF OBJECT_ID('dbo.SurveyConfiguration',     'U') IS NOT NULL DROP TABLE dbo.SurveyConfiguration;
  IF OBJECT_ID('dbo.Events',                  'U') IS NOT NULL DROP TABLE dbo.Events;
  IF OBJECT_ID('dbo.Surveys',                 'U') IS NOT NULL DROP TABLE dbo.Surveys;
  PRINT 'Phase 4 tables dropped (including synonym aliases).';

  -- ============================================================
  -- STEP 3: Recreate Events (aka Surveys) with BIGINT IDENTITY
  -- ============================================================

  CREATE TABLE dbo.Events (
    SurveyId                   BIGINT IDENTITY(1,1) PRIMARY KEY,
    Title                      NVARCHAR(500) NOT NULL,
    Description                NVARCHAR(MAX) NULL,
    StartDate                  DATETIME2     NULL,
    EndDate                    DATETIME2     NULL,
    Status                     NVARCHAR(50)  NOT NULL DEFAULT 'Draft'
                               CHECK (Status IN ('Draft','Active','Closed','Archived')),
    AssignedAdminId            BIGINT        NULL REFERENCES dbo.Users(UserId),
    TargetRespondents          INT           NULL,
    TargetScore                DECIMAL(5,2)  NULL,
    SurveyLink                 NVARCHAR(500) NULL,
    ShortenedLink              NVARCHAR(500) NULL,
    QRCodeDataUrl              NVARCHAR(MAX) NULL,
    EmbedCode                  NVARCHAR(MAX) NULL,
    DuplicatePreventionEnabled BIT           NOT NULL DEFAULT 1,
    CreatedAt                  DATETIME2     NOT NULL DEFAULT GETDATE(),
    CreatedBy                  BIGINT        NULL REFERENCES dbo.Users(UserId),
    UpdatedAt                  DATETIME2     NULL,
    UpdatedBy                  BIGINT        NULL REFERENCES dbo.Users(UserId)
  );

  CREATE INDEX IX_Events_Status           ON dbo.Events(Status);
  CREATE INDEX IX_Events_AssignedAdminId  ON dbo.Events(AssignedAdminId);
  CREATE INDEX IX_Events_CreatedBy        ON dbo.Events(CreatedBy);
  CREATE INDEX IX_Events_StartDate_EndDate ON dbo.Events(StartDate, EndDate);
  PRINT 'Events created (BIGINT)';

  -- Create synonym for backward compatibility
  IF OBJECT_ID(N'dbo.Surveys', N'SN') IS NOT NULL DROP SYNONYM dbo.Surveys;
  CREATE SYNONYM dbo.Surveys FOR dbo.Events;
  PRINT 'Synonym dbo.Surveys created for dbo.Events';

  -- ============================================================
  -- STEP 4: Recreate EventConfiguration (aka SurveyConfiguration)
  -- ============================================================

  CREATE TABLE dbo.EventConfiguration (
    ConfigId          BIGINT IDENTITY(1,1) PRIMARY KEY,
    SurveyId          BIGINT        NOT NULL UNIQUE REFERENCES dbo.Events(SurveyId) ON DELETE CASCADE,
    HeroTitle         NVARCHAR(500) NULL,
    HeroSubtitle      NVARCHAR(500) NULL,
    HeroImageUrl      NVARCHAR(500) NULL,
    LogoUrl           NVARCHAR(500) NULL,
    BackgroundColor   NVARCHAR(50)  NULL,
    BackgroundImageUrl NVARCHAR(500) NULL,
    PrimaryColor      NVARCHAR(50)  NULL,
    SecondaryColor    NVARCHAR(50)  NULL,
    FontFamily        NVARCHAR(100) NULL,
    ButtonStyle       NVARCHAR(50)  NULL,
    ShowProgressBar   BIT           NOT NULL DEFAULT 1,
    ShowPageNumbers   BIT           NOT NULL DEFAULT 1,
    MultiPage         BIT           NOT NULL DEFAULT 0,
    CreatedAt         DATETIME2     NOT NULL DEFAULT GETDATE(),
    UpdatedAt         DATETIME2     NULL
  );

  CREATE INDEX IX_EventConfiguration_SurveyId ON dbo.EventConfiguration(SurveyId);
  PRINT 'EventConfiguration created (BIGINT)';

  -- Create synonym for backward compatibility
  IF OBJECT_ID(N'dbo.SurveyConfiguration', N'SN') IS NOT NULL DROP SYNONYM dbo.SurveyConfiguration;
  CREATE SYNONYM dbo.SurveyConfiguration FOR dbo.EventConfiguration;
  PRINT 'Synonym dbo.SurveyConfiguration created for dbo.EventConfiguration';

  -- ============================================================
  -- STEP 5: Recreate Questions with BIGINT IDENTITY
  -- ============================================================

  CREATE TABLE dbo.Questions (
    QuestionId                BIGINT IDENTITY(1,1) PRIMARY KEY,
    SurveyId                  BIGINT        NOT NULL REFERENCES dbo.Events(SurveyId) ON DELETE CASCADE,
    Type                      NVARCHAR(50)  NOT NULL
                              CHECK (Type IN ('HeroCover','Text','MultipleChoice','Checkbox','Dropdown','MatrixLikert','Rating','Date','Signature')),
    PromptText                NVARCHAR(MAX) NOT NULL,
    Subtitle                  NVARCHAR(500) NULL,
    ImageUrl                  NVARCHAR(500) NULL,
    IsMandatory               BIT           NOT NULL DEFAULT 0,
    DisplayOrder              INT           NOT NULL,
    PageNumber                INT           NOT NULL DEFAULT 1,
    LayoutOrientation         NVARCHAR(20)  NULL CHECK (LayoutOrientation IN ('vertical','horizontal',NULL)),
    Options                   NVARCHAR(MAX) NULL,
    CommentRequiredBelowRating INT          NULL,
    CreatedAt                 DATETIME2     NOT NULL DEFAULT GETDATE(),
    CreatedBy                 BIGINT        NULL REFERENCES dbo.Users(UserId),
    UpdatedAt                 DATETIME2     NULL,
    UpdatedBy                 BIGINT        NULL REFERENCES dbo.Users(UserId)
  );

  CREATE INDEX IX_Questions_SurveyId         ON dbo.Questions(SurveyId);
  CREATE INDEX IX_Questions_DisplayOrder     ON dbo.Questions(DisplayOrder);
  CREATE INDEX IX_Questions_Type             ON dbo.Questions(Type);
  PRINT 'Questions created (BIGINT)';

  -- ============================================================
  -- STEP 6: Recreate EventAdminAssignments with BIGINT
  -- ============================================================

  CREATE TABLE dbo.EventAdminAssignments (
    SurveyId    BIGINT    NOT NULL REFERENCES dbo.Events(SurveyId) ON DELETE CASCADE,
    AdminUserId BIGINT    NOT NULL REFERENCES dbo.Users(UserId),
    AssignedAt  DATETIME2 NOT NULL DEFAULT GETDATE(),
    CreatedBy   BIGINT    NULL,
    PRIMARY KEY (SurveyId, AdminUserId)
  );

  CREATE INDEX IX_EventAdminAssignments_AdminUserId ON dbo.EventAdminAssignments(AdminUserId);
  PRINT 'EventAdminAssignments created (BIGINT)';

  COMMIT TRANSACTION;
  PRINT '=== Migration 037 Phase 4 completed successfully ===';

END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  PRINT 'ERROR in Migration 037: ' + ERROR_MESSAGE();
  THROW;
END CATCH;
