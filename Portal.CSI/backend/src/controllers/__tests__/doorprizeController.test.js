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
}));

// Mock express-validator's validationResult
jest.mock('express-validator', () => {
  const actual = jest.requireActual('express-validator');
  return {
    ...actual,
    validationResult: jest.fn(),
  };
});

const { validationResult } = require('express-validator');
const doorprizeService = require('../../services/doorprizeService');
const doorprizeController = require('../doorprizeController');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn(),
    send: jest.fn(),
  };
}

function mockValidationPass() {
  validationResult.mockReturnValue({
    isEmpty: () => true,
    array: () => [],
  });
}

function mockValidationFail(errors) {
  validationResult.mockReturnValue({
    isEmpty: () => false,
    array: () => errors,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('doorprizeController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // Input validation tests
  // =========================================================================

  describe('createDoorprizeEvent - validation', () => {
    it('should return 400 when name is missing', async () => {
      mockValidationFail([
        { path: 'name', msg: 'Name is required', location: 'body' },
      ]);

      const req = {
        body: { eventDate: '2025-01-01T00:00:00Z' },
        user: { userId: 1, role: 'AdminEvent' },
      };
      const res = createResponse();

      await doorprizeController.createDoorprizeEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Validation failed',
        })
      );
      expect(doorprizeService.createEvent).not.toHaveBeenCalled();
    });

    it('should return 400 when eventDate is missing', async () => {
      mockValidationFail([
        { path: 'eventDate', msg: 'Event date is required', location: 'body' },
      ]);

      const req = {
        body: { name: 'Test Event' },
        user: { userId: 1, role: 'AdminEvent' },
      };
      const res = createResponse();

      await doorprizeController.createDoorprizeEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Validation failed',
        })
      );
      expect(doorprizeService.createEvent).not.toHaveBeenCalled();
    });
  });

  describe('createGift - validation', () => {
    it('should return 400 when quota is zero or negative', async () => {
      mockValidationFail([
        { path: 'quota', msg: 'Quota must be a positive integer greater than 0', location: 'body' },
      ]);

      const req = {
        params: { id: '1' },
        body: { name: 'Gift A', quota: 0 },
        user: { userId: 1, role: 'AdminEvent' },
      };
      const res = createResponse();

      await doorprizeController.createGift(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Validation failed',
        })
      );
      expect(doorprizeService.createGift).not.toHaveBeenCalled();
    });

    it('should return 400 when gift name is missing', async () => {
      mockValidationFail([
        { path: 'name', msg: 'Name is required', location: 'body' },
      ]);

      const req = {
        params: { id: '1' },
        body: { quota: 5 },
        user: { userId: 1, role: 'AdminEvent' },
      };
      const res = createResponse();

      await doorprizeController.createGift(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Validation failed',
        })
      );
      expect(doorprizeService.createGift).not.toHaveBeenCalled();
    });
  });

  describe('createParticipant - validation', () => {
    it('should return 400 when participant name is missing', async () => {
      mockValidationFail([
        { path: 'name', msg: 'Name is required', location: 'body' },
      ]);

      const req = {
        params: { id: '1' },
        body: { employeeCode: 'EMP001' },
        user: { userId: 1, role: 'AdminEvent' },
      };
      const res = createResponse();

      await doorprizeController.createParticipant(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Validation failed',
        })
      );
      expect(doorprizeService.createParticipant).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Permission enforcement tests (middleware-level, tested via requirePermission)
  // Note: Permission is enforced by the middleware before the handler runs.
  // These tests verify the middleware behaviour would return 403.
  // =========================================================================

  describe('permission enforcement (middleware behaviour)', () => {
    // The requirePermission middleware checks req.user.role against allowed roles.
    // We simulate what the middleware does by calling it directly.
    const { requirePermission } = require('../../middleware/authMiddleware');

    it('should return 403 when non-AdminEvent user accesses doorprize:create', () => {
      const middleware = requirePermission('doorprize:create');

      const req = {
        user: { userId: 99, username: 'viewer', role: 'DepartmentHead' },
      };
      const res = createResponse();
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'UnauthorizedAccess',
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 when ITLead tries to execute a draw', () => {
      const middleware = requirePermission('doorprize:draw');

      const req = {
        user: { userId: 5, username: 'itlead', role: 'ITLead' },
      };
      const res = createResponse();
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'UnauthorizedAccess',
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow AdminEvent to access doorprize:draw', () => {
      const middleware = requirePermission('doorprize:draw');

      const req = {
        user: { userId: 1, username: 'admin', role: 'AdminEvent' },
      };
      const res = createResponse();
      const next = jest.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Draw error response tests
  // =========================================================================

  describe('executeDraw - error responses', () => {
    it('should return error when gift quota is exhausted', async () => {
      mockValidationPass();

      const error = new Error('Gift quota exhausted');
      error.statusCode = 409;
      error.name = 'BusinessError';
      doorprizeService.executeDraw.mockRejectedValue(error);

      const req = {
        params: { id: '1' },
        body: { giftId: 10 },
        user: { userId: 1, role: 'AdminEvent' },
      };
      const res = createResponse();

      await doorprizeController.executeDraw(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Gift quota exhausted',
        })
      );
    });

    it('should return error when no eligible participants remain', async () => {
      mockValidationPass();

      const error = new Error('No eligible participants remaining');
      error.statusCode = 409;
      error.name = 'BusinessError';
      doorprizeService.executeDraw.mockRejectedValue(error);

      const req = {
        params: { id: '1' },
        body: { giftId: 10 },
        user: { userId: 1, role: 'AdminEvent' },
      };
      const res = createResponse();

      await doorprizeController.executeDraw(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'No eligible participants remaining',
        })
      );
    });

    it('should return 400 when giftId is missing from draw request', async () => {
      mockValidationFail([
        { path: 'giftId', msg: 'Gift ID is required', location: 'body' },
      ]);

      const req = {
        params: { id: '1' },
        body: {},
        user: { userId: 1, role: 'AdminEvent' },
      };
      const res = createResponse();

      await doorprizeController.executeDraw(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Validation failed',
        })
      );
      expect(doorprizeService.executeDraw).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Happy-path sanity tests (ensures delegation works)
  // =========================================================================

  describe('createDoorprizeEvent - success', () => {
    it('should delegate to service and return 201 on valid input', async () => {
      mockValidationPass();

      const createdEvent = { doorprizeEventId: 1, name: 'Annual Draw', status: 'Draft' };
      doorprizeService.createEvent.mockResolvedValue(createdEvent);

      const req = {
        body: { name: 'Annual Draw', eventDate: '2025-06-01T10:00:00Z' },
        user: { userId: 1 },
        file: undefined,
      };
      const res = createResponse();

      await doorprizeController.createDoorprizeEvent(req, res);

      expect(doorprizeService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Annual Draw',
          eventDate: '2025-06-01T10:00:00Z',
          status: 'Draft',
          imagePath: null,
          createdBy: 1,
        })
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          event: createdEvent,
        })
      );
    });
  });

  describe('executeDraw - success', () => {
    it('should delegate to service and return 201 with draw result', async () => {
      mockValidationPass();

      const drawResult = {
        result: { doorprizeResultId: 1 },
        winner: { doorprizeParticipantId: 5, name: 'John' },
        gift: { doorprizeGiftId: 10, name: 'Laptop' },
      };
      doorprizeService.executeDraw.mockResolvedValue(drawResult);

      const req = {
        params: { id: '1' },
        body: { giftId: 10 },
        user: { userId: 1 },
      };
      const res = createResponse();

      await doorprizeController.executeDraw(req, res);

      expect(doorprizeService.executeDraw).toHaveBeenCalledWith('1', 10, 1);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Draw executed successfully',
        })
      );
    });
  });

  // =========================================================================
  // Internal server error (unhandled) tests
  // =========================================================================

  describe('error handling - generic errors', () => {
    it('should return 500 for unexpected errors without statusCode', async () => {
      mockValidationPass();

      doorprizeService.executeDraw.mockRejectedValue(new Error('DB connection lost'));

      const req = {
        params: { id: '1' },
        body: { giftId: 10 },
        user: { userId: 1, role: 'AdminEvent' },
      };
      const res = createResponse();

      await doorprizeController.executeDraw(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Internal server error',
        })
      );
    });
  });
});
