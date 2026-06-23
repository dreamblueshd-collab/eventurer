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
// Tests (standard API envelope)
// ---------------------------------------------------------------------------

describe('doorprizeController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // Input validation tests -> standardized 422 VALIDATION_ERROR
  // =========================================================================

  describe('createDoorprizeEvent - validation', () => {
    it('should return 422 VALIDATION_ERROR when name is missing', async () => {
      mockValidationFail([
        { path: 'name', msg: 'Name is required', location: 'body' },
      ]);

      const req = {
        body: { eventDate: '2025-01-01T00:00:00Z' },
        user: { userId: 1, role: 'AdminEvent' },
      };
      const res = createResponse();

      await doorprizeController.createDoorprizeEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
        })
      );
      expect(doorprizeService.createEvent).not.toHaveBeenCalled();
    });

    it('should return 422 when eventDate is missing', async () => {
      mockValidationFail([
        { path: 'eventDate', msg: 'Event date is required', location: 'body' },
      ]);

      const req = {
        body: { name: 'Test Event' },
        user: { userId: 1, role: 'AdminEvent' },
      };
      const res = createResponse();

      await doorprizeController.createDoorprizeEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
        })
      );
      expect(doorprizeService.createEvent).not.toHaveBeenCalled();
    });
  });

  describe('createGift - validation', () => {
    it('should return 422 when quota is zero or negative', async () => {
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

      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
        })
      );
      expect(doorprizeService.createGift).not.toHaveBeenCalled();
    });

    it('should return 422 when gift name is missing', async () => {
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

      expect(res.status).toHaveBeenCalledWith(422);
      expect(doorprizeService.createGift).not.toHaveBeenCalled();
    });
  });

  describe('createParticipant - validation', () => {
    it('should return 422 when participant name is missing', async () => {
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

      expect(res.status).toHaveBeenCalledWith(422);
      expect(doorprizeService.createParticipant).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Permission enforcement tests (middleware-level) - unchanged
  // =========================================================================

  describe('permission enforcement (middleware behaviour)', () => {
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
  // Draw error response tests -> standardized error envelope
  // =========================================================================

  describe('executeDraw - error responses', () => {
    it('should map a 409 business error to CONFLICT envelope', async () => {
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
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: { code: 'CONFLICT', message: 'Gift quota exhausted' },
      });
    });

    it('should return 422 when giftId is missing from draw request', async () => {
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

      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
        })
      );
      expect(doorprizeService.executeDraw).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Happy-path sanity tests (ensures delegation + envelope)
  // =========================================================================

  describe('createDoorprizeEvent - success', () => {
    it('should delegate to service and return 201 with data envelope', async () => {
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
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: createdEvent,
        meta: { message: 'Doorprize event created successfully' },
      });
    });
  });

  describe('executeDraw - success', () => {
    it('should delegate to service and return 201 with draw result under data', async () => {
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
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: drawResult,
        meta: { message: 'Draw executed successfully' },
      });
    });
  });

  describe('getDoorprizeEvents - success', () => {
    it('returns the service result object under data', async () => {
      const result = { events: [{ doorprizeEventId: 1 }], pagination: { page: 1, total: 1 } };
      doorprizeService.getAllEvents.mockResolvedValue(result);

      const req = { query: {} };
      const res = createResponse();

      await doorprizeController.getDoorprizeEvents(req, res);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: result });
    });
  });

  // =========================================================================
  // Internal server error (unhandled) tests
  // =========================================================================

  describe('error handling - generic errors', () => {
    it('should return 500 INTERNAL_ERROR for unexpected errors without statusCode', async () => {
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
          error: expect.objectContaining({ code: 'INTERNAL_ERROR' }),
        })
      );
    });
  });
});
