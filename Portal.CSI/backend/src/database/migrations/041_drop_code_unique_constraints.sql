-- Migration 041: Drop UNIQUE constraints on Code columns
-- SQL Server UNIQUE constraints do not allow multiple NULL values
-- Since Code is now optional (nullable) and not auto-generated,
-- we need to drop these constraints to allow multiple records without Code

BEGIN TRANSACTION;

BEGIN TRY
  -- 1. Drop Applications Code UNIQUE constraint
  IF EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE name = 'UQ__Applicat__A25C5AA7C99D82DC' 
    AND object_id = OBJECT_ID('Applications')
  )
  BEGIN
    ALTER TABLE Applications DROP CONSTRAINT UQ__Applicat__A25C5AA7C99D82DC;
    PRINT 'Dropped UNIQUE constraint on Applications.Code';
  END
  ELSE IF EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE name LIKE 'UQ__Applicat%Code%' 
    AND object_id = OBJECT_ID('Applications')
  )
  BEGIN
    DECLARE @appConst NVARCHAR(255);
    SELECT @appConst = name FROM sys.indexes 
    WHERE name LIKE 'UQ__Applicat%' 
    AND object_id = OBJECT_ID('Applications')
    AND is_unique_constraint = 1;
    
    IF @appConst IS NOT NULL
    BEGIN
      EXEC('ALTER TABLE Applications DROP CONSTRAINT ' + @appConst);
      PRINT 'Dropped UNIQUE constraint on Applications.Code: ' + @appConst;
    END
  END
  ELSE
  BEGIN
    PRINT 'Applications.Code UNIQUE constraint already dropped';
  END

  -- 2. Drop BusinessUnits Code UNIQUE constraint
  IF EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE name = 'UQ__Business__A25C5AA77C5E9D0B' 
    AND object_id = OBJECT_ID('BusinessUnits')
  )
  BEGIN
    ALTER TABLE BusinessUnits DROP CONSTRAINT UQ__Business__A25C5AA77C5E9D0B;
    PRINT 'Dropped UNIQUE constraint on BusinessUnits.Code';
  END
  ELSE IF EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE name LIKE 'UQ__Business%' 
    AND object_id = OBJECT_ID('BusinessUnits')
  )
  BEGIN
    DECLARE @buConst NVARCHAR(255);
    SELECT @buConst = name FROM sys.indexes 
    WHERE name LIKE 'UQ__Business%' 
    AND object_id = OBJECT_ID('BusinessUnits')
    AND is_unique_constraint = 1;
    
    IF @buConst IS NOT NULL
    BEGIN
      EXEC('ALTER TABLE BusinessUnits DROP CONSTRAINT ' + @buConst);
      PRINT 'Dropped UNIQUE constraint on BusinessUnits.Code: ' + @buConst;
    END
  END
  ELSE
  BEGIN
    PRINT 'BusinessUnits.Code UNIQUE constraint already dropped';
  END

  -- 3. Drop Divisions Code UNIQUE constraint
  IF EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE name = 'UQ__Division__A25C5AA7EAFF6649' 
    AND object_id = OBJECT_ID('Divisions')
  )
  BEGIN
    ALTER TABLE Divisions DROP CONSTRAINT UQ__Division__A25C5AA7EAFF6649;
    PRINT 'Dropped UNIQUE constraint on Divisions.Code';
  END
  ELSE IF EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE name LIKE 'UQ__Division%' 
    AND object_id = OBJECT_ID('Divisions')
  )
  BEGIN
    DECLARE @divConst NVARCHAR(255);
    SELECT @divConst = name FROM sys.indexes 
    WHERE name LIKE 'UQ__Division%' 
    AND object_id = OBJECT_ID('Divisions')
    AND is_unique_constraint = 1;
    
    IF @divConst IS NOT NULL
    BEGIN
      EXEC('ALTER TABLE Divisions DROP CONSTRAINT ' + @divConst);
      PRINT 'Dropped UNIQUE constraint on Divisions.Code: ' + @divConst;
    END
  END
  ELSE
  BEGIN
    PRINT 'Divisions.Code UNIQUE constraint already dropped';
  END

  -- 4. Drop Departments Code UNIQUE constraint
  IF EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE name = 'UQ__Departme__A25C5AA7B98E2BBB' 
    AND object_id = OBJECT_ID('Departments')
  )
  BEGIN
    ALTER TABLE Departments DROP CONSTRAINT UQ__Departme__A25C5AA7B98E2BBB;
    PRINT 'Dropped UNIQUE constraint on Departments.Code';
  END
  ELSE IF EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE name LIKE 'UQ__Departme%' 
    AND object_id = OBJECT_ID('Departments')
  )
  BEGIN
    DECLARE @deptConst NVARCHAR(255);
    SELECT @deptConst = name FROM sys.indexes 
    WHERE name LIKE 'UQ__Departme%' 
    AND object_id = OBJECT_ID('Departments')
    AND is_unique_constraint = 1;
    
    IF @deptConst IS NOT NULL
    BEGIN
      EXEC('ALTER TABLE Departments DROP CONSTRAINT ' + @deptConst);
      PRINT 'Dropped UNIQUE constraint on Departments.Code: ' + @deptConst;
    END
  END
  ELSE
  BEGIN
    PRINT 'Departments.Code UNIQUE constraint already dropped';
  END

  -- 5. Drop Functions Code UNIQUE constraint
  IF EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE name = 'UQ__Function__A25C5AA786BF8674' 
    AND object_id = OBJECT_ID('Functions')
  )
  BEGIN
    ALTER TABLE Functions DROP CONSTRAINT UQ__Function__A25C5AA786BF8674;
    PRINT 'Dropped UNIQUE constraint on Functions.Code';
  END
  ELSE IF EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE name LIKE 'UQ__Function%' 
    AND object_id = OBJECT_ID('Functions')
  )
  BEGIN
    DECLARE @funcConst NVARCHAR(255);
    SELECT @funcConst = name FROM sys.indexes 
    WHERE name LIKE 'UQ__Function%' 
    AND object_id = OBJECT_ID('Functions')
    AND is_unique_constraint = 1;
    
    IF @funcConst IS NOT NULL
    BEGIN
      EXEC('ALTER TABLE Functions DROP CONSTRAINT ' + @funcConst);
      PRINT 'Dropped UNIQUE constraint on Functions.Code: ' + @funcConst;
    END
  END
  ELSE
  BEGIN
    PRINT 'Functions.Code UNIQUE constraint already dropped';
  END

  COMMIT TRANSACTION;
  PRINT 'Migration 041 completed successfully';
END TRY
BEGIN CATCH
  ROLLBACK TRANSACTION;
  PRINT 'Migration 041 failed: ' + ERROR_MESSAGE();
  THROW;
END CATCH;
