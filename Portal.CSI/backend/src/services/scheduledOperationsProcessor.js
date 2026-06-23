const sql = require('../database/sql-client');
/**
 * Scheduled Operations Processor
 * Background job that processes scheduled email blasts and reminders
 */

const cron = require('node-cron');

  
const logger = require('../config/logger');
const db = require('../database/connection');
const emailService = require('./emailService');

class ScheduledOperationsProcessor {
    constructor() {
        this.isRunning = false;
        this.cronJob = null;
    }

    /**
     * Start the scheduled operations processor
     * Runs every minute to check for pending operations
     */
    start() {
        if (this.cronJob) {
            logger.warn('Scheduled operations processor is already running');
            return;
        }

        // Run every minute
        this.cronJob = cron.schedule('* * * * *', async () => {
            if (this.isRunning) {
                logger.debug('Previous operation still running, skipping this cycle');
                return;
            }

            this.isRunning = true;
            try {
                await this.processScheduledOperations();
            } catch (error) {
                logger.error('Error processing scheduled operations:', error);
            } finally {
                this.isRunning = false;
            }
        });

        logger.info('Scheduled operations processor started');
    }

    /**
     * Stop the scheduled operations processor
     */
    stop() {
        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob = null;
            logger.info('Scheduled operations processor stopped');
        }
    }

    /**
     * Process all pending scheduled operations
     */
    async processScheduledOperations() {
        const pool = await db.getPool();

        try {
            // Recover stuck Running operations (running for more than 30 minutes)
            const stuckResult = await pool.request()
                .query(`
                    SELECT OperationId
                    FROM ScheduledOperations
                    WHERE Status = 'Running'
                        AND LastExecutedAt < DATEADD(MINUTE, -30, GETDATE())
                `);

            const stuckOps = stuckResult.recordset;
            if (stuckOps.length > 0) {
                logger.warn(`Found ${stuckOps.length} stuck Running operations, recovering...`);
                await pool.request()
                    .query(`
                        UPDATE ScheduledOperations
                        SET Status = 'Pending',
                            ErrorMessage = 'Recovered from stuck Running state (exceeded 30 minute timeout)'
                        WHERE Status = 'Running'
                            AND LastExecutedAt < DATEADD(MINUTE, -30, GETDATE())
                    `);
            }

            // Get pending operations that are due
            const result = await pool.request()
                .query(`
                    SELECT
                        OperationId,
                        SurveyId,
                        OperationType,
                        Frequency,
                        ScheduledDate,
                        ScheduledTime,
                        DayOfWeek,
                        EmailTemplate,
                        EmbedCover,
                        TargetCriteria,
                        OperationContext,
                        NextExecutionAt
                    FROM ScheduledOperations
                    WHERE Status = 'Pending'
                        AND (
                            NextExecutionAt <= GETDATE()
                            OR (NextExecutionAt IS NULL AND ScheduledDate <= GETDATE())
                        )
                    ORDER BY NextExecutionAt
                `);

            const operations = result.recordset;

            if (operations.length === 0) {
                logger.debug('No pending operations to process');
                return;
            }

            logger.info(`Processing ${operations.length} scheduled operations`);

            for (const operation of operations) {
                await this.processOperation(operation);
            }
        } catch (error) {
            logger.error('Failed to process scheduled operations:', error);
            throw error;
        }
    }

    /**
     * Process a single scheduled operation
     * @param {Object} operation - Operation details
     */
    async processOperation(operation) {
        const pool = await db.getPool();
        const operationId = operation.OperationId;

        try {
            logger.info(`Processing operation ${operationId} (${operation.OperationType})`);

            // Mark as running
            await pool.request()
                .input('operationId', sql.BigInt, operationId)
                .query(`
                    UPDATE ScheduledOperations
                    SET Status = 'Running',
                        LastExecutedAt = GETDATE()
                    WHERE OperationId = @operationId
                `);

            // Execute the operation
            let result;
            if (operation.OperationType === 'Blast') {
                result = await this.executeBlast(operation);
            } else if (operation.OperationType === 'Reminder') {
                result = await this.executeReminder(operation);
            } else if (operation.OperationType === 'StandaloneBlast') {
                result = await this.executeStandaloneBlast(operation);
            } else {
                throw new Error(`Unknown operation type: ${operation.OperationType}`);
            }

            logger.info(`Operation ${operationId} result: ${result.sent} sent, ${result.failed} failed, ${result.skipped || 0} skipped`);

            // Evaluasi hasil sebelum update status — hindari double-update (Completed lalu Failed)
            let finalStatus, finalErrorMessage;
            if (result.sent === 0 && (result.failed > 0 || result.total > 0)) {
                finalStatus = 'Failed';
                finalErrorMessage = `Blast failed: 0 sent, ${result.failed} failed, ${result.total} total recipients`;
                logger.warn(`Operation ${operationId} failed: 0 dari ${result.total} email berhasil dikirim`);
            } else {
                finalStatus = 'Completed';
                finalErrorMessage = null;
            }

            // Calculate next execution time for recurring operations
            const nextExecutionAt = this.calculateNextExecution(operation);

            // Update operation status — hanya satu kali (atomic)
            if (finalStatus === 'Completed' && nextExecutionAt && operation.Frequency !== 'once') {
                // Recurring operation - set back to Pending with new execution time
                // Format as local time string to avoid UTC conversion by mssql driver
                const nextExecStr = this.formatLocalDateTime(nextExecutionAt);
                await pool.request()
                    .input('operationId', sql.BigInt, operationId)
                    .input('nextExecutionAt', sql.NVarChar(50), nextExecStr)
                    .query(`
                        UPDATE ScheduledOperations
                        SET Status = 'Pending',
                            NextExecutionAt = @nextExecutionAt,
                            ExecutionCount = ExecutionCount + 1,
                            ErrorMessage = NULL
                        WHERE OperationId = @operationId
                    `);

                logger.info(`Operation ${operationId} completed. Next execution: ${nextExecutionAt}`);
            } else {
                // One-time operation atau failed — update ke status final sekali
                await pool.request()
                    .input('operationId', sql.BigInt, operationId)
                    .input('errorMessage', sql.NVarChar(sql.MAX), finalErrorMessage)
                    .query(`
                        UPDATE ScheduledOperations
                        SET Status = '${finalStatus}',
                            ExecutionCount = ExecutionCount + 1,
                            ErrorMessage = @errorMessage
                        WHERE OperationId = @operationId
                    `);

                logger.info(`Operation ${operationId} ${finalStatus === 'Failed' ? 'failed' : 'completed'} (one-time)`);
            }
        } catch (error) {
            logger.error(`Failed to process operation ${operationId}:`, error);

            // Mark as failed
            await pool.request()
                .input('operationId', sql.BigInt, operationId)
                .input('errorMessage', sql.NVarChar(sql.MAX), error.message)
                .query(`
                    UPDATE ScheduledOperations
                    SET Status = 'Failed',
                        ErrorMessage = @errorMessage
                    WHERE OperationId = @operationId
                `);
        }
    }

    /**
     * Execute a blast operation
     * @param {Object} operation - Operation details
     * @returns {Promise<Object>} Results
     */
    async executeBlast(operation) {
        const targetCriteria = operation.TargetCriteria 
            ? JSON.parse(operation.TargetCriteria) 
            : {};
        const recipientEmails = Array.isArray(targetCriteria.recipientEmails)
            ? targetCriteria.recipientEmails
            : [];
        const customSubject = typeof targetCriteria.customSubject === 'string'
            ? targetCriteria.customSubject
            : '';
        const includeQrCode = targetCriteria.includeQrCode === true;
        const customMessage = typeof targetCriteria.customMessage === 'string'
            ? targetCriteria.customMessage
            : '';

        const resolvedTemplate = this.resolveTemplateName(operation.EmailTemplate, 'survey-invitation');
        const legacyMessage = resolvedTemplate === 'survey-invitation' && operation.EmailTemplate !== resolvedTemplate
            ? String(operation.EmailTemplate || '')
            : '';

        return await emailService.sendSurveyBlast({
            surveyId: operation.SurveyId,
            targetCriteria,
            emailTemplate: resolvedTemplate,
            customSubject,
            customMessage: customMessage || legacyMessage,
            includeQrCode,
            recipientEmails,
            disableDuplicateCheck: true,
            embedCover: operation.EmbedCover
        });
    }

    /**
     * Execute a reminder operation
     * @param {Object} operation - Operation details
     * @returns {Promise<Object>} Results
     */
    async executeReminder(operation) {
        const targetCriteria = operation.TargetCriteria
            ? JSON.parse(operation.TargetCriteria)
            : {};
        const recipientEmails = Array.isArray(targetCriteria.recipientEmails)
            ? targetCriteria.recipientEmails
            : [];
        const customSubject = typeof targetCriteria.customSubject === 'string'
            ? targetCriteria.customSubject
            : '';
        const customMessage = typeof targetCriteria.customMessage === 'string'
            ? targetCriteria.customMessage
            : '';

        const resolvedTemplate = this.resolveTemplateName(operation.EmailTemplate, 'survey-reminder');
        const legacyMessage = resolvedTemplate === 'survey-reminder' && operation.EmailTemplate !== resolvedTemplate
            ? String(operation.EmailTemplate || '')
            : '';

        return await emailService.sendReminders({
            surveyId: operation.SurveyId,
            emailTemplate: resolvedTemplate,
            customSubject,
            customMessage: customMessage || legacyMessage,
            recipientEmails,
            embedCover: operation.EmbedCover
        });
    }

    /**
     * Execute a standalone blast operation (no survey context)
     * @param {Object} operation - Operation details
     * @returns {Promise<Object>} Results
     */
    async executeStandaloneBlast(operation) {
        const context = operation.OperationContext
            ? JSON.parse(operation.OperationContext)
            : {};

        return await emailService.sendStandaloneBlast({
            subject: context.subject || '',
            message: context.message || '',
            recipients: Array.isArray(context.recipients) ? context.recipients : [],
            includeQrCode: context.includeQrCode === true,
            includeSurveyButton: context.includeSurveyButton === true,
            surveyLink: context.surveyLink || '',
            buttonLabel: context.buttonLabel || '',
            includeCalendarInvite: context.includeCalendarInvite === true,
            eventTitle: context.eventTitle || '',
            location: context.location || '',
            teamsLink: context.teamsLink || '',
            startAt: context.startAt || null,
            endAt: context.endAt || null
        });
    }

    resolveTemplateName(templateName, fallback) {
        const value = String(templateName || '').trim();
        if (value === 'survey-invitation' || value === 'survey-reminder') {
            return value;
        }

        // Backward compatibility: legacy records may store plain message in EmailTemplate.
        return fallback;
    }

    /**
     * Format a Date object as local datetime string (YYYY-MM-DD HH:mm:ss)
     */
    formatLocalDateTime(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        const h = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        const s = String(date.getSeconds()).padStart(2, '0');
        return `${y}-${m}-${d} ${h}:${min}:${s}`;
    }

    /**
     * Calculate next execution time for recurring operations
     * @param {Object} operation - Operation details
     * @returns {Date|null} Next execution time or null for one-time operations
     */
    calculateNextExecution(operation) {
        if (operation.Frequency === 'once') {
            return null;
        }

        // TIMEZONE NOTE: new Date() di sini menggunakan timezone lokal server (Node.js process).
        // Pastikan server berjalan di timezone WIB (UTC+7) agar konsisten dengan SQL Server GETDATE().
        // Nilai nextExecution kemudian di-format via formatLocalDateTime() sebagai string lokal
        // sebelum di-pass ke SQL — JANGAN ubah ke UTC saat mengirim ke query.
        const now = new Date(); // Diasumsikan WIB (UTC+7) — pastikan konsisten dengan SQL Server timezone
        let nextExecution = new Date(now);

        switch (operation.Frequency) {
            case 'daily':
                // Execute at the same time tomorrow
                if (operation.ScheduledTime) {
                    const [hours, minutes] = operation.ScheduledTime.split(':');
                    nextExecution.setDate(nextExecution.getDate() + 1);
                    nextExecution.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                } else {
                    nextExecution.setDate(nextExecution.getDate() + 1);
                }
                break;

            case 'weekly':
                // Execute on the same day of week next week
                if (operation.DayOfWeek !== null) {
                    const currentDay = nextExecution.getDay();
                    const targetDay = operation.DayOfWeek;
                    let daysToAdd = targetDay - currentDay;
                    
                    if (daysToAdd <= 0) {
                        daysToAdd += 7; // Next week
                    }
                    
                    nextExecution.setDate(nextExecution.getDate() + daysToAdd);
                    
                    if (operation.ScheduledTime) {
                        const [hours, minutes] = operation.ScheduledTime.split(':');
                        nextExecution.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                    }
                } else {
                    nextExecution.setDate(nextExecution.getDate() + 7);
                }
                break;

            case 'monthly':
                // Execute on the same date next month
                nextExecution.setMonth(nextExecution.getMonth() + 1);
                
                if (operation.ScheduledTime) {
                    const [hours, minutes] = operation.ScheduledTime.split(':');
                    nextExecution.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                }
                break;

            default:
                logger.warn(`Unknown frequency: ${operation.Frequency}`);
                return null;
        }

        return nextExecution;
    }

    /**
     * Manually trigger processing (for testing)
     */
    async triggerProcessing() {
        if (this.isRunning) {
            throw new Error('Processing is already running');
        }

        this.isRunning = true;
        try {
            await this.processScheduledOperations();
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Get processor status
     * @returns {Object} Status information
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            isScheduled: this.cronJob !== null
        };
    }
}

// Export singleton instance
module.exports = new ScheduledOperationsProcessor();


