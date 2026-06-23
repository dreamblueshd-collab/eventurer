/**
 * Property-Based Tests for Doorprize Public Page Safety
 *
 * Validates: Requirements 2.3, 2.7
 *
 * Property 6: Public Page Safety — public endpoint responses never contain
 * email, phone, employeeCode, or internal admin data.
 *
 * These tests mock the database layer and verify that regardless of what PII
 * data participants have, the public methods never leak it in their responses.
 */
const fc = require('fast-check');

// Mock the database connection module
jest.mock('../../database/connection');
jest.mock('../../config/logger');

const db = require('../../database/connection');

// ----------------------------------------------------------
// Arbitraries (generators)
// ----------------------------------------------------------

/**
 * Generate random PII data that might be stored for a participant.
 * We generate realistic-looking emails, phone numbers, and employee codes
 * to ensure they are truly absent from the output.
 */
function arbPiiData() {
  return fc.record({
    email: fc.option(
      fc.emailAddress().map(e => e || 'test@example.com'),
      { nil: null }
    ),
    phone: fc.option(
      fc.string({ minLength: 8, maxLength: 15 }).map(s => s.replace(/[^0-9+\- ]/g, '0')),
      { nil: null }
    ),
    employeeCode: fc.option(
      fc.string({ minLength: 3, maxLength: 20 }).map(s => `EMP${s}`),
      { nil: null }
    )
  });
}

/**
 * Generate an array of participant rows for a given event, with random PII.
 */
function arbParticipantsWithPii(eventId, minCount = 1, maxCount = 10) {
  return fc.integer({ min: minCount, max: maxCount }).chain(count =>
    fc.array(
      fc.tuple(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: null }),
        arbPiiData()
      ),
      { minLength: count, maxLength: count }
    ).map(items =>
      items.map(([name, unit, pii], idx) => ({
        DoorprizeParticipantId: idx + 1,
        DoorprizeEventId: eventId,
        EmployeeCode: pii.employeeCode,
        Name: name || `Participant ${idx + 1}`,
        Phone: pii.phone,
        Email: pii.email,
        Unit: unit,
        IsActive: 1,
        ImagePath: null,
        CreatedAt: new Date(),
        UpdatedAt: null
      }))
    )
  );
}

/**
 * Generate gifts for a given event.
 */
function arbGifts(eventId, minCount = 1, maxCount = 5) {
  return fc.integer({ min: minCount, max: maxCount }).chain(count =>
    fc.array(
      fc.record({
        name: fc.string({ minLength: 1, maxLength: 50 }),
        quota: fc.integer({ min: 1, max: 10 })
      }),
      { minLength: count, maxLength: count }
    ).map(items =>
      items.map((item, idx) => ({
        DoorprizeGiftId: idx + 1,
        DoorprizeEventId: eventId,
        Name: item.name || `Gift ${idx + 1}`,
        Quota: item.quota,
        GiftBy: null,
        DrawTime: null,
        ImagePath: null,
        DisplayOrder: idx,
        CreatedAt: new Date(),
        UpdatedAt: null
      }))
    )
  );
}

// ----------------------------------------------------------
// Helper: create a mock pool that simulates public queries
// ----------------------------------------------------------

/**
 * Create a mock pool that handles the queries used by
 * getPublicResults and getPublicEventInfo.
 */
function createMockPool(event, gifts, participants, results) {
  return {
    request: () => {
      const inputs = {};
      const req = {
        input: (name, _type, value) => {
          inputs[name] = value;
          return req;
        },
        query: async (queryStr) => {
          // Event exists check (simple SELECT)
          if (queryStr.includes('FROM DoorprizeEvents') && queryStr.includes('DoorprizeEventId = @eventId')) {
            if (queryStr.includes('Name, EventDate')) {
              // getPublicEventInfo: returns Name and EventDate
              return {
                recordset: event
                  ? [{ Name: event.Name, EventDate: event.EventDate }]
                  : []
              };
            }
            // Simple existence check
            return {
              recordset: event
                ? [{ DoorprizeEventId: event.DoorprizeEventId }]
                : []
            };
          }

          // getPublicResults: join query
          if (queryStr.includes('FROM DoorprizeResults r') && queryStr.includes('DoorprizeParticipants p')) {
            let filteredResults = results.filter(r => r.DoorprizeEventId === inputs.eventId);
            if (inputs.afterId !== undefined) {
              filteredResults = filteredResults.filter(r => r.DoorprizeResultId > inputs.afterId);
            }

            const joinedRows = filteredResults.map(r => {
              const participant = participants.find(p => p.DoorprizeParticipantId === r.DoorprizeParticipantId);
              const gift = gifts.find(g => g.DoorprizeGiftId === r.DoorprizeGiftId);
              return {
                ParticipantName: participant ? participant.Name : 'Unknown',
                ParticipantUnit: participant ? participant.Unit : null,
                GiftName: gift ? gift.Name : 'Unknown',
                DrawnAt: r.DrawnAt
              };
            });

            return { recordset: joinedRows };
          }

          // getPublicEventInfo: gifts summary query
          if (queryStr.includes('FROM DoorprizeGifts g') && queryStr.includes('DoorprizeEventId = @eventId')) {
            const eventGifts = gifts.filter(g => g.DoorprizeEventId === inputs.eventId);
            const rows = eventGifts.map(g => ({
              Name: g.Name,
              Quota: g.Quota,
              ResultCount: results.filter(r => r.DoorprizeGiftId === g.DoorprizeGiftId).length
            }));
            return { recordset: rows };
          }

          return { recordset: [] };
        }
      };
      return req;
    }
  };
}

