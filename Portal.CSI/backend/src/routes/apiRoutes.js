const express = require('express');
const multer = require('multer');
const config = require('../config');
const validators = require('../middleware/validators');
const {
  requireAuth,
  requirePermission
} = require('../middleware/authMiddleware');
const { uploadTimeoutHandler } = require('../middleware/connectionHandler');

const userController = require('../controllers/userController');
const businessUnitController = require('../controllers/businessUnitController');
const divisionController = require('../controllers/divisionController');
const departmentController = require('../controllers/departmentController');
const functionController = require('../controllers/functionController');
const applicationController = require('../controllers/applicationController');
const mappingController = require('../controllers/mappingController');
const surveyController = require('../controllers/surveyController');
const questionController = require('../controllers/questionController');
const responseController = require('../controllers/responseController');
const reportController = require('../controllers/reportController');
const approvalController = require('../controllers/approvalController');
const emailController = require('../controllers/emailController');
const auditController = require('../controllers/auditController');
const integrationController = require('../controllers/integrationController');
const doorprizeController = require('../controllers/doorprizeController');

const router = express.Router();
const maxUploadSizeBytes = (config.upload.maxFileSizeMB || 10) * 1024 * 1024;

// Upload timeout handler (5 minutes)
const uploadTimeout = uploadTimeoutHandler(300000);

function createUploadMiddleware(allowedMimeTypes) {
  return multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: maxUploadSizeBytes,
      files: 1
    },
    fileFilter: (req, file, cb) => {
      if (!allowedMimeTypes.includes(file.mimetype)) {
        const error = new Error(`Invalid file type: ${file.mimetype}`);
        error.statusCode = 400;
        return cb(error);
      }

      cb(null, true);
    }
  });
}

const spreadsheetUpload = createUploadMiddleware([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv'
]);

// Public master data endpoints for respondent form
router.get('/public/business-units', businessUnitController.getBusinessUnits);
router.get('/public/divisions', divisionController.getDivisions);
router.get('/public/departments', departmentController.getDepartments);
router.get('/public/functions', functionController.getFunctions);
router.get('/public/users/it-leads', userController.getPublicITLeads);
router.get('/public/survey-link/:code', surveyController.resolveSurveyShortCode);

// Users
router.get('/users', requireAuth, requirePermission('users:read'), userController.getUsers);
router.get('/users/template', requireAuth, requirePermission('users:read'), userController.downloadUserTemplate);
router.get('/users/download', requireAuth, requirePermission('users:read'), userController.downloadUserList);
router.post('/users/upload', requireAuth, requirePermission('users:create'), uploadTimeout, spreadsheetUpload.single('file'), userController.uploadUserFile);
router.get('/users/:id', requireAuth, requirePermission('users:read'), userController.getUserById);
router.post('/users', requireAuth, requirePermission('users:create'), userController.createUserValidation, userController.createUser);
router.put('/users/:id', requireAuth, requirePermission('users:update'), userController.updateUserValidation, userController.updateUser);
router.delete('/users/:id', requireAuth, requirePermission('users:delete'), userController.deactivateUser);
router.patch('/users/:id/ldap', requireAuth, requirePermission('users:update'), userController.toggleLDAPValidation, userController.toggleUserLDAP);
router.patch('/users/:id/password', requireAuth, requirePermission('users:update'), userController.setPasswordValidation, userController.setUserPassword);

// Master data
router.get('/business-units', requireAuth, requirePermission('master-data:read'), businessUnitController.getBusinessUnits);
router.get('/business-units/template', requireAuth, requirePermission('master-data:read'), businessUnitController.downloadTemplate);
router.post('/business-units/upload', requireAuth, requirePermission('master-data:create'), uploadTimeout, spreadsheetUpload.single('file'), businessUnitController.uploadBusinessUnits);
router.get('/business-units/:id', requireAuth, requirePermission('master-data:read'), businessUnitController.getBusinessUnitById);
router.post('/business-units', requireAuth, requirePermission('master-data:create'), businessUnitController.createBusinessUnitValidation, businessUnitController.createBusinessUnit);
router.put('/business-units/:id', requireAuth, requirePermission('master-data:update'), businessUnitController.updateBusinessUnitValidation, businessUnitController.updateBusinessUnit);
router.delete('/business-units/:id', requireAuth, requirePermission('master-data:delete'), businessUnitController.deleteBusinessUnit);

