/*
  Migration 014:
  Seed division/department structure for Master User mockup and map existing users.
  (Updated for BIGINT IDs)

  Target BU: Corporate HO (lookup by Name = Corporate HO)
*/

BEGIN TRY
  BEGIN TRANSACTION;

  DECLARE @CorporateHO BIGINT;
  SELECT TOP 1 @CorporateHO = BusinessUnitId
  FROM dbo.BusinessUnits
  WHERE Name = N'Corporate HO';

  IF @CorporateHO IS NULL
  BEGIN
    THROW 50010, 'Corporate HO Business Unit not found (Name = Corporate HO).', 1;
  END

  IF NOT EXISTS (SELECT 1 FROM dbo.Divisions WHERE Code = 'DIV-ITAPPS')
  BEGIN
    INSERT INTO dbo.Divisions (BusinessUnitId, Code, Name, IsActive)
    VALUES (@CorporateHO, 'DIV-ITAPPS', 'IT Apps', 1);
  END

  IF NOT EXISTS (SELECT 1 FROM dbo.Divisions WHERE Code = 'DIV-ITOPS')
  BEGIN
    INSERT INTO dbo.Divisions (BusinessUnitId, Code, Name, IsActive)
    VALUES (@CorporateHO, 'DIV-ITOPS', 'IT Ops', 1);
  END

  IF NOT EXISTS (SELECT 1 FROM dbo.Divisions WHERE Code = 'DIV-COMM')
  BEGIN
    INSERT INTO dbo.Divisions (BusinessUnitId, Code, Name, IsActive)
    VALUES (@CorporateHO, 'DIV-COMM', 'Commercial', 1);
  END

  IF NOT EXISTS (SELECT 1 FROM dbo.Divisions WHERE Code = 'DIV-RETAIL')
  BEGIN
    INSERT INTO dbo.Divisions (BusinessUnitId, Code, Name, IsActive)
    VALUES (@CorporateHO, 'DIV-RETAIL', 'Retail', 1);
  END

  DECLARE @DivITApps BIGINT = (SELECT TOP 1 DivisionId FROM dbo.Divisions WHERE Code = 'DIV-ITAPPS');
  DECLARE @DivITOps BIGINT = (SELECT TOP 1 DivisionId FROM dbo.Divisions WHERE Code = 'DIV-ITOPS');
  DECLARE @DivCommercial BIGINT = (SELECT TOP 1 DivisionId FROM dbo.Divisions WHERE Code = 'DIV-COMM');
  DECLARE @DivRetail BIGINT = (SELECT TOP 1 DivisionId FROM dbo.Divisions WHERE Code = 'DIV-RETAIL');

  IF NOT EXISTS (SELECT 1 FROM dbo.Departments WHERE Code = 'DEPT-ITDIG-APPS')
  BEGIN
    INSERT INTO dbo.Departments (DivisionId, Code, Name, IsActive)
    VALUES (@DivITApps, 'DEPT-ITDIG-APPS', 'IT Digital', 1);
  END

  IF NOT EXISTS (SELECT 1 FROM dbo.Departments WHERE Code = 'DEPT-ITINF-OPS')
  BEGIN
    INSERT INTO dbo.Departments (DivisionId, Code, Name, IsActive)
    VALUES (@DivITOps, 'DEPT-ITINF-OPS', 'IT Infrastructure', 1);
  END

  IF NOT EXISTS (SELECT 1 FROM dbo.Departments WHERE Code = 'DEPT-SALES-COMM')
  BEGIN
    INSERT INTO dbo.Departments (DivisionId, Code, Name, IsActive)
    VALUES (@DivCommercial, 'DEPT-SALES-COMM', 'Sales', 1);
  END

  IF NOT EXISTS (SELECT 1 FROM dbo.Departments WHERE Code = 'DEPT-SALES-RET')
  BEGIN
    INSERT INTO dbo.Departments (DivisionId, Code, Name, IsActive)
    VALUES (@DivRetail, 'DEPT-SALES-RET', 'Sales', 1);
  END

  DECLARE @DeptITDigital BIGINT = (SELECT TOP 1 DepartmentId FROM dbo.Departments WHERE Code = 'DEPT-ITDIG-APPS');
  DECLARE @DeptITInfra BIGINT = (SELECT TOP 1 DepartmentId FROM dbo.Departments WHERE Code = 'DEPT-ITINF-OPS');
  DECLARE @DeptSalesComm BIGINT = (SELECT TOP 1 DepartmentId FROM dbo.Departments WHERE Code = 'DEPT-SALES-COMM');
  DECLARE @DeptSalesRetail BIGINT = (SELECT TOP 1 DepartmentId FROM dbo.Departments WHERE Code = 'DEPT-SALES-RET');

  UPDATE dbo.Users
  SET BusinessUnitId = @CorporateHO,
      DivisionId = @DivITApps,
      DepartmentId = @DeptITDigital,
      UpdatedAt = GETDATE()
  WHERE Username IN ('2091', '3321');

  UPDATE dbo.Users
  SET BusinessUnitId = @CorporateHO,
      DivisionId = @DivITOps,
      DepartmentId = @DeptITInfra,
      UpdatedAt = GETDATE()
  WHERE Username = '4589';

  UPDATE dbo.Users
  SET BusinessUnitId = @CorporateHO,
      DivisionId = @DivCommercial,
      DepartmentId = @DeptSalesComm,
      UpdatedAt = GETDATE()
  WHERE Username = '7751';

  UPDATE dbo.Users
  SET BusinessUnitId = @CorporateHO,
      DivisionId = @DivRetail,
      DepartmentId = @DeptSalesRetail,
      UpdatedAt = GETDATE()
  WHERE Username = '8893';

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0
    ROLLBACK TRANSACTION;
  THROW;
END CATCH;