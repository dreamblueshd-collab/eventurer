-- ================================================================
-- DIAGNOSTIC SCRIPT: Check AssignedAdminId Column Type
-- ================================================================
-- Purpose: Determine actual data type of Events.AssignedAdminId
-- to understand if migration 050 was applied or not
--
-- Expected Results:
--   If BIGINT     → Migration 050 NOT applied (original schema)
--   If NVARCHAR   → Migration 050 WAS applied
--
-- Usage from SSMS or sqlcmd:
--   sqlcmd -S "10.14.90.210\DEV" -U userdev -P "AopPortal123!" -d CSI -i diagnose-assignedadminid-schema.sql
-- ================================================================

USE CSI;
GO

PRINT '=================================================================';
PRINT 'DIAGNOSTIC: Events.AssignedAdminId Column Type';
PRINT '=================================================================';
PRINT '';

-- Check actual column type
SELECT 
    t.name AS TableName,
    c.name AS ColumnName,
    ty.name AS DataType,
    c.max_length AS MaxLength,
    c.precision AS Precision,
    c.scale AS Scale,
    c.is_nullable AS IsNullable,
    CASE 
        WHEN ty.name = 'bigint' THEN '✓ BIGINT (Migration 050 NOT applied - Original schema)'
        WHEN ty.name = 'nvarchar' THEN '⚠ NVARCHAR (Migration 050 WAS applied - Conflict with current code!)'
        ELSE '❌ UNEXPECTED TYPE'
    END AS Status
FROM sys.tables t
INNER JOIN sys.columns c ON c.object_id = t.object_id
INNER JOIN sys.types ty ON ty.user_type_id = c.user_type_id
WHERE t.name = 'Events'
  AND c.name = 'AssignedAdminId';

PRINT '';
PRINT '=================================================================';
PRINT 'Sample Data Check';
PRINT '=================================================================';

-- Check actual data in the column
SELECT TOP 5
    SurveyId,
    Title,
    AssignedAdminId,
    CASE 
        WHEN AssignedAdminId IS NULL THEN 'NULL'
        WHEN ISNUMERIC(AssignedAdminId) = 1 THEN 'Numeric (ID)'
        ELSE 'String (Username/CSV)'
    END AS DataFormat,
    SQL_VARIANT_PROPERTY(AssignedAdminId, 'BaseType') AS ActualType
FROM Events
WHERE AssignedAdminId IS NOT NULL
ORDER BY CreatedAt DESC;

PRINT '';
PRINT '=================================================================';
PRINT 'Foreign Key Constraints Check';
PRINT '=================================================================';

-- Check if FK constraint exists (should NOT exist if migration 050 applied)
SELECT 
    fk.name AS FKName,
    OBJECT_NAME(fk.parent_object_id) AS ParentTable,
    c.name AS ParentColumn,
    OBJECT_NAME(fk.referenced_object_id) AS ReferencedTable,
    rc.name AS ReferencedColumn,
    CASE 
        WHEN fk.name IS NOT NULL THEN '⚠ FK EXISTS (Migration 050 NOT applied or was rolled back)'
        ELSE '✓ No FK (Migration 050 applied)'
    END AS Status
FROM sys.foreign_keys fk
INNER JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
INNER JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
INNER JOIN sys.columns rc ON rc.object_id = fkc.referenced_object_id AND rc.column_id = fkc.referenced_column_id
WHERE fk.parent_object_id = OBJECT_ID('dbo.Events')
  AND c.name = 'AssignedAdminId';

-- If no results, FK doesn't exist
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys fk
    INNER JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
    INNER JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
    WHERE fk.parent_object_id = OBJECT_ID('dbo.Events') AND c.name = 'AssignedAdminId'
)
BEGIN
    PRINT '✓ No FK constraint found on Events.AssignedAdminId';
END

PRINT '';
PRINT '=================================================================';
PRINT 'EventAdminAssignments Table Check';
PRINT '=================================================================';

-- Check if EventAdminAssignments has data
SELECT 
    COUNT(DISTINCT SurveyId) AS EventsWithAdminAssignments,
    COUNT(*) AS TotalAssignments,
    COUNT(DISTINCT AdminUserId) AS UniqueAdmins
FROM EventAdminAssignments;

PRINT '';
PRINT '=================================================================';
PRINT 'DIAGNOSIS COMPLETE';
PRINT '=================================================================';
PRINT '';
PRINT 'Next Steps:';
PRINT '1. Review the DataType result above';
PRINT '2. If BIGINT → Current code fix is correct, no migration needed';
PRINT '3. If NVARCHAR → Need to rollback migration 050 OR update code';
PRINT '';
