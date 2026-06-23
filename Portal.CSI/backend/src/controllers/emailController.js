const { body, param, query, validationResult } = require('express-validator');
const emailService = require('../services/emailService');
const logger = require('../config/logger');
const ExcelJS = require('exceljs');

function handleEmailError(res, error, fallbackMessage) {
  const message = error?.message || fallbackMessage;

  if (/not found/i.test(message)) {
    return res.status(404).json({
      error: 'Not found',
      message
    });
  }

  if (/validation|required|invalid|ended|no recipients/i.test(message)) {
    return res.status(400).json({
      error: 'Validation failed',
      message
    });
  }

  logger.error(fallbackMessage, error);
  return res.status(500).json({
    error: 'Internal server error',
    message: fallbackMessage
  });
}

/**
 * Send survey blast
 * POST /api/v1/emails/blast
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function sendSurveyBlast(req, res) {
  try {
    const request = req.body;
    const result = await emailService.sendSurveyBlast(request);

    res.json({
      success: true,
      message: 'Survey blast sent successfully',
      total: result.total,
      sent: result.sent,
      failed: result.failed,
      skipped: result.skipped || 0,
      errors: result.errors || [],
      detail: result.message || null
    });

  } catch (error) {
    return handleEmailError(res, error, 'An error occurred while sending survey blast');
  }
}

/**
 * Get target recipients
 * POST /api/v1/emails/target-recipients
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getTargetRecipients(req, res) {
  try {
    const criteria = req.body;
    const recipients = await emailService.getTargetRecipients(criteria);

    res.json({
      success: true,
      recipients,
      count: recipients.length
    });

  } catch (error) {
    logger.error('Get target recipients controller error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'An error occurred while fetching recipients'
    });
  }
}

/**
 * Send reminders
 * POST /api/v1/emails/reminders
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function sendReminders(req, res) {
  try {
    const request = req.body;
    const result = await emailService.sendReminders(request);

    res.json({
      success: true,
      message: 'Reminders sent successfully',
      total: result.total,
      sent: result.sent,
      failed: result.failed,
      skipped: result.skipped || 0,
      errors: result.errors || [],
      detail: result.message || null
    });

  } catch (error) {
    return handleEmailError(res, error, 'An error occurred while sending reminders');
  }
}

/**
 * Get non-respondents
 * GET /api/v1/emails/non-respondents/:surveyId
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getNonRespondents(req, res) {
  try {
    const surveyId = String(req.params.surveyId || '').trim();
    const nonRespondents = await emailService.getNonRespondents(surveyId);

    res.json({
      success: true,
      nonRespondents,
      count: nonRespondents.length
    });

  } catch (error) {
    return handleEmailError(res, error, 'An error occurred while fetching non-respondents');
  }
}

/**
 * Send approval notification
 * POST /api/v1/emails/approval-notification
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function sendApprovalNotification(req, res) {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Notification payload is required'
      });
    }

    const result = await emailService.sendApprovalNotification(req.body);

    if (!result.success) {
      return res.status(400).json({
        error: 'Notification sending failed',
        message: result.error
      });
    }

    res.json({
      success: true,
      message: 'Approval notification sent successfully'
    });

  } catch (error) {
    return handleEmailError(res, error, 'An error occurred while sending notification');
  }
}

/**
 * Send rejection notification
 * POST /api/v1/emails/rejection-notification
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function sendRejectionNotification(req, res) {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Notification payload is required'
      });
    }

    const result = await emailService.sendRejectionNotification(req.body);

    if (!result.success) {
      return res.status(400).json({
        error: 'Notification sending failed',
        message: result.error
      });
    }

    res.json({
      success: true,
      message: 'Rejection notification sent successfully'
    });

  } catch (error) {
    return handleEmailError(res, error, 'An error occurred while sending notification');
  }
}

/**
 * Get email template
 * GET /api/v1/emails/templates/:templateName
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getTemplate(req, res) {
  try {
    const templateName = req.params.templateName;
    const template = await emailService.getTemplate(templateName);

    if (!template) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Template not found'
      });
    }

    res.json({
      success: true,
      template
    });

  } catch (error) {
    logger.error('Get template controller error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'An error occurred while fetching template'
    });
  }
}

async function parseRecipientsFromFile(file) {
  if (!file?.buffer) return [];
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer);
    const ws = workbook.worksheets[0];
    if (!ws) return [];

    const headerRow = ws.getRow(1);
    const headers = {};
    headerRow.eachCell((cell, col) => {
      headers[String(cell.text || '').trim().toLowerCase()] = col;
    });

    const emailCol = headers.email;
    const nameCol = headers.name || headers.nama;
    if (!emailCol) {
      throw new Error('Excel recipients must include "email" column');
    }

    const rows = [];
    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const email = String(row.getCell(emailCol).text || '').trim();
      const name = nameCol ? String(row.getCell(nameCol).text || '').trim() : '';
      if (!email) return;
      rows.push({ email, name });
    });
    return rows;
  } catch {
    // Fallback CSV/plain-text parser: header must include email, optional name.
    const content = String(file.buffer || '').trim();
    if (!content) return [];
    const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length === 0) return [];

    const header = lines[0].split(',').map((c) => c.trim().toLowerCase());
    const emailIdx = header.indexOf('email');
    const nameIdx = header.indexOf('name');
    if (emailIdx === -1) {
      throw new Error('Recipient file must include "email" column');
    }

    return lines.slice(1).map((line) => {
      const cols = line.split(',').map((c) => c.trim());
      return {
        email: cols[emailIdx] || '',
        name: nameIdx >= 0 ? (cols[nameIdx] || '') : ''
      };
    }).filter((row) => row.email);
  }
}

async function sendStandaloneBlast(req, res) {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const parsedRecipients = (() => {
      if (!body.recipients) return [];
      if (Array.isArray(body.recipients)) return body.recipients;
      try { return JSON.parse(body.recipients); } catch { return []; }
    })();
    const uploadedRecipients = await parseRecipientsFromFile(req.file);
    const recipients = [...parsedRecipients, ...uploadedRecipients];

    const result = await emailService.sendStandaloneBlast({
      subject: body.subject,
      message: body.message,
      recipients,
      includeQrCode: String(body.includeQrCode || '').toLowerCase() === 'true' || body.includeQrCode === true,
      includeSurveyButton: String(body.includeSurveyButton || '').toLowerCase() === 'true' || body.includeSurveyButton === true,
      surveyLink: body.surveyLink,
      buttonLabel: body.buttonLabel,
      includeCalendarInvite: String(body.includeCalendarInvite || '').toLowerCase() === 'true' || body.includeCalendarInvite === true,
      eventTitle: body.eventTitle,
      location: body.location,
      teamsLink: body.teamsLink,
      startAt: body.startAt,
      endAt: body.endAt
    });

    res.json({
      success: true,
      message: 'Email blast sent successfully',
      ...result
    });
  } catch (error) {
    return handleEmailError(res, error, 'An error occurred while sending standalone blast');
  }
}

/**
 * Schedule standalone blast (no survey context)
 * POST /api/v1/emails/schedule-standalone
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function scheduleStandaloneBlast(req, res) {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};

    const parsedRecipients = (() => {
      if (!body.recipients) return [];
      if (Array.isArray(body.recipients)) return body.recipients;
      try { return JSON.parse(body.recipients); } catch { return []; }
    })();
    const uploadedRecipients = await parseRecipientsFromFile(req.file);
    const recipients = [...parsedRecipients, ...uploadedRecipients];

    if (recipients.length === 0) {
      return res.status(400).json({ error: 'Validation failed', message: 'At least one recipient is required' });
    }
    if (!body.subject || !String(body.subject).trim()) {
      return res.status(400).json({ error: 'Validation failed', message: 'Subject is required' });
    }
    if (!body.message || !String(body.message).trim()) {
      return res.status(400).json({ error: 'Validation failed', message: 'Message is required' });
    }
    if (!body.scheduledDate) {
      return res.status(400).json({ error: 'Validation failed', message: 'Scheduled date is required' });
    }

    const frequency = body.frequency || 'once';
    const validFrequencies = ['once', 'daily', 'weekly', 'monthly'];
    if (!validFrequencies.includes(frequency)) {
      return res.status(400).json({ error: 'Validation failed', message: `Frequency must be one of: ${validFrequencies.join(', ')}` });
    }
    if (frequency === 'weekly' && (body.dayOfWeek === null || body.dayOfWeek === undefined || body.dayOfWeek < 0 || body.dayOfWeek > 6)) {
      return res.status(400).json({ error: 'Validation failed', message: 'Weekly scheduling requires dayOfWeek (0-6)' });
    }
    if (frequency !== 'once' && !body.scheduledTime) {
      return res.status(400).json({ error: 'Validation failed', message: 'Recurring schedules require scheduledTime in HH:mm format' });
    }

    // Build operation context (standalone payload)
    const operationContext = {
      subject: body.subject,
      message: body.message,
      recipients,
      includeQrCode: String(body.includeQrCode || '').toLowerCase() === 'true' || body.includeQrCode === true,
      includeSurveyButton: String(body.includeSurveyButton || '').toLowerCase() === 'true' || body.includeSurveyButton === true,
      surveyLink: body.surveyLink || '',
      buttonLabel: body.buttonLabel || '',
      includeCalendarInvite: String(body.includeCalendarInvite || '').toLowerCase() === 'true' || body.includeCalendarInvite === true,
      eventTitle: body.eventTitle || '',
      location: body.location || '',
      teamsLink: body.teamsLink || '',
      startAt: body.startAt || null,
      endAt: body.endAt || null
    };

    const scheduledOperationsService = require('../services/standalone-scheduled-operations');
    const result = await scheduledOperationsService.scheduleStandaloneBlast({
      scheduledDate: body.scheduledDate,
      scheduledTime: body.scheduledTime || null,
      frequency,
      dayOfWeek: frequency === 'weekly' ? Number(body.dayOfWeek) : null,
      operationContext,
      createdBy: req.user?.userId || null
    });

    res.status(201).json({
      success: true,
      message: 'Standalone blast scheduled successfully',
      operation: result
    });
  } catch (error) {
    return handleEmailError(res, error, 'An error occurred while scheduling standalone blast');
  }
}

module.exports = {
  sendSurveyBlast,
  getTargetRecipients,
  sendReminders,
  getNonRespondents,
  sendApprovalNotification,
  sendRejectionNotification,
  getTemplate,
  sendStandaloneBlast,
  scheduleStandaloneBlast
};
