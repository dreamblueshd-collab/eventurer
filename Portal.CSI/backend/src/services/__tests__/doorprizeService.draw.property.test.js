/**
 * Property-Based Tests for Doorprize Draw Logic
 *
 * Validates: Requirements 2.1, 2.4, 2.5, 1.4
 *
 * These tests mock the database layer and verify that the draw logic
 * maintains its invariants across many random inputs.
 */
const fc = require('fast-check');
const crypto = require('crypto');

// Mock the database connection module
jest.mock('../../database/connection');
jest.mock('../../config/logger');

const db = require('../../database/connection');

// We need to re-require doorprizeService after mocking
let doorprizeService;

/**
 * Helper: create a mock transaction that simulates the draw flow.
 * The transaction maintains internal state (gifts, participants, results)
 * to simulate the database behavior for the draw logic.
 */
function createMockTransaction(gifts, participants, results) {
  // Mutable copy of results to track inserts during the transaction
  const txResults = [...results];
  let committed = false;
  let rolledBack = false;

  const transaction = {
    request: () => {
      const inputs = {};
      const req = {
        input: (name, _type, value) => {
          inputs[name] = value;
          return req;
        },
        query: async (queryStr) => {
          // Gift lookup with UPDLOCK
          if (queryStr.includes('FROM DoorprizeGifts WITH (UPDLOCK')) {
            const gift = gifts.find(
              g => g.DoorprizeGiftId === inputs.giftId && g.DoorprizeEventId === inputs.eventId
            );
            return { recordset: gift ? [gift] : [] };
          }

          // Count results for gift
          if (queryStr.includes('COUNT(*)') && queryStr.includes('DoorprizeResults') && queryStr.includes('DoorprizeGiftId')) {
            const count = txResults.filter(r => r.DoorprizeGiftId === inputs.giftId).length;
            return { recordset: [{ Count: count }] };
          }

          // Eligible participants query
          if (queryStr.includes('FROM DoorprizeParticipants') && queryStr.includes('IsActive = 1')) {
            const winnerIds = new Set(
              txResults
                .filter(r => r.DoorprizeEventId === inputs.eventId)
                .map(r => r.DoorprizeParticipantId)
            );
            const eligible = participants.filter(
              p => p.DoorprizeEventId === inputs.eventId &&
                   p.IsActive === 1 &&
                   !winnerIds.has(p.DoorprizeParticipantId)
            );
            return { recordset: eligible };
          }

          // INSERT result
          if (queryStr.includes('INSERT INTO DoorprizeResults')) {
            const newResult = {
              DoorprizeResultId: txResults.length + 1,
              DoorprizeEventId: inputs.eventId,
              DoorprizeGiftId: inputs.giftId,
              DoorprizeParticipantId: inputs.participantId,
              DrawnAt: new Date(),
              DrawnBy: inputs.drawnBy
            };
            txResults.push(newResult);
            return { recordset: [newResult] };
          }

          return { recordset: [] };
        }
      };
      return req;
    },
    commit: async () => { committed = true; },
    rollback: async () => { rolledBack = true; },
    isCommitted: () => committed,
    isRolledBack: () => rolledBack,
    getResults: () => txResults
  };

  return transaction;
}

beforeAll(() => {
  // Setup mock pool (needed for validation checks outside transaction)
  const mockPool = {
    request: () => {
      const inputs = {};
      const req = {
        input: (name, _type, value) => {
          inputs[name] = value;
          return req;
        },
        query: async () => {
          // Default: return event exists for assertEventExists
          return { recordset: [{ DoorprizeEventId: inputs.eventId || 1 }] };
        }
      };
      return req;
    }
  };

  db.getPool.mockResolvedValue(mockPool);
});

beforeEach(() => {
  jest.resetModules();
  jest.mock('../../database/connection');
  jest.mock('../../config/logger');
});

// ----------------------------------------------------------
// Arbitraries (generators)
// ----------------------------------------------------------

/**
 * Generate an array of participant rows for a given event.
 * Each participant has a unique ID, random active status, and a name.
 */
function arbParticipants(eventId, minCount = 1, maxCount = 20) {
  return fc.integer({ min: minCount, max: maxCount }).chain(count =>
    fc.array(
      fc.record({
        name: fc.string({ minLength: 1, maxLength: 50 }),
        isActive: fc.boolean(),
        unit: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: null })
      }),
      { minLength: count, maxLength: count }
    ).map(items =>
      items.map((item, idx) => ({
        DoorprizeParticipantId: idx + 1,
        DoorprizeEventId: eventId,
        EmployeeCode: `EMP${String(idx + 1).padStart(4, '0')}`,
        Name: item.name || `Participant ${idx + 1}`,
        Phone: null,
        Email: null,
        Unit: item.unit,
        IsActive: item.isActive ? 1 : 0,
        ImagePath: null,
        CreatedAt: new Date(),
        UpdatedAt: null
      }))
    )
  );
}

