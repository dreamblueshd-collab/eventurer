/*
  Migration 013:
  Set Users.BusinessUnitId to Corporate HO for existing records.
  (Updated for BIGINT IDs)
*/

BEGIN TRY
  BEGIN TRANSACTION;

  DECLARE @CorporateHOBusinessUnitId BIGINT;

  SELECT TOP 1 @CorporateHOBusinessUnitId = BusinessUnitId
  FROM dbo.BusinessUnits
  WHERE Name = N'Corporate HO';

  IF @CorporateHOBusinessUnitId IS NULL
  BEGIN
    THROW 50002, 'Corporate HO BusinessUnit not found in dbo.BusinessUnits (Name = Corporate HO).', 1;
  END

  IF COL_LENGTH('dbo.Users', 'BusinessUnitId') IS NULL
  BEGIN
    THROW 50001, 'Users.BusinessUnitId column does not exist. Run migration 012 first.', 1;
  END

  UPDATE dbo.Users
  SET BusinessUnitId = @CorporateHOBusinessUnitId,
      UpdatedAt = GETDATE()
  WHERE BusinessUnitId IS NULL
     OR BusinessUnitId <> @CorporateHOBusinessUnitId;

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0
    ROLLBACK TRANSACTION;
  THROW;
END CATCH;