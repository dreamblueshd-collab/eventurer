-- Migration 050: Change Events.AssignedAdminId from BIGINT to NVARCHAR (username semicolon-separated)
-- Purpose: Make multi-admin assignment directly readable from Events table.
-- Source of truth remains EventAdminAssignments table (relational, UserId-based).
-- Events.AssignedAdminId now stores semicolon-separated usernames, e.g. "acil;budi"

USE CSI;
GO

SET XACT_ABORT ON;
GO

BEGIN TRY
  BEGIN TRANSACTION;

  -- ============================================================
  -- STEP 1: Drop FK constraint on Events.AssignedAdminId -> Users
  -- ============================================================
  DECLARE @fkName NVARCHAR(256);
  SELECT @fkName = fk.name
  FROM sys.foreign_keys fk
  JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
  JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
  WHERE fk.parent_object_id = OBJECT_ID('dbo.Events')
    AND c.name = 'AssignedAdminId';

  IF @fkName IS NOT NULL
    EXEC('ALTER TABLE dbo.Events DROP CONSTRAINT [' + @fkName + ']');

  PRINT 'FK constraint on Events.AssignedAdminId dropped (if existed).';

  -- ============================================================
  -- STEP 2: Drop any indexes referencing AssignedAdminId
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
    EXEC(@ixSql);

  PRINT 'Indexes on Events.AssignedAdminId dropped (if existed).';

  -- ============================================================
  -- STEP 3: Build mapping of existing AssignedAdminId -> Username
  -- Store in temp table before altering column
  -- ============================================================
  CREATE TABLE #AdminMapping (
    SurveyId BIGINT NOT NULL,
    UsernamesCsv NVARCHAR(500) NULL
  );

  INSERT INTO #AdminMapping (SurveyId, UsernamesCsv)
  SELECT
    e.SurveyId,
    STUFF((
      SELECT ';' + u.Username
      FROM EventAdminAssignments eaa
      INNER JOIN Users u ON u.UserId = eaa.AdminUserId
      WHERE eaa.SurveyId = e.SurveyId
      ORDER BY u.Username
      FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'), 1, 1, '') AS UsernamesCsv
  FROM Events e
  WHERE EXISTS (SELECT 1 FROM EventAdminAssignments eaa WHERE eaa.SurveyId = e.SurveyId);

  -- For events that have AssignedAdminId but no rows in EventAdminAssignments
  INSERT INTO #AdminMapping (SurveyId, UsernamesCsv)
  SELECT e.SurveyId, u.Username
  FROM Events e
  INNER JOIN Users u ON u.UserId = e.AssignedAdminId
  WHERE e.AssignedAdminId IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM #AdminMapping am WHERE am.SurveyId = e.SurveyId);

  PRINT 'Username mapping built from existing data.';

  -- ============================================================
  -- STEP 4: Alter column from BIGINT to NVARCHAR(500)
  -- ============================================================
  ALTER TABLE dbo.Events ALTER COLUMN AssignedAdminId NVARCHAR(500) NULL;

  PRINT 'Events.AssignedAdminId changed to NVARCHAR(500).';

  -- ============================================================
  -- STEP 5: Populate with semicolon-separated usernames
  -- ============================================================
  UPDATE e
  SET e.AssignedAdminId = am.UsernamesCsv
  FROM dbo.Events e
  INNER JOIN #AdminMapping am ON am.SurveyId = e.SurveyId;

  -- Clear old numeric values that didn't map
  UPDATE dbo.Events
  SET AssignedAdminId = NULL
  WHERE AssignedAdminId IS NOT NULL
    AND ISNUMERIC(AssignedAdminId) = 1
    AND NOT EXISTS (SELECT 1 FROM #AdminMapping am WHERE am.SurveyId = Events.SurveyId);

  DROP TABLE #AdminMapping;

  PRINT 'Events.AssignedAdminId populated with semicolon-separated usernames.';

  -- ============================================================
  -- STEP 6: Add index for lookup
  -- ============================================================
  CREATE INDEX IX_Events_AssignedAdminId ON dbo.Events(AssignedAdminId);

  PRINT 'Index on Events.AssignedAdminId recreated.';

  COMMIT TRANSACTION;
  PRINT '=== Migration 050 completed successfully ===';
  PRINT 'Events.AssignedAdminId is now NVARCHAR(500) with semicolon-separated usernames.';

END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  PRINT 'ERROR in Migration 050: ' + ERROR_MESSAGE();
  THROW;
END CATCH;
GO