/**
 * Generate an array of gift rows for a given event.
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
// Property Tests
// ----------------------------------------------------------

describe('Property Tests - Doorprize Draw Logic', () => {

  describe('Property 1: Draw Fairness', () => {
    /**
     * **Validates: Requirements 2.1**
     *
     * Property 1: Draw Fairness — verify uniform distribution via
     * `crypto.randomInt` over eligible pool.
     *
     * The draw logic calls `crypto.randomInt(0, eligible.length)` to select
     * a winner. This test verifies that the index used to pick a winner is
     * exactly the value returned by crypto.randomInt, confirming every
     * eligible participant has probability 1/N.
     */
    test('winner is always the participant at the index returned by crypto.randomInt', async () => {
      const EVENT_ID = 1;
      const USER_ID = 99;

      await fc.assert(
        fc.asyncProperty(
          // Generate 2-20 active participants
          fc.integer({ min: 2, max: 20 }),
          fc.integer({ min: 0, max: 19 }),
          async (poolSize, randomSeed) => {
            // Ensure randomSeed is within bounds
            const targetIndex = randomSeed % poolSize;

            // Create all-active participants
            const participants = Array.from({ length: poolSize }, (_, idx) => ({
              DoorprizeParticipantId: idx + 1,
              DoorprizeEventId: EVENT_ID,
              EmployeeCode: `EMP${String(idx + 1).padStart(4, '0')}`,
              Name: `Participant ${idx + 1}`,
              Phone: null,
              Email: null,
              Unit: `Unit ${idx + 1}`,
              IsActive: 1,
              ImagePath: null,
              CreatedAt: new Date(),
              UpdatedAt: null
            }));

            const gifts = [{
              DoorprizeGiftId: 1,
              DoorprizeEventId: EVENT_ID,
              Name: 'Gift A',
              Quota: poolSize, // large quota so it never exhausts
              GiftBy: null,
              DrawTime: null,
              ImagePath: null,
              DisplayOrder: 0,
              CreatedAt: new Date(),
              UpdatedAt: null
            }];

            const results = [];
            const transaction = createMockTransaction(gifts, participants, results);

            // Mock crypto.randomInt to return our target index
            const spy = jest.spyOn(crypto, 'randomInt').mockReturnValue(targetIndex);

            // Re-setup mocks for this iteration
            db.beginTransaction.mockResolvedValue(transaction);
            db.getPool.mockResolvedValue({
              request: () => {
                const inputs = {};
                return {
                  input: (name, _type, value) => { inputs[name] = value; return { input: (n, _t, v) => { inputs[n] = v; return { query: async () => ({ recordset: [{ DoorprizeEventId: EVENT_ID }] }) }; }, query: async () => ({ recordset: [{ DoorprizeEventId: EVENT_ID }] }) }; },
                  query: async () => ({ recordset: [{ DoorprizeEventId: EVENT_ID }] })
                };
              }
            });

            // Fresh require to pick up mocks
            jest.resetModules();
            jest.mock('../../database/connection');
            jest.mock('../../config/logger');
            const dbMod = require('../../database/connection');
            dbMod.beginTransaction.mockResolvedValue(transaction);
            dbMod.getPool.mockResolvedValue({
              request: () => {
                const inputs = {};
                const req = {
                  input: (name, _type, value) => { inputs[name] = value; return req; },
                  query: async () => ({ recordset: [{ DoorprizeEventId: EVENT_ID }] })
                };
                return req;
              }
            });
            const service = require('../doorprizeService');

            const drawResult = await service.executeDraw(EVENT_ID, 1, USER_ID);

            spy.mockRestore();

            // The winner should be the participant at targetIndex
            return drawResult.winner.doorprizeParticipantId === participants[targetIndex].DoorprizeParticipantId;
          }
        ),
        { numRuns: 50 }
      );
    }, 30000);
  });

  describe('Property 2: No Double Win', () => {
    /**
     * **Validates: Requirements 2.4**
     *
     * Property 2: No Double Win — after any sequence of draws, each
     * participant appears at most once in results.
     *
     * We simulate multiple draws in sequence and verify that no participant
     * ID appears more than once in the accumulated results.
     */
    test('each participant appears at most once in results after multiple draws', async () => {
      const EVENT_ID = 1;
      const USER_ID = 99;

      await fc.assert(
        fc.asyncProperty(
          // Number of participants (all active)
          fc.integer({ min: 3, max: 15 }),
          // Number of draws to attempt (up to number of participants)
          fc.integer({ min: 2, max: 10 }),
          async (numParticipants, numDrawsRaw) => {
            const numDraws = Math.min(numDrawsRaw, numParticipants);

            const participants = Array.from({ length: numParticipants }, (_, idx) => ({
              DoorprizeParticipantId: idx + 1,
              DoorprizeEventId: EVENT_ID,
              EmployeeCode: `EMP${String(idx + 1).padStart(4, '0')}`,
              Name: `Participant ${idx + 1}`,
              Phone: null,
              Email: null,
              Unit: null,
              IsActive: 1,
              ImagePath: null,
              CreatedAt: new Date(),
              UpdatedAt: null
            }));

            const gifts = [{
              DoorprizeGiftId: 1,
              DoorprizeEventId: EVENT_ID,
              Name: 'Grand Prize',
              Quota: numParticipants, // enough quota
              GiftBy: null,
              DrawTime: null,
              ImagePath: null,
              DisplayOrder: 0,
              CreatedAt: new Date(),
              UpdatedAt: null
            }];

            // Shared results array that accumulates across draws
            const sharedResults = [];

            const winnerIds = [];

            for (let i = 0; i < numDraws; i++) {
              const transaction = createMockTransaction(gifts, participants, sharedResults);

              jest.resetModules();
              jest.mock('../../database/connection');
              jest.mock('../../config/logger');
              const dbMod = require('../../database/connection');
              dbMod.beginTransaction.mockResolvedValue(transaction);
              dbMod.getPool.mockResolvedValue({
                request: () => {
                  const inputs = {};
                  const req = {
                    input: (name, _type, value) => { inputs[name] = value; return req; },
                    query: async () => ({ recordset: [{ DoorprizeEventId: EVENT_ID }] })
                  };
                  return req;
                }
              });
              const service = require('../doorprizeService');

              const drawResult = await service.executeDraw(EVENT_ID, 1, USER_ID);
              winnerIds.push(drawResult.winner.doorprizeParticipantId);

              // Sync shared results from transaction
              sharedResults.length = 0;
              sharedResults.push(...transaction.getResults());
            }

            // Check: no duplicate winner IDs
            const uniqueWinners = new Set(winnerIds);
            return uniqueWinners.size === winnerIds.length;
          }
        ),
        { numRuns: 30 }
      );
    }, 60000);
  });

  describe('Property 3: Quota Enforcement', () => {
    /**
     * **Validates: Requirements 2.5**
     *
     * Property 3: Quota Enforcement — result count for any gift never
     * exceeds its quota.
     *
     * After drawing up to the quota, the next draw should throw a
     * ConflictError. We verify that successful draws never exceed quota.
     */
    test('result count for a gift never exceeds its quota', async () => {
      const EVENT_ID = 1;
      const USER_ID = 99;

      await fc.assert(
        fc.asyncProperty(
          // Gift quota between 1 and 5
          fc.integer({ min: 1, max: 5 }),
          // Number of participants (always more than quota to test limits)
          fc.integer({ min: 6, max: 15 }),
          async (quota, numParticipants) => {
            const participants = Array.from({ length: numParticipants }, (_, idx) => ({
              DoorprizeParticipantId: idx + 1,
              DoorprizeEventId: EVENT_ID,
              EmployeeCode: `EMP${String(idx + 1).padStart(4, '0')}`,
              Name: `Participant ${idx + 1}`,
              Phone: null,
              Email: null,
              Unit: null,
              IsActive: 1,
              ImagePath: null,
              CreatedAt: new Date(),
              UpdatedAt: null
            }));

            const gifts = [{
              DoorprizeGiftId: 1,
              DoorprizeEventId: EVENT_ID,
              Name: 'Limited Prize',
              Quota: quota,
              GiftBy: null,
              DrawTime: null,
              ImagePath: null,
              DisplayOrder: 0,
              CreatedAt: new Date(),
              UpdatedAt: null
            }];

            const sharedResults = [];
            let successCount = 0;
            let quotaExhaustedThrown = false;

            // Attempt quota + 1 draws
            for (let i = 0; i <= quota; i++) {
              const transaction = createMockTransaction(gifts, participants, sharedResults);

              jest.resetModules();
              jest.mock('../../database/connection');
              jest.mock('../../config/logger');
              const dbMod = require('../../database/connection');
              dbMod.beginTransaction.mockResolvedValue(transaction);
              dbMod.getPool.mockResolvedValue({
                request: () => {
                  const inputs = {};
                  const req = {
                    input: (name, _type, value) => { inputs[name] = value; return req; },
                    query: async () => ({ recordset: [{ DoorprizeEventId: EVENT_ID }] })
                  };
                  return req;
                }
              });
              const service = require('../doorprizeService');

              try {
                await service.executeDraw(EVENT_ID, 1, USER_ID);
                successCount++;
                // Sync shared results
                sharedResults.length = 0;
                sharedResults.push(...transaction.getResults());
              } catch (error) {
                if (error.message === 'Gift quota exhausted') {
                  quotaExhaustedThrown = true;
                  break;
                }
                throw error;
              }
            }

            // The successful draws should be exactly equal to quota
            // and the (quota+1)th draw should have thrown
            return successCount === quota && quotaExhaustedThrown;
          }
        ),
        { numRuns: 20 }
      );
    }, 60000);
  });

  describe('Property 4: Eligibility Integrity', () => {
    /**
     * **Validates: Requirements 1.4, 2.4**
     *
     * Property 4: Eligibility Integrity — draw never selects inactive or
     * already-won participant.
     *
     * We generate a mixed pool (active and inactive participants) plus some
     * pre-existing results, then verify the winner is always from the
     * eligible subset (active AND not already won).
     */
    test('winner is always an active participant who has not already won', async () => {
      const EVENT_ID = 1;
      const USER_ID = 99;

      await fc.assert(
        fc.asyncProperty(
          // Number of active participants
          fc.integer({ min: 2, max: 10 }),
          // Number of inactive participants
          fc.integer({ min: 0, max: 5 }),
          // Number of already-won participants (from active pool)
          fc.integer({ min: 0, max: 4 }),
          async (numActive, numInactive, numAlreadyWonRaw) => {
            const numAlreadyWon = Math.min(numAlreadyWonRaw, numActive - 1); // leave at least 1 eligible

            // Build participants: active ones first, then inactive
            const participants = [];
            let id = 1;

            for (let i = 0; i < numActive; i++) {
              participants.push({
                DoorprizeParticipantId: id,
                DoorprizeEventId: EVENT_ID,
                EmployeeCode: `EMP${String(id).padStart(4, '0')}`,
                Name: `Active ${id}`,
                Phone: null,
                Email: null,
                Unit: null,
                IsActive: 1,
                ImagePath: null,
                CreatedAt: new Date(),
                UpdatedAt: null
              });
              id++;
            }

            for (let i = 0; i < numInactive; i++) {
              participants.push({
                DoorprizeParticipantId: id,
                DoorprizeEventId: EVENT_ID,
                EmployeeCode: `EMP${String(id).padStart(4, '0')}`,
                Name: `Inactive ${id}`,
                Phone: null,
                Email: null,
                Unit: null,
                IsActive: 0,
                ImagePath: null,
                CreatedAt: new Date(),
                UpdatedAt: null
              });
              id++;
            }

            // Pre-existing results (first numAlreadyWon active participants already won)
            const preExistingResults = [];
            for (let i = 0; i < numAlreadyWon; i++) {
              preExistingResults.push({
                DoorprizeResultId: i + 1,
                DoorprizeEventId: EVENT_ID,
                DoorprizeGiftId: 1,
                DoorprizeParticipantId: participants[i].DoorprizeParticipantId,
                DrawnAt: new Date(),
                DrawnBy: USER_ID
              });
            }

            const gifts = [{
              DoorprizeGiftId: 1,
              DoorprizeEventId: EVENT_ID,
              Name: 'Prize',
              Quota: numActive, // plenty of quota
              GiftBy: null,
              DrawTime: null,
              ImagePath: null,
              DisplayOrder: 0,
              CreatedAt: new Date(),
              UpdatedAt: null
            }];

            const transaction = createMockTransaction(gifts, participants, preExistingResults);

            jest.resetModules();
            jest.mock('../../database/connection');
            jest.mock('../../config/logger');
            const dbMod = require('../../database/connection');
            dbMod.beginTransaction.mockResolvedValue(transaction);
            dbMod.getPool.mockResolvedValue({
              request: () => {
                const inputs = {};
                const req = {
                  input: (name, _type, value) => { inputs[name] = value; return req; },
                  query: async () => ({ recordset: [{ DoorprizeEventId: EVENT_ID }] })
                };
                return req;
              }
            });
            const service = require('../doorprizeService');

            const drawResult = await service.executeDraw(EVENT_ID, 1, USER_ID);
            const winnerId = drawResult.winner.doorprizeParticipantId;

            // Find the winner in our participants list
            const winnerParticipant = participants.find(
              p => p.DoorprizeParticipantId === winnerId
            );

            // Winner must be active
            const isActive = winnerParticipant && winnerParticipant.IsActive === 1;

            // Winner must not be in pre-existing results
            const alreadyWon = preExistingResults.some(
              r => r.DoorprizeParticipantId === winnerId
            );

            // Winner must not be inactive
            const isInactive = winnerParticipant && winnerParticipant.IsActive === 0;

            return isActive && !alreadyWon && !isInactive;
          }
        ),
        { numRuns: 50 }
      );
    }, 30000);
  });
});