router.get('/divisions', requireAuth, requirePermission('master-data:read'), divisionController.getDivisions);
router.get('/divisions/template', requireAuth, requirePermission('master-data:read'), divisionController.downloadTemplate);
router.post('/divisions/upload', requireAuth, requirePermission('master-data:create'), uploadTimeout, spreadsheetUpload.single('file'), divisionController.uploadDivisions);
router.get('/divisions/:id', requireAuth, requirePermission('master-data:read'), divisionController.getDivisionById);
router.post('/divisions', requireAuth, requirePermission('master-data:create'), divisionController.createDivisionValidation, divisionController.createDivision);
router.put('/divisions/:id', requireAuth, requirePermission('master-data:update'), divisionController.updateDivisionValidation, divisionController.updateDivision);
router.delete('/divisions/:id', requireAuth, requirePermission('master-data:delete'), divisionController.deleteDivision);

router.get('/departments', requireAuth, requirePermission('master-data:read'), departmentController.getDepartments);
router.get('/departments/template', requireAuth, requirePermission('master-data:read'), departmentController.downloadTemplate);
router.post('/departments/upload', requireAuth, requirePermission('master-data:create'), uploadTimeout, spreadsheetUpload.single('file'), departmentController.uploadDepartments);
router.get('/departments/:id', requireAuth, requirePermission('master-data:read'), departmentController.getDepartmentById);
router.post('/departments', requireAuth, requirePermission('master-data:create'), departmentController.createDepartmentValidation, departmentController.createDepartment);
router.put('/departments/:id', requireAuth, requirePermission('master-data:update'), departmentController.updateDepartmentValidation, departmentController.updateDepartment);
router.delete('/departments/:id', requireAuth, requirePermission('master-data:delete'), departmentController.deleteDepartment);

router.get('/functions', requireAuth, requirePermission('master-data:read'), functionController.getFunctions);
router.get('/functions/template', requireAuth, requirePermission('master-data:read'), functionController.downloadTemplate);
router.post('/functions/upload', requireAuth, requirePermission('master-data:create'), uploadTimeout, spreadsheetUpload.single('file'), functionController.uploadFunctions);
router.get('/functions/:id', requireAuth, requirePermission('master-data:read'), functionController.getFunctionById);
router.post('/functions', requireAuth, requirePermission('master-data:create'), functionController.createFunctionValidation, functionController.createFunction);
router.put('/functions/:id', requireAuth, requirePermission('master-data:update'), functionController.updateFunctionValidation, functionController.updateFunction);
router.delete('/functions/:id', requireAuth, requirePermission('master-data:delete'), functionController.deleteFunction);

router.get('/applications', requireAuth, requirePermission('master-data:read'), applicationController.getApplications);
router.get('/applications/template', requireAuth, requirePermission('master-data:read'), applicationController.downloadTemplate);
router.post('/applications/upload', requireAuth, requirePermission('master-data:create'), uploadTimeout, spreadsheetUpload.single('file'), applicationController.uploadApplications);
router.get('/applications/:id', requireAuth, requirePermission('master-data:read'), applicationController.getApplicationById);
router.post('/applications', requireAuth, requirePermission('master-data:create'), applicationController.createApplicationValidation, applicationController.createApplication);
router.put('/applications/:id', requireAuth, requirePermission('master-data:update'), applicationController.updateApplicationValidation, applicationController.updateApplication);
router.delete('/applications/:id', requireAuth, requirePermission('master-data:delete'), applicationController.deleteApplication);

