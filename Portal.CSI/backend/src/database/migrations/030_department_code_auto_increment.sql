-- Migration 030: Change Departments.Code to auto-increment integer
-- Description: Replace NVARCHAR Code with INT IDENTITY auto-increment

USE CSI;

-- Safety: after UUID->BIGINT migration, master data codes remain NVARCHAR.
-- This migration is kept for historical reference and is skipped on BIGINT schemas.
IF OBJECT_ID('dbo.Departments', 'U') IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM sys.columns c
    JOIN sys.types t ON t.user_type_id = c.user_type_id
    WHERE c.object_id = OBJECT_ID('dbo.Departments')
      AND c.name = 'DepartmentId'
      AND t.name = 'bigint'
  )
BEGIN
  PRINT 'Migration 030 skipped: BIGINT schema detected (Departments.Code stays NVARCHAR).';
  RETURN;
END;

-- Step 1: Drop unique constraint on Code if exists
IF EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'UQ__Departments__Code' AND object_id = OBJECT_ID('Departments')
)
BEGIN
  ALTER TABLE Departments DROP CONSTRAINT UQ__Departments__Code;
  PRINT 'Dropped unique constraint UQ__Departments__Code on Departments.Code';
END

IF EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'UQ_Departments_Code' AND object_id = OBJECT_ID('Departments')
)
BEGIN
  ALTER TABLE Departments DROP CONSTRAINT UQ_Departments_Code;
  PRINT 'Dropped unique constraint UQ_Departments_Code on Departments.Code';
END

-- Drop index on Code if exists
IF EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'IX_Departments_Code' AND object_id = OBJECT_ID('Departments')
)
BEGIN
  DROP INDEX IX_Departments_Code ON Departments;
  PRINT 'Dropped index IX_Departments_Code';
END

-- Step 2: Drop the old Code column
IF EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('Departments') AND name = 'Code'
)
BEGIN
  ALTER TABLE Departments DROP COLUMN Code;
  PRINT 'Dropped old Code column from Departments';
END

-- Step 3: Add new Code column as INT IDENTITY auto-increment
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('Departments') AND name = 'Code'
)
BEGIN
  ALTER TABLE Departments ADD Code INT IDENTITY(1,1) NOT NULL;
  PRINT 'Added new Code column as INT IDENTITY(1,1) to Departments';
END

-- Step 4: Add unique constraint on new Code
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'UQ_Departments_Code' AND object_id = OBJECT_ID('Departments')
)
BEGIN
  ALTER TABLE Departments ADD CONSTRAINT UQ_Departments_Code UNIQUE (Code);
  PRINT 'Added unique constraint UQ_Departments_Code on new Code column';
END

PRINT 'Migration 030 completed: Departments.Code is now INT IDENTITY auto-increment';
