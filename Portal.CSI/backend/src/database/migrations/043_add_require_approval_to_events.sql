-- Migration: Add RequireApproval column to Events table
-- This allows each survey/event to optionally require approval workflow for responses

IF NOT EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID('dbo.Events') AND name = 'RequireApproval'
)
BEGIN
    ALTER TABLE dbo.Events ADD RequireApproval BIT NOT NULL DEFAULT 0;
    PRINT 'Added RequireApproval column to Events table';
END
GO
