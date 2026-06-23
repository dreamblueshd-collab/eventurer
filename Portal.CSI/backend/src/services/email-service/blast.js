/**
 * email-service/blast.js — Survey blast email orchestration.
 * Extracted from EmailService to reduce the main file size.
 */

const sql = require('../../database/sql-client');
const QRCode = require('qrcode');
const logger = require('../../config/logger');
const db = require('../../database/connection');

/**
 * Get target recipients based on organizational criteria.
 * @param {Object} criteria - Target criteria (businessUnitIds, divisionIds, departmentIds, functionIds)
 * @returns {Promise<Array>} Array of recipients
 */
async function getTargetRecipients(criteria) {
    const pool = await db.getPool();
    const {
        businessUnitIds = [],
        divisionIds = [],
        departmentIds = [],
        functionIds = []
    } = criteria;

    try {
        // NOTE: Organizational hierarchy filtering is currently DISABLED
        // The Users table no longer has BusinessUnitId, DivisionId, DepartmentId columns
        // Email blast can only target: all active users OR manual recipient list
        // If org hierarchy filtering is needed, consider alternative approach (e.g., via Application/Department mappings)
        
        if (businessUnitIds.length > 0 || divisionIds.length > 0 || departmentIds.length > 0 || functionIds.length > 0) {
            logger.warn('Org hierarchy filtering requested but not supported - Users table has no org hierarchy columns');
        }

        let query = `
            SELECT DISTINCT 
                u.UserId,
                u.Email,
                u.DisplayName
            FROM Users u
            WHERE u.IsActive = 1
                AND u.Email IS NOT NULL
                AND u.Email != ''
        `;

        /* DISABLED - Org hierarchy columns removed from Users table
        LEFT JOIN BusinessUnits bu ON u.BusinessUnitId = bu.BusinessUnitId
        LEFT JOIN Divisions d ON u.DivisionId = d.DivisionId
        LEFT JOIN Departments dept ON u.DepartmentId = dept.DepartmentId
        
        if (businessUnitIds.length > 0) {
            query += ` AND u.BusinessUnitId IN (${businessUnitIds.map((_, i) => `@bu${i}`).join(',')})`;
            businessUnitIds.forEach((id, i) => {
                request.input(`bu${i}`, sql.BigInt, id);
            });
        }

        if (divisionIds.length > 0) {
            query += ` AND u.DivisionId IN (${divisionIds.map((_, i) => `@div${i}`).join(',')})`;
            divisionIds.forEach((id, i) => {
                request.input(`div${i}`, sql.BigInt, id);
            });
        }

        if (departmentIds.length > 0) {
            query += ` AND u.DepartmentId IN (${departmentIds.map((_, i) => `@dept${i}`).join(',')})`;
            departmentIds.forEach((id, i) => {
                request.input(`dept${i}`, sql.BigInt, id);
            });
        }

        if (functionIds.length > 0) {
            query += ` AND u.FunctionId IN (${functionIds.map((_, i) => `@func${i}`).join(',')})`;
            functionIds.forEach((id, i) => {
                request.input(`func${i}`, sql.BigInt, id);
            });
        }
        */

        query += ` ORDER BY u.DisplayName`;

        const request = pool.request();
        const result = await request.query(query);

        return result.recordset.map(row => ({
            userId: row.UserId,
            email: row.Email,
            name: row.DisplayName,
            businessUnit: null, // DISABLED - no org hierarchy in Users table
            division: null,     // DISABLED - no org hierarchy in Users table
            department: null    // DISABLED - no org hierarchy in Users table
        }));
    } catch (error) {
        logger.error('Failed to get target recipients:', error);
        throw error;
    }
}

/**
 * Send survey blast to target recipients.
 * @param {Object} self - EmailService instance (for sendBatch, validateEmail, etc.)
 * @param {Object} params - Blast parameters
 * @returns {Promise<Object>} Results summary
 */
