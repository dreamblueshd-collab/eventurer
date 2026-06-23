const approvalService = require('../services/approvalService');
const { sendSuccess, sendCreated, sendError } = require('../utils/apiResponse');
const { handleControllerError } = require('../utils/controllerError');

/**
 * Map approval-service errors to the standard error envelope.
 * UnauthorizedError stays a 403 (forbidden) to preserve approval semantics;
 * everything else delegates to the shared handler (ValidationError->422,
 * NotFoundError->404, otherwise 500).
 */
function handleApprovalError(res, error, fallbackMessage) {
  if (error?.name === 'UnauthorizedError') {
    return sendError(res, { status: 403, code: 'FORBIDDEN', message: 'Akses tidak diizinkan' });
  }
  return handleControllerError(res, error, fallbackMessage);
}

/**
 * Propose takeout for question
 * POST /api/v1/approvals/propose-takeout
 */
async function proposeTakeoutForQuestion(req, res) {
  try {
    const { responseId, questionId, reason } = req.body;
    const proposedBy = req.user?.userId;

    if (!responseId || !questionId || !reason) {
      return sendError(res, { status: 422, code: 'VALIDATION_ERROR', message: 'Response ID, question ID, and reason are required' });
    }

    const result = await approvalService.proposeTakeoutForQuestion({
      responseId,
      questionId,
      reason,
      proposedBy,
      proposedByRole: req.user?.role
    });

    if (!result.success) {
      return sendError(res, { status: 400, code: 'BAD_REQUEST', message: 'Gagal mengusulkan takeout' });
    }

    return sendSuccess(res, null, { meta: { message: 'Takeout proposed successfully' } });
  } catch (error) {
    return handleApprovalError(res, error, 'An error occurred while proposing takeout');
  }
}

/**
 * Bulk propose takeout
 * POST /api/v1/approvals/bulk-propose-takeout
 */
async function bulkProposeTakeout(req, res) {
  try {
    const { responseIds, questionIds, reason } = req.body;
    const proposedBy = req.user?.userId;

    const result = await approvalService.bulkProposeTakeout(responseIds, questionIds, reason, proposedBy);

    if (!result || (Array.isArray(result.success) && result.success.length === 0 && result.failed.length > 0)) {
      return sendError(res, {
        status: 400,
        code: 'BAD_REQUEST',
        message: 'Semua item gagal diproses',
        details: result?.failed || []
      });
    }

    return sendSuccess(res, {
      count: Array.isArray(result.success) ? result.success.length : (result.count || 0),
      failed: Array.isArray(result.failed) ? result.failed : []
    }, {
      meta: { message: 'Bulk takeout proposed successfully' }
    });
  } catch (error) {
    return handleApprovalError(res, error, 'Gagal mengusulkan bulk takeout');
  }
}

/**
 * Cancel proposed takeout
 * DELETE /api/v1/approvals/propose-takeout
 */
async function cancelProposedTakeout(req, res) {
  try {
    const { responseId, questionId } = req.body;

    const result = await approvalService.cancelProposedTakeoutForQuestion(
      responseId,
      questionId,
      req.user?.userId,
      req.user?.role
    );

    if (!result.success) {
      return sendError(res, { status: 400, code: 'BAD_REQUEST', message: 'Gagal membatalkan takeout' });
    }

    return sendSuccess(res, null, { meta: { message: 'Proposed takeout cancelled successfully' } });
  } catch (error) {
    return handleApprovalError(res, error, 'An error occurred while cancelling takeout');
  }
}

/**
 * Approve proposed takeout
 * POST /api/v1/approvals/approve
 */
async function approveProposedTakeout(req, res) {
  try {
    const { responseId, questionId, reason } = req.body;
    const approvedBy = req.user?.userId;

    const result = await approvalService.approveProposedTakeout(
      responseId,
      questionId,
      approvedBy,
      reason,
      req.user?.role
    );

    if (!result.success) {
      return sendError(res, { status: 400, code: 'BAD_REQUEST', message: 'Gagal melakukan approval' });
    }

    return sendSuccess(res, null, { meta: { message: 'Takeout approved successfully' } });
  } catch (error) {
    return handleApprovalError(res, error, 'An error occurred while approving takeout');
  }
}

/**
 * Reject proposed takeout
 * POST /api/v1/approvals/reject
 */
async function rejectProposedTakeout(req, res) {
  try {
    const { responseId, questionId, reason } = req.body;
    const rejectedBy = req.user?.userId;

    if (!reason) {
      return sendError(res, { status: 422, code: 'VALIDATION_ERROR', message: 'Reason is required for rejection' });
    }

    const result = await approvalService.rejectProposedTakeout(
      responseId,
      questionId,
      rejectedBy,
      reason,
      req.user?.role
    );

    if (!result.success) {
      return sendError(res, { status: 400, code: 'BAD_REQUEST', message: 'Gagal melakukan rejection' });
    }

    return sendSuccess(res, null, { meta: { message: 'Takeout rejected successfully' } });
  } catch (error) {
    return handleApprovalError(res, error, 'An error occurred while rejecting takeout');
  }
}

