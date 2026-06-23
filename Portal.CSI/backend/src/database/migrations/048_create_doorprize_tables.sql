-- Migration 048: Create Doorprize Tables
-- Description: Creates DoorprizeEvents, DoorprizeGifts, DoorprizeParticipants, and
--              DoorprizeResults tables to support the migrated doorprize/lucky draw
--              module from the legacy Laravel app into the CSI Portal.
--              Includes indexes, foreign keys, CHECK constraints (Status, Quota),
--              and a unique composite index to enforce no-double-win per event.
-- Validates Requirements: 1.1, 1.2, 1.3, 1.4, 2.4, 2.5

USE CSI;
GO

-- DoorprizeEvents Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DoorprizeEvents')
BEGIN
    CREATE TABLE DoorprizeEvents (
        DoorprizeEventId BIGINT IDENTITY(1,1) PRIMARY KEY,
        Name NVARCHAR(500) NOT NULL,
        EventDate DATETIME2 NOT NULL,
        ImagePath NVARCHAR(500) NULL,
        Status NVARCHAR(50) NOT NULL DEFAULT 'Draft',
        CreatedBy BIGINT NOT NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME2 NULL,
        CONSTRAINT FK_DoorprizeEvents_CreatedBy
            FOREIGN KEY (CreatedBy) REFERENCES Users(UserId),
        CONSTRAINT CK_DoorprizeEvents_Status
            CHECK (Status IN ('Draft', 'Active', 'Completed', 'Archived'))
    );

    CREATE INDEX IX_DoorprizeEvents_Status ON DoorprizeEvents(Status);
    CREATE INDEX IX_DoorprizeEvents_EventDate ON DoorprizeEvents(EventDate);

    PRINT 'DoorprizeEvents table created successfully';
END
GO

-- DoorprizeGifts Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DoorprizeGifts')
BEGIN
    CREATE TABLE DoorprizeGifts (
        DoorprizeGiftId BIGINT IDENTITY(1,1) PRIMARY KEY,
        DoorprizeEventId BIGINT NOT NULL,
        Name NVARCHAR(500) NOT NULL,
        Quota INT NOT NULL DEFAULT 1,
        GiftBy NVARCHAR(200) NULL,
        DrawTime NVARCHAR(100) NULL,
        ImagePath NVARCHAR(500) NULL,
        DisplayOrder INT NOT NULL DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME2 NULL,
        CONSTRAINT FK_DoorprizeGifts_DoorprizeEventId
            FOREIGN KEY (DoorprizeEventId) REFERENCES DoorprizeEvents(DoorprizeEventId)
            ON DELETE CASCADE,
        CONSTRAINT CK_DoorprizeGifts_Quota CHECK (Quota > 0)
    );

    CREATE INDEX IX_DoorprizeGifts_EventId ON DoorprizeGifts(DoorprizeEventId);

    PRINT 'DoorprizeGifts table created successfully';
END
GO

-- DoorprizeParticipants Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DoorprizeParticipants')
BEGIN
    CREATE TABLE DoorprizeParticipants (
        DoorprizeParticipantId BIGINT IDENTITY(1,1) PRIMARY KEY,
        DoorprizeEventId BIGINT NOT NULL,
        EmployeeCode NVARCHAR(50) NULL,
        Name NVARCHAR(200) NOT NULL,
        Phone NVARCHAR(50) NULL,
        Email NVARCHAR(255) NULL,
        Unit NVARCHAR(200) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        ImagePath NVARCHAR(500) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME2 NULL,
        CONSTRAINT FK_DoorprizeParticipants_DoorprizeEventId
            FOREIGN KEY (DoorprizeEventId) REFERENCES DoorprizeEvents(DoorprizeEventId)
            ON DELETE CASCADE
    );

    CREATE INDEX IX_DoorprizeParticipants_EventId
        ON DoorprizeParticipants(DoorprizeEventId);
    CREATE INDEX IX_DoorprizeParticipants_EmployeeCode
        ON DoorprizeParticipants(EmployeeCode);
    CREATE INDEX IX_DoorprizeParticipants_IsActive
        ON DoorprizeParticipants(IsActive);

    PRINT 'DoorprizeParticipants table created successfully';
END
GO

-- DoorprizeResults Table
-- Note: FKs intentionally omit ON DELETE CASCADE to avoid multiple cascade paths
-- (DoorprizeGifts and DoorprizeParticipants already cascade from DoorprizeEvents,
-- so cascading from any of them to DoorprizeResults would conflict in MSSQL).
-- Application-level deletion must remove DoorprizeResults rows before deleting
-- the parent event. The unique composite index prevents double-wins per event.
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DoorprizeResults')
BEGIN
    CREATE TABLE DoorprizeResults (
        DoorprizeResultId BIGINT IDENTITY(1,1) PRIMARY KEY,
        DoorprizeEventId BIGINT NOT NULL,
        DoorprizeGiftId BIGINT NOT NULL,
        DoorprizeParticipantId BIGINT NOT NULL,
        DrawnAt DATETIME2 NOT NULL DEFAULT GETDATE(),
        DrawnBy BIGINT NOT NULL,
        CONSTRAINT FK_DoorprizeResults_DoorprizeEventId
            FOREIGN KEY (DoorprizeEventId) REFERENCES DoorprizeEvents(DoorprizeEventId),
        CONSTRAINT FK_DoorprizeResults_DoorprizeGiftId
            FOREIGN KEY (DoorprizeGiftId) REFERENCES DoorprizeGifts(DoorprizeGiftId),
        CONSTRAINT FK_DoorprizeResults_DoorprizeParticipantId
            FOREIGN KEY (DoorprizeParticipantId)
            REFERENCES DoorprizeParticipants(DoorprizeParticipantId),
        CONSTRAINT FK_DoorprizeResults_DrawnBy
            FOREIGN KEY (DrawnBy) REFERENCES Users(UserId)
    );

    CREATE UNIQUE INDEX IX_DoorprizeResults_Participant_Unique
        ON DoorprizeResults(DoorprizeEventId, DoorprizeParticipantId);
    CREATE INDEX IX_DoorprizeResults_GiftId ON DoorprizeResults(DoorprizeGiftId);
    CREATE INDEX IX_DoorprizeResults_DrawnAt ON DoorprizeResults(DrawnAt);

    PRINT 'DoorprizeResults table created successfully';
END
GO

PRINT 'Migration 048 completed successfully';
GO
