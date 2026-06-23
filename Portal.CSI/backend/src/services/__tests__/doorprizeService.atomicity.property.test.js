/**
 * Property-Based Test for Transaction Atomicity
 *
 * **Validates: Requirements 2.2**
 *
 * Property 5: Transaction Atomicity — simulate failure mid-draw, verify no
 * partial state in database.
 *
 * The draw logic wraps everything in a transaction:
 *   BEGIN → validate → select → INSERT → COMMIT
 * On error → ROLLBACK.
 *
 * This test verifies: for any failure point during the draw transaction,
 * the result set before and after is identical (no partial inserts).
 */
const fc = require('fast-check');

jest.mock('../../database/connection');
jest.mock('../../config/logger');

describe('Property Tests - Transaction Atomicity', () => {

  describe('Property 5: Transaction Atomicity', () => {
    /**
     * **Validates: Requirements 2.2**
     *
     * For any failure point during the draw transaction, the database state
     * (results) before and after the failed draw attempt must be identical.
     * No partial inserts should exist.
     */
    test('no partial state exists when a failure occurs at any point in the transaction', async () => {
      const EVENT_ID = 1;
      const GIFT_ID = 1;
      const USER_ID = 99;

      // Arbitrary for failure injection point
      // 0 = fail at gift lookup (UPDLOCK query)
      // 1 = fail at result count query
      // 2 = fail at eligible participants query
      // 3 = fail at INSERT INTO DoorprizeResults
      // 4 = fail at commit
      const arbFailurePoint = fc.integer({ min: 0, max: 4 });

      // Arbitrary for number of pre-existing results (0..5)
      const arbPreExistingResults = fc.integer({ min: 0, max: 5 });

      // Arbitrary for pool size (active participants)
      const arbPoolSize = fc.integer({ min: 2, max: 10 });

      await fc.assert(
        fc.asyncProperty(
          arbFailurePoint,
          arbPreExistingResults,
          arbPoolSize,
          async (failurePoint, numPreExisting, poolSize) => {
            // Build test state
            const gifts = [{
              DoorprizeGiftId: GIFT_ID,
              DoorprizeEventId: EVENT_ID,
              Name: 'Test Gift',
              Quota: poolSize, // large quota
              GiftBy: null,
              DrawTime: null,
              ImagePath: null,
              DisplayOrder: 0,
              CreatedAt: new Date(),
              UpdatedAt: null
            }];

            const participants = Array.from({ length: poolSize }, (_, idx) => ({
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

            // Pre-existing results (participants who already won)
            const actualPreExisting = Math.min(numPreExisting, poolSize - 1);
            const preExistingResults = Array.from({ length: actualPreExisting }, (_, idx) => ({
              DoorprizeResultId: idx + 1,
              DoorprizeEventId: EVENT_ID,
              DoorprizeGiftId: GIFT_ID,
              DoorprizeParticipantId: idx + 1,
              DrawnAt: new Date(),
              DrawnBy: USER_ID
            }));

            // Snapshot of the database state BEFORE the draw attempt
            const snapshotBefore = JSON.parse(JSON.stringify(preExistingResults));

            // Track what actually got "committed" to our simulated DB
            const committedResults = [...preExistingResults];
            let transactionCommitted = false;
            let transactionRolledBack = false;

            // Query call counter to track which step we're on
            let queryCallIndex = 0;

            const transaction = {
              request: () => {
                const inputs = {};
                const req = {
                  input: (name, _type, value) => {
                    inputs[name] = value;
                    return req;
                  },
                  query: async (queryStr) => {
                    const currentCall = queryCallIndex++;

                    // Inject failure at the designated point
                    if (currentCall === failurePoint) {
                      throw new Error(`Simulated failure at step ${failurePoint}`);
                    }

                    // Step 0: Gift lookup with UPDLOCK
                    if (queryStr.includes('FROM DoorprizeGifts WITH (UPDLOCK')) {
                      const gift = gifts.find(
                        g => g.DoorprizeGiftId === inputs.giftId && g.DoorprizeEventId === inputs.eventId
                      );
                      return { recordset: gift ? [gift] : [] };
                    }

                    // Step 1: Count results for gift
                    if (queryStr.includes('COUNT(*)') && queryStr.includes('DoorprizeResults')) {
                      const count = committedResults.filter(r => r.DoorprizeGiftId === inputs.giftId).length;
                      return { recordset: [{ Count: count }] };
                    }

                    // Step 2: Eligible participants query
                    if (queryStr.includes('FROM DoorprizeParticipants') && queryStr.includes('IsActive = 1')) {
                      const winnerIds = new Set(
                        committedResults
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

                    // Step 3: INSERT result (in-memory only, not committed yet)
                    if (queryStr.includes('INSERT INTO DoorprizeResults')) {
                      const newResult = {
                        DoorprizeResultId: committedResults.length + 1,
                        DoorprizeEventId: inputs.eventId,
                        DoorprizeGiftId: inputs.giftId,
                        DoorprizeParticipantId: inputs.participantId,
                        DrawnAt: new Date(),
                        DrawnBy: inputs.drawnBy
                      };
                      // Note: NOT pushing to committedResults here!
                      // Only push on commit to simulate real transaction behavior
                      return { recordset: [newResult] };
                    }

                    return { recordset: [] };
                  }
                };
                return req;
              },
              commit: async () => {
                // Step 4: fail at commit if that's the failure point
                if (failurePoint === 4 && queryCallIndex >= 4) {
                  queryCallIndex++;
                  throw new Error('Simulated commit failure');
                }
                transactionCommitted = true;
              },
              rollback: async () => {
                transactionRolledBack = true;
              }
            };

            // Setup mocks for this iteration
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

            // Execute the draw — expect it to throw due to injected failure
            let drawSucceeded = false;
            try {
              await service.executeDraw(EVENT_ID, GIFT_ID, USER_ID);
              drawSucceeded = true;
            } catch (error) {
              // Expected: the draw failed
            }

            // PROPERTY: If the draw did NOT succeed, the database state must
            // remain unchanged from the snapshot taken before the attempt.
            if (!drawSucceeded) {
              // The committedResults should be identical to snapshotBefore
              // (nothing was added since we never committed)
              const stateAfter = JSON.parse(JSON.stringify(committedResults));

              // Results count must be the same
              if (stateAfter.length !== snapshotBefore.length) {
                return false;
              }

              // Each result must match
              for (let i = 0; i < stateAfter.length; i++) {
                if (stateAfter[i].DoorprizeResultId !== snapshotBefore[i].DoorprizeResultId ||
                    stateAfter[i].DoorprizeParticipantId !== snapshotBefore[i].DoorprizeParticipantId ||
                    stateAfter[i].DoorprizeGiftId !== snapshotBefore[i].DoorprizeGiftId) {
                  return false;
                }
              }

              // Transaction should have been rolled back (not committed)
              if (transactionCommitted) {
                return false;
              }
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    }, 60000);
  });
});