/**
 * Get pending approvals for IT Lead
 * GET /api/v1/approvals/pending
 */
async function getPendingApprovals(req, res) {
  try {
    const itLeadUserId = req.user?.userId;
    const { surveyId, functionId } = req.query;
    const approvals = await approvalService.getPendingApprovalsForITLead(itLeadUserId, {
      surveyId,
      functionId
    });

    return sendSuccess(res, approvals);
  } catch (error) {
    return handleApprovalError(res, error, 'Gagal memuat pending approvals');
  }
}

/**
 * Get respondents list for admin review
 * GET /api/v1/approvals/respondents
 */
async function getRespondents(req, res) {
  try {
    const { surveyId, duplicateFilter, applicationId, departmentId } = req.query;
    if (!surveyId) {
      return sendError(res, { status: 422, code: 'VALIDATION_ERROR', message: 'Survey ID is required' });
    }

    const respondents = await approvalService.getRespondents({
      surveyId,
      duplicateFilter,
      applicationId,
      departmentId,
      requesterUserId: req.user?.userId,
      requesterRole: req.user?.role
    });

    return sendSuccess(res, respondents);
  } catch (error) {
    return handleApprovalError(res, error, 'An error occurred while fetching respondents');
  }
}

async function approveInitialResponses(req, res) {
  try {
    const { responseIds, reason } = req.body;
    const approvedBy = req.user?.userId;

    if (!Array.isArray(responseIds) || responseIds.length === 0) {
      return sendError(res, { status: 422, code: 'VALIDATION_ERROR', message: 'Minimal satu response wajib dipilih' });
    }

    const result = await approvalService.approveInitialResponses(responseIds, approvedBy, reason || null, req.user?.role);
    return sendSuccess(res, result, { meta: { message: 'Response berhasil di-approve oleh Admin Event' } });
  } catch (error) {
    return handleApprovalError(res, error, 'An error occurred while approving responses');
  }
}

async function rejectInitialResponses(req, res) {
  try {
    const { responseIds, reason } = req.body;
    const rejectedBy = req.user?.userId;

    if (!Array.isArray(responseIds) || responseIds.length === 0 || !reason) {
      return sendError(res, { status: 422, code: 'VALIDATION_ERROR', message: 'Minimal satu response dan alasan reject wajib diisi' });
    }

    const result = await approvalService.rejectInitialResponses(responseIds, rejectedBy, reason, req.user?.role);
    return sendSuccess(res, result, { meta: { message: 'Response berhasil di-reject oleh Admin Event' } });
  } catch (error) {
    return handleApprovalError(res, error, 'An error occurred while rejecting responses');
  }
}

async function approveFinalResponses(req, res) {
  try {
    const { responseIds, reason } = req.body;
    const approvedBy = req.user?.userId;

    if (!Array.isArray(responseIds) || responseIds.length === 0) {
      return sendError(res, { status: 422, code: 'VALIDATION_ERROR', message: 'Minimal satu response wajib dipilih' });
    }

    const result = await approvalService.approveFinalResponses(responseIds, approvedBy, reason || null, req.user?.role);
    return sendSuccess(res, result, { meta: { message: 'Response berhasil di-approve final oleh IT Lead' } });
  } catch (error) {
    return handleApprovalError(res, error, 'An error occurred while approving final responses');
  }
}

/**
 * Get comments list for best comment selection
 * GET /api/v1/approvals/comments
 */
async function getCommentsForSelection(req, res) {
  try {
    const { surveyId, functionId, departmentId, applicationId } = req.query;
    const comments = await approvalService.getCommentsForSelection({
      surveyId,
      functionId,
      departmentId,
      applicationId
    });

    return sendSuccess(res, comments);
  } catch (error) {
    return handleApprovalError(res, error, 'Gagal memuat daftar komentar');
  }
}

/**
 * Get proposed takeouts list
 * GET /api/v1/approvals/proposed-takeouts
 */
async function getProposedTakeouts(req, res) {
  try {
    const { surveyId, functionId, applicationId, departmentId, status } = req.query;
    const takeouts = await approvalService.getProposedTakeouts({
      surveyId,
      functionId,
      applicationId,
      departmentId,
      status,
      requesterUserId: req.user?.userId,
      requesterRole: req.user?.role
    });

    return sendSuccess(res, takeouts);
  } catch (error) {
    return handleApprovalError(res, error, 'An error occurred while fetching proposed takeouts');
  }
}