async function sendSurveyBlast(self, params) {
    const {
        surveyId,
        targetCriteria,
        emailTemplate,
        customSubject = '',
        customMessage = '',
        includeQrCode = false,
        recipientEmails = [],
        embedCover = false,
        duplicatePreventionHours = 24,
        disableDuplicateCheck = true,
        showPeriod = true,
        showBadge = true,
        badgeText = '',
        showButton = true,
        showLinkFallback = true
    } = params;

    try {
        const pool = await db.getPool();
        const surveyResult = await pool.request()
            .input('surveyId', sql.BigInt, surveyId)
            .query(`
                SELECT 
                    s.SurveyId,
                    s.Title,
                    s.Description,
                    s.StartDate,
                    s.EndDate,
                    s.SurveyLink,
                    s.QRCodeDataUrl,
                    s.TargetRespondents,
                    sc.HeroImageUrl
                FROM Surveys s
                LEFT JOIN EventConfiguration sc ON s.SurveyId = sc.SurveyId
                WHERE s.SurveyId = @surveyId
            `);

        if (surveyResult.recordset.length === 0) {
            throw new Error('Survey not found');
        }

        const survey = surveyResult.recordset[0];

        let recipients = [];
        if (Array.isArray(recipientEmails) && recipientEmails.length > 0) {
            recipients = recipientEmails
                .map(email => String(email || '').trim())
                .filter(Boolean)
                .map(email => ({
                    email,
                    name: email.split('@')[0] || email
                }));
        } else {
            recipients = await getTargetRecipients(targetCriteria);
        }

        if (recipients.length === 0) {
            logger.warn('No recipients found for survey blast');
            return { total: 0, sent: 0, failed: 0, skipped: 0, errors: [] };
        }

        logger.info(`Preparing to send survey blast to ${recipients.length} recipients`);

        // Filter out recipients who received email recently (duplicate prevention)
        const filteredRecipients = [];
        let skippedCount = 0;

        for (const recipient of recipients) {
            if (!self.validateEmail(recipient.email)) {
                logger.warn(`Invalid email address: ${recipient.email}`);
                skippedCount++;
                continue;
            }

            if (!disableDuplicateCheck) {
                const wasSent = await self.wasEmailSentRecently(
                    recipient.email,
                    surveyId,
                    duplicatePreventionHours
                );

                if (wasSent) {
                    logger.info(`Skipping ${recipient.email} - email sent recently`);
                    skippedCount++;
                    continue;
                }
            }

            filteredRecipients.push(recipient);
        }

        logger.info(`Sending to ${filteredRecipients.length} recipients (${skippedCount} skipped)`);

        const publicSurveyBaseUrl = process.env.PUBLIC_SURVEY_BASE_URL || process.env.BASE_URL;
        const surveyLink = survey.SurveyLink || `${publicSurveyBaseUrl}/survey/${surveyId}`;
        let qrCodeDataUrl = null;
        if (includeQrCode) {
            qrCodeDataUrl = survey.QRCodeDataUrl || await QRCode.toDataURL(surveyLink, {
                width: 260,
                margin: 2
            });
        }
        const qrBuffer = self.dataUrlToBuffer(qrCodeDataUrl);
        const qrCid = qrBuffer ? `survey-qr-${surveyId}@csi.local` : null;
        const qrImageSrc = qrCid ? `cid:${qrCid}` : qrCodeDataUrl;
        const qrAttachment = qrBuffer ? {
            filename: `survey-${surveyId}-qrcode.png`,
            content: qrBuffer,
            contentType: 'image/png',
            cid: qrCid
        } : null;

        const logo = self.getLogoCidAttachment();
        const safeCustomMessage = self.sanitizeEmailPlainText(customMessage);

        const subjectLine = String(customSubject || '').trim() || survey.Title;
        const emails = filteredRecipients.map(recipient => ({
            to: recipient.email,
            subject: subjectLine,
            template: emailTemplate || 'survey-invitation',
            data: {
                recipientName: recipient.name,
                surveyTitle: survey.Title,
                surveyDescription: survey.Description,
                surveyLink,
                startDate: survey.StartDate ? new Date(survey.StartDate).toLocaleDateString('id-ID') : '-',
                endDate: survey.EndDate ? new Date(survey.EndDate).toLocaleDateString('id-ID') : '-',
                targetRespondents: survey.TargetRespondents,
                customMessage: safeCustomMessage,
                includeQrCode,
                qrCodeDataUrl,
                qrCodeImageSrc: qrImageSrc,
                embedCover,
                heroCoverUrl: embedCover ? survey.HeroImageUrl : null,
                baseUrl: process.env.BASE_URL || 'http://localhost:3000',
                logoCid: logo ? logo.cidRef : null,
                buttonLabel: params.buttonLabel || '',
                primaryColor: params.primaryColor || '',
                showPeriod: showPeriod !== false,
                showBadge: showBadge !== false,
                badgeText: badgeText || 'UNDANGAN SURVEY',
                showButton: showButton !== false,
                showLinkFallback: showLinkFallback !== false
            },
            attachments: [
                ...(logo ? [logo.attachment] : []),
                ...(qrAttachment ? [qrAttachment] : [])
            ],
            surveyId,
            emailType: 'Blast'
        }));

        const results = await self.sendBatch(emails);

        return { ...results, skipped: skippedCount };
    } catch (error) {
        logger.error('Failed to send survey blast:', error);
        throw error;
    }
}

module.exports = { getTargetRecipients, sendSurveyBlast };
