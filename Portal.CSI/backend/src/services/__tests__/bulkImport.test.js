const { TemplateParser } = require('../templateParser');
const { BulkImportService } = require('../bulkImportService');
const ExcelJS = require('exceljs');

describe('Bulk Import Service', () => {
  describe('TemplateParser', () => {
    let parser;

    beforeEach(() => {
      parser = new TemplateParser();
    });

    test('should parse valid Business Unit Excel file', async () => {
      // Create test Excel file
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('BusinessUnits');

      // Add headers
      worksheet.addRow(['Name', 'Status']);

      // Add data
      worksheet.addRow(['Business Unit 1', 'Active']);
      worksheet.addRow(['Business Unit 2', 'Inactive']);

      // Convert to buffer
      const buffer = await workbook.xlsx.writeBuffer();

      // Parse
      const config = {
        entityType: 'BusinessUnit',
        columnMapping: {
          'Name': 'name',
          'Status': 'status'
        }
      };

      const result = await parser.parseExcelFile(buffer, config);

      expect(result.success).toBe(true);
      expect(result.validRecords).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
      expect(result.validRecords[0].data).toEqual({
        name: 'Business Unit 1',
        status: 'Active'
      });
    });

    test('should detect validation errors in Excel file', async () => {
      // Create test Excel file with invalid data
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('BusinessUnits');

      // Add headers — Code is removed; only Name is used now
      worksheet.addRow(['Name', 'Status']);

      // Add invalid data: name too long
      worksheet.addRow(['A'.repeat(201), 'Active']); // Name exceeds 200 chars
      // Row with a space (non-empty row so it isn't skipped, but name is blank after trim)
      worksheet.addRow([' ', 'Inactive']); // Name is whitespace-only → treated as missing
      worksheet.addRow(['Valid BU', 'Bogus']); // Invalid status

      const buffer = await workbook.xlsx.writeBuffer();

      const config = {
        entityType: 'BusinessUnit',
        columnMapping: {
          'Name': 'name',
          'Status': 'status'
        }
      };

      const result = await parser.parseExcelFile(buffer, config);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(3);
      expect(result.errors[0].errors).toContain('Name must be 1-200 characters');
      expect(result.errors[1].errors).toContain('Name is required');
      expect(result.errors[2].errors).toContain('Status must be Active or Inactive');
    });

    test('should detect missing required columns', async () => {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('BusinessUnits');

      // Add headers with missing columns
      worksheet.addRow(['Code']); // Missing 'Name' / 'Status' columns

      worksheet.addRow(['BU001']);

      const buffer = await workbook.xlsx.writeBuffer();

      const config = {
        entityType: 'BusinessUnit',
        columnMapping: {
          'Name': 'name',
          'Status': 'status'
        }
      };

      await expect(parser.parseExcelFile(buffer, config)).rejects.toThrow('Missing required columns');
    });

    test('should reject wrong template with unexpected columns', async () => {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Divisions');

      worksheet.addRow(['Name', 'Business Unit Name', 'Status']);
      worksheet.addRow(['Division 1', 'Business Unit 1', 'Active']);

      const buffer = await workbook.xlsx.writeBuffer();

      const config = {
        entityType: 'BusinessUnit',
        allowExtraColumns: false,
        columnMapping: {
          'Name': 'name',
          'Status': 'status'
        }
      };

      await expect(parser.parseExcelFile(buffer, config)).rejects.toThrow('Unexpected columns found');
    });

    test('should skip empty rows', async () => {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('BusinessUnits');

      worksheet.addRow(['Name', 'Status']);
      worksheet.addRow(['Business Unit 1', 'Active']);
      worksheet.addRow([]); // Empty row
      worksheet.addRow(['Business Unit 2', 'Inactive']);

      const buffer = await workbook.xlsx.writeBuffer();

      const config = {
        entityType: 'BusinessUnit',
        columnMapping: {
          'Name': 'name',
          'Status': 'status'
        }
      };

      const result = await parser.parseExcelFile(buffer, config);

      expect(result.validRecords).toHaveLength(2);
    });

    test('should validate Division with Business Unit reference', async () => {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Divisions');

      // Code is removed; Division now uses Name + Business Unit Name
      worksheet.addRow(['Name', 'Business Unit Name', 'Status']);
      worksheet.addRow(['Division 1', 'Business Unit 1', 'Active']);
      worksheet.addRow(['Division 2', '', 'Inactive']); // Missing BU name
      worksheet.addRow(['Division 3', 'Business Unit 1', 'Bogus']); // Invalid status

      const buffer = await workbook.xlsx.writeBuffer();

      const config = {
        entityType: 'Division',
        columnMapping: {
          'Name': 'name',
          'Business Unit Name': 'businessUnitName',
          'Status': 'status'
        }
      };

      const result = await parser.parseExcelFile(buffer, config);

      expect(result.validRecords).toHaveLength(1);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].errors).toContain('Business Unit Name is required');
      expect(result.errors[1].errors).toContain('Status must be Active or Inactive');
    });

    test('should validate Application with optional description', async () => {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Applications');

      worksheet.addRow(['Name', 'Description', 'Status']);
      worksheet.addRow(['Application 1', 'Test description', 'Active']);
      worksheet.addRow(['Application 2', '', 'Inactive']); // Empty description is OK

      const buffer = await workbook.xlsx.writeBuffer();

      const config = {
        entityType: 'Application',
        columnMapping: {
          'Name': 'name',
          'Description': 'description',
          'Status': 'status'
        }
      };

      const result = await parser.parseExcelFile(buffer, config);

      expect(result.validRecords).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
    });

    test('should allow Department status to be blank', async () => {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Departments');

      worksheet.addRow(['Name', 'Division Name', 'Status']);
      worksheet.addRow(['Department 1', 'Division 1', 'Active']);
      worksheet.addRow(['Department 2', 'Division 1', '']); // Blank status should default to Active

      const buffer = await workbook.xlsx.writeBuffer();

      const config = {
        entityType: 'Department',
        columnMapping: {
          'Name': 'name',
          'Division Name': 'divisionName',
          'Status': 'status'
        }
      };

      const result = await parser.parseExcelFile(buffer, config);

      expect(result.validRecords).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
    });

    test('should validate Function with status', async () => {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Functions');

      worksheet.addRow(['Name', 'Department Name', 'IT Lead Name', 'Status']);
      worksheet.addRow(['Function 1', 'Department 1', 'John Doe', 'Active']);
      worksheet.addRow(['Function 2', '', '', 'Bogus']);

      const buffer = await workbook.xlsx.writeBuffer();

      const config = {
        entityType: 'Function',
        columnMapping: {
          'Name': 'name',
          'Department Name': 'departmentName',
          'IT Lead Name': 'itLeadName',
          'Status': 'status'
        }
      };

      const result = await parser.parseExcelFile(buffer, config);

      expect(result.validRecords).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].errors).toContain('Status must be Active or Inactive');
    });

    test('should validate mapping records', async () => {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Mappings');

      // Mapping now uses Name columns instead of Code columns
      worksheet.addRow(['Function Name', 'Application Name']);
      worksheet.addRow(['Function One', 'App One']);
      worksheet.addRow(['', 'App Two']); // Missing function name

      const buffer = await workbook.xlsx.writeBuffer();

      const config = {
        entityType: 'FunctionAppMapping',
        columnMapping: {
          'Function Name': 'functionName',
          'Application Name': 'applicationName'
        }
      };

      const result = await parser.parseExcelFile(buffer, config);

      expect(result.validRecords).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].errors).toContain('Function Name is required');
    });

    test('should generate error report', () => {
      const errors = [
        {
          row: 2,
          data: { code: '', name: 'Test' },
          errors: ['Code is required']
        },
        {
          row: 3,
          data: { code: 'TOOLONG123456789012345', name: 'Test' },
          errors: ['Code must be 2-20 characters, alphanumeric and hyphen only']
        }
      ];

      const report = parser.generateErrorReport(errors);

      expect(report).toContain('Found 2 error(s)');
      expect(report).toContain('Row 2');
      expect(report).toContain('Row 3');
      expect(report).toContain('Code is required');
    });
  });

  describe('BulkImportService', () => {
    let service;

    beforeEach(() => {
      service = new BulkImportService();
    });

    test('should get correct entity config for BusinessUnit', () => {
      const config = service._getEntityConfig('BusinessUnit');

      expect(config.entityType).toBe('BusinessUnit');
      // Name + Status are in the upload template mapping
      expect(config.columnMapping).toHaveProperty('Name');
      expect(config.columnMapping).toHaveProperty('Status');
      expect(config.columnMapping).not.toHaveProperty('Code');
    });

    test('should get correct entity config for Division', () => {
      const config = service._getEntityConfig('Division');

      expect(config.entityType).toBe('Division');
      expect(config.columnMapping).toHaveProperty('Name');
      expect(config.columnMapping).toHaveProperty('Business Unit Name');
      expect(config.columnMapping).toHaveProperty('Status');
    });

    test('should get correct entity config for Department', () => {
      const config = service._getEntityConfig('Department');

      expect(config.entityType).toBe('Department');
      expect(config.columnMapping).toHaveProperty('Name');
      expect(config.columnMapping).toHaveProperty('Division Name');
      expect(config.columnMapping).toHaveProperty('Status');
    });

    test('should get correct entity config for Function', () => {
      const config = service._getEntityConfig('Function');

      expect(config.entityType).toBe('Function');
      expect(config.columnMapping).toHaveProperty('Status');
    });

    test('should get correct entity config for Application', () => {
      const config = service._getEntityConfig('Application');

      expect(config.entityType).toBe('Application');
      expect(config.columnMapping).toHaveProperty('Name');
      expect(config.columnMapping).toHaveProperty('Description');
      expect(config.columnMapping).toHaveProperty('Status');
    });

    test('should throw error for unknown entity type', () => {
      expect(() => service._getEntityConfig('UnknownType')).toThrow('Unknown entity type');
    });

    test('should detect duplicate records inside uploaded file', () => {
      const duplicates = service._findDuplicateRecords([
        { row: 2, data: { name: 'Corporate HO' } },
        { row: 3, data: { name: 'corporate ho' } },
        { row: 4, data: { name: 'Other BU' } }
      ], ['name']);

      expect(duplicates).toHaveLength(1);
      expect(duplicates[0].firstRow).toBe(2);
      expect(duplicates[0].row).toBe(3);
    });

    test('should generate import report', () => {
      const results = {
        success: true,
        totalRows: 10,
        imported: 8,
        updated: 1,
        skipped: 0,
        failed: 1,
        errors: [
          {
            row: 5,
            data: { code: 'TEST', name: 'Test' },
            errors: ['Duplicate code']
          }
        ],
        duration: 1500
      };

      const report = service.generateReport(results);

      expect(report).toContain('SUCCESS');
      expect(report).toContain('Total Rows: 10');
      expect(report).toContain('Imported: 8');
      expect(report).toContain('Failed: 1');
      expect(report).toContain('Row 5');
    });
  });
});
