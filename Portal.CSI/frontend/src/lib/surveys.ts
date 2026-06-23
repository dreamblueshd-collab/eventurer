/**
 * surveys.ts — Barrel file re-exporting all survey-related API functions.
 * Actual implementations live in survey-events.ts, survey-questions.ts, survey-distribution.ts.
 */

export {
  fetchSurveyOverview,
  fetchEventsOverview,
  createEventDraft,
  fetchSurveyById,
  updateEventById,
  deleteEventById,
  updateEventConfiguration,
  uploadSurveyStyleImage,
} from "./survey-events";

export {
  fetchSurveyQuestions,
  fetchSurveyResponseStatistics,
  createSurveyQuestion,
  updateSurveyQuestion,
  deleteSurveyQuestion,
  uploadSurveyQuestionImage,
  type SurveyQuestionPayload,
} from "./survey-questions";

export {
  generateEventLink,
  scheduleEventBlast,
  scheduleEventReminder,
  type ScheduleFrequency,
} from "./survey-distribution";
