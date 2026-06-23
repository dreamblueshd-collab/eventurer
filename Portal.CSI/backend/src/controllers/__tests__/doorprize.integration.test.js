/**
 * Doorprize API Integration Tests
 *
 * Tests the full HTTP layer: routes → middleware → controller → (mocked) service.
 * Validates Requirements: 1.1, 1.2, 1.3, 1.4, 2.2, 2.4, 2.5
 */

const request = require('supertest');
const express = require('express');

// ---------------------------------------------------------------------------
// Mocks — must be declared before require
// ---------------------------------------------------------------------------

jest.mock('../../services/authService', () => ({
  validateToken: jest.fn(),
}));

jest.mock('../../services/doorprizeService', () => ({
  getAllEvents: jest.fn(),
  getEventById: jest.fn(),
  createEvent: jest.fn(),
  updateEvent: jest.fn(),
  deleteEvent: jest.fn(),
  getGiftsByEvent: jest.fn(),
  createGift: jest.fn(),
  updateGift: jest.fn(),
  deleteGift: jest.fn(),
  getParticipantsByEvent: jest.fn(),
  createParticipant: jest.fn(),
  updateParticipant: jest.fn(),
  deleteParticipant: jest.fn(),
  importFromExcel: jest.fn(),
  generateImportTemplate: jest.fn(),
  getDrawState: jest.fn(),
  executeDraw: jest.fn(),
  resetResult: jest.fn(),
  exportToExcel: jest.fn(),
  getPublicResults: jest.fn(),
  getPublicEventInfo: jest.fn(),
}));

