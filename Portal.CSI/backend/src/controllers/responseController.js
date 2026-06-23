const { body, validationResult } = require('express-validator');
const responseService = require('../services/responseService');
const { getIpAddress } = require('../utils/auditHelpers');
const logger = require('../config/logger');
const { sendSuccess, sendCreated, sendError } = require('../utils/apiResponse');
const { handleControllerError, sendValidationErrors } = require('../utils/controllerError');

// Accept both numeric IDs and slugs (e.g. "survey-corp-it-bpm-2026")
const surveyIdentifierPattern = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

/**
 * Validation rules for submitting a response
 */
const submitResponseValidation = [
  body('surveyId')
    .notEmpty().withMessage('Survey ID is required')
    .matches(surveyIdentifierPattern).withMessage('Survey ID must be a positive integer'),
  body('respondent.email')
    .optional({ values: 'falsy' })
    .isEmail().withMessage('Invalid email format'),
  body('respondent.name')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ min: 1, max: 200 }).withMessage('Name must be between 1 and 200 characters'),
  body('respondent.businessUnitId')
    .optional({ values: 'falsy' })
    .custom((v) => /^\d+$/.test(String(v)))
    .withMessage('Business Unit ID must be a positive integer'),
  body('respondent.divisionId')
    .optional({ values: 'falsy' })
    .custom((v) => /^\d+$/.test(String(v)))
    .withMessage('Division ID must be a positive integer'),
  body('respondent.departmentId')
    .optional({ values: 'falsy' })
    .custom((v) => /^\d+$/.test(String(v)))
    .withMessage('Department ID must be a positive integer'),
  body('selectedApplicationIds')
    .isArray().withMessage('Selected applications must be an array')
    .notEmpty().withMessage('At least one application must be selected')
    .custom((ids) => ids.every((id) => typeof id === 'number' || /^[0-9]+$/.test(String(id))))
    .withMessage('Each selected application ID must be a positive integer'),
  body('responses')
    .isArray().withMessage('Responses must be an array')
    .notEmpty().withMessage('At least one response is required')
];

/**
 * Get survey form
 * GET /api/v1/responses/survey/:surveyId/form
 */
async function getSurveyForm(req, res) {
  try {
    const form = await responseService.getSurveyForm(req.params.surveyId);

    if (!form) {
      return sendError(res, { status: 404, code: 'NOT_FOUND', message: 'Survey not found or not active' });
    }

    return sendSuccess(res, form);
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while fetching survey form');
  }
}

/**
 * Get available applications for a survey
 * GET /api/v1/responses/survey/:surveyId/applications?departmentId=1
 */
async function getAvailableApplications(req, res) {
  try {
    const surveyId = req.params.surveyId;
    const departmentId = req.query.departmentId;
    const functionId = req.query.functionId;

    const applications = await responseService.getAvailableApplications(surveyId, departmentId, functionId);

    return sendSuccess(res, applications);
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while fetching applications');
  }
}

/**
 * Submit survey response
 * POST /api/v1/responses
 */
async function submitResponse(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendValidationErrors(res, errors);
    }

    const responseData = {
      ...req.body,
      ipAddress: getIpAddress(req)
    };

    const result = await responseService.submitResponse(responseData);

    if (!result.success) {
      return sendError(res, { status: 400, code: 'BAD_REQUEST', message: result.errorMessage });
    }

    return sendCreated(res, { responseIds: result.responseIds }, { meta: { message: 'Response submitted successfully' } });
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while submitting response');
  }
}

/**
 * Check for duplicate response
 * POST /api/v1/responses/check-duplicate
 */
async function checkDuplicateResponse(req, res) {
  try {
    const { surveyId, email, applicationId, applicationIds } = req.body;
    const normalizedApplicationIds = Array.isArray(applicationIds)
      ? applicationIds.filter(Boolean)
      : (applicationId ? [applicationId] : []);

    if (!surveyId || normalizedApplicationIds.length === 0) {
      return sendError(res, { status: 422, code: 'VALIDATION_ERROR', message: 'Survey ID and application ID are required' });
    }

    if (!String(email || '').trim()) {
      return sendSuccess(res, { isDuplicate: false }, { meta: { message: 'Duplicate check skipped because no email was provided' } });
    }

    let duplicateFound = false;
    for (const appId of normalizedApplicationIds) {
      // eslint-disable-next-line no-await-in-loop
      const isDuplicate = await responseService.checkDuplicateResponse(surveyId, email, appId);
      if (isDuplicate) {
        duplicateFound = true;
        break;
      }
    }

    return sendSuccess(res, { isDuplicate: duplicateFound }, {
      meta: { message: duplicateFound ? 'Duplicate response found for one or more applications' : 'No duplicate response' }
    });
  } catch (error) {
    logger.error('Check duplicate response controller error:', error);
    return sendError(res, { status: 500, message: 'An error occurred while checking for duplicates' });
  }
}

/**
 * Get responses with filters
 * GET /api/v1/responses
 */
async function getResponses(req, res) {
  try {
    const { surveyId, departmentId, applicationId, status, search } = req.query;

    const filter = {};
    if (surveyId) filter.surveyId = String(surveyId).trim();
    if (departmentId) filter.departmentId = String(departmentId).trim();
    if (applicationId) filter.applicationId = String(applicationId).trim();
    if (status) filter.status = status;
    if (search) filter.search = search;

    const responses = await responseService.getResponses(filter);

    return sendSuccess(res, responses);
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while fetching responses');
  }
}

/**
 * Get response by ID
 * GET /api/v1/responses/:id
 */
async function getResponseById(req, res) {
  try {
    const responseId = String(req.params.id || '').trim();
    const response = await responseService.getResponseById(responseId);

    if (!response) {
      return sendError(res, { status: 404, code: 'NOT_FOUND', message: 'Response not found' });
    }

    return sendSuccess(res, response);
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while fetching response');
  }
}

/**
 * Get response statistics
 * GET /api/v1/responses/survey/:surveyId/statistics
 */
async function getResponseStatistics(req, res) {
  try {
    const statistics = await responseService.getResponseStatistics(req.params.surveyId);

    return sendSuccess(res, statistics);
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while fetching statistics');
  }
}

module.exports = {
  getSurveyForm,
  getAvailableApplications,
  submitResponse,
  checkDuplicateResponse,
  getResponses,
  getResponseById,
  getResponseStatistics,
  submitResponseValidation
};
