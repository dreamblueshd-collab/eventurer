const { body, param, query, validationResult } = require('express-validator');
const approvalService = require('../services/approvalService');
const logger = require('../config/logger');

function handleApprovalError(res, error, fallbackMessage) {
  if (error?.name === 'ValidationError' || error?.name === 'NotFoundError') {
    return res.status(400).json({
      error: 'Validation failed',
      message: fallbackMessage
    });
  }

  if (error?.name === 'UnauthorizedError') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Akses tidak diizinkan'
    });
  }

  logger.error(fallbackMessage, error);
  return res.status(500).json({
    error: 'Internal server error',
    message: fallbackMessage
  });
}

/**
 * Propose takeout for question
 * POST /api/v1/approvals/propose-takeout
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function proposeTakeoutForQuestion(req, res) {
  try {
    const { responseId, questionId, reason } = req.body;
    const proposedBy = req.user?.userId;

    if (!responseId || !questionId || !reason) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Response ID, question ID, and reason are required'
      });
    }

    const result = await approvalService.proposeTakeoutForQuestion({
      responseId,
      questionId,
      reason,
      proposedBy,
      proposedByRole: req.user?.role
    });

    if (!result.success) {
      return res.status(400).json({
        error: 'Propose takeout failed',
        message: 'Gagal mengusulkan takeout'
      });
    }

    res.json({
      success: true,
      message: 'Takeout proposed successfully'
    });

  } catch (error) {
    return handleApprovalError(res, error, 'An error occurred while proposing takeout');
  }
}

/**
 * Bulk propose takeout
 * POST /api/v1/approvals/bulk-propose-takeout
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function bulkProposeTakeout(req, res) {
  try {
    const { responseIds, questionIds, reason } = req.body;
    const proposedBy = req.user?.userId;

    const result = await approvalService.bulkProposeTakeout(responseIds, questionIds, reason, proposedBy);

    if (!result || (Array.isArray(result.success) && result.success.length === 0 && result.failed.length > 0)) {
      return res.status(400).json({
        error: 'Bulk propose takeout failed',
        message: 'Semua item gagal diproses',
        failed: result?.failed || []
      });
    }

    res.json({
      success: true,
      message: 'Bulk takeout proposed successfully',
      count: Array.isArray(result.success) ? result.success.length : (result.count || 0),
      failed: Array.isArray(result.failed) ? result.failed : []
    });

  } catch (error) {
    return handleApprovalError(res, error, 'Gagal mengusulkan bulk takeout');
  }
}

/**
 * Cancel proposed takeout
 * DELETE /api/v1/approvals/propose-takeout
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
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
      return res.status(400).json({
        error: 'Cancel takeout failed',
        message: 'Gagal membatalkan takeout'
      });
    }

    res.json({
      success: true,
      message: 'Proposed takeout cancelled successfully'
    });

  } catch (error) {
    return handleApprovalError(res, error, 'An error occurred while cancelling takeout');
  }
}

/**
 * Approve proposed takeout
 * POST /api/v1/approvals/approve
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
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
      return res.status(400).json({
        error: 'Approval failed',
        message: 'Gagal melakukan approval'
      });
    }

    res.json({
      success: true,
      message: 'Takeout approved successfully'
    });

  } catch (error) {
    return handleApprovalError(res, error, 'An error occurred while approving takeout');
  }
}

/**
 * Reject proposed takeout
 * POST /api/v1/approvals/reject
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function rejectProposedTakeout(req, res) {
  try {
    const { responseId, questionId, reason } = req.body;
    const rejectedBy = req.user?.userId;

    if (!reason) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Reason is required for rejection'
      });
    }

    const result = await approvalService.rejectProposedTakeout(
      responseId,
      questionId,
      rejectedBy,
      reason,
      req.user?.role
    );

    if (!result.success) {
      return res.status(400).json({
        error: 'Rejection failed',
        message: 'Gagal melakukan rejection'
      });
    }

    res.json({
      success: true,
      message: 'Takeout rejected successfully'
    });

  } catch (error) {
    return handleApprovalError(res, error, 'An error occurred while rejecting takeout');
  }
}

/**
 * Get pending approvals for IT Lead
 * GET /api/v1/approvals/pending
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getPendingApprovals(req, res) {
  try {
    const itLeadUserId = req.user?.userId;
    const { surveyId, functionId } = req.query;
    const approvals = await approvalService.getPendingApprovalsForITLead(itLeadUserId, {
      surveyId,
      functionId
    });

    res.json({
      success: true,
      approvals
    });

  } catch (error) {
    return handleApprovalError(res, error, 'Gagal memuat pending approvals');
  }
}

/**
 * Get respondents list for admin review
 * GET /api/v1/approvals/respondents
 * @param {Object} req
 * @param {Object} res
 */
async function getRespondents(req, res) {
  try {
    const { surveyId, duplicateFilter, applicationId, departmentId } = req.query;
    if (!surveyId) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Survey ID is required'
      });
    }

    const respondents = await approvalService.getRespondents({
      surveyId,
      duplicateFilter,
      applicationId,
      departmentId,
      requesterUserId: req.user?.userId,
      requesterRole: req.user?.role
    });

    res.json({
      success: true,
      respondents
    });
  } catch (error) {
    return handleApprovalError(res, error, 'An error occurred while fetching respondents');
  }
}

async function approveInitialResponses(req, res) {
  try {
    const { responseIds, reason } = req.body;
    const approvedBy = req.user?.userId;

    if (!Array.isArray(responseIds) || responseIds.length === 0) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Minimal satu response wajib dipilih'
      });
    }

    const result = await approvalService.approveInitialResponses(responseIds, approvedBy, reason || null, req.user?.role);
    res.json({
      success: true,
      message: 'Response berhasil di-approve oleh Admin Event',
      data: result
    });
  } catch (error) {
    return handleApprovalError(res, error, 'An error occurred while approving responses');
  }
}

