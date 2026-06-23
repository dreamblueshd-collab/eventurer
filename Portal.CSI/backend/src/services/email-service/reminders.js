/**
 * email-service/reminders.js — Survey reminder email orchestration.
 * Extracted from EmailService to reduce the main file size.
 */

const sql = require('../../database/sql-client');
const logger = require('../../config/logger');
const db = require('../../database/connection');

/**
 * Get non-respondents for a survey.
 * @param {string} surveyId - Survey ID
 * @returns {Promise<Array>} Array of non-respondents
 */
async function getNonRespondents(surveyId) {
    const pool = await db.getPool();

    try {
        const blastRecipientsResult = await pool.request()
            .input('surveyId', sql.BigInt, surveyId)
            .query(`
                SELECT DISTINCT 
                    el.RecipientEmail,
                    el.RecipientName
                FROM EmailLogs el
                WHERE el.SurveyId = @surveyId
                    AND el.EmailType = 'Blast'
                    AND el.Status = 'Sent'
            `);

        const blastRecipients = blastRecipientsResult.recordset;

        if (blastRecipients.length === 0) {
            logger.warn('No blast recipients found for survey');
            return [];
        }

        const respondentsResult = await pool.request()
            .input('surveyId', sql.BigInt, surveyId)
            .query(`
                SELECT DISTINCT RespondentEmail
                FROM Responses
                WHERE SurveyId = @surveyId
            `);

        const respondentEmails = new Set(
            respondentsResult.recordset.map(r => r.RespondentEmail.toLowerCase())
        );

        const nonRespondents = blastRecipients.filter(
            recipient => !respondentEmails.has(recipient.RecipientEmail.toLowerCase())
        );

        logger.info(`Found ${nonRespondents.length} non-respondents out of ${blastRecipients.length} recipients`);

        return nonRespondents.map(r => ({
            email: r.RecipientEmail,
            name: r.RecipientName
        }));
    } catch (error) {
        logger.error('Failed to get non-respondents:', error);
        throw error;
    }
}

/**
 * Send reminders to non-respondents.
 * @param {Object} self - EmailService instance (for sendBatch, validateEmail, etc.)
 * @param {Object} params - Reminder parameters
 * @returns {Promise<Object>} Results summary
 */
async function sendReminders(self, params) {
    const {
        surveyId,
        emailTemplate,
        customSubject = '',
        customMessage = '',
        recipientEmails = [],
        embedCover = false,
        duplicatePreventionHours = 24
    } = params;

    try {
        const pool = await db.getPool();
        const surveyResult = await pool.request()
            .input('surveyId', sql.BigInt, surveyId)
            .query(`
                SELECT 
                    s.SurveyId,
                    s.Title,
                    s.EndDate,
                    s.SurveyLink,
                    sc.HeroImageUrl
                FROM Surveys s
                LEFT JOIN EventConfiguration sc ON s.SurveyId = sc.SurveyId
                WHERE s.SurveyId = @surveyId
            `);

        if (surveyResult.recordset.length === 0) {
            throw new Error('Survey not found');
        }

        const survey = surveyResult.recordset[0];

        const endDate = new Date(survey.EndDate);
        const now = new Date();

        if (now > endDate) {
            logger.warn('Survey has already ended, skipping reminders');
            return {
                total: 0, sent: 0, failed: 0, skipped: 0,
                errors: [], message: 'Survey has ended'
            };
        }

        const daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

        let nonRespondents = [];
        if (Array.isArray(recipientEmails) && recipientEmails.length > 0) {
            nonRespondents = recipientEmails
                .map(email => String(email || '').trim())
                .filter(Boolean)
                .map(email => ({
                    email,
                    name: email.split('@')[0] || email
                }));
        } else {
            nonRespondents = await getNonRespondents(surveyId);
        }

        if (nonRespondents.length === 0) {
            logger.info('No non-respondents found, all recipients have responded');
            return {
                total: 0, sent: 0, failed: 0, skipped: 0,
                errors: [], message: 'All recipients have responded'
            };
        }

        logger.info(`Preparing to send reminders to ${nonRespondents.length} non-respondents`);

        const filteredRecipients = [];
        let skippedCount = 0;

        for (const recipient of nonRespondents) {
            if (!self.validateEmail(recipient.email)) {
                logger.warn(`Invalid email address: ${recipient.email}`);
                skippedCount++;
                continue;
            }

            const wasSent = await self.wasEmailSentRecently(
                recipient.email,
                surveyId,
                duplicatePreventionHours
            );

            if (wasSent) {
                logger.info(`Skipping ${recipient.email} - reminder sent recently`);
                skippedCount++;
                continue;
            }

            filteredRecipients.push(recipient);
        }

        logger.info(`Sending to ${filteredRecipients.length} recipients (${skippedCount} skipped)`);

        const logo = self.getLogoCidAttachment();
        const safeCustomMessage = self.sanitizeEmailPlainText(customMessage);

        const subjectLine = String(customSubject || '').trim() || survey.Title;
        const emails = filteredRecipients.map(recipient => ({
            to: recipient.email,
            subject: subjectLine,
            template: emailTemplate || 'survey-reminder',
            data: {
                recipientName: recipient.name,
                surveyTitle: survey.Title,
                surveyLink: survey.SurveyLink || `${process.env.PUBLIC_SURVEY_BASE_URL || process.env.BASE_URL}/survey/${surveyId}`,
                endDate: endDate.toLocaleDateString('id-ID'),
                daysRemaining,
                customMessage: safeCustomMessage,
                embedCover,
                heroCoverUrl: embedCover ? survey.HeroImageUrl : null,
                baseUrl: process.env.BASE_URL || 'http://localhost:3000',
                logoCid: logo ? logo.cidRef : null,
                buttonLabel: params.buttonLabel || '',
                primaryColor: params.primaryColor || ''
            },
            attachments: [
                ...(logo ? [logo.attachment] : [])
            ],
            surveyId,
            emailType: 'Reminder'
        }));

        const results = await self.sendBatch(emails);

        return { ...results, skipped: skippedCount };
    } catch (error) {
        logger.error('Failed to send reminders:', error);
        throw error;
    }
}

module.exports = { getNonRespondents, sendReminders };