// Mappings
router.get('/mappings/function-application', requireAuth, requirePermission('mappings:read'), mappingController.getFunctionAppMappings);
router.post('/mappings/function-application', requireAuth, requirePermission('mappings:create'), mappingController.createFunctionAppMappingValidation, mappingController.createFunctionAppMapping);
router.delete('/mappings/function-application/:id', requireAuth, requirePermission('mappings:delete'), mappingController.deleteFunctionAppMapping);
router.get('/mappings/function-application/function/:functionId', requireAuth, requirePermission('mappings:read'), mappingController.getApplicationsByFunction);
router.get('/mappings/function-application/application/:applicationId', requireAuth, requirePermission('mappings:read'), mappingController.getFunctionsByApplication);
router.get('/mappings/function-application/export/csv', requireAuth, requirePermission('mappings:read'), mappingController.exportFunctionAppMappingsToCSV);

router.get('/mappings/application-department', requireAuth, requirePermission('mappings:read'), mappingController.getAppDeptMappings);
router.post('/mappings/application-department', requireAuth, requirePermission('mappings:create'), mappingController.createAppDeptMappingValidation, mappingController.createAppDeptMapping);
router.delete('/mappings/application-department/:id', requireAuth, requirePermission('mappings:delete'), mappingController.deleteAppDeptMapping);
router.get('/mappings/application-department/department/:departmentId', requireAuth, requirePermission('mappings:read'), mappingController.getApplicationsByDepartment);
router.get('/mappings/application-department/application/:applicationId', requireAuth, requirePermission('mappings:read'), mappingController.getDepartmentsByApplication);
router.get('/mappings/application-department/export/csv', requireAuth, requirePermission('mappings:read'), mappingController.exportAppDeptMappingsToCSV);
router.post('/mappings/bulk-import', requireAuth, requirePermission('mappings:create'), uploadTimeout, spreadsheetUpload.single('file'), mappingController.bulkImportMappings);

// Backward-compatible mapping aliases used by current frontend
router.get('/mappings/function-app/details', requireAuth, requirePermission('mappings:read'), (req, res, next) => {
  req.query.detailed = 'true';
  return mappingController.getFunctionAppMappings(req, res, next);
});
router.post('/mappings/function-app', requireAuth, requirePermission('mappings:create'), mappingController.createFunctionAppMappingValidation, mappingController.createFunctionAppMapping);
router.get('/mappings/function-app/export', requireAuth, requirePermission('mappings:read'), mappingController.exportFunctionAppMappingsToCSV);
router.get('/mappings/function-app/template', requireAuth, requirePermission('mappings:read'), mappingController.downloadFunctionAppTemplate);
router.get('/mappings/app-dept/hierarchical', requireAuth, requirePermission('mappings:read'), (req, res, next) => {
  req.query.hierarchical = 'true';
  return mappingController.getAppDeptMappings(req, res, next);
});
router.post('/mappings/app-dept', requireAuth, requirePermission('mappings:create'), mappingController.createAppDeptMappingValidation, mappingController.createAppDeptMapping);
router.get('/mappings/app-dept/export', requireAuth, requirePermission('mappings:read'), mappingController.exportAppDeptMappingsToCSV);
router.get('/mappings/app-dept/template', requireAuth, requirePermission('mappings:read'), mappingController.downloadAppDeptTemplate);

