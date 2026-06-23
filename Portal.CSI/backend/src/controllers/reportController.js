const reportService = require('../services/reportService');
const logger = require('../config/logger');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { handleControllerError } = require('../utils/controllerError');

function buildExportFilename(title, extension) {
  const normalized = String(title || 'report')
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  const safeName = normalized || 'report';
  return `report-${safeName}.${extension}`;
}

/**
 * Map report-service errors to the standard error envelope.
 * UnauthorizedError stays 403 (access denied); ValidationError->422, NotFound->404.
 * The user-facing message uses the provided fallback (no raw detail leakage).
 */
function handleReportError(error, res, fallbackMessage) {
  const name = String(error?.name || '');
  if (name === 'ValidationError') {
    return sendError(res, { status: 422, code: 'VALIDATION_ERROR', message: fallbackMessage });
  }
  if (name === 'NotFoundError') {
    return sendError(res, { status: 404, code: 'NOT_FOUND', message: fallbackMessage });
  }
  if (name === 'UnauthorizedError') {
    return sendError(res, { status: 403, code: 'FORBIDDEN', message: fallbackMessage });
  }
  return sendError(res, { status: 500, message: fallbackMessage });
}

/**
 * Generate report
 * POST /api/v1/reports/generate
 */
async function generateReport(req, res) {
  try {
    const request = { ...req.body, userId: req.user?.userId, userRole: req.user?.role };
    const report = await reportService.generateReport(request);

    return sendSuccess(res, report);
  } catch (error) {
    logger.error('Generate report controller error:', error);
    return handleReportError(error, res, 'An error occurred while generating report');
  }
}

/**
 * View generated report
 * POST /api/v1/reports/view
 */
async function viewReport(req, res) {
  try {
    const request = { ...req.body, userId: req.user?.userId, userRole: req.user?.role };
    const report = await reportService.viewReport(request);

    return sendSuccess(res, report);
  } catch (error) {
    logger.error('View report controller error:', error);
    return handleReportError(error, res, 'An error occurred while fetching report');
  }
}

/**
 * Generate before takeout report
 * POST /api/v1/reports/before-takeout
 */
async function generateBeforeTakeoutReport(req, res) {
  try {
    const request = { ...req.body, userId: req.user?.userId, userRole: req.user?.role };
    const report = await reportService.generateBeforeTakeoutReport(request);

    return sendSuccess(res, report);
  } catch (error) {
    logger.error('Generate before takeout report controller error:', error);
    return handleReportError(error, res, 'An error occurred while generating report');
  }
}

/**
 * Generate after takeout report
 * POST /api/v1/reports/after-takeout
 */
async function generateAfterTakeoutReport(req, res) {
  try {
    const request = { ...req.body, userId: req.user?.userId, userRole: req.user?.role };
    const report = await reportService.generateAfterTakeoutReport(request);

    return sendSuccess(res, report);
  } catch (error) {
    logger.error('Generate after takeout report controller error:', error);
    return handleReportError(error, res, 'An error occurred while generating report');
  }
}

/**
 * Get report selection list
 * GET /api/v1/reports/selection-list
 */
async function getReportSelectionList(req, res) {
  try {
    const list = await reportService.getReportSelectionList({
      userId: req.user?.userId,
      userRole: req.user?.role,
    });

    return sendSuccess(res, list);
  } catch (error) {
    return handleControllerError(res, error, 'Gagal memuat report selection list');
  }
}

/**
 * Get takeout comparison table
 * GET /api/v1/reports/takeout-comparison/:surveyId
 */
async function getTakeoutComparisonTable(req, res) {
  try {
    const surveyId = String(req.params.surveyId || '').trim();
    const { functionId } = req.query;

    const comparison = await reportService.getTakeoutComparisonTable(
      surveyId,
      functionId ? String(functionId) : null
    );

    return sendSuccess(res, comparison);
  } catch (error) {
    return handleControllerError(res, error, 'Gagal memuat comparison');
  }
}

/**
 * Get Department Head review
 * GET /api/v1/reports/department-head-review/:departmentId/:surveyId
 */
async function getDepartmentHeadReview(req, res) {
  try {
    const departmentId = String(req.params.departmentId || '').trim();
    const surveyId = String(req.params.surveyId || '').trim();

    const review = await reportService.getDepartmentHeadReview(departmentId, surveyId);

    return sendSuccess(res, review);
  } catch (error) {
    return handleControllerError(res, error, 'Gagal memuat review');
  }
}

/**
 * Get scores by function
 * GET /api/v1/reports/scores-by-function/:departmentId/:surveyId
 */
async function getScoresByFunction(req, res) {
  try {
    const departmentId = String(req.params.departmentId || '').trim();
    const surveyId = String(req.params.surveyId || '').trim();

    const scores = await reportService.getScoresByFunction(departmentId, surveyId);

    return sendSuccess(res, scores);
  } catch (error) {
    return handleControllerError(res, error, 'Gagal memuat scores');
  }
}

/**
 * Get approved takeouts
 * GET /api/v1/reports/approved-takeouts/:departmentId/:surveyId
 */
async function getApprovedTakeouts(req, res) {
  try {
    const departmentId = String(req.params.departmentId || '').trim();
    const surveyId = String(req.params.surveyId || '').trim();

    const takeouts = await reportService.getApprovedTakeouts(departmentId, surveyId);

    return sendSuccess(res, takeouts);
  } catch (error) {
    return handleControllerError(res, error, 'Gagal memuat takeouts');
  }
}

/**
 * Export report to Excel
 * POST /api/v1/reports/export/excel
 */
async function exportToExcel(req, res) {
  try {
    const request = { ...req.body, userId: req.user?.userId, userRole: req.user?.role };
    const buffer = await reportService.exportToExcel(request);
    const report = await reportService.viewReport(request);
    const filename = buildExportFilename(report?.survey?.title, 'xlsx');

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    logger.error('Export to Excel controller error:', error);
    return handleReportError(error, res, 'An error occurred while exporting to Excel');
  }
}

/**
 * Export report to PDF
 * POST /api/v1/reports/export/pdf
 */
async function exportToPdf(req, res) {
  try {
    const request = { ...req.body, userId: req.user?.userId, userRole: req.user?.role };
    const buffer = await reportService.exportToPdf(request);
    const report = await reportService.viewReport(request);
    const filename = buildExportFilename(report?.survey?.title, 'pdf');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    logger.error('Export to PDF controller error:', error);
    return handleReportError(error, res, 'An error occurred while exporting to PDF');
  }
}

/**
 * Get aggregate statistics
 * POST /api/v1/reports/statistics
 */
async function getAggregateStatistics(req, res) {
  try {
    const statistics = await reportService.getAggregateStatistics(req.body);

    return sendSuccess(res, statistics);
  } catch (error) {
    return handleControllerError(res, error, 'An error occurred while fetching statistics');
  }
}

module.exports = {
  generateReport,
  viewReport,
  generateBeforeTakeoutReport,
  generateAfterTakeoutReport,
  getReportSelectionList,
  getTakeoutComparisonTable,
  getDepartmentHeadReview,
  getScoresByFunction,
  getApprovedTakeouts,
  exportToExcel,
  exportToPdf,
  getAggregateStatistics
};
