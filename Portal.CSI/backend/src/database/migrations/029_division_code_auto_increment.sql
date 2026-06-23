-- Migration 029: Change Divisions.Code to auto-increment integer
-- Description: Replace NVARCHAR Code with INT IDENTITY auto-increment

USE CSI;

-- Safety: after UUID->BIGINT migration, master data codes remain NVARCHAR.
-- This migration is kept for historical reference and is skipped on BIGINT schemas.
IF OBJECT_ID('dbo.Divisions', 'U') IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM sys.columns c
    JOIN sys.types t ON t.user_type_id = c.user_type_id
    WHERE c.object_id = OBJECT_ID('dbo.Divisions')
      AND c.name = 'DivisionId'
      AND t.name = 'bigint'
  )
BEGIN
  PRINT 'Migration 029 skipped: BIGINT schema detected (Divisions.Code stays NVARCHAR).';
  RETURN;
END;

-- Step 1: Drop unique constraint on Code if exists
IF EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'UQ__Divisions__Code' AND object_id = OBJECT_ID('Divisions')
)
BEGIN
  ALTER TABLE Divisions DROP CONSTRAINT UQ__Divisions__Code;
  PRINT 'Dropped unique constraint UQ__Divisions__Code on Divisions.Code';
END

IF EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'UQ_Divisions_Code' AND object_id = OBJECT_ID('Divisions')
)
BEGIN
  ALTER TABLE Divisions DROP CONSTRAINT UQ_Divisions_Code;
  PRINT 'Dropped unique constraint UQ_Divisions_Code on Divisions.Code';
END

-- Drop index on Code if exists
IF EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'IX_Divisions_Code' AND object_id = OBJECT_ID('Divisions')
)
BEGIN
  DROP INDEX IX_Divisions_Code ON Divisions;
  PRINT 'Dropped index IX_Divisions_Code';
END

-- Step 2: Drop the old Code column
IF EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('Divisions') AND name = 'Code'
)
BEGIN
  ALTER TABLE Divisions DROP COLUMN Code;
  PRINT 'Dropped old Code column from Divisions';
END

-- Step 3: Add new Code column as INT IDENTITY auto-increment
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('Divisions') AND name = 'Code'
)
BEGIN
  ALTER TABLE Divisions ADD Code INT IDENTITY(1,1) NOT NULL;
  PRINT 'Added new Code column as INT IDENTITY(1,1) to Divisions';
END

-- Step 4: Add unique constraint on new Code
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'UQ_Divisions_Code' AND object_id = OBJECT_ID('Divisions')
)
BEGIN
  ALTER TABLE Divisions ADD CONSTRAINT UQ_Divisions_Code UNIQUE (Code);
  PRINT 'Added unique constraint UQ_Divisions_Code on new Code column';
END

PRINT 'Migration 029 completed: Divisions.Code is now INT IDENTITY auto-increment';
