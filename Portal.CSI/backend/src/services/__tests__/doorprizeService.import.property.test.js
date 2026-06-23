/**
 * Property-Based Tests for Doorprize Import Idempotency
 *
 * Validates: Requirements 2.6 (Requirement 13: Idempotent Import)
 *
 * These tests mock the database layer and ExcelJS to verify that the import
 * logic maintains its invariants across many random inputs:
 * 1. imported + skipped = totalRows always holds
 * 2. Importing same data twice produces same final participant count (idempotent)
 * 3. No duplicate employeeCode entries exist per event after any number of imports
 */
const fc = require('fast-check');

// Mock dependencies before requiring the service
jest.mock('../../database/connection');
jest.mock('../../config/logger');
jest.mock('exceljs');

const db = require('../../database/connection');
const ExcelJS = require('exceljs');

/**
 * Helper: create a mock pool that simulates participant storage for a given event.
 * The pool maintains an in-memory participant list to track inserts and dedup checks.
 */
function createMockPool(eventId, existingParticipants = []) {
  // Mutable store: keyed by employeeCode for fast dedup lookup
  const participants = [...existingParticipants];

  const pool = {
    request: () => {
      const inputs = {};
      const req = {
        input: (name, _type, value) => {
          inputs[name] = value;
          return req;
        },
        query: async (queryStr) => {
          // assertEventExists query
          if (queryStr.includes('SELECT DoorprizeEventId FROM DoorprizeEvents')) {
            return { recordset: [{ DoorprizeEventId: eventId }] };
          }

          // Duplicate check query
          if (queryStr.includes('SELECT TOP 1 1 AS Found') && queryStr.includes('EmployeeCode')) {
            const code = inputs.code;
            const evId = inputs.eventId;
            const found = participants.some(
              p => p.DoorprizeEventId === evId && p.EmployeeCode === code
            );
            return { recordset: found ? [{ Found: 1 }] : [] };
          }

          // INSERT participant query
          if (queryStr.includes('INSERT INTO DoorprizeParticipants')) {
            participants.push({
              DoorprizeParticipantId: participants.length + 1,
              DoorprizeEventId: inputs.eventId,
              EmployeeCode: inputs.employeeCode || null,
              Name: inputs.name,
              Phone: inputs.phone || null,
              Email: inputs.email || null,
              Unit: inputs.unit || null,
              IsActive: inputs.isActive,
              CreatedAt: new Date()
            });
            return { recordset: [] };
          }

          return { recordset: [] };
        }
      };
      return req;
    },
    getParticipants: () => participants
  };

  return pool;
}

/**
 * Helper: create a mock ExcelJS workbook that returns the given rows.
 * Each row is an array of cell values: [employeeCode, name, phone, email, unit]
 */
function createMockWorkbook(rows) {
  const mockWorksheet = {
    rowCount: rows.length + 1, // +1 for header row
    getRow: (rowNumber) => {
      // Row 1 is header, data starts at row 2
      const dataIndex = rowNumber - 2;
      const rowData = dataIndex >= 0 && dataIndex < rows.length ? rows[dataIndex] : [];
      return {
        getCell: (colIndex) => ({
          value: rowData[colIndex - 1] !== undefined ? rowData[colIndex - 1] : null
        })
      };
    }
  };

  const mockWorkbook = {
    worksheets: [mockWorksheet],
    xlsx: {
      load: jest.fn().mockResolvedValue(undefined)
    }
  };

  return mockWorkbook;
}

// ----------------------------------------------------------
// Arbitraries (generators)
// ----------------------------------------------------------

/**
 * Generate a valid participant row for Excel import.
 * Column order: [employeeCode, name, phone, email, unit]
 */
const arbEmployeeCode = fc.stringMatching(/^[A-Z]{2,4}\d{3,6}$/);

const arbValidRow = fc.record({
  employeeCode: arbEmployeeCode,
  name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  phone: fc.option(fc.stringMatching(/^08\d{8,11}$/), { nil: null }),
  email: fc.option(fc.emailAddress(), { nil: null }),
  unit: fc.option(fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0), { nil: null })
}).map(r => [r.employeeCode, r.name, r.phone, r.email, r.unit]);

