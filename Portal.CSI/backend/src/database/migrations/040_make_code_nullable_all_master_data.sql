-- Migration 040: Make Code column NULLABLE for all master data tables
-- This allows master data to exist without Code values
-- User preference: No auto-generate, no required Excel input

-- Check if we are using BIGINT schema (newer) or old schema
DECLARE @isBigIntSchema BIT = 0;

IF EXISTS (
  SELECT 1 FROM sys.columns 
  WHERE object_id = OBJECT_ID('BusinessUnits') 
  AND name = 'BusinessUnitId' 
  AND system_type_id = 127 -- BIGINT
)
BEGIN
  SET @isBigIntSchema = 1;
END

IF @isBigIntSchema = 0
BEGIN
  PRINT 'Migration 040 skipped: Old schema detected, not applicable.';
  RETURN;
END

BEGIN TRANSACTION;

BEGIN TRY
  -- 1. BusinessUnits: Make Code NULLABLE
  IF EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID('BusinessUnits') 
    AND name = 'Code' 
    AND is_nullable = 0
  )
  BEGIN
    ALTER TABLE BusinessUnits ALTER COLUMN Code NVARCHAR(20) NULL;
    PRINT 'BusinessUnits.Code is now NULLABLE';
  END
  ELSE
  BEGIN
    PRINT 'BusinessUnits.Code already NULLABLE';
  END

  -- 2. Divisions: Make Code NULLABLE
  IF EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID('Divisions') 
    AND name = 'Code' 
    AND is_nullable = 0
  )
  BEGIN
    ALTER TABLE Divisions ALTER COLUMN Code NVARCHAR(20) NULL;
    PRINT 'Divisions.Code is now NULLABLE';
  END
  ELSE
  BEGIN
    PRINT 'Divisions.Code already NULLABLE';
  END

  -- 3. Departments: Make Code NULLABLE
  IF EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID('Departments') 
    AND name = 'Code' 
    AND is_nullable = 0
  )
  BEGIN
    ALTER TABLE Departments ALTER COLUMN Code NVARCHAR(20) NULL;
    PRINT 'Departments.Code is now NULLABLE';
  END
  ELSE
  BEGIN
    PRINT 'Departments.Code already NULLABLE';
  END

  -- 4. Functions: Make Code NULLABLE
  IF EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID('Functions') 
    AND name = 'Code' 
    AND is_nullable = 0
  )
  BEGIN
    ALTER TABLE Functions ALTER COLUMN Code NVARCHAR(20) NULL;
    PRINT 'Functions.Code is now NULLABLE';
  END
  ELSE
  BEGIN
    PRINT 'Functions.Code already NULLABLE';
  END

  -- 5. Applications: Make Code NULLABLE
  IF EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID('Applications') 
    AND name = 'Code' 
    AND is_nullable = 0
  )
  BEGIN
    ALTER TABLE Applications ALTER COLUMN Code NVARCHAR(20) NULL;
    PRINT 'Applications.Code is now NULLABLE';
  END
  ELSE
  BEGIN
    PRINT 'Applications.Code already NULLABLE';
  END

  COMMIT TRANSACTION;
  PRINT 'Migration 040 completed successfully';
END TRY
BEGIN CATCH
  ROLLBACK TRANSACTION;
  PRINT 'Migration 040 failed: ' + ERROR_MESSAGE();
  THROW;
END CATCH;
