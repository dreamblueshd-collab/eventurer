const { body, param, validationResult } = require('express-validator');
const surveyService = require('../services/surveyService');
const logger = require('../config/logger');
const { sendSuccess, sendCreated, sendError } = require('../utils/apiResponse');
const { handleControllerError, sendValidationErrors } = require('../utils/controllerError');

/**
 * Validation rules for adding a question
 */
const addQuestionValidation = [
  body('surveyId')
    .optional()
    .isInt({ min: 1 }).withMessage('Survey ID must be a positive integer')
    .toInt(),
  body('type')
    .notEmpty().withMessage('Question type is required')
    .isIn(['HeroCover', 'Text', 'MultipleChoice', 'Checkbox', 'Dropdown', 'MatrixLikert', 'Rating', 'Date', 'Signature'])
    .withMessage('Invalid question type'),
  body('promptText')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Prompt text must not exceed 500 characters'),
  body('subtitle')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('Subtitle must not exceed 200 characters'),
  body('isMandatory')
    .optional()
    .isBoolean().withMessage('isMandatory must be a boolean'),
  body('displayOrder')
    .optional()
    .isInt({ min: 0 }).withMessage('Display order must be a non-negative integer'),
  body('pageNumber')
    .optional()
    .isInt({ min: 1 }).withMessage('Page number must be a positive integer'),
  body('layoutOrientation')
    .optional()
    .isIn(['vertical', 'horizontal']).withMessage('Invalid layout orientation')
];

/**
 * Validation rules for updating a question
 */
const updateQuestionValidation = [
  param('id')
    .trim()
    .isInt({ min: 1 }).withMessage('Question ID must be a positive integer')
    .toInt(),
  body('surveyId')
    .optional()
    .isInt({ min: 1 }).withMessage('Survey ID must be a positive integer')
    .toInt(),
  body('type')
    .optional()
    .isIn(['HeroCover', 'Text', 'MultipleChoice', 'Checkbox', 'Dropdown', 'MatrixLikert', 'Rating', 'Date', 'Signature'])
    .withMessage('Invalid question type'),
  body('promptText')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Prompt text must not exceed 500 characters'),
  body('subtitle')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('Subtitle must not exceed 200 characters'),
  body('isMandatory')
    .optional()
    .isBoolean().withMessage('isMandatory must be a boolean'),
  body('displayOrder')
    .optional()
    .isInt({ min: 0 }).withMessage('Display order must be a non-negative integer'),
  body('pageNumber')
    .optional()
    .isInt({ min: 1 }).withMessage('Page number must be a positive integer'),
  body('layoutOrientation')
    .optional()
    .isIn(['vertical', 'horizontal']).withMessage('Invalid layout orientation')
];

/**
 * Validation rules for reordering questions
 */
const reorderQuestionsValidation = [
  body('surveyId')
    .isInt({ min: 1 }).withMessage('Survey ID must be a positive integer')
    .toInt(),
  body('questionOrders')
    .isArray().withMessage('Question orders must be an array')
    .notEmpty().withMessage('Question orders cannot be empty')
];

/**
 * Add a question to a survey
 * POST /api/v1/questions
 */
async function addQuestion(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendValidationErrors(res, errors);
    }

    const surveyId = req.params.surveyId || req.body.surveyId;
    const question = await surveyService.addQuestion(surveyId, req.body);

    return sendCreated(res, question, { meta: { message: 'Question added successfully' } });
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while adding question');
  }
}

/**
 * Get questions by survey
 * GET /api/v1/questions/survey/:surveyId
 */
async function getQuestionsBySurvey(req, res) {
  try {
    const surveyId = req.params.surveyId || req.body.surveyId;
    const questions = await surveyService.getQuestionsBySurvey(surveyId);

    return sendSuccess(res, questions);
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while fetching questions');
  }
}

/**
 * Update a question
 * PUT /api/v1/questions/:id
 */
async function updateQuestion(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendValidationErrors(res, errors);
    }

    const question = await surveyService.updateQuestion(req.params.id, req.body);

    return sendSuccess(res, question, { meta: { message: 'Question updated successfully' } });
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while updating question');
  }
}

/**
 * Delete a question
 * DELETE /api/v1/questions/:id
 */
async function deleteQuestion(req, res) {
  try {
    const deleted = await surveyService.deleteQuestion(req.params.id);

    if (!deleted) {
      return sendError(res, { status: 400, code: 'BAD_REQUEST', message: 'Question was not deleted' });
    }

    return sendSuccess(res, null, { meta: { message: 'Question deleted successfully' } });
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while deleting question');
  }
}

/**
 * Reorder questions in a survey
 * PATCH /api/v1/questions/reorder
 */
async function reorderQuestions(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendValidationErrors(res, errors);
    }

    const { surveyId, questionOrders } = req.body;
    const questions = await surveyService.reorderQuestions(surveyId, questionOrders);

    return sendSuccess(res, questions, { meta: { message: 'Questions reordered successfully' } });
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while reordering questions');
  }
}

/**
 * Upload question image
 * POST /api/v1/questions/:id/upload/image
 */
async function uploadQuestionImage(req, res) {
  try {
    const questionId = req.params.id;

    if (!req.file) {
      return sendError(res, { status: 400, code: 'BAD_REQUEST', message: 'Image file is required' });
    }

    const question = await surveyService.uploadQuestionImage(questionId, req.file);
    const imageUrl = question?.ImageUrl || null;

    if (!imageUrl) {
      return sendError(res, { status: 500, message: 'Image uploaded but URL could not be retrieved' });
    }

    return sendSuccess(res, { imageUrl }, { meta: { message: 'Question image uploaded successfully' } });
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while uploading image');
  }
}

/**
 * Upload option image
 * POST /api/v1/questions/:id/upload/option/:optionIndex
 */
async function uploadOptionImage(req, res) {
  try {
    const questionId = req.params.id;
    const optionIndex = parseInt(req.params.optionIndex, 10);

    if (!req.file) {
      return sendError(res, { status: 400, code: 'BAD_REQUEST', message: 'Image file is required' });
    }

    const imageUrl = await surveyService.uploadOptionImage(questionId, optionIndex, req.file);

    return sendSuccess(res, { imageUrl }, { meta: { message: 'Option image uploaded successfully' } });
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while uploading option image');
  }
}

module.exports = {
  addQuestion,
  getQuestionsBySurvey,
  updateQuestion,
  deleteQuestion,
  reorderQuestions,
  uploadQuestionImage,
  uploadOptionImage,
  addQuestionValidation,
  updateQuestionValidation,
  reorderQuestionsValidation
};