/**
 * Generate a row with missing name (should be skipped with error).
 */
const arbInvalidRow = fc.record({
  employeeCode: arbEmployeeCode,
  phone: fc.option(fc.stringMatching(/^08\d{8,11}$/), { nil: null }),
  email: fc.option(fc.emailAddress(), { nil: null }),
  unit: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: null })
}).map(r => [r.employeeCode, '', r.phone, r.email, r.unit]);

/**
 * Generate a mixed set of rows (some valid, some with missing name,
 * some with duplicate employee codes).
 */
function arbImportRows(minRows = 1, maxRows = 20) {
  return fc.integer({ min: minRows, max: maxRows }).chain(count =>
    fc.array(
      fc.oneof(
        { weight: 7, arbitrary: arbValidRow },
        { weight: 2, arbitrary: arbInvalidRow }
      ),
      { minLength: count, maxLength: count }
    )
  );
}

// ----------------------------------------------------------
// Property Tests
// ----------------------------------------------------------

describe('Property Tests - Doorprize Import Idempotency', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Property 7: Import Idempotency', () => {
    /**
     * **Validates: Requirements 2.6**
     *
     * Sub-property 7a: For any valid import data,
     * `imported + skipped = totalRows` always holds.
     */
    test('imported + skipped = totalRows for any input', async () => {
      const EVENT_ID = 1;

      await fc.assert(
        fc.asyncProperty(
          arbImportRows(1, 25),
          async (rows) => {
            const mockPool = createMockPool(EVENT_ID);
            const mockWorkbook = createMockWorkbook(rows);

            db.getPool.mockResolvedValue(mockPool);
            ExcelJS.Workbook.mockImplementation(() => mockWorkbook);

            // Fresh require to pick up mocks
            jest.resetModules();
            jest.mock('../../database/connection');
            jest.mock('../../config/logger');
            jest.mock('exceljs');
            const dbMod = require('../../database/connection');
            const ExcelMod = require('exceljs');
            dbMod.getPool.mockResolvedValue(mockPool);
            ExcelMod.Workbook.mockImplementation(() => mockWorkbook);
            const service = require('../doorprizeService');

            const result = await service.importFromExcel(EVENT_ID, Buffer.from('fake'));

            // Core invariant: imported + skipped = totalRows
            return result.imported + result.skipped === result.totalRows;
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);

    /**
     * **Validates: Requirements 2.6**
     *
     * Sub-property 7b: Importing the same data twice produces the same
     * final participant count (idempotent). The second import should skip
     * all rows that have matching employeeCode.
     */
    test('importing same data twice produces same participant count (idempotent)', async () => {
      const EVENT_ID = 1;

      await fc.assert(
        fc.asyncProperty(
          // Generate rows where all have unique employee codes and valid names
          fc.integer({ min: 2, max: 15 }).chain(count =>
            fc.array(
              fc.record({
                code: arbEmployeeCode,
                name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
                phone: fc.option(fc.stringMatching(/^08\d{8,11}$/), { nil: null }),
                email: fc.option(fc.emailAddress(), { nil: null }),
                unit: fc.option(fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0), { nil: null })
              }),
              { minLength: count, maxLength: count }
            )
          ).map(records => {
            // Make employee codes unique within the set
            return records.map((r, idx) => [
              `${r.code}${idx}`,
              r.name,
              r.phone,
              r.email,
              r.unit
            ]);
          }),
          async (rows) => {
            // Use a shared pool that persists participants across both imports
            const mockPool = createMockPool(EVENT_ID);
            const mockWorkbook = createMockWorkbook(rows);

            // First import
            jest.resetModules();
            jest.mock('../../database/connection');
            jest.mock('../../config/logger');
            jest.mock('exceljs');
            let dbMod = require('../../database/connection');
            let ExcelMod = require('exceljs');
            dbMod.getPool.mockResolvedValue(mockPool);
            ExcelMod.Workbook.mockImplementation(() => createMockWorkbook(rows));
            let service = require('../doorprizeService');

            const result1 = await service.importFromExcel(EVENT_ID, Buffer.from('fake'));
            const countAfterFirst = mockPool.getParticipants().length;

            // Second import (same data, same pool with participants from first)
            jest.resetModules();
            jest.mock('../../database/connection');
            jest.mock('../../config/logger');
            jest.mock('exceljs');
            dbMod = require('../../database/connection');
            ExcelMod = require('exceljs');
            dbMod.getPool.mockResolvedValue(mockPool);
            ExcelMod.Workbook.mockImplementation(() => createMockWorkbook(rows));
            service = require('../doorprizeService');

            const result2 = await service.importFromExcel(EVENT_ID, Buffer.from('fake'));
            const countAfterSecond = mockPool.getParticipants().length;

            // Idempotency: participant count should be same after second import
            const sameCount = countAfterFirst === countAfterSecond;

            // Second import should have imported 0 (all skipped as duplicates)
            const secondImportedZero = result2.imported === 0;

            // totalRows invariant still holds for both
            const invariant1 = result1.imported + result1.skipped === result1.totalRows;
            const invariant2 = result2.imported + result2.skipped === result2.totalRows;

            return sameCount && secondImportedZero && invariant1 && invariant2;
          }
        ),
        { numRuns: 50 }
      );
    }, 60000);

    /**
     * **Validates: Requirements 2.6**
     *
     * Sub-property 7c: No duplicate employeeCode entries exist per event
     * after any number of imports. Even with rows containing duplicate
     * employeeCodes within the same file or across multiple imports.
     */
    test('no duplicate employeeCode entries per event after multiple imports', async () => {
      const EVENT_ID = 1;

      await fc.assert(
        fc.asyncProperty(
          // Generate rows that intentionally include duplicates within the batch
          fc.integer({ min: 3, max: 10 }).chain(uniqueCount =>
            fc.array(
              fc.record({
                code: arbEmployeeCode,
                name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
                unit: fc.option(fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0), { nil: null })
              }),
              { minLength: uniqueCount, maxLength: uniqueCount }
            )
          ).chain(uniqueRecords => {
            // Create rows with unique codes, then duplicate some
            const baseRows = uniqueRecords.map((r, idx) => [
              `${r.code}${idx}`, r.name, null, null, r.unit
            ]);
            // Pick some rows to duplicate
            return fc.array(
              fc.integer({ min: 0, max: baseRows.length - 1 }),
              { minLength: 1, maxLength: 3 }
            ).map(dupeIndices => {
              const extraRows = dupeIndices.map(i => [...baseRows[i]]);
              return [...baseRows, ...extraRows];
            });
          }),
          async (rows) => {
            const mockPool = createMockPool(EVENT_ID);

            // Import the batch (has internal duplicates)
            jest.resetModules();
            jest.mock('../../database/connection');
            jest.mock('../../config/logger');
            jest.mock('exceljs');
            let dbMod = require('../../database/connection');
            let ExcelMod = require('exceljs');
            dbMod.getPool.mockResolvedValue(mockPool);
            ExcelMod.Workbook.mockImplementation(() => createMockWorkbook(rows));
            let service = require('../doorprizeService');

            await service.importFromExcel(EVENT_ID, Buffer.from('fake'));

            // Import again (all should be skipped)
            jest.resetModules();
            jest.mock('../../database/connection');
            jest.mock('../../config/logger');
            jest.mock('exceljs');
            dbMod = require('../../database/connection');
            ExcelMod = require('exceljs');
            dbMod.getPool.mockResolvedValue(mockPool);
            ExcelMod.Workbook.mockImplementation(() => createMockWorkbook(rows));
            service = require('../doorprizeService');

            await service.importFromExcel(EVENT_ID, Buffer.from('fake'));

            // Check: no duplicate employeeCodes in the participant store
            const participants = mockPool.getParticipants();
            const codesByEvent = participants
              .filter(p => p.DoorprizeEventId === EVENT_ID && p.EmployeeCode)
              .map(p => p.EmployeeCode);

            const uniqueCodes = new Set(codesByEvent);
            return uniqueCodes.size === codesByEvent.length;
          }
        ),
        { numRuns: 50 }
      );
    }, 60000);
  });
});
