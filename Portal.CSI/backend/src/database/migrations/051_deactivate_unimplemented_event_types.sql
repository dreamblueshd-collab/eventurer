-- Migration 051: Deactivate EventTypes that don't have implementation yet
-- Keep active: SURVEY (4), DOORPRIZE (2)
-- Deactivate: WORKSHOP (1), WEBINAR (3), TOWNHALL (5), EXHIBITION (6), SEMINAR (7), TRAINING (8)

USE CSI;
GO

UPDATE dbo.EventTypes
SET IsActive = 0, UpdatedAt = GETDATE()
WHERE Code IN ('WORKSHOP', 'WEBINAR', 'TOWNHALL', 'EXHIBITION', 'SEMINAR', 'TRAINING')
  AND IsActive = 1;

PRINT 'Deactivated unimplemented EventTypes (WORKSHOP, WEBINAR, TOWNHALL, EXHIBITION, SEMINAR, TRAINING).';
PRINT 'Active EventTypes: SURVEY, DOORPRIZE.';
GO