// Surveys and questions
router.get('/surveys', requireAuth, requirePermission('surveys:read'), surveyController.getSurveys);
router.get('/surveys/:id', requireAuth, requirePermission('surveys:read'), surveyController.getSurveyById);
router.post('/surveys', requireAuth, requirePermission('surveys:create'), surveyController.createSurveyValidation, surveyController.createSurvey);
router.put('/surveys/:id', requireAuth, requirePermission('surveys:update'), surveyController.updateSurveyValidation, surveyController.updateSurvey);
router.delete('/surveys/:id', requireAuth, requirePermission('surveys:delete'), surveyController.deleteSurvey);
router.patch('/surveys/:id/config', requireAuth, requirePermission('surveys:update'), surveyController.updateSurveyConfig);
router.get('/surveys/:id/preview', requireAuth, requirePermission('surveys:read'), surveyController.generatePreview);
router.post('/surveys/:id/link', requireAuth, requirePermission('surveys:read'), surveyController.generateSurveyLink);
router.post('/surveys/:id/qrcode', requireAuth, requirePermission('surveys:read'), surveyController.generateQRCode);
router.post('/surveys/:id/embed', requireAuth, requirePermission('surveys:read'), surveyController.generateEmbedCode);
router.post('/surveys/:id/schedule-blast', requireAuth, requirePermission('surveys:update'), validators.validateScheduleOperation, surveyController.scheduleBlast);
router.post('/surveys/:id/schedule-reminder', requireAuth, requirePermission('surveys:update'), validators.validateScheduleOperation, surveyController.scheduleReminder);
router.get('/surveys/:id/scheduled-operations', requireAuth, requirePermission('surveys:read'), surveyController.getScheduledOperations);
router.delete('/surveys/scheduled-operations/:operationId', requireAuth, requirePermission('surveys:update'), surveyController.cancelScheduledOperation);
router.post('/surveys/scheduled-operations/:operationId/retry', requireAuth, requirePermission('surveys:update'), surveyController.retryScheduledOperation);
router.post('/surveys/:id/upload/hero', requireAuth, requirePermission('surveys:update'), uploadTimeout, surveyController.upload.single('image'), surveyController.uploadHeroImage);
router.post('/surveys/:id/upload/logo', requireAuth, requirePermission('surveys:update'), uploadTimeout, surveyController.upload.single('image'), surveyController.uploadLogo);
router.post('/surveys/:id/upload/background', requireAuth, requirePermission('surveys:update'), uploadTimeout, surveyController.upload.single('image'), surveyController.uploadBackgroundImage);

// Event aliases (naming transition from survey -> event)
router.get('/events', requireAuth, requirePermission('surveys:read'), surveyController.getEvents);
router.get('/events/:id', requireAuth, requirePermission('surveys:read'), surveyController.getEventById);
router.post('/events', requireAuth, requirePermission('surveys:create'), surveyController.createEventValidation, surveyController.createEvent);
router.put('/events/:id', requireAuth, requirePermission('surveys:update'), surveyController.updateEventValidation, surveyController.updateEvent);
router.delete('/events/:id', requireAuth, requirePermission('surveys:delete'), surveyController.deleteEvent);
router.patch('/events/:id/config', requireAuth, requirePermission('surveys:update'), surveyController.updateSurveyConfig);
router.get('/events/:id/preview', requireAuth, requirePermission('surveys:read'), surveyController.generatePreview);
router.post('/events/:id/link', requireAuth, requirePermission('surveys:read'), surveyController.generateSurveyLink);
router.post('/events/:id/qrcode', requireAuth, requirePermission('surveys:read'), surveyController.generateQRCode);
router.post('/events/:id/embed', requireAuth, requirePermission('surveys:read'), surveyController.generateEmbedCode);
router.post('/events/:id/schedule-blast', requireAuth, requirePermission('surveys:update'), validators.validateScheduleOperation, surveyController.scheduleBlast);
router.post('/events/:id/schedule-reminder', requireAuth, requirePermission('surveys:update'), validators.validateScheduleOperation, surveyController.scheduleReminder);
router.get('/events/:id/scheduled-operations', requireAuth, requirePermission('surveys:read'), surveyController.getScheduledOperations);
router.get('/events/:eventId/surveys', requireAuth, requirePermission('surveys:read'), surveyController.getEventSurveys);
router.post('/events/:eventId/surveys', requireAuth, requirePermission('surveys:create'), surveyController.createSurveyValidation, surveyController.createEventSurvey);

