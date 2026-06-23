-- Migration 032: Change Applications.Code to auto-increment integer
-- Description: Replace NVARCHAR Code with INT IDENTITY auto-increment

USE CSI;

-- Safety: after UUID->BIGINT migration, master data codes remain NVARCHAR.
-- This migration is kept for historical reference and is skipped on BIGINT schemas.
IF OBJECT_ID('dbo.Applications', 'U') IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM sys.columns c
    JOIN sys.types t ON t.user_type_id = c.user_type_id
    WHERE c.object_id = OBJECT_ID('dbo.Applications')
      AND c.name = 'ApplicationId'
      AND t.name = 'bigint'
  )
BEGIN
  PRINT 'Migration 032 skipped: BIGINT schema detected (Applications.Code stays NVARCHAR).';
  RETURN;
END;

-- Step 1: Drop unique constraint on Code if exists
IF EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'UQ__Applications__Code' AND object_id = OBJECT_ID('Applications')
)
BEGIN
  ALTER TABLE Applications DROP CONSTRAINT UQ__Applications__Code;
  PRINT 'Dropped unique constraint UQ__Applications__Code on Applications.Code';
END

IF EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'UQ_Applications_Code' AND object_id = OBJECT_ID('Applications')
)
BEGIN
  ALTER TABLE Applications DROP CONSTRAINT UQ_Applications_Code;
  PRINT 'Dropped unique constraint UQ_Applications_Code on Applications.Code';
END

-- Drop index on Code if exists
IF EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'IX_Applications_Code' AND object_id = OBJECT_ID('Applications')
)
BEGIN
  DROP INDEX IX_Applications_Code ON Applications;
  PRINT 'Dropped index IX_Applications_Code';
END

-- Step 2: Drop the old Code column
IF EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('Applications') AND name = 'Code'
)
BEGIN
  ALTER TABLE Applications DROP COLUMN Code;
  PRINT 'Dropped old Code column from Applications';
END

-- Step 3: Add new Code column as INT IDENTITY auto-increment
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('Applications') AND name = 'Code'
)
BEGIN
  ALTER TABLE Applications ADD Code INT IDENTITY(1,1) NOT NULL;
  PRINT 'Added new Code column as INT IDENTITY(1,1) to Applications';
END

-- Step 4: Add unique constraint on new Code
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'UQ_Applications_Code' AND object_id = OBJECT_ID('Applications')
)
BEGIN
  ALTER TABLE Applications ADD CONSTRAINT UQ_Applications_Code UNIQUE (Code);
  PRINT 'Added unique constraint UQ_Applications_Code on new Code column';
END

PRINT 'Migration 032 completed: Applications.Code is now INT IDENTITY auto-increment';
