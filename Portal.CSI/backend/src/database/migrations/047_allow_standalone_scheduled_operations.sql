-- Migration 047: Allow standalone scheduled operations (no SurveyId required)
-- Description: Makes SurveyId nullable in ScheduledOperations, adds OperationContext
--              column, and expands OperationType CHECK constraint for 'StandaloneBlast'.

USE CSI;
GO

-- 1. Drop the FK constraint on SurveyId
IF EXISTS (
  SELECT 1 FROM sys.foreign_keys
  WHERE parent_object_id = OBJECT_ID('ScheduledOperations')
    AND name LIKE '%SurveyId%'
)
BEGIN
  DECLARE @fkName NVARCHAR(256);
  SELECT @fkName = fk.name
  FROM sys.foreign_keys fk
  WHERE fk.parent_object_id = OBJECT_ID('ScheduledOperations')
    AND EXISTS (
      SELECT 1 FROM sys.foreign_key_columns fkc
      WHERE fkc.constraint_object_id = fk.object_id
        AND COL_NAME(fkc.parent_object_id, fkc.parent_column_id) = 'SurveyId'
    );

  IF @fkName IS NOT NULL
  BEGIN
    EXEC('ALTER TABLE ScheduledOperations DROP CONSTRAINT [' + @fkName + ']');
    PRINT 'Dropped FK constraint: ' + @fkName;
  END
END
GO

-- 2. Make SurveyId nullable and convert index to filtered
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('ScheduledOperations') AND name = 'SurveyId' AND is_nullable = 0)
BEGIN
  -- Drop existing index on SurveyId first (cannot alter column with index)
  IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('ScheduledOperations') AND name = 'IX_ScheduledOperations_SurveyId')
  BEGIN
    DROP INDEX IX_ScheduledOperations_SurveyId ON ScheduledOperations;
    PRINT 'Dropped index IX_ScheduledOperations_SurveyId';
  END

  ALTER TABLE ScheduledOperations ALTER COLUMN SurveyId BIGINT NULL;
  PRINT 'SurveyId is now nullable';

  -- Re-create as filtered index
  CREATE INDEX IX_ScheduledOperations_SurveyId ON ScheduledOperations(SurveyId) WHERE SurveyId IS NOT NULL;
  PRINT 'Recreated IX_ScheduledOperations_SurveyId as filtered index';
END
GO

-- 3. Re-add FK constraint on SurveyId (now optional)
IF NOT EXISTS (
  SELECT 1 FROM sys.foreign_keys
  WHERE parent_object_id = OBJECT_ID('ScheduledOperations')
    AND name = 'FK_ScheduledOperations_SurveyId'
)
BEGIN
  ALTER TABLE ScheduledOperations
    ADD CONSTRAINT FK_ScheduledOperations_SurveyId
    FOREIGN KEY (SurveyId) REFERENCES Events(SurveyId) ON DELETE SET NULL;
  PRINT 'Re-added FK constraint FK_ScheduledOperations_SurveyId (nullable, ON DELETE SET NULL)';
END
GO

-- 4. Add OperationContext column (JSON) for standalone blast data
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('ScheduledOperations') AND name = 'OperationContext')
BEGIN
  ALTER TABLE ScheduledOperations ADD OperationContext NVARCHAR(MAX) NULL;
  PRINT 'Added OperationContext column';
END
GO

-- 5. Expand OperationType CHECK constraint to include 'StandaloneBlast'
-- Drop existing constraint first
IF EXISTS (
  SELECT 1 FROM sys.check_constraints
  WHERE parent_object_id = OBJECT_ID('ScheduledOperations')
    AND definition LIKE '%OperationType%'
)
BEGIN
  DECLARE @ckName NVARCHAR(256);
  SELECT @ckName = cc.name
  FROM sys.check_constraints cc
  WHERE cc.parent_object_id = OBJECT_ID('ScheduledOperations')
    AND cc.definition LIKE '%OperationType%';

  IF @ckName IS NOT NULL
  BEGIN
    EXEC('ALTER TABLE ScheduledOperations DROP CONSTRAINT [' + @ckName + ']');
    PRINT 'Dropped CHECK constraint: ' + @ckName;
  END
END
GO

ALTER TABLE ScheduledOperations
  ADD CONSTRAINT CK_ScheduledOperations_OperationType
  CHECK (OperationType IN ('Blast', 'Reminder', 'StandaloneBlast'));
PRINT 'Added updated OperationType CHECK constraint';
GO

PRINT 'Migration 047 completed successfully';
GO