router.get('/questions/survey/:surveyId', requireAuth, requirePermission('surveys:read'), questionController.getQuestionsBySurvey);
router.post('/questions', requireAuth, requirePermission('surveys:update'), questionController.addQuestionValidation, questionController.addQuestion);
router.put('/questions/:id', requireAuth, requirePermission('surveys:update'), questionController.updateQuestionValidation, questionController.updateQuestion);
router.delete('/questions/:id', requireAuth, requirePermission('surveys:update'), questionController.deleteQuestion);
router.patch('/questions/reorder', requireAuth, requirePermission('surveys:update'), questionController.reorderQuestionsValidation, questionController.reorderQuestions);
router.post('/questions/:id/upload/image', requireAuth, requirePermission('surveys:update'), uploadTimeout, surveyController.upload.single('image'), questionController.uploadQuestionImage);
router.post('/questions/:id/upload/option/:optionIndex', requireAuth, requirePermission('surveys:update'), uploadTimeout, surveyController.upload.single('image'), questionController.uploadOptionImage);

// Public survey response endpoints
router.get('/responses/survey/:surveyId/form', responseController.getSurveyForm);
router.get('/responses/survey/:surveyId/applications', responseController.getAvailableApplications);
router.post('/responses/check-duplicate', responseController.checkDuplicateResponse);
router.post('/responses', responseController.submitResponseValidation, responseController.submitResponse);

// Response management
router.get('/responses', requireAuth, requirePermission('responses:read'), responseController.getResponses);
router.get('/responses/:id', requireAuth, requirePermission('responses:read'), responseController.getResponseById);
router.get('/responses/survey/:surveyId/statistics', requireAuth, requirePermission('responses:read'), responseController.getResponseStatistics);

// Reports
router.post('/reports/generate', requireAuth, requirePermission('reports:read'), reportController.generateReport);
router.post('/reports/view', requireAuth, requirePermission('reports:read'), reportController.viewReport);
router.post('/reports/before-takeout', requireAuth, requirePermission('reports:read'), reportController.generateBeforeTakeoutReport);
router.post('/reports/after-takeout', requireAuth, requirePermission('reports:read'), reportController.generateAfterTakeoutReport);
router.get('/reports/selection-list', requireAuth, requirePermission('reports:read'), reportController.getReportSelectionList);
router.get('/reports/takeout-comparison/:surveyId', requireAuth, requirePermission('reports:read'), reportController.getTakeoutComparisonTable);
router.get('/reports/department-head-review/:departmentId/:surveyId', requireAuth, requirePermission('reports:read'), reportController.getDepartmentHeadReview);
router.get('/reports/scores-by-function/:departmentId/:surveyId', requireAuth, requirePermission('reports:read'), reportController.getScoresByFunction);
router.get('/reports/approved-takeouts/:departmentId/:surveyId', requireAuth, requirePermission('reports:read'), reportController.getApprovedTakeouts);
router.post('/reports/export/excel', requireAuth, requirePermission('reports:export'), reportController.exportToExcel);
router.post('/reports/export/pdf', requireAuth, requirePermission('reports:export'), reportController.exportToPdf);
router.post('/reports/statistics', requireAuth, requirePermission('reports:read'), reportController.getAggregateStatistics);

