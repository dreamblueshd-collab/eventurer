-- ================================================================
-- Migration 054: Rollback AssignedAdminId to BIGINT
-- ================================================================
-- Purpose: Revert Migration 050 - restore Events.AssignedAdminId to BIGINT
-- Reason:  Conflict between migration 050 (NVARCHAR) and code implementation (BIGINT)
--          Current architecture: EventAdminAssignments is source of truth for multi-admin
--          Events.AssignedAdminId stores only PRIMARY admin ID for legacy compatibility
--
-- IMPORTANT: Only run this if Migration 050 was applied on your environment
-- Check first using: backend/scripts/diagnose-assignedadminid-schema.sql
--
-- If diagnosis shows BIGINT -> This migration is NOT needed (already correct)
-- If diagnosis shows NVARCHAR -> Run this migration to fix the schema
-- ================================================================

USE CSI;
GO

SET XACT_ABORT ON;
GO

BEGIN TRY
  BEGIN TRANSACTION;

  PRINT '=================================================================';
  PRINT 'Migration 054: Rollback AssignedAdminId to BIGINT';
  PRINT '=================================================================';

  -- ============================================================
  -- STEP 1: Check current column type
  -- ============================================================
  DECLARE @currentType NVARCHAR(128);
  SELECT @currentType = ty.name
  FROM sys.tables t
  INNER JOIN sys.columns c ON c.object_id = t.object_id
  INNER JOIN sys.types ty ON ty.user_type_id = c.user_type_id
  WHERE t.name = 'Events' AND c.name = 'AssignedAdminId';

  PRINT 'Current AssignedAdminId type: ' + @currentType;

  IF @currentType = 'bigint'
  BEGIN
    PRINT '✓ Column is already BIGINT. No changes needed.';
    PRINT 'Migration 054 completed (no action required).';
    COMMIT TRANSACTION;
    RETURN;
  END

  IF @currentType <> 'nvarchar'
  BEGIN
    PRINT '⚠ Unexpected column type: ' + @currentType;
    PRINT 'Expected either ''bigint'' or ''nvarchar''. Aborting.';
    ROLLBACK TRANSACTION;
    RETURN;
  END

  PRINT 'Proceeding with rollback from NVARCHAR to BIGINT...';

  -- ============================================================
  -- STEP 2: Drop any indexes on AssignedAdminId
  -- ============================================================
  DECLARE @ixSql NVARCHAR(MAX) = N'';
  SELECT @ixSql = @ixSql +
    N'DROP INDEX [' + i.name + N'] ON dbo.Events; '
  FROM sys.indexes i
  JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
  JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
  WHERE i.object_id = OBJECT_ID('dbo.Events')
    AND c.name = 'AssignedAdminId'
    AND i.is_primary_key = 0
    AND i.type <> 0;

  IF LEN(@ixSql) > 0
  BEGIN
    EXEC(@ixSql);
    PRINT 'Indexes on Events.AssignedAdminId dropped.';
  END

  -- ============================================================
  -- STEP 3: Build mapping from EventAdminAssignments
  -- Store primary admin UserId before column conversion
  -- ============================================================
  CREATE TABLE #AdminIdMapping (
    SurveyId BIGINT NOT NULL,
    PrimaryAdminUserId BIGINT NULL
  );

  -- Get primary admin from EventAdminAssignments (first by CreatedAt)
  INSERT INTO #AdminIdMapping (SurveyId, PrimaryAdminUserId)
  SELECT 
    e.SurveyId,
    (
      SELECT TOP 1 eaa.AdminUserId
      FROM EventAdminAssignments eaa
      WHERE eaa.SurveyId = e.SurveyId
      ORDER BY eaa.CreatedAt, eaa.AdminUserId
    ) AS PrimaryAdminUserId
  FROM Events e
  WHERE EXISTS (SELECT 1 FROM EventAdminAssignments eaa WHERE eaa.SurveyId = e.SurveyId);

  PRINT 'Primary admin mapping built from EventAdminAssignments.';

  -- ============================================================
  -- STEP 4: Clear AssignedAdminId before type conversion
  -- ============================================================
  UPDATE Events SET AssignedAdminId = NULL;
  PRINT 'Events.AssignedAdminId cleared for type conversion.';

  -- ============================================================
  -- STEP 5: Alter column back to BIGINT
  -- ============================================================
  ALTER TABLE dbo.Events ALTER COLUMN AssignedAdminId BIGINT NULL;
  PRINT 'Events.AssignedAdminId converted to BIGINT.';

  -- ============================================================
  -- STEP 6: Populate with primary admin UserId
  -- ============================================================
  UPDATE e
  SET e.AssignedAdminId = am.PrimaryAdminUserId
  FROM dbo.Events e
  INNER JOIN #AdminIdMapping am ON am.SurveyId = e.SurveyId
  WHERE am.PrimaryAdminUserId IS NOT NULL;

  DECLARE @updatedCount INT = @@ROWCOUNT;
  PRINT 'Populated ' + CAST(@updatedCount AS NVARCHAR) + ' events with primary admin ID.';

  DROP TABLE #AdminIdMapping;

  -- ============================================================
  -- STEP 7: Recreate FK constraint to Users
  -- ============================================================
  IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys fk
    JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
    JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
    WHERE fk.parent_object_id = OBJECT_ID('dbo.Events') AND c.name = 'AssignedAdminId'
  )
  BEGIN
    ALTER TABLE dbo.Events 
    ADD CONSTRAINT FK_Events_AssignedAdminId_Users 
    FOREIGN KEY (AssignedAdminId) REFERENCES dbo.Users(UserId);
    PRINT 'FK constraint created: Events.AssignedAdminId -> Users.UserId';
  END
  ELSE
  BEGIN
    PRINT 'FK constraint already exists.';
  END

  -- ============================================================
  -- STEP 8: Recreate index for performance
  -- ============================================================
  CREATE INDEX IX_Events_AssignedAdminId ON dbo.Events(AssignedAdminId);
  PRINT 'Index recreated on Events.AssignedAdminId.';

  COMMIT TRANSACTION;
  PRINT '';
  PRINT '=== Migration 054 completed successfully ===';
  PRINT 'Events.AssignedAdminId is now BIGINT (stores primary admin UserId).';
  PRINT 'EventAdminAssignments remains the source of truth for multi-admin data.';

END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  PRINT 'ERROR in Migration 054: ' + ERROR_MESSAGE();
  THROW;
END CATCH;
GO