/**
 * Mark as best comment
 * POST /api/v1/approvals/best-comments
 */
async function markAsBestComment(req, res) {
  try {
    const { responseId, questionId } = req.body;

    if (!responseId || !questionId) {
      return sendError(res, { status: 422, code: 'VALIDATION_ERROR', message: 'Response ID dan Question ID wajib diisi' });
    }

    const result = await approvalService.markAsBestComment(
      responseId,
      questionId,
      req.user?.userId
    );

    if (!result.success) {
      return sendError(res, { status: 400, code: 'BAD_REQUEST', message: 'Gagal menyimpan best comment' });
    }

    return sendSuccess(res, null, { meta: { message: 'Best comment berhasil disimpan' } });
  } catch (error) {
    return handleApprovalError(res, error, 'Gagal menyimpan best comment');
  }
}

/**
 * Unmark best comment
 * DELETE /api/v1/approvals/best-comments
 */
async function unmarkBestComment(req, res) {
  try {
    const { responseId, questionId } = req.body;

    if (!responseId || !questionId) {
      return sendError(res, { status: 422, code: 'VALIDATION_ERROR', message: 'Response ID dan Question ID wajib diisi' });
    }

    const result = await approvalService.unmarkBestComment(
      responseId,
      questionId,
      req.user?.userId
    );

    if (!result.success) {
      return sendError(res, { status: 400, code: 'BAD_REQUEST', message: 'Gagal menghapus best comment' });
    }

    return sendSuccess(res, null, { meta: { message: 'Best comment berhasil dihapus' } });
  } catch (error) {
    return handleApprovalError(res, error, 'Gagal menghapus best comment');
  }
}

/**
 * Get best comments
 * GET /api/v1/approvals/best-comments
 */
async function getBestComments(req, res) {
  try {
    const { surveyId, functionId } = req.query;

    const filter = {};
    if (surveyId) filter.surveyId = surveyId;
    if (functionId) filter.functionId = functionId;

    const comments = await approvalService.getBestComments(filter);

    return sendSuccess(res, comments);
  } catch (error) {
    return handleApprovalError(res, error, 'Gagal memuat best comments');
  }
}

/**
 * Submit best comment feedback
 * POST /api/v1/approvals/best-comments/feedback
 */
async function submitBestCommentFeedback(req, res) {
  try {
    const { responseId, questionId, questionResponseId, feedbackText } = req.body;
    const itLeadUserId = req.user?.userId;

    if (!feedbackText || !String(feedbackText).trim()) {
      return sendError(res, { status: 422, code: 'VALIDATION_ERROR', message: 'Teks feedback wajib diisi' });
    }

    const feedback = {
      questionResponseId,
      responseId,
      questionId,
      itLeadUserId,
      feedbackText
    };

    const result = await approvalService.submitBestCommentFeedback(feedback);

    if (!result.success) {
      return sendError(res, { status: 400, code: 'BAD_REQUEST', message: 'Gagal mengirim feedback' });
    }

    return sendCreated(res, result, { meta: { message: 'Feedback berhasil dikirim' } });
  } catch (error) {
    return handleApprovalError(res, error, 'Gagal mengirim feedback best comment');
  }
}

/**
 * Get best comments with IT Lead feedback
 * GET /api/v1/approvals/best-comments-with-feedback
 */
async function getBestCommentsWithFeedback(req, res) {
  try {
    const { surveyId, functionId, departmentId } = req.query;
    const comments = await approvalService.getBestCommentsWithFeedback({
      surveyId,
      functionId,
      departmentId
    });

    return sendSuccess(res, comments);
  } catch (error) {
    return handleApprovalError(res, error, 'Gagal memuat best comments dengan feedback');
  }
}

/**
 * Get approval statistics
 * GET /api/v1/approvals/statistics/:surveyId
 */
async function getApprovalStatistics(req, res) {
  try {
    const statistics = await approvalService.getApprovalStatistics(req.params.surveyId);

    return sendSuccess(res, statistics);
  } catch (error) {
    return handleApprovalError(res, error, 'Gagal memuat statistik approval');
  }
}

module.exports = {
  proposeTakeoutForQuestion,
  bulkProposeTakeout,
  cancelProposedTakeout,
  approveProposedTakeout,
  rejectProposedTakeout,
  getPendingApprovals,
  getRespondents,
  approveInitialResponses,
  rejectInitialResponses,
  approveFinalResponses,
  getProposedTakeouts,
  getCommentsForSelection,
  markAsBestComment,
  unmarkBestComment,
  getBestComments,
  getBestCommentsWithFeedback,
  submitBestCommentFeedback,
  getApprovalStatistics
};
