const sql = require('../database/sql-client');
/**
 * Email Service
 * Handles email sending, template rendering, and email logging.
 * Orchestration logic (blast, reminders) is in ./email-service/ sub-modules.
 */

const nodemailer = require('nodemailer');
const ejs = require('ejs');
const path = require('path');
const fs = require('fs').promises;
const QRCode = require('qrcode');

  
const logger = require('../config/logger');
const db = require('../database/connection');
const { getTargetRecipients, sendSurveyBlast: sendSurveyBlastImpl } = require('./email-service/blast');
const { getNonRespondents: getNonRespondentsImpl, sendReminders: sendRemindersImpl } = require('./email-service/reminders');

/**
 * @typedef {Object} EmailOptions
 * @property {string} to - Recipient email address
 * @property {string} subject - Email subject
 * @property {string} template - Template name (without .ejs extension)
 * @property {Object} data - Template data
 * @property {string} [surveyId] - Survey ID for logging
 * @property {string} [emailType] - Email type (Blast, Reminder, Notification)
 */

/**
 * @typedef {Object} SendResult
 * @property {boolean} success
 * @property {string} [messageId]
 * @property {string} [error]
 */

class EmailService {
    constructor() {
        this.transporter = null;
        this.templatesDir = path.join(__dirname, '../templates/email');
        this.initializeTransporter();
    }

    /**
     * Initialize nodemailer transporter
     */
    initializeTransporter() {
        try {
            const disableAuth = process.env.SMTP_DISABLE_AUTH === 'true';
            const transportOptions = {
                host: process.env.SMTP_HOST,
                port: parseInt(process.env.SMTP_PORT || '587'),
                secure: process.env.SMTP_SECURE === 'true',
                ignoreTLS: process.env.SMTP_IGNORE_TLS === 'true',
                requireTLS: process.env.SMTP_REQUIRE_TLS === 'true',
                name: process.env.SMTP_EHLO_NAME || 'DMZSVR-B2BWEBDEV.component.astra.co.id',
                connectionTimeout: 30000, // 30 seconds to establish connection
                greetingTimeout: 15000,   // 15 seconds for SMTP greeting
                socketTimeout: 60000,     // 60 seconds for socket inactivity
                tls: {
                    rejectUnauthorized: false
                }
            };

            if (!disableAuth && process.env.SMTP_USER) {
                transportOptions.auth = {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASSWORD
                };
            }

            this.transporter = nodemailer.createTransport(transportOptions);

            logger.info('Email transporter initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize email transporter:', error);
            throw error;
        }
    }

    /**
     * Parse "Name <email>" format into nodemailer {name, address} object
     */
    parseFromAddress(fromString) {
        const match = fromString.match(/^(.+?)\s*<(.+)>$/);
        if (match) {
            // Use RFC 5322 quoted display name format for maximum compatibility
            const name = match[1].trim();
            const address = match[2].trim();
            return `"${name}" <${address}>`;
        }
        return fromString;
    }

    /**
     * Render email template with data
     * @param {string} templateName - Template name (without .ejs extension)
     * @param {Object} data - Template data
     * @returns {Promise<string>} Rendered HTML
     */
    async renderTemplate(templateName, data) {
        try {
            const templatePath = path.join(this.templatesDir, `${templateName}.ejs`);
            const templateContent = await fs.readFile(templatePath, 'utf-8');
            const html = ejs.render(templateContent, data);
            return html;
        } catch (error) {
            logger.error(`Failed to render template ${templateName}:`, error);
            throw new Error(`Template rendering failed: ${error.message}`);
        }
    }

    /**
     * Get template by name
     * @param {string} templateName - Template name
     * @returns {Promise<string>} Template content
     */
    async getTemplate(templateName) {
        try {
            const templatePath = path.join(this.templatesDir, `${templateName}.ejs`);
            const content = await fs.readFile(templatePath, 'utf-8');
            return content;
        } catch (error) {
            logger.error(`Failed to get template ${templateName}:`, error);
            throw new Error(`Template not found: ${templateName}`);
        }
    }