// ----------------------------------------------------------
// Property Tests
// ----------------------------------------------------------

describe('Property Tests - Public Page Safety', () => {

  describe('Property 6: Public Page Safety', () => {
    /**
     * **Validates: Requirements 2.3, 2.7**
     *
     * Property 6: Public Page Safety — public endpoint responses never
     * contain email, phone, employeeCode, or internal admin data.
     *
     * For any set of participant data (including random PII), calling
     * getPublicResults never leaks that PII in the response.
     */
    test('getPublicResults never leaks email, phone, or employeeCode', async () => {
      const EVENT_ID = 1;

      await fc.assert(
        fc.asyncProperty(
          arbParticipantsWithPii(EVENT_ID, 1, 10),
          arbGifts(EVENT_ID, 1, 3),
          // Number of results to create
          fc.integer({ min: 1, max: 5 }),
          async (participants, gifts, numResultsRaw) => {
            const numResults = Math.min(numResultsRaw, participants.length, gifts.length > 0 ? gifts[0].Quota : 1);

            // Create some draw results
            const results = [];
            for (let i = 0; i < numResults && i < participants.length; i++) {
              results.push({
                DoorprizeResultId: i + 1,
                DoorprizeEventId: EVENT_ID,
                DoorprizeGiftId: gifts[i % gifts.length].DoorprizeGiftId,
                DoorprizeParticipantId: participants[i].DoorprizeParticipantId,
                DrawnAt: new Date(),
                DrawnBy: 99
              });
            }

            const event = {
              DoorprizeEventId: EVENT_ID,
              Name: 'Test Event',
              EventDate: new Date()
            };

            const mockPool = createMockPool(event, gifts, participants, results);

            // Re-require service with fresh mocks
            jest.resetModules();
            jest.mock('../../database/connection');
            jest.mock('../../config/logger');
            const dbMod = require('../../database/connection');
            dbMod.getPool.mockResolvedValue(mockPool);
            const service = require('../doorprizeService');

            const response = await service.getPublicResults(EVENT_ID);
            const responseStr = JSON.stringify(response);

            // Collect all PII values from participants
            const piiValues = [];
            for (const p of participants) {
              if (p.Email) piiValues.push(p.Email);
              if (p.Phone) piiValues.push(p.Phone);
              if (p.EmployeeCode) piiValues.push(p.EmployeeCode);
            }

            // Verify no PII value appears in the serialized response
            for (const pii of piiValues) {
              if (responseStr.includes(pii)) {
                return false;
              }
            }

            // Verify response structure: only allowed fields
            for (const item of response.results) {
              const keys = Object.keys(item);
              const allowedKeys = ['participantName', 'unit', 'giftName', 'drawnAt'];
              for (const key of keys) {
                if (!allowedKeys.includes(key)) {
                  return false;
                }
              }
            }

            // Verify no internal IDs in response
            if (responseStr.includes('DoorprizeParticipantId') ||
                responseStr.includes('DoorprizeGiftId') ||
                responseStr.includes('DoorprizeResultId') ||
                responseStr.includes('doorprizeParticipantId') ||
                responseStr.includes('doorprizeGiftId') ||
                responseStr.includes('doorprizeResultId')) {
              return false;
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);

    /**
     * **Validates: Requirements 2.3, 2.7**
     *
     * Property 6 (continued): getPublicEventInfo never leaks PII or
     * internal IDs.
     */
    test('getPublicEventInfo never leaks email, phone, employeeCode, or internal IDs', async () => {
      const EVENT_ID = 1;

      await fc.assert(
        fc.asyncProperty(
          arbParticipantsWithPii(EVENT_ID, 1, 10),
          arbGifts(EVENT_ID, 1, 5),
          fc.integer({ min: 0, max: 5 }),
          async (participants, gifts, numResults) => {
            // Create some draw results
            const results = [];
            const maxResults = Math.min(numResults, participants.length);
            for (let i = 0; i < maxResults; i++) {
              results.push({
                DoorprizeResultId: i + 1,
                DoorprizeEventId: EVENT_ID,
                DoorprizeGiftId: gifts[i % gifts.length].DoorprizeGiftId,
                DoorprizeParticipantId: participants[i].DoorprizeParticipantId,
                DrawnAt: new Date(),
                DrawnBy: 99
              });
            }

            const event = {
              DoorprizeEventId: EVENT_ID,
              Name: 'Public Event',
              EventDate: new Date()
            };

            const mockPool = createMockPool(event, gifts, participants, results);

            // Re-require service with fresh mocks
            jest.resetModules();
            jest.mock('../../database/connection');
            jest.mock('../../config/logger');
            const dbMod = require('../../database/connection');
            dbMod.getPool.mockResolvedValue(mockPool);
            const service = require('../doorprizeService');

            const response = await service.getPublicEventInfo(EVENT_ID);
            const responseStr = JSON.stringify(response);

            // Collect all PII values from participants
            const piiValues = [];
            for (const p of participants) {
              if (p.Email) piiValues.push(p.Email);
              if (p.Phone) piiValues.push(p.Phone);
              if (p.EmployeeCode) piiValues.push(p.EmployeeCode);
            }

            // Verify no PII value appears in the serialized response
            for (const pii of piiValues) {
              if (responseStr.includes(pii)) {
                return false;
              }
            }

            // Verify response structure: only allowed top-level fields
            const topKeys = Object.keys(response);
            const allowedTopKeys = ['eventName', 'eventDate', 'gifts'];
            for (const key of topKeys) {
              if (!allowedTopKeys.includes(key)) {
                return false;
              }
            }

            // Verify gift items only have allowed fields
            for (const gift of response.gifts) {
              const giftKeys = Object.keys(gift);
              const allowedGiftKeys = ['name', 'quota', 'winnersCount'];
              for (const key of giftKeys) {
                if (!allowedGiftKeys.includes(key)) {
                  return false;
                }
              }
            }

            // Verify no internal IDs in response
            if (responseStr.includes('DoorprizeParticipantId') ||
                responseStr.includes('DoorprizeGiftId') ||
                responseStr.includes('DoorprizeResultId') ||
                responseStr.includes('DoorprizeEventId') ||
                responseStr.includes('doorprizeParticipantId') ||
                responseStr.includes('doorprizeGiftId') ||
                responseStr.includes('doorprizeResultId') ||
                responseStr.includes('doorprizeEventId')) {
              return false;
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);

    /**
     * **Validates: Requirements 2.3, 2.7**
     *
     * Property 6 (continued): getPublicResults with delta polling (afterId)
     * also never leaks PII.
     */
    test('getPublicResults with afterId never leaks PII', async () => {
      const EVENT_ID = 1;

      await fc.assert(
        fc.asyncProperty(
          arbParticipantsWithPii(EVENT_ID, 3, 10),
          arbGifts(EVENT_ID, 1, 3),
          // afterId to simulate delta polling
          fc.integer({ min: 0, max: 5 }),
          async (participants, gifts, afterId) => {
            // Create multiple draw results
            const results = [];
            const numResults = Math.min(participants.length, 5);
            for (let i = 0; i < numResults; i++) {
              results.push({
                DoorprizeResultId: i + 1,
                DoorprizeEventId: EVENT_ID,
                DoorprizeGiftId: gifts[i % gifts.length].DoorprizeGiftId,
                DoorprizeParticipantId: participants[i].DoorprizeParticipantId,
                DrawnAt: new Date(),
                DrawnBy: 99
              });
            }

            const event = {
              DoorprizeEventId: EVENT_ID,
              Name: 'Delta Poll Event',
              EventDate: new Date()
            };

            const mockPool = createMockPool(event, gifts, participants, results);

            // Re-require service with fresh mocks
            jest.resetModules();
            jest.mock('../../database/connection');
            jest.mock('../../config/logger');
            const dbMod = require('../../database/connection');
            dbMod.getPool.mockResolvedValue(mockPool);
            const service = require('../doorprizeService');

            const response = await service.getPublicResults(EVENT_ID, { afterId });
            const responseStr = JSON.stringify(response);

            // Collect all PII values
            const piiValues = [];
            for (const p of participants) {
              if (p.Email) piiValues.push(p.Email);
              if (p.Phone) piiValues.push(p.Phone);
              if (p.EmployeeCode) piiValues.push(p.EmployeeCode);
            }

            // Verify no PII leaks
            for (const pii of piiValues) {
              if (responseStr.includes(pii)) {
                return false;
              }
            }

            // Verify no internal IDs
            if (responseStr.includes('doorprizeParticipantId') ||
                responseStr.includes('doorprizeGiftId') ||
                responseStr.includes('doorprizeResultId') ||
                responseStr.includes('DoorprizeParticipantId') ||
                responseStr.includes('DoorprizeGiftId') ||
                responseStr.includes('DoorprizeResultId')) {
              return false;
            }

            return true;
          }
        ),
        { numRuns: 50 }
      );
    }, 30000);
  });
});