async function rejectInitialResponses(req, res) {
  try {
    const { responseIds, reason } = req.body;
    const rejectedBy = req.user?.userId;

    if (!Array.isArray(responseIds) || responseIds.length === 0 || !reason) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Minimal satu response dan alasan reject wajib diisi'
      });
    }

    const result = await approvalService.rejectInitialResponses(responseIds, rejectedBy, reason, req.user?.role);
    res.json({
      success: true,
      message: 'Response berhasil di-reject oleh Admin Event',
      data: result
    });
  } catch (error) {
    return handleApprovalError(res, error, 'An error occurred while rejecting responses');
  }
}

async function approveFinalResponses(req, res) {
  try {
    const { responseIds, reason } = req.body;
    const approvedBy = req.user?.userId;

    if (!Array.isArray(responseIds) || responseIds.length === 0) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Minimal satu response wajib dipilih'
      });
    }

    const result = await approvalService.approveFinalResponses(responseIds, approvedBy, reason || null, req.user?.role);
    res.json({
      success: true,
      message: 'Response berhasil di-approve final oleh IT Lead',
      data: result
    });
  } catch (error) {
    return handleApprovalError(res, error, 'An error occurred while approving final responses');
  }
}

/**
 * Get comments list for best comment selection
 * GET /api/v1/approvals/comments
 * @param {Object} req
 * @param {Object} res
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

    res.json({
      success: true,
      comments
    });
  } catch (error) {
    return handleApprovalError(res, error, 'Gagal memuat daftar komentar');
  }
}

/**
 * Get proposed takeouts list
 * GET /api/v1/approvals/proposed-takeouts
 * @param {Object} req
 * @param {Object} res
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

    res.json({
      success: true,
      takeouts
    });
  } catch (error) {
    return handleApprovalError(res, error, 'An error occurred while fetching proposed takeouts');
  }
}

/**
 * Mark as best comment
 * POST /api/v1/approvals/best-comments
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function markAsBestComment(req, res) {
  try {
    const { responseId, questionId } = req.body;

    if (!responseId || !questionId) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Response ID dan Question ID wajib diisi'
      });
    }

    const result = await approvalService.markAsBestComment(
      responseId,
      questionId,
      req.user?.userId
    );

    if (!result.success) {
      return res.status(400).json({
        error: 'Mark best comment failed',
        message: 'Gagal menyimpan best comment'
      });
    }

    res.json({
      success: true,
      message: 'Best comment berhasil disimpan'
    });

  } catch (error) {
    return handleApprovalError(res, error, 'Gagal menyimpan best comment');
  }
}

/**
 * Unmark best comment
 * DELETE /api/v1/approvals/best-comments
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function unmarkBestComment(req, res) {
  try {
    const { responseId, questionId } = req.body;

    if (!responseId || !questionId) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Response ID dan Question ID wajib diisi'
      });
    }

    const result = await approvalService.unmarkBestComment(
      responseId,
      questionId,
      req.user?.userId
    );

    if (!result.success) {
      return res.status(400).json({
        error: 'Unmark best comment failed',
        message: 'Gagal menghapus best comment'
      });
    }

    res.json({
      success: true,
      message: 'Best comment berhasil dihapus'
    });

  } catch (error) {
    return handleApprovalError(res, error, 'Gagal menghapus best comment');
  }
}

/**
 * Get best comments
 * GET /api/v1/approvals/best-comments
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getBestComments(req, res) {
  try {
    const { surveyId, functionId } = req.query;

    const filter = {};
    if (surveyId) filter.surveyId = surveyId;
    if (functionId) filter.functionId = functionId;

    const comments = await approvalService.getBestComments(filter);

    res.json({
      success: true,
      comments
    });

  } catch (error) {
    return handleApprovalError(res, error, 'Gagal memuat best comments');
  }
}

/**
 * Submit best comment feedback
 * POST /api/v1/approvals/best-comments/feedback
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function submitBestCommentFeedback(req, res) {
  try {
    const { responseId, questionId, questionResponseId, feedbackText } = req.body;
    const itLeadUserId = req.user?.userId;

    if (!feedbackText || !String(feedbackText).trim()) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Teks feedback wajib diisi'
      });
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
      return res.status(400).json({
        error: 'Feedback submission failed',
        message: 'Gagal mengirim feedback'
      });
    }

    res.status(201).json({
      success: true,
      message: 'Feedback berhasil dikirim',
      feedback: result
    });

  } catch (error) {
    return handleApprovalError(res, error, 'Gagal mengirim feedback best comment');
  }
}

/**
 * Get best comments with IT Lead feedback
 * GET /api/v1/approvals/best-comments-with-feedback
 * @param {Object} req
 * @param {Object} res
 */
async function getBestCommentsWithFeedback(req, res) {
  try {
    const { surveyId, functionId, departmentId } = req.query;
    const comments = await approvalService.getBestCommentsWithFeedback({
      surveyId,
      functionId,
      departmentId
    });

    res.json({
      success: true,
      comments
    });
  } catch (error) {
    return handleApprovalError(res, error, 'Gagal memuat best comments dengan feedback');
  }
}

/**
 * Get approval statistics
 * GET /api/v1/approvals/statistics/:surveyId
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getApprovalStatistics(req, res) {
  try {
    const surveyId = req.params.surveyId;
    const statistics = await approvalService.getApprovalStatistics(surveyId);

    res.json({
      success: true,
      statistics
    });

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