    /**
     * Send email
     * @param {EmailOptions} options - Email options
     * @returns {Promise<SendResult>}
     */
    async sendEmail(options) {
        const { to, subject, template, data, attachments = [], surveyId, emailType = 'Notification' } = options;

        try {
            // Render template
            const html = await this.renderTemplate(template, data);

            const normalizedEmailType = this.normalizeEmailType(emailType);
            // Build from address - use object format for reliable display name
            const fromAddress = this.parseFromAddress(process.env.SMTP_FROM || 'noreply@component.astra.co.id');
            const mailOptions = {
                from: fromAddress,
                to,
                subject,
                html,
                attachments
            };

            // Send email with a single retry for transient SMTP socket failures.
            let info;
            try {
                info = await this.transporter.sendMail(mailOptions);
            } catch (error) {
                if (!this.isTransientEmailError(error)) {
                    throw error;
                }

                logger.warn(`Transient email error detected for ${to}, retrying once`, {
                    code: error.code,
                    syscall: error.syscall
                });
                info = await this.transporter.sendMail(mailOptions);
            }

            // Log email
            await this.logEmail({
                surveyId,
                recipientEmail: to,
                recipientName: data.recipientName || null,
                subject,
                emailType: normalizedEmailType,
                status: 'Sent',
                errorMessage: null
            });

            logger.info(`Email sent successfully to ${to}`, { messageId: info.messageId });

            return {
                success: true,
                messageId: info.messageId
            };
        } catch (error) {
            logger.error(`Failed to send email to ${to}:`, error);

            // Log failed email
            await this.logEmail({
                surveyId,
                recipientEmail: to,
                recipientName: data.recipientName || null,
                subject,
                emailType: this.normalizeEmailType(emailType),
                status: 'Failed',
                errorMessage: error.message
            });

            return {
                success: false,
                error: error.message
            };
        }
    }

    normalizeEmailType(emailType) {
        const normalized = String(emailType || '').trim();
        if (normalized === 'Blast' || normalized === 'Reminder' || normalized === 'Notification') {
            return normalized;
        }

        return 'Notification';
    }

    isTransientEmailError(error) {
        const code = String(error?.code || '').toUpperCase();
        return code === 'ECONNRESET' || code === 'ESOCKET' || code === 'ETIMEDOUT' || code === 'ECONNECTION';
    }

    /**
     * Send batch emails with rate limiting
     * @param {EmailOptions[]} emails - Array of email options
     * @param {number} [batchSize=50] - Number of emails per batch
     * @param {number} [delayMs=1000] - Delay between batches in milliseconds
     * @returns {Promise<Object>} Results summary
     */
    async sendBatch(emails, batchSize = 50, delayMs = 1000) {
        const results = {
            total: emails.length,
            sent: 0,
            failed: 0,
            errors: []
        };

        for (let i = 0; i < emails.length; i += batchSize) {
            const batch = emails.slice(i, i + batchSize);
            
            logger.info(`Sending batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(emails.length / batchSize)}`);

            const batchPromises = batch.map(email => this.sendEmail(email));
            const batchResults = await Promise.allSettled(batchPromises);

            batchResults.forEach((result, index) => {
                if (result.status === 'fulfilled' && result.value.success) {
                    results.sent++;
                } else {
                    results.failed++;
                    results.errors.push({
                        email: batch[index].to,
                        error: result.status === 'fulfilled' ? result.value.error : result.reason
                    });
                }
            });

            // Delay between batches (except for the last batch)
            if (i + batchSize < emails.length) {
                await this.delay(delayMs);
            }
        }

        logger.info(`Batch sending completed: ${results.sent} sent, ${results.failed} failed`);

        return results;
    }

    /**
     * Log email to database
     * @param {Object} logData - Email log data
     * @returns {Promise<void>}
     */
    async logEmail(logData) {
        const pool = await db.getPool();
        
        try {
            await pool.request()
                .input('surveyId', sql.BigInt, logData.surveyId || null)
                .input('recipientEmail', sql.NVarChar(255), logData.recipientEmail)
                .input('recipientName', sql.NVarChar(200), logData.recipientName)
                .input('subject', sql.NVarChar(500), logData.subject)
                .input('emailType', sql.NVarChar(50), logData.emailType)
                .input('status', sql.NVarChar(50), logData.status)
                .input('errorMessage', sql.NVarChar(sql.MAX), logData.errorMessage)
                .query(`
                    INSERT INTO EmailLogs (
                        SurveyId, RecipientEmail, RecipientName, Subject,
                        EmailType, Status, ErrorMessage, SentAt
                    )
                    VALUES (
                        @surveyId, @recipientEmail, @recipientName, @subject,
                        @emailType, @status, @errorMessage, GETDATE()
                    )
                `);
        } catch (error) {
            logger.error('Failed to log email:', error);
            // Don't throw - logging failure shouldn't prevent email sending
        }
    }