jest.mock('../../config/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const authService = require('../../services/authService');
const doorprizeService = require('../../services/doorprizeService');
const apiRoutes = require('../../routes/apiRoutes');

// ---------------------------------------------------------------------------
// Test app factory
// ---------------------------------------------------------------------------

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use('/api/v1', apiRoutes);
  return app;
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

const ADMIN_EVENT_USER = {
  userId: 1,
  username: 'admin_event',
  displayName: 'Admin Event',
  email: 'admin@aop.co.id',
  role: 'AdminEvent',
};

const DEPT_HEAD_USER = {
  userId: 99,
  username: 'dept_head',
  displayName: 'Dept Head',
  email: 'depthead@aop.co.id',
  role: 'DepartmentHead',
};

const IT_LEAD_USER = {
  userId: 50,
  username: 'it_lead',
  displayName: 'IT Lead',
  email: 'itlead@aop.co.id',
  role: 'ITLead',
};

function mockAuthAs(user) {
  authService.validateToken.mockResolvedValue({
    isValid: true,
    user,
    errorMessage: null,
  });
}

function mockAuthInvalid() {
  authService.validateToken.mockResolvedValue({
    isValid: false,
    user: null,
    errorMessage: 'Invalid token',
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Doorprize API Integration Tests', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // 1. Full CRUD Lifecycle
  // Validates: Req 1.1, 1.2, 1.3, 1.4, 2.2
  // =========================================================================

  describe('Full CRUD lifecycle: event → gift → participant → draw → verify', () => {
    it('should create event, add gift, add participant, execute draw, and verify result', async () => {
      mockAuthAs(ADMIN_EVENT_USER);

      // --- Step 1: Create event ---
      const mockEvent = {
        doorprizeEventId: 1,
        name: 'Annual Gathering 2025',
        eventDate: '2025-06-15T09:00:00.000Z',
        status: 'Draft',
        imagePath: null,
        createdBy: 1,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: null,
      };
      doorprizeService.createEvent.mockResolvedValue(mockEvent);

      const createEventRes = await request(app)
        .post('/api/v1/doorprize/events')
        .set('Authorization', 'Bearer valid-admin-token')
        .field('name', 'Annual Gathering 2025')
        .field('eventDate', '2025-06-15T09:00:00.000Z');

      expect(createEventRes.status).toBe(201);
      expect(createEventRes.body.success).toBe(true);
      expect(createEventRes.body.event.name).toBe('Annual Gathering 2025');

      // --- Step 2: Add gift ---
      const mockGift = {
        doorprizeGiftId: 10,
        doorprizeEventId: 1,
        name: 'MacBook Pro 14"',
        quota: 2,
        giftBy: 'IT Department',
        drawTime: 'Sesi 1',
        displayOrder: 1,
        imagePath: null,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: null,
        resultCount: 0,
        quotaRemaining: 2,
      };
      doorprizeService.createGift.mockResolvedValue(mockGift);

      const createGiftRes = await request(app)
        .post('/api/v1/doorprize/events/1/gifts')
        .set('Authorization', 'Bearer valid-admin-token')
        .field('name', 'MacBook Pro 14"')
        .field('quota', '2')
        .field('giftBy', 'IT Department')
        .field('drawTime', 'Sesi 1')
        .field('displayOrder', '1');

      expect(createGiftRes.status).toBe(201);
      expect(createGiftRes.body.success).toBe(true);
      expect(createGiftRes.body.gift.name).toBe('MacBook Pro 14"');
      expect(createGiftRes.body.gift.quota).toBe(2);

      // --- Step 3: Add participant ---
      const mockParticipant = {
        doorprizeParticipantId: 5,
        doorprizeEventId: 1,
        name: 'Budi Santoso',
        employeeCode: 'EMP001',
        phone: '081234567890',
        email: 'budi@aop.co.id',
        unit: 'IT Division',
        isActive: true,
        imagePath: null,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: null,
      };
      doorprizeService.createParticipant.mockResolvedValue(mockParticipant);

      const createPartRes = await request(app)
        .post('/api/v1/doorprize/events/1/participants')
        .set('Authorization', 'Bearer valid-admin-token')
        .field('name', 'Budi Santoso')
        .field('employeeCode', 'EMP001')
        .field('phone', '081234567890')
        .field('email', 'budi@aop.co.id')
        .field('unit', 'IT Division');

      expect(createPartRes.status).toBe(201);
      expect(createPartRes.body.success).toBe(true);
      expect(createPartRes.body.participant.name).toBe('Budi Santoso');

      // --- Step 4: Execute draw ---
      const mockDrawResult = {
        result: {
          doorprizeResultId: 1,
          doorprizeEventId: 1,
          doorprizeGiftId: 10,
          doorprizeParticipantId: 5,
          drawnAt: '2025-06-15T10:00:00.000Z',
          drawnBy: 1,
        },
        winner: {
          doorprizeParticipantId: 5,
          name: 'Budi Santoso',
          unit: 'IT Division',
        },
        gift: {
          doorprizeGiftId: 10,
          name: 'MacBook Pro 14"',
          quota: 2,
          resultCount: 1,
          quotaRemaining: 1,
        },
      };
      doorprizeService.executeDraw.mockResolvedValue(mockDrawResult);

      const drawRes = await request(app)
        .post('/api/v1/doorprize/events/1/draw')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({ giftId: 10 });

      expect(drawRes.status).toBe(201);
      expect(drawRes.body.success).toBe(true);
      expect(drawRes.body.message).toBe('Draw executed successfully');
      expect(drawRes.body.winner.name).toBe('Budi Santoso');
      expect(drawRes.body.gift.name).toBe('MacBook Pro 14"');

      // --- Step 5: Get draw state to verify result ---
      const mockDrawState = {
        event: mockEvent,
        gifts: [{ ...mockGift, quotaRemaining: 1, resultCount: 1 }],
        eligibleParticipants: [],
        results: [mockDrawResult.result],
      };
      doorprizeService.getDrawState.mockResolvedValue(mockDrawState);

      const drawStateRes = await request(app)
        .get('/api/v1/doorprize/events/1/draw-state')
        .set('Authorization', 'Bearer valid-admin-token');

      expect(drawStateRes.status).toBe(200);
      expect(drawStateRes.body.success).toBe(true);
      expect(drawStateRes.body.results).toHaveLength(1);
      expect(drawStateRes.body.results[0].doorprizeParticipantId).toBe(5);
      expect(drawStateRes.body.gifts[0].quotaRemaining).toBe(1);
    });
  });

  // =========================================================================
  // 2. Permission Enforcement (403 for unauthorized roles)
  // Validates: Req 1.1, 1.4, 2.5
  // =========================================================================

  describe('Permission enforcement — 403 for unauthorized roles', () => {
    it('should return 403 when DepartmentHead tries to create an event', async () => {
      mockAuthAs(DEPT_HEAD_USER);

      const res = await request(app)
        .post('/api/v1/doorprize/events')
        .set('Authorization', 'Bearer dept-head-token')
        .field('name', 'Unauthorized Event')
        .field('eventDate', '2025-01-01T00:00:00Z');

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Access denied');
      expect(doorprizeService.createEvent).not.toHaveBeenCalled();
    });

    it('should return 403 when ITLead tries to execute a draw', async () => {
      mockAuthAs(IT_LEAD_USER);

      const res = await request(app)
        .post('/api/v1/doorprize/events/1/draw')
        .set('Authorization', 'Bearer itlead-token')
        .send({ giftId: 10 });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Access denied');
      expect(doorprizeService.executeDraw).not.toHaveBeenCalled();
    });

    it('should return 403 when DepartmentHead tries to delete a gift', async () => {
      mockAuthAs(DEPT_HEAD_USER);

      const res = await request(app)
        .delete('/api/v1/doorprize/gifts/1')
        .set('Authorization', 'Bearer dept-head-token');

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Access denied');
      expect(doorprizeService.deleteGift).not.toHaveBeenCalled();
    });

    it('should return 403 when ITLead tries to create a participant', async () => {
      mockAuthAs(IT_LEAD_USER);

      const res = await request(app)
        .post('/api/v1/doorprize/events/1/participants')
        .set('Authorization', 'Bearer itlead-token')
        .field('name', 'Unauthorized Participant');

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Access denied');
      expect(doorprizeService.createParticipant).not.toHaveBeenCalled();
    });

    it('should return 401 when no auth token is provided for protected endpoints', async () => {
      authService.validateToken.mockResolvedValue({
        isValid: false,
        user: null,
        errorMessage: 'No token',
      });

      const res = await request(app)
        .get('/api/v1/doorprize/events');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Authentication required');
    });

    it('should allow SuperAdmin read-only access to doorprize events', async () => {
      const superAdminUser = {
        userId: 2,
        username: 'super_admin',
        displayName: 'Super Admin',
        email: 'superadmin@aop.co.id',
        role: 'SuperAdmin',
      };
      mockAuthAs(superAdminUser);

      doorprizeService.getAllEvents.mockResolvedValue({
        data: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
      });

      const res = await request(app)
        .get('/api/v1/doorprize/events')
        .set('Authorization', 'Bearer super-admin-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 403 when SuperAdmin tries to create an event (no doorprize:create)', async () => {
      const superAdminUser = {
        userId: 2,
        username: 'super_admin',
        displayName: 'Super Admin',
        email: 'superadmin@aop.co.id',
        role: 'SuperAdmin',
      };
      mockAuthAs(superAdminUser);

      const res = await request(app)
        .post('/api/v1/doorprize/events')
        .set('Authorization', 'Bearer super-admin-token')
        .field('name', 'Unauthorized')
        .field('eventDate', '2025-01-01T00:00:00Z');

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Access denied');
    });
  });

  // =========================================================================
  // 3. Public Endpoints (no auth required)
  // Validates: Req 2.2, 2.4
  // =========================================================================

  describe('Public endpoints — work without authentication', () => {
    it('should return public results without auth token', async () => {
      const mockPublicResults = {
        results: [
          {
            participantName: 'Budi Santoso',
            unit: 'IT Division',
            giftName: 'MacBook Pro 14"',
            drawnAt: '2025-06-15T10:00:00.000Z',
          },
          {
            participantName: 'Siti Rahayu',
            unit: 'HR Department',
            giftName: 'iPad Air',
            drawnAt: '2025-06-15T10:05:00.000Z',
          },
        ],
      };
      doorprizeService.getPublicResults.mockResolvedValue(mockPublicResults);

      const res = await request(app)
        .get('/api/v1/public/doorprize/events/1/results');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.results).toHaveLength(2);
      expect(res.body.results[0].participantName).toBe('Budi Santoso');
      expect(res.body.results[0].giftName).toBe('MacBook Pro 14"');
      // Verify no PII fields exist
      expect(res.body.results[0]).not.toHaveProperty('email');
      expect(res.body.results[0]).not.toHaveProperty('phone');
      expect(res.body.results[0]).not.toHaveProperty('employeeCode');
    });

    it('should return public event info without auth token', async () => {
      const mockPublicInfo = {
        eventName: 'Annual Gathering 2025',
        eventDate: '2025-06-15T09:00:00.000Z',
        gifts: [
          { name: 'MacBook Pro 14"', quota: 2 },
          { name: 'iPad Air', quota: 5 },
        ],
      };
      doorprizeService.getPublicEventInfo.mockResolvedValue(mockPublicInfo);

      const res = await request(app)
        .get('/api/v1/public/doorprize/events/1/info');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.eventName).toBe('Annual Gathering 2025');
      expect(res.body.gifts).toHaveLength(2);
    });

    it('should support delta polling via ?after={lastId} parameter', async () => {
      doorprizeService.getPublicResults.mockResolvedValue({
        results: [
          {
            participantName: 'Dewi Anggraeni',
            unit: 'Finance',
            giftName: 'Smartwatch',
            drawnAt: '2025-06-15T10:10:00.000Z',
          },
        ],
      });

      const res = await request(app)
        .get('/api/v1/public/doorprize/events/1/results?after=5');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.results).toHaveLength(1);
      // Verify service was called with afterId option
      expect(doorprizeService.getPublicResults).toHaveBeenCalledWith(
        '1',
        expect.objectContaining({ afterId: '5' })
      );
    });

    it('should return 400 for invalid event ID on public results', async () => {
      const res = await request(app)
        .get('/api/v1/public/doorprize/events/abc/results');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // 4. Concurrent Draw Scenario (last quota slot)
  // Validates: Req 2.4, 2.5
  // =========================================================================

  describe('Concurrent draw — two parallel draws for last quota slot', () => {
    it('should allow one draw and reject the other with 409 when quota is exhausted', async () => {
      mockAuthAs(ADMIN_EVENT_USER);

      // First draw succeeds
      const successResult = {
        result: {
          doorprizeResultId: 100,
          doorprizeEventId: 1,
          doorprizeGiftId: 10,
          doorprizeParticipantId: 5,
          drawnAt: '2025-06-15T10:30:00.000Z',
          drawnBy: 1,
        },
        winner: {
          doorprizeParticipantId: 5,
          name: 'Andi Wijaya',
          unit: 'Engineering',
        },
        gift: {
          doorprizeGiftId: 10,
          name: 'iPhone 15',
          quota: 1,
          resultCount: 1,
          quotaRemaining: 0,
        },
      };

      // Second draw fails with quota exhausted (simulating race condition resolution)
      const quotaError = new Error('Gift quota exhausted');
      quotaError.statusCode = 409;
      quotaError.name = 'ConflictError';

      // Set up mock: first call succeeds, second call fails
      doorprizeService.executeDraw
        .mockResolvedValueOnce(successResult)
        .mockRejectedValueOnce(quotaError);

      // Fire both draws in parallel
      const [firstRes, secondRes] = await Promise.all([
        request(app)
          .post('/api/v1/doorprize/events/1/draw')
          .set('Authorization', 'Bearer valid-admin-token')
          .send({ giftId: 10 }),
        request(app)
          .post('/api/v1/doorprize/events/1/draw')
          .set('Authorization', 'Bearer valid-admin-token')
          .send({ giftId: 10 }),
      ]);

      // One should succeed (201), the other should fail (409)
      const statuses = [firstRes.status, secondRes.status].sort();
      expect(statuses).toEqual([201, 409]);

      // The successful response
      const successfulRes = firstRes.status === 201 ? firstRes : secondRes;
      expect(successfulRes.body.success).toBe(true);
      expect(successfulRes.body.winner.name).toBe('Andi Wijaya');

      // The failed response
      const failedRes = firstRes.status === 409 ? firstRes : secondRes;
      expect(failedRes.body.success).toBe(false);
      expect(failedRes.body.message).toBe('Gift quota exhausted');
    });

    it('should reject draw when no eligible participants remain (all have won)', async () => {
      mockAuthAs(ADMIN_EVENT_USER);

      const noEligibleError = new Error('No eligible participants remaining');
      noEligibleError.statusCode = 409;
      noEligibleError.name = 'ConflictError';

      doorprizeService.executeDraw.mockRejectedValue(noEligibleError);

      const res = await request(app)
        .post('/api/v1/doorprize/events/1/draw')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({ giftId: 10 });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('No eligible participants remaining');
    });
  });

  // =========================================================================
  // 5. Additional CRUD operations
  // Validates: Req 1.1, 1.2, 1.3
  // =========================================================================

  describe('Additional CRUD operations', () => {
    it('should list events with pagination', async () => {
      mockAuthAs(ADMIN_EVENT_USER);

      doorprizeService.getAllEvents.mockResolvedValue({
        data: [
          { doorprizeEventId: 1, name: 'Event A', status: 'Active' },
          { doorprizeEventId: 2, name: 'Event B', status: 'Draft' },
        ],
        pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
      });

      const res = await request(app)
        .get('/api/v1/doorprize/events')
        .set('Authorization', 'Bearer valid-admin-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
    });

    it('should get event by ID', async () => {
      mockAuthAs(ADMIN_EVENT_USER);

      doorprizeService.getEventById.mockResolvedValue({
        doorprizeEventId: 1,
        name: 'Annual Gathering 2025',
        status: 'Active',
        giftCount: 3,
        participantCount: 50,
        resultCount: 10,
      });

      const res = await request(app)
        .get('/api/v1/doorprize/events/1')
        .set('Authorization', 'Bearer valid-admin-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.event.name).toBe('Annual Gathering 2025');
    });

    it('should update a gift', async () => {
      mockAuthAs(ADMIN_EVENT_USER);

      doorprizeService.updateGift.mockResolvedValue({
        doorprizeGiftId: 10,
        name: 'MacBook Pro 16" (Updated)',
        quota: 3,
      });

      const res = await request(app)
        .put('/api/v1/doorprize/gifts/10')
        .set('Authorization', 'Bearer valid-admin-token')
        .field('name', 'MacBook Pro 16" (Updated)')
        .field('quota', '3');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.gift.name).toBe('MacBook Pro 16" (Updated)');
    });

    it('should delete a participant', async () => {
      mockAuthAs(ADMIN_EVENT_USER);

      doorprizeService.deleteParticipant.mockResolvedValue();

      const res = await request(app)
        .delete('/api/v1/doorprize/participants/5')
        .set('Authorization', 'Bearer valid-admin-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Participant deleted successfully');
    });

    it('should reset (delete) a draw result', async () => {
      mockAuthAs(ADMIN_EVENT_USER);

      doorprizeService.resetResult.mockResolvedValue();

      const res = await request(app)
        .delete('/api/v1/doorprize/results/1')
        .set('Authorization', 'Bearer valid-admin-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Draw result reset successfully');
    });

    it('should return 404 when event not found', async () => {
      mockAuthAs(ADMIN_EVENT_USER);

      doorprizeService.getEventById.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/v1/doorprize/events/999')
        .set('Authorization', 'Bearer valid-admin-token');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Doorprize event not found');
    });
  });
});
