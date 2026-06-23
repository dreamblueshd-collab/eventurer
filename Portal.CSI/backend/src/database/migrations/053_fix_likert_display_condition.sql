-- Migration 053: Fix displayCondition for existing surveys
-- Ensures questions positioned after app_department/app_function selectors
-- are marked with displayCondition = "after_mapped_selection"
-- so they repeat per selected application in the respondent form.

-- This updates Questions that:
-- 1. Are of type MatrixLikert, Rating, or Text
-- 2. Are in the same survey/page as a MultipleChoice question with dataSource app_department or app_function
-- 3. Have DisplayOrder greater than the app-selector question
-- 4. Don't already have displayCondition set to 'after_mapped_selection'

;WITH AppSelectors AS (
  SELECT SurveyId, QuestionId, DisplayOrder, PageNumber
  FROM Questions
  WHERE Type = 'MultipleChoice'
    AND (
      JSON_VALUE(Options, '$.dataSource') = 'app_department'
      OR JSON_VALUE(Options, '$.dataSource') = 'app_function'
    )
),
QuestionsAfterSelector AS (
  SELECT q.QuestionId, q.SurveyId, q.Options
  FROM Questions q
  INNER JOIN AppSelectors sel ON q.SurveyId = sel.SurveyId
    AND q.PageNumber = sel.PageNumber
    AND q.DisplayOrder > sel.DisplayOrder
  WHERE q.Type IN ('MatrixLikert', 'Rating', 'Text')
    AND (
      JSON_VALUE(q.Options, '$.displayCondition') IS NULL
      OR JSON_VALUE(q.Options, '$.displayCondition') != 'after_mapped_selection'
    )
)
UPDATE q
SET q.Options = CASE
  WHEN q.Options IS NULL THEN '{"displayCondition":"after_mapped_selection"}'
  ELSE JSON_MODIFY(q.Options, '$.displayCondition', 'after_mapped_selection')
END
FROM Questions q
INNER JOIN QuestionsAfterSelector qas ON q.QuestionId = qas.QuestionId;

PRINT 'Updated displayCondition for questions after app selectors';
GO