// Approvals and best comments
router.post('/approvals/propose-takeout', requireAuth, requirePermission('responses:propose-takeout'), approvalController.proposeTakeoutForQuestion);
router.post('/approvals/bulk-propose-takeout', requireAuth, requirePermission('responses:propose-takeout'), approvalController.bulkProposeTakeout);
router.delete('/approvals/propose-takeout', requireAuth, requirePermission('responses:propose-takeout'), approvalController.cancelProposedTakeout);
router.post('/approvals/respondents/approve', requireAuth, requirePermission('responses:approve-initial'), approvalController.approveInitialResponses);
router.post('/approvals/respondents/reject', requireAuth, requirePermission('responses:reject-initial'), approvalController.rejectInitialResponses);
router.post('/approvals/respondents/final-approve', requireAuth, requirePermission('responses:approve-final'), approvalController.approveFinalResponses);
router.post('/approvals/approve', requireAuth, requirePermission('approvals:approve'), approvalController.approveProposedTakeout);
router.post('/approvals/reject', requireAuth, requirePermission('approvals:reject'), approvalController.rejectProposedTakeout);
router.get('/approvals/pending', requireAuth, requirePermission('approvals:read'), approvalController.getPendingApprovals);
router.get('/approvals/respondents', requireAuth, requirePermission('approvals:read'), approvalController.getRespondents);
router.get('/approvals/proposed-takeouts', requireAuth, requirePermission('approvals:read'), approvalController.getProposedTakeouts);
router.get('/approvals/comments', requireAuth, requirePermission('best-comments:read'), approvalController.getCommentsForSelection);
router.post('/approvals/best-comments', requireAuth, requirePermission('best-comments:create'), approvalController.markAsBestComment);
router.delete('/approvals/best-comments', requireAuth, requirePermission('best-comments:delete'), approvalController.unmarkBestComment);
router.get('/approvals/best-comments', requireAuth, requirePermission('best-comments:read'), approvalController.getBestComments);
router.get('/approvals/best-comments-with-feedback', requireAuth, requirePermission('best-comments:read'), approvalController.getBestCommentsWithFeedback);
router.post('/approvals/best-comments/feedback', requireAuth, requirePermission('best-comments:feedback'), approvalController.submitBestCommentFeedback);
router.get('/approvals/statistics/:surveyId', requireAuth, requirePermission('approvals:read'), approvalController.getApprovalStatistics);

// Emails
router.post('/emails/blast', requireAuth, requirePermission('emails:send'), emailController.sendSurveyBlast);
router.post('/emails/blast-standalone', requireAuth, requirePermission('emails:send'), uploadTimeout, spreadsheetUpload.single('file'), emailController.sendStandaloneBlast);
router.post('/emails/schedule-standalone', requireAuth, requirePermission('emails:send'), uploadTimeout, spreadsheetUpload.single('file'), emailController.scheduleStandaloneBlast);
router.get('/emails/recipients/:surveyId', requireAuth, requirePermission('emails:send'), emailController.getTargetRecipients);
router.post('/emails/reminders', requireAuth, requirePermission('emails:send'), emailController.sendReminders);
router.get('/emails/non-respondents/:surveyId', requireAuth, requirePermission('emails:send'), emailController.getNonRespondents);
router.post('/emails/approval-notification', requireAuth, requirePermission('emails:send'), emailController.sendApprovalNotification);
router.post('/emails/rejection-notification', requireAuth, requirePermission('emails:send'), emailController.sendRejectionNotification);
router.get('/emails/templates/:templateName', requireAuth, requirePermission('emails:send'), emailController.getTemplate);

// Audit
router.get('/audit', requireAuth, requirePermission('audit:read'), auditController.getAuditLogs);
router.get('/audit/entity-history/:entityType/:entityId', requireAuth, requirePermission('audit:read'), auditController.getEntityHistory);
router.post('/audit/log', requireAuth, requirePermission('audit:write'), auditController.logAction);

// SAP integration
router.post('/integrations/sap/sync', requireAuth, requirePermission('sap:sync'), integrationController.triggerSAPSync);
router.get('/integrations/sap/sync/status', requireAuth, requirePermission('sap:sync'), integrationController.getSAPSyncStatus);
router.get('/integrations/sap/sync/history', requireAuth, requirePermission('sap:sync'), integrationController.getSAPSyncHistory);
router.get('/integrations/sap/test-connection', requireAuth, requirePermission('sap:sync'), integrationController.testSAPConnection);

// ---------------------------------------------------------------------------
// Doorprize - Events
// ---------------------------------------------------------------------------
router.get('/doorprize/events', requireAuth, requirePermission('doorprize:read'), doorprizeController.getDoorprizeEvents);
router.get('/doorprize/events/:id', requireAuth, requirePermission('doorprize:read'), doorprizeController.eventIdParam, doorprizeController.getDoorprizeEventById);
router.post('/doorprize/events', requireAuth, requirePermission('doorprize:create'), doorprizeController.imageUpload.single('image'), doorprizeController.createEventValidation, doorprizeController.createDoorprizeEvent);
router.put('/doorprize/events/:id', requireAuth, requirePermission('doorprize:update'), doorprizeController.imageUpload.single('image'), doorprizeController.updateEventValidation, doorprizeController.updateDoorprizeEvent);
router.delete('/doorprize/events/:id', requireAuth, requirePermission('doorprize:delete'), doorprizeController.eventIdParam, doorprizeController.deleteDoorprizeEvent);

