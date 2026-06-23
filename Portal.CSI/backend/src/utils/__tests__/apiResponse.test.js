const {
  defaultErrorCode,
  sendSuccess,
  sendCreated,
  sendPaginated,
  sendError
} = require('../apiResponse');

function createRes() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

describe('apiResponse envelope helpers', () => {
  describe('sendSuccess', () => {
    it('wraps payload as { success:true, data } with default 200', () => {
      const res = createRes();
      sendSuccess(res, { id: 1 });
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ success: true, data: { id: 1 } });
    });

    it('includes meta when provided and honors custom status', () => {
      const res = createRes();
      sendSuccess(res, [1, 2], { status: 207, meta: { count: 2 } });
      expect(res.statusCode).toBe(207);
      expect(res.body).toEqual({ success: true, data: [1, 2], meta: { count: 2 } });
    });

    it('defaults data to null', () => {
      const res = createRes();
      sendSuccess(res);
      expect(res.body).toEqual({ success: true, data: null });
    });
  });

  describe('sendCreated', () => {
    it('returns 201 with the data envelope', () => {
      const res = createRes();
      sendCreated(res, { id: 9 }, { meta: { message: 'created' } });
      expect(res.statusCode).toBe(201);
      expect(res.body).toEqual({ success: true, data: { id: 9 }, meta: { message: 'created' } });
    });
  });

  describe('sendPaginated', () => {
    it('computes totalPages and nests pagination under meta', () => {
      const res = createRes();
      sendPaginated(res, [{ id: 1 }], { page: 2, pageSize: 10, total: 25 });
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: [{ id: 1 }],
        meta: { pagination: { page: 2, pageSize: 10, total: 25, totalPages: 3 } }
      });
    });
  });

  describe('sendError', () => {
    it('produces { success:false, error:{ code, message } }', () => {
      const res = createRes();
      sendError(res, { status: 404, code: 'NOT_FOUND', message: 'missing' });
      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({ success: false, error: { code: 'NOT_FOUND', message: 'missing' } });
    });

    it('derives code from status and includes details when present', () => {
      const res = createRes();
      sendError(res, { status: 422, message: 'bad', details: [{ field: 'name' }] });
      expect(res.body).toEqual({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'bad', details: [{ field: 'name' }] }
      });
    });

    it('defaults to 500 / INTERNAL_ERROR', () => {
      const res = createRes();
      sendError(res, {});
      expect(res.statusCode).toBe(500);
      expect(res.body.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('defaultErrorCode', () => {
    it('maps known statuses and falls back sensibly', () => {
      expect(defaultErrorCode(400)).toBe('BAD_REQUEST');
      expect(defaultErrorCode(409)).toBe('CONFLICT');
      expect(defaultErrorCode(503)).toBe('SERVICE_UNAVAILABLE');
      expect(defaultErrorCode(418)).toBe('ERROR');
      expect(defaultErrorCode(599)).toBe('INTERNAL_ERROR');
    });
  });
});
