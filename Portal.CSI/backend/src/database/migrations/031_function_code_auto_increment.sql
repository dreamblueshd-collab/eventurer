-- Migration 031: Change Functions.Code to auto-increment integer
-- Description: Replace NVARCHAR Code with INT IDENTITY auto-increment

USE CSI;

-- Safety: after UUID->BIGINT migration, master data codes remain NVARCHAR.
-- This migration is kept for historical reference and is skipped on BIGINT schemas.
IF OBJECT_ID('dbo.Functions', 'U') IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM sys.columns c
    JOIN sys.types t ON t.user_type_id = c.user_type_id
    WHERE c.object_id = OBJECT_ID('dbo.Functions')
      AND c.name = 'FunctionId'
      AND t.name = 'bigint'
  )
BEGIN
  PRINT 'Migration 031 skipped: BIGINT schema detected (Functions.Code stays NVARCHAR).';
  RETURN;
END;

-- Step 1: Drop unique constraint on Code if exists
IF EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'UQ__Functions__Code' AND object_id = OBJECT_ID('Functions')
)
BEGIN
  ALTER TABLE Functions DROP CONSTRAINT UQ__Functions__Code;
  PRINT 'Dropped unique constraint UQ__Functions__Code on Functions.Code';
END

IF EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'UQ_Functions_Code' AND object_id = OBJECT_ID('Functions')
)
BEGIN
  ALTER TABLE Functions DROP CONSTRAINT UQ_Functions_Code;
  PRINT 'Dropped unique constraint UQ_Functions_Code on Functions.Code';
END

-- Drop index on Code if exists
IF EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'IX_Functions_Code' AND object_id = OBJECT_ID('Functions')
)
BEGIN
  DROP INDEX IX_Functions_Code ON Functions;
  PRINT 'Dropped index IX_Functions_Code';
END

-- Step 2: Drop the old Code column
IF EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('Functions') AND name = 'Code'
)
BEGIN
  ALTER TABLE Functions DROP COLUMN Code;
  PRINT 'Dropped old Code column from Functions';
END

-- Step 3: Add new Code column as INT IDENTITY auto-increment
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('Functions') AND name = 'Code'
)
BEGIN
  ALTER TABLE Functions ADD Code INT IDENTITY(1,1) NOT NULL;
  PRINT 'Added new Code column as INT IDENTITY(1,1) to Functions';
END

-- Step 4: Add unique constraint on new Code
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'UQ_Functions_Code' AND object_id = OBJECT_ID('Functions')
)
BEGIN
  ALTER TABLE Functions ADD CONSTRAINT UQ_Functions_Code UNIQUE (Code);
  PRINT 'Added unique constraint UQ_Functions_Code on new Code column';
END

PRINT 'Migration 031 completed: Functions.Code is now INT IDENTITY auto-increment';
