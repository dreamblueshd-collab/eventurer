-- Drop unused Slug column and index from Events table
-- Slug is now derived at runtime from Title via slugify()
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_Events_Slug' AND object_id = OBJECT_ID('dbo.Events'))
BEGIN
    DROP INDEX UQ_Events_Slug ON dbo.Events;
END
GO

IF COL_LENGTH('dbo.Events', 'Slug') IS NOT NULL
BEGIN
    ALTER TABLE dbo.Events DROP COLUMN Slug;
END
GO
