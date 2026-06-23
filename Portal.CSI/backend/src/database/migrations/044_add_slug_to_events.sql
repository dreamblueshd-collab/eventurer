-- Add Slug column to Events table for URL-friendly survey identifiers
IF COL_LENGTH('dbo.Events', 'Slug') IS NULL
BEGIN
    ALTER TABLE Events ADD Slug NVARCHAR(500) NULL;
END
GO

-- Create unique index on Slug (filtered - only non-null values)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_Events_Slug' AND object_id = OBJECT_ID('dbo.Events'))
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UQ_Events_Slug
    ON Events(Slug)
    WHERE Slug IS NOT NULL;
END
GO

-- Populate slugs for existing surveys based on their Title (title-only, no ID prefix)
UPDATE Events
SET Slug = LOWER(
    LEFT(
        REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
        REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
            LTRIM(RTRIM(LOWER(Title))),
            ' ', '-'),
            '.', '-'),
            ',', '-'),
            ':', '-'),
            ';', '-'),
            '!', ''),
            '?', ''),
            '''', ''),
            '"', ''),
            '(', ''),
            ')', ''),
            '[', ''),
            ']', ''),
            '{', ''),
            '}', ''),
            '/', '-'),
            '\', '-'),
            '&', '-and-'),
            '@', '-at-'),
            '#', '')
        , 200)
)
WHERE Slug IS NULL;
GO

-- Clean up consecutive hyphens (run multiple passes)
UPDATE Events SET Slug = REPLACE(Slug, '--', '-') WHERE Slug LIKE '%--%';
GO
UPDATE Events SET Slug = REPLACE(Slug, '--', '-') WHERE Slug LIKE '%--%';
GO
UPDATE Events SET Slug = REPLACE(Slug, '--', '-') WHERE Slug LIKE '%--%';
GO

-- Remove trailing hyphens
UPDATE Events
SET Slug = LEFT(Slug, LEN(Slug) - 1)
WHERE Slug LIKE '%-';
GO