// ---------------------------------------------------------------------------
// Doorprize - Gifts
// ---------------------------------------------------------------------------
router.get('/doorprize/events/:id/gifts', requireAuth, requirePermission('doorprize:read'), doorprizeController.eventIdParam, doorprizeController.getGifts);
router.post('/doorprize/events/:id/gifts', requireAuth, requirePermission('doorprize:create'), doorprizeController.imageUpload.single('image'), doorprizeController.createGiftValidation, doorprizeController.createGift);
router.put('/doorprize/gifts/:id', requireAuth, requirePermission('doorprize:update'), doorprizeController.imageUpload.single('image'), doorprizeController.updateGiftValidation, doorprizeController.updateGift);
router.delete('/doorprize/gifts/:id', requireAuth, requirePermission('doorprize:delete'), doorprizeController.giftIdParam, doorprizeController.deleteGift);

// ---------------------------------------------------------------------------
// Doorprize - Participants
// ---------------------------------------------------------------------------
router.get('/doorprize/events/:id/participants', requireAuth, requirePermission('doorprize:read'), doorprizeController.eventIdParam, doorprizeController.getParticipants);
router.post('/doorprize/events/:id/participants', requireAuth, requirePermission('doorprize:create'), doorprizeController.imageUpload.single('image'), doorprizeController.createParticipantValidation, doorprizeController.createParticipant);
router.put('/doorprize/participants/:id', requireAuth, requirePermission('doorprize:update'), doorprizeController.imageUpload.single('image'), doorprizeController.updateParticipantValidation, doorprizeController.updateParticipant);
router.delete('/doorprize/participants/:id', requireAuth, requirePermission('doorprize:delete'), doorprizeController.participantIdParam, doorprizeController.deleteParticipant);
router.post('/doorprize/events/:id/participants/import', requireAuth, requirePermission('doorprize:create'), uploadTimeout, doorprizeController.spreadsheetUpload.single('file'), doorprizeController.eventIdParam, doorprizeController.importParticipants);
router.post('/doorprize/events/:id/participants/photos', requireAuth, requirePermission('doorprize:create'), uploadTimeout, doorprizeController.zipUpload.single('file'), doorprizeController.eventIdParam, doorprizeController.uploadParticipantPhotos);
router.get('/doorprize/events/:id/participants/template', requireAuth, requirePermission('doorprize:read'), doorprizeController.eventIdParam, doorprizeController.downloadImportTemplate);

// ---------------------------------------------------------------------------
// Doorprize - Draw
// ---------------------------------------------------------------------------
router.get('/doorprize/events/:id/draw-state', requireAuth, requirePermission('doorprize:draw'), doorprizeController.eventIdParam, doorprizeController.getDrawState);
router.post('/doorprize/events/:id/draw', requireAuth, requirePermission('doorprize:draw'), doorprizeController.executeDrawValidation, doorprizeController.executeDraw);
router.delete('/doorprize/results/:id', requireAuth, requirePermission('doorprize:delete'), doorprizeController.resultIdParam, doorprizeController.resetDrawResult);

// ---------------------------------------------------------------------------
// Doorprize - Export
// ---------------------------------------------------------------------------
router.get('/doorprize/events/:id/export', requireAuth, requirePermission('doorprize:read'), doorprizeController.eventIdParam, doorprizeController.exportEventData);

// ---------------------------------------------------------------------------
// Doorprize - Public (no auth)
// ---------------------------------------------------------------------------
router.get('/public/doorprize/events/:id/results', doorprizeController.getPublicResults);
router.get('/public/doorprize/events/:id/info', doorprizeController.getPublicEventInfo);

module.exports = router;
