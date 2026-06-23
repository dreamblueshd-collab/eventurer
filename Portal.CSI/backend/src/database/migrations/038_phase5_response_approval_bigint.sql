-- Migration 038: Phase 5 — Migrate Response & Approval Tables PKs from UUID to BIGINT IDENTITY
-- Tables: Responses, QuestionResponses, ApprovalHistory, BestCommentFeedback
-- Strategy: Drop all FK constraints, drop tables, recreate with BIGINT IDENTITY(1,1)
-- Note: Data reset is acceptable (development environment)

USE CSI;

SET XACT_ABORT ON;

PRINT '=== Migration 038: Phase 5 Response & Approval UUID -> BIGINT ===';

-- Safety: no-op if Phase 5 tables already use BIGINT IDENTITY PKs.
IF OBJECT_ID('dbo.Responses', 'U') IS NOT NULL
  AND OBJECT_ID('dbo.QuestionResponses', 'U') IS NOT NULL
  AND OBJECT_ID('dbo.ApprovalHistory', 'U') IS NOT NULL
  AND OBJECT_ID('dbo.BestCommentFeedback', 'U') IS NOT NULL
  AND COLUMNPROPERTY(OBJECT_ID('dbo.Responses'), 'ResponseId', 'IsIdentity') = 1
  AND COLUMNPROPERTY(OBJECT_ID('dbo.QuestionResponses'), 'QuestionResponseId', 'IsIdentity') = 1
  AND COLUMNPROPERTY(OBJECT_ID('dbo.ApprovalHistory'), 'HistoryId', 'IsIdentity') = 1
  AND COLUMNPROPERTY(OBJECT_ID('dbo.BestCommentFeedback'), 'FeedbackId', 'IsIdentity') = 1
  AND EXISTS (SELECT 1 FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id WHERE c.object_id = OBJECT_ID('dbo.Responses') AND c.name = 'ResponseId' AND t.name = 'bigint')
  AND EXISTS (SELECT 1 FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id WHERE c.object_id = OBJECT_ID('dbo.QuestionResponses') AND c.name = 'QuestionResponseId' AND t.name = 'bigint')
  AND EXISTS (SELECT 1 FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id WHERE c.object_id = OBJECT_ID('dbo.ApprovalHistory') AND c.name = 'HistoryId' AND t.name = 'bigint')
  AND EXISTS (SELECT 1 FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id WHERE c.object_id = OBJECT_ID('dbo.BestCommentFeedback') AND c.name = 'FeedbackId' AND t.name = 'bigint')
BEGIN
  PRINT 'Migration 038 skipped: BIGINT schema already present for Phase 5 tables.';
  RETURN;
END;

