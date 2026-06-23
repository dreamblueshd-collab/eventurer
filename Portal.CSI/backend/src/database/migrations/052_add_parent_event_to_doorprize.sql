-- Migration 052: Add ParentEventId to DoorprizeEvents
-- Links doorprize events as sub-events under a parent Event

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'DoorprizeEvents' AND COLUMN_NAME = 'ParentEventId'
)
BEGIN
  ALTER TABLE DoorprizeEvents ADD ParentEventId BIGINT NULL;
  PRINT 'Added ParentEventId column to DoorprizeEvents';
END
GO
