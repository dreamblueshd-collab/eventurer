-- Migration 033: Indexing hardening (post-BIGINT)
-- Note: UUID sequential defaults are no longer relevant after UUID->BIGINT migration.
-- This migration keeps only safe, idempotent performance indexes.

USE CSI;

SET XACT_ABORT ON;

PRINT '=== Migration 033: Indexing hardening (post-BIGINT) ===';

-- Responses: report query joins SurveyId + ApprovalStatus + SubmittedAt
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Responses_Survey_Status_Date' AND object_id = OBJECT_ID('dbo.Responses'))
  CREATE INDEX IX_Responses_Survey_Status_Date
  ON dbo.Responses(SurveyId, ResponseApprovalStatus, SubmittedAt DESC)
  INCLUDE (RespondentName, RespondentEmail, DepartmentId, ApplicationId);

-- QuestionResponses: approval query joins ResponseId + TakeoutStatus
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_QuestionResponses_Response_Takeout' AND object_id = OBJECT_ID('dbo.QuestionResponses'))
  CREATE INDEX IX_QuestionResponses_Response_Takeout
  ON dbo.QuestionResponses(ResponseId, TakeoutStatus)
  INCLUDE (QuestionId, NumericValue, CommentValue, IsBestComment);

-- QuestionResponses: best comments query
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_QuestionResponses_BestComment' AND object_id = OBJECT_ID('dbo.QuestionResponses'))
  CREATE INDEX IX_QuestionResponses_BestComment
  ON dbo.QuestionResponses(IsBestComment, TakeoutStatus)
  INCLUDE (ResponseId, QuestionId, CommentValue, NumericValue);

-- Events: dashboard query by Status + date range
IF OBJECT_ID('dbo.Events', 'U') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Events_Status_Dates' AND object_id = OBJECT_ID('dbo.Events'))
BEGIN
  CREATE INDEX IX_Events_Status_Dates
  ON dbo.Events(Status, StartDate, EndDate)
  INCLUDE (Title, AssignedAdminId, TargetRespondents, TargetScore);
END

-- AuditLogs: filter by action + timestamp (most common audit query)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AuditLogs_Action_Timestamp' AND object_id = OBJECT_ID('dbo.AuditLogs'))
  CREATE INDEX IX_AuditLogs_Action_Timestamp
  ON dbo.AuditLogs(Action, Timestamp DESC)
  INCLUDE (UserId, Username, EntityType, EntityId, IPAddress);

-- AuditLogs: filter by EntityType + EntityId (detail lookup)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AuditLogs_Entity_Lookup' AND object_id = OBJECT_ID('dbo.AuditLogs'))
  CREATE INDEX IX_AuditLogs_Entity_Lookup
  ON dbo.AuditLogs(EntityType, EntityId, Timestamp DESC);

-- Sessions: cleanup query (expired + inactive)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Sessions_Cleanup' AND object_id = OBJECT_ID('dbo.Sessions'))
  CREATE INDEX IX_Sessions_Cleanup
  ON dbo.Sessions(IsActive, ExpiresAt)
  INCLUDE (UserId, TokenHash);

-- ScheduledOperations: scheduler processor query
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ScheduledOperations_Processor' AND object_id = OBJECT_ID('dbo.ScheduledOperations'))
  CREATE INDEX IX_ScheduledOperations_Processor
  ON dbo.ScheduledOperations(Status, NextExecutionAt)
  INCLUDE (SurveyId, OperationType, Frequency);

-- FunctionApplicationMappings: lookup by ApplicationId (approval routing)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_FuncAppMap_AppId_FuncId' AND object_id = OBJECT_ID('dbo.FunctionApplicationMappings'))
  CREATE INDEX IX_FuncAppMap_AppId_FuncId
  ON dbo.FunctionApplicationMappings(ApplicationId, FunctionId);

-- ApplicationDepartmentMappings: lookup by DepartmentId (respondent app selection)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AppDeptMap_DeptId_AppId' AND object_id = OBJECT_ID('dbo.ApplicationDepartmentMappings'))
  CREATE INDEX IX_AppDeptMap_DeptId_AppId
  ON dbo.ApplicationDepartmentMappings(DepartmentId, ApplicationId);

PRINT '=== Migration 033 completed successfully ===';