BEGIN TRY
  BEGIN TRANSACTION;

  -- ============================================================
  -- STEP 1: Drop ALL FK constraints referencing Phase 5 tables
  -- ============================================================

  DECLARE @sql NVARCHAR(MAX) = N'';

  SELECT @sql = @sql +
    N'ALTER TABLE ' + QUOTENAME(OBJECT_SCHEMA_NAME(fk.parent_object_id)) +
    N'.' + QUOTENAME(OBJECT_NAME(fk.parent_object_id)) +
    N' DROP CONSTRAINT ' + QUOTENAME(fk.name) + N'; '
  FROM sys.foreign_keys fk
  WHERE OBJECT_NAME(fk.referenced_object_id) IN (
    'Responses','QuestionResponses','ApprovalHistory','BestCommentFeedback'
  );

  IF LEN(@sql) > 0
  BEGIN
    EXEC(@sql);
    PRINT 'All FK constraints referencing Phase 5 tables dropped.';
  END;

  -- Also drop FK constraints WITHIN Phase 5 tables
  SET @sql = N'';
  SELECT @sql = @sql +
    N'ALTER TABLE ' + QUOTENAME(OBJECT_SCHEMA_NAME(fk.parent_object_id)) +
    N'.' + QUOTENAME(OBJECT_NAME(fk.parent_object_id)) +
    N' DROP CONSTRAINT ' + QUOTENAME(fk.name) + N'; '
  FROM sys.foreign_keys fk
  WHERE OBJECT_NAME(fk.parent_object_id) IN (
    'Responses','QuestionResponses','ApprovalHistory','BestCommentFeedback'
  );

  IF LEN(@sql) > 0
  BEGIN
    EXEC(@sql);
    PRINT 'Internal FK constraints within Phase 5 tables dropped.';
  END;

  -- ============================================================
  -- STEP 2: Drop Phase 5 tables (order: leaf first)
  -- ============================================================

  IF OBJECT_ID('dbo.BestCommentFeedback',  'U') IS NOT NULL DROP TABLE dbo.BestCommentFeedback;
  IF OBJECT_ID('dbo.ApprovalHistory',      'U') IS NOT NULL DROP TABLE dbo.ApprovalHistory;
  IF OBJECT_ID('dbo.QuestionResponses',    'U') IS NOT NULL DROP TABLE dbo.QuestionResponses;
  IF OBJECT_ID('dbo.Responses',            'U') IS NOT NULL DROP TABLE dbo.Responses;
  PRINT 'Phase 5 tables dropped.';

  -- ============================================================
  -- STEP 3: Recreate Responses with BIGINT IDENTITY
  -- ============================================================

  CREATE TABLE dbo.Responses (
    ResponseId             BIGINT IDENTITY(1,1) PRIMARY KEY,
    SurveyId               BIGINT        NOT NULL REFERENCES dbo.Events(SurveyId),
    RespondentEmail        NVARCHAR(255) NULL,
    RespondentName         NVARCHAR(200) NOT NULL,
    BusinessUnitId         BIGINT        NOT NULL REFERENCES dbo.BusinessUnits(BusinessUnitId),
    DivisionId             BIGINT        NOT NULL REFERENCES dbo.Divisions(DivisionId),
    DepartmentId           BIGINT        NOT NULL REFERENCES dbo.Departments(DepartmentId),
    ApplicationId          BIGINT        NOT NULL REFERENCES dbo.Applications(ApplicationId),
    IPAddress              NVARCHAR(50)  NULL,
    SubmittedAt            DATETIME2     NOT NULL DEFAULT GETDATE(),
    ResponseApprovalStatus NVARCHAR(50)  NOT NULL DEFAULT 'Submitted'
                           CHECK (ResponseApprovalStatus IN (
                               'Submitted','RejectedByAdmin','PendingITLead',
                               'PendingAdminTakeoutDecision','ApprovedFinal')),
    AdminReviewedBy        BIGINT        NULL REFERENCES dbo.Users(UserId),
    AdminReviewedAt        DATETIME2     NULL,
    AdminReviewReason      NVARCHAR(MAX) NULL,
    ITLeadReviewedBy       BIGINT        NULL REFERENCES dbo.Users(UserId),
    ITLeadReviewedAt       DATETIME2     NULL,
    ITLeadReviewReason     NVARCHAR(MAX) NULL,
    FinalizedAt            DATETIME2     NULL
  );

  CREATE INDEX IX_Responses_SurveyId             ON dbo.Responses(SurveyId);
  CREATE INDEX IX_Responses_BusinessUnitId       ON dbo.Responses(BusinessUnitId);
  CREATE INDEX IX_Responses_DivisionId           ON dbo.Responses(DivisionId);
  CREATE INDEX IX_Responses_DepartmentId         ON dbo.Responses(DepartmentId);
  CREATE INDEX IX_Responses_ApplicationId        ON dbo.Responses(ApplicationId);
  CREATE INDEX IX_Responses_ResponseApprovalStatus ON dbo.Responses(ResponseApprovalStatus);
  CREATE INDEX IX_Responses_SubmittedAt          ON dbo.Responses(SubmittedAt);
  PRINT 'Responses created (BIGINT)';

  -- ============================================================
  -- STEP 4: Recreate QuestionResponses with BIGINT IDENTITY
  -- ============================================================

  CREATE TABLE dbo.QuestionResponses (
    QuestionResponseId BIGINT IDENTITY(1,1) PRIMARY KEY,
    ResponseId         BIGINT         NOT NULL REFERENCES dbo.Responses(ResponseId) ON DELETE CASCADE,
    QuestionId         BIGINT         NOT NULL REFERENCES dbo.Questions(QuestionId),
    TextValue          NVARCHAR(MAX)  NULL,
    NumericValue       DECIMAL(10,2)  NULL,
    DateValue          DATETIME2      NULL,
    MatrixValues       NVARCHAR(MAX)  NULL,
    CommentValue       NVARCHAR(MAX)  NULL,
    TakeoutStatus      NVARCHAR(50)   NOT NULL DEFAULT 'Active'
                       CHECK (TakeoutStatus IN ('Active','ProposedTakeout','TakenOut','Rejected')),
    TakeoutReason      NVARCHAR(MAX)  NULL,
    ProposedBy         BIGINT         NULL REFERENCES dbo.Users(UserId),
    ProposedAt         DATETIME2      NULL,
    ReviewedBy         BIGINT         NULL REFERENCES dbo.Users(UserId),
    ReviewedAt         DATETIME2      NULL,
    IsBestComment      BIT            NOT NULL DEFAULT 0,
    CreatedAt          DATETIME2      NOT NULL DEFAULT GETDATE()
  );

  CREATE INDEX IX_QuestionResponses_ResponseId    ON dbo.QuestionResponses(ResponseId);
  CREATE INDEX IX_QuestionResponses_QuestionId    ON dbo.QuestionResponses(QuestionId);
  CREATE INDEX IX_QuestionResponses_TakeoutStatus ON dbo.QuestionResponses(TakeoutStatus);
  CREATE INDEX IX_QuestionResponses_IsBestComment ON dbo.QuestionResponses(IsBestComment);
  PRINT 'QuestionResponses created (BIGINT)';

  -- ============================================================
  -- STEP 5: Recreate ApprovalHistory with BIGINT IDENTITY
  -- ============================================================

  CREATE TABLE dbo.ApprovalHistory (
    HistoryId          BIGINT IDENTITY(1,1) PRIMARY KEY,
    QuestionResponseId BIGINT        NOT NULL REFERENCES dbo.QuestionResponses(QuestionResponseId) ON DELETE CASCADE,
    Action             NVARCHAR(50)  NOT NULL CHECK (Action IN ('Proposed','Approved','Rejected','Cancelled')),
    PerformedBy        BIGINT        NOT NULL REFERENCES dbo.Users(UserId),
    Reason             NVARCHAR(MAX) NULL,
    PreviousStatus     NVARCHAR(50)  NULL,
    NewStatus          NVARCHAR(50)  NOT NULL,
    PerformedAt        DATETIME2     NOT NULL DEFAULT GETDATE()
  );

  CREATE INDEX IX_ApprovalHistory_QuestionResponseId ON dbo.ApprovalHistory(QuestionResponseId);
  CREATE INDEX IX_ApprovalHistory_PerformedBy        ON dbo.ApprovalHistory(PerformedBy);
  CREATE INDEX IX_ApprovalHistory_Action             ON dbo.ApprovalHistory(Action);
  PRINT 'ApprovalHistory created (BIGINT)';

  -- ============================================================
  -- STEP 6: Recreate BestCommentFeedback with BIGINT IDENTITY
  -- ============================================================

  CREATE TABLE dbo.BestCommentFeedback (
    FeedbackId         BIGINT IDENTITY(1,1) PRIMARY KEY,
    QuestionResponseId BIGINT        NOT NULL REFERENCES dbo.QuestionResponses(QuestionResponseId) ON DELETE CASCADE,
    ITLeadUserId       BIGINT        NOT NULL REFERENCES dbo.Users(UserId),
    FeedbackText       NVARCHAR(MAX) NOT NULL,
    CreatedAt          DATETIME2     NOT NULL DEFAULT GETDATE(),
    UpdatedAt          DATETIME2     NULL,
    CONSTRAINT UQ_BestCommentFeedback UNIQUE (QuestionResponseId, ITLeadUserId)
  );

  CREATE INDEX IX_BestCommentFeedback_QuestionResponseId ON dbo.BestCommentFeedback(QuestionResponseId);
  CREATE INDEX IX_BestCommentFeedback_ITLeadUserId       ON dbo.BestCommentFeedback(ITLeadUserId);
  PRINT 'BestCommentFeedback created (BIGINT)';

  COMMIT TRANSACTION;
  PRINT '=== Migration 038 Phase 5 completed successfully ===';

END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  PRINT 'ERROR in Migration 038: ' + ERROR_MESSAGE();
  THROW;
END CATCH;