    /**
     * Check if email was sent recently (duplicate prevention)
     * @param {string} recipientEmail - Recipient email
     * @param {string} surveyId - Survey ID
     * @param {number} [hoursWindow=24] - Time window in hours
     * @returns {Promise<boolean>} True if email was sent recently
     */
    async wasEmailSentRecently(recipientEmail, surveyId, hoursWindow = 24) {
        const pool = await db.getPool();
        
        try {
            const result = await pool.request()
                .input('recipientEmail', sql.NVarChar(255), recipientEmail)
                .input('surveyId', sql.BigInt, surveyId)
                .input('hoursWindow', sql.Int, hoursWindow)
                .query(`
                    SELECT COUNT(*) as count
                    FROM EmailLogs
                    WHERE RecipientEmail = @recipientEmail
                        AND SurveyId = @surveyId
                        AND Status = 'Sent'
                        AND SentAt >= DATEADD(HOUR, -@hoursWindow, GETDATE())
                `);

            return result.recordset[0].count > 0;
        } catch (error) {
            logger.error('Failed to check email history:', error);
            return false; // On error, allow sending
        }
    }

    /**
     * Validate email address format
     * @param {string} email - Email address
     * @returns {boolean} True if valid
     */
    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Delay helper for rate limiting
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise<void>}
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Read logo as Base64 data URL for inline embedding.
     * Base64 inline is forward-safe — CID attachments are stripped when forwarded.
     * @returns {string|null} data:image/png;base64,... or null
     */
    getLogoBase64() {
        const pathMod = require('path');
        const fsMod = require('fs');
        const logoPath = pathMod.join(__dirname, '../../public/assets/img/logo.png');
        try {
            const buf = fsMod.readFileSync(logoPath);
            return `data:image/png;base64,${buf.toString('base64')}`;
        } catch {
            logger.warn('Logo file not found, email will be sent without logo');
            return null;
        }
    }

    /**
     * Read logo as CID attachment for inline embedding.
     * Gmail blocks `data:` images, so CID is the most compatible for blast/reminder.
     * @returns {{ cidRef: string, attachment: Object } | null}
     */
    getLogoCidAttachment() {
        const pathMod = require('path');
        const fsMod = require('fs');
        const logoPath = pathMod.join(__dirname, '../../public/assets/img/logo.png');
        try {
            const buf = fsMod.readFileSync(logoPath);
            const cid = 'csi-portal-logo@csi.local';
            return {
                cidRef: `cid:${cid}`,
                attachment: {
                    filename: 'csi-portal-logo.png',
                    content: buf,
                    contentType: 'image/png',
                    cid: cid
                }
            };
        } catch {
            logger.warn('Logo file not found, email will be sent without logo');
            return null;
        }
    }

    /**
     * Treat customMessage as plain text (strip any HTML).
     * Prevents pasted HTML from showing as raw tags in email clients (Gmail/Outlook).
     * @param {unknown} value
     * @returns {string}
     */
    sanitizeEmailPlainText(value) {
        if (value === null || value === undefined) {
            return '';
        }

        let text = String(value);
        text = text.replace(/\r\n?/g, '\n');

        text = text
            .replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>')
            .replace(/&quot;/gi, '"')
            .replace(/&#39;/g, "'")
            .replace(/&amp;/gi, '&');

        text = text.replace(/<[^>]*>/g, '');

        text = text.replace(/[ \t]+\n/g, '\n').trim();
        return text;
    }

    /**
     * Convert PNG data URL to Buffer
     * @param {string|null} dataUrl
     * @returns {Buffer|null}
     */
    dataUrlToBuffer(dataUrl) {
        if (!dataUrl || typeof dataUrl !== 'string') {
            return null;
        }

        const match = dataUrl.match(/^data:image\/png;base64,(.+)$/);
        if (!match || !match[1]) {
            return null;
        }

        return Buffer.from(match[1], 'base64');
    }

    /**
     * Send survey invitation email
     * @param {Object} params - Email parameters
     * @returns {Promise<SendResult>}
     */
    async sendSurveyInvitation(params) {
        const {
            recipientEmail,
            recipientName,
            surveyId,
            surveyTitle,
            surveyDescription,
            surveyLink,
            startDate,
            endDate,
            targetRespondents,
            embedCover,
            heroCoverUrl
        } = params;

        return this.sendEmail({
            to: recipientEmail,
            subject: `Undangan Survey: ${surveyTitle}`,
            template: 'survey-invitation',
            data: {
                recipientName,
                surveyTitle,
                surveyDescription,
                surveyLink,
                startDate,
                endDate,
                targetRespondents,
                embedCover,
                heroCoverUrl
            },
            surveyId,
            emailType: 'Blast'
        });
    }

    /**
     * Send survey reminder email
     * @param {Object} params - Email parameters
     * @returns {Promise<SendResult>}
     */
    async sendSurveyReminder(params) {
        const {
            recipientEmail,
            recipientName,
            surveyId,
            surveyTitle,
            surveyLink,
            endDate,
            daysRemaining,
            embedCover,
            heroCoverUrl
        } = params;

        return this.sendEmail({
            to: recipientEmail,
            subject: `Reminder: ${surveyTitle} - Segera Berakhir`,
            template: 'survey-reminder',
            data: {
                recipientName,
                surveyTitle,
                surveyLink,
                endDate,
                daysRemaining,
                embedCover,
                heroCoverUrl
            },
            surveyId,
            emailType: 'Reminder'
        });
    }

    /**
     * Send approval notification email
     * @param {Object} params - Email parameters
     * @returns {Promise<SendResult>}
     */
    async sendApprovalNotification(params) {
        const {
            recipientEmail,
            recipientName,
            surveyTitle,
            respondentEmail,
            questionText,
            approvalReason,
            approverName,
            approvalDate
        } = params;

        return this.sendEmail({
            to: recipientEmail,
            subject: `Takeout Disetujui - ${surveyTitle}`,
            template: 'approval-notification',
            data: {
                recipientName,
                surveyTitle,
                respondentEmail,
                questionText,
                approvalReason,
                approverName,
                approvalDate
            },
            emailType: 'Notification'
        });
    }

    /**
     * Send rejection notification email
     * @param {Object} params - Email parameters
     * @returns {Promise<SendResult>}
     */
    async sendRejectionNotification(params) {
        const {
            recipientEmail,
            recipientName,
            surveyTitle,
            respondentEmail,
            questionText,
            rejectionReason,
            rejectorName,
            rejectionDate
        } = params;

        return this.sendEmail({
            to: recipientEmail,
            subject: `Takeout Ditolak - ${surveyTitle}`,
            template: 'rejection-notification',
            data: {
                recipientName,
                surveyTitle,
                respondentEmail,
                questionText,
                rejectionReason,
                rejectorName,
                rejectionDate
            },
            emailType: 'Notification'
        });
    }

    /**
     * Get target recipients based on organizational criteria
     * @param {Object} criteria - Target criteria
     * @returns {Promise<Array>} Array of recipients
     */
    async getTargetRecipients(criteria) {
        return getTargetRecipients(criteria);
    }

    /**
     * Send survey blast to target recipients
     * @param {Object} params - Blast parameters
     * @returns {Promise<Object>} Results summary
     */
    async sendSurveyBlast(params) {
        return sendSurveyBlastImpl(this, params);
    }

    /**
     * Get non-respondents for a survey
     * @param {string} surveyId - Survey ID
     * @returns {Promise<Array>} Array of non-respondents
     */
    async getNonRespondents(surveyId) {
        return getNonRespondentsImpl(surveyId);
    }

    /**
     * Send reminders to non-respondents
     * @param {Object} params - Reminder parameters
     * @returns {Promise<Object>} Results summary
     */
    async sendReminders(params) {
        return sendRemindersImpl(this, params);
    }

    sanitizeIcsText(value) {
        return String(value || '')
            .replace(/\\/g, '\\\\')
            .replace(/\r\n/g, '\n')
            .replace(/\n/g, '\\n')
            .replace(/,/g, '\\,')
            .replace(/;/g, '\\;');
    }

    /**
     * Format Date as iCalendar UTC timestamp (DTSTAMP only).
     * @param {Date|string} value
     * @returns {string|null} e.g. "20260520T020000Z"
     */
    toIcsDateTimeUtc(value) {
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) return null;
        const y = date.getUTCFullYear();
        const m = String(date.getUTCMonth() + 1).padStart(2, '0');
        const d = String(date.getUTCDate()).padStart(2, '0');
        const hh = String(date.getUTCHours()).padStart(2, '0');
        const mm = String(date.getUTCMinutes()).padStart(2, '0');
        const ss = String(date.getUTCSeconds()).padStart(2, '0');
        return `${y}${m}${d}T${hh}${mm}${ss}Z`;
    }

    /**
     * Format Date as iCalendar local timestamp (no Z suffix).
     * Used with TZID parameter for timezone-aware events.
     * Input is treated as Asia/Jakarta (WIB) local time.
     * @param {Date|string} value
     * @returns {string|null} e.g. "20260520T090000"
     */
    toIcsDateTimeLocal(value) {
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) return null;
        // Use local time components — the input from frontend datetime-local
        // is already in WIB (Asia/Jakarta) context.
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        const hh = String(date.getHours()).padStart(2, '0');
        const mm = String(date.getMinutes()).padStart(2, '0');
        const ss = String(date.getSeconds()).padStart(2, '0');
        return `${y}${m}${d}T${hh}${mm}${ss}`;
    }

    buildCalendarInvite({ organizerEmail, organizerName, recipientEmail, title, description, location, startAt, endAt, uid, sequence = 0 }) {
        const nowStamp = this.toIcsDateTimeUtc(new Date());
        const startStamp = this.toIcsDateTimeLocal(startAt);
        const endStamp = this.toIcsDateTimeLocal(endAt);
        if (!startStamp || !endStamp) {
            throw new Error('Invalid calendar time range');
        }

        const orgDisplay = this.sanitizeIcsText(organizerName || organizerEmail);
        const eventTitle = this.sanitizeIcsText(title || 'Email Blast Invitation');
        const eventDesc = this.sanitizeIcsText(description || '');
        const eventLocation = this.sanitizeIcsText(location || '');
        const eventUid = String(uid || `${Date.now()}-${recipientEmail}`).trim();

        // VTIMEZONE block for Asia/Jakarta (WIB, UTC+7, no DST)
        const tzId = 'Asia/Jakarta';

        return [
            'BEGIN:VCALENDAR',
            'PRODID:-//CSI Portal//Email Blast//ID',
            'VERSION:2.0',
            'CALSCALE:GREGORIAN',
            'METHOD:REQUEST',
            'BEGIN:VTIMEZONE',
            `TZID:${tzId}`,
            'BEGIN:STANDARD',
            'DTSTART:19700101T000000',
            'TZOFFSETFROM:+0700',
            'TZOFFSETTO:+0700',
            'TZNAME:WIB',
            'END:STANDARD',
            'END:VTIMEZONE',
            'BEGIN:VEVENT',
            `UID:${eventUid}`,
            `SEQUENCE:${Number(sequence) || 0}`,
            `DTSTAMP:${nowStamp}`,
            `DTSTART;TZID=${tzId}:${startStamp}`,
            `DTEND;TZID=${tzId}:${endStamp}`,
            `SUMMARY:${eventTitle}`,
            `DESCRIPTION:${eventDesc}`,
            `LOCATION:${eventLocation}`,
            `ORGANIZER;CN=${orgDisplay}:mailto:${organizerEmail}`,
            `ATTENDEE;CN=${this.sanitizeIcsText(recipientEmail)};RSVP=TRUE:mailto:${recipientEmail}`,
            'STATUS:CONFIRMED',
            'TRANSP:OPAQUE',
            'END:VEVENT',
            'END:VCALENDAR'
        ].join('\r\n');
    }

    async sendStandaloneBlast(params = {}) {
        const subject = String(params.subject || '').trim();
        const message = this.sanitizeEmailPlainText(params.message || '');
        const recipients = Array.isArray(params.recipients) ? params.recipients : [];
        const includeQrCode = params.includeQrCode === true;
        const includeSurveyButton = params.includeSurveyButton === true;
        const surveyLink = String(params.surveyLink || '').trim();
        const buttonLabel = String(params.buttonLabel || 'Mulai Survey').trim() || 'Mulai Survey';
        const teamsLink = String(params.teamsLink || '').trim();
        const includeCalendarInvite = params.includeCalendarInvite === true;
        const eventTitle = String(params.eventTitle || 'Undangan Meeting').trim();
        const eventLocation = String(params.location || '').trim();
        const startAt = params.startAt ? new Date(params.startAt) : null;
        const endAt = params.endAt ? new Date(params.endAt) : null;

        if (!subject) throw new Error('Subject is required');
        if (!message) throw new Error('Message is required');
        if (recipients.length === 0) throw new Error('At least one recipient is required');

        if (includeCalendarInvite) {
            if (!startAt || !endAt || Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
                throw new Error('Valid startAt and endAt are required for calendar invite');
            }
            if (endAt <= startAt) {
                throw new Error('endAt must be greater than startAt');
            }
        }

        const normalizedRecipients = recipients
            .map((recipient) => {
                const email = String(recipient?.email || '').trim().toLowerCase();
                const name = String(recipient?.name || '').trim();
                return { email, name: name || email.split('@')[0] || 'Recipient' };
            })
            .filter((recipient) => this.validateEmail(recipient.email));

        if (normalizedRecipients.length === 0) {
            throw new Error('No valid recipient email found');
        }

        const fromRaw = process.env.SMTP_FROM || 'noreply@component.astra.co.id';
        const fromAddress = this.parseFromAddress(fromRaw);
        const fromEmailMatch = String(fromRaw).match(/<([^>]+)>/);
        const organizerEmail = (fromEmailMatch ? fromEmailMatch[1] : String(fromRaw)).trim();
        const organizerName = (String(fromRaw).match(/^(.+?)\s*<.+>$/) || [])[1] || 'CSI Portal';
        const baseDescription = teamsLink
            ? `${message}\n\nLink Teams:\n${teamsLink}`
            : message;
        const logo = this.getLogoCidAttachment();
        const qrCodeDataUrl = includeQrCode && surveyLink
            ? await QRCode.toDataURL(surveyLink, { errorCorrectionLevel: 'M', margin: 1, width: 220 })
            : null;

        const emails = [];
        for (const recipient of normalizedRecipients) {
            const templateData = {
                subject,
                recipientName: recipient.name,
                message: baseDescription,
                includeSurveyButton,
                surveyLink,
                buttonLabel,
                includeQrCode,
                qrCodeDataUrl,
                logoCid: logo ? logo.cidRef : null,
                baseUrl: process.env.BASE_URL || 'http://localhost:3000',
                includeCalendarInvite,
                eventTitle: includeCalendarInvite ? eventTitle : null,
                eventLocation: includeCalendarInvite ? eventLocation : null,
                teamsLink: includeCalendarInvite ? teamsLink : null,
                startAt: includeCalendarInvite && startAt ? startAt.toISOString() : null,
                endAt: includeCalendarInvite && endAt ? endAt.toISOString() : null
            };

            // eslint-disable-next-line no-await-in-loop
            const html = await this.renderTemplate('standalone-blast', templateData);

            const mailOptions = {
                from: fromAddress,
                to: recipient.email,
                subject,
                html,
                text: `Halo ${recipient.name},\n\n${baseDescription}${includeSurveyButton && surveyLink ? `\n\n${buttonLabel}: ${surveyLink}` : ''}\n`,
                attachments: [...(logo ? [logo.attachment] : [])],
                emailType: 'Blast'
            };

            if (includeCalendarInvite) {
                const uid = `${eventTitle.replace(/\s+/g, '-').toLowerCase()}-${recipient.email}-${startAt.getTime()}@csi.portal`;
                const ics = this.buildCalendarInvite({
                    organizerEmail,
                    organizerName,
                    recipientEmail: recipient.email,
                    title: eventTitle,
                    description: baseDescription,
                    location: eventLocation || (teamsLink ? `Microsoft Teams: ${teamsLink}` : ''),
                    startAt,
                    endAt,
                    uid
                });
                mailOptions.icalEvent = {
                    method: 'REQUEST',
                    filename: 'invite.ics',
                    content: ics
                };
            }

            emails.push(mailOptions);
        }

        const result = { total: emails.length, sent: 0, failed: 0, errors: [] };

        for (const mail of emails) {
            try {
                // eslint-disable-next-line no-await-in-loop
                await this.transporter.sendMail(mail);
                result.sent += 1;
                // eslint-disable-next-line no-await-in-loop
                await this.logEmail({
                    surveyId: null,
                    recipientEmail: mail.to,
                    recipientName: null,
                    subject: mail.subject,
                    emailType: 'Blast',
                    status: 'Sent',
                    errorMessage: null
                });
            } catch (error) {
                logger.error(`Standalone blast failed for ${mail.to}:`, error);
                result.failed += 1;
                result.errors.push({ email: mail.to, error: error.message || 'Unknown error' });
                // eslint-disable-next-line no-await-in-loop
                await this.logEmail({
                    surveyId: null,
                    recipientEmail: mail.to,
                    recipientName: null,
                    subject: mail.subject,
                    emailType: 'Blast',
                    status: 'Failed',
                    errorMessage: error.message
                });
            }
        }

        return result;
    }
}

// Export singleton instance
module.exports = new EmailService();


