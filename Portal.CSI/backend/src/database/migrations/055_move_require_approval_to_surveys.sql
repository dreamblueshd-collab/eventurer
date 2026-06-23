-- Migration 055: Move RequireApproval to Surveys as the source of truth
-- Keep Events.RequireApproval for backward compatibility during transition.

IF COL_LENGTH('dbo.Surveys', 'RequireApproval') IS NULL
BEGIN
    ALTER TABLE dbo.Surveys
    ADD RequireApproval BIT NOT NULL
        CONSTRAINT DF_Surveys_RequireApproval DEFAULT (0);

    PRINT 'Added RequireApproval column to Surveys table';
END
GO

IF OBJECT_ID('dbo.Events', 'U') IS NOT NULL
   AND COL_LENGTH('dbo.Events', 'RequireApproval') IS NOT NULL
BEGIN
    UPDATE s
    SET s.RequireApproval = ISNULL(e.RequireApproval, 0)
    FROM dbo.Surveys s
    INNER JOIN dbo.Events e ON e.SurveyId = s.EventId
    WHERE s.RequireApproval <> ISNULL(e.RequireApproval, 0);

    PRINT 'Synced Surveys.RequireApproval from Events.RequireApproval';
END
GO
