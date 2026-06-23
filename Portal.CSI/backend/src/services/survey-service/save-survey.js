const sql = require('../../database/sql-client');
const { NotFoundError, ValidationError } = require('./errors');

async function syncSurveyConfiguration(transaction, surveyId, configuration) {
  const configCheck = await new sql.Request(transaction)
    .input('surveyId', sql.BigInt, surveyId)
    .query('SELECT ConfigId FROM EventConfiguration WHERE SurveyId = @surveyId');

  if (configuration) {
    const config = configuration;

    if (configCheck.recordset.length > 0) {
      const updateFields = [];
      const request = new sql.Request(transaction);
      request.input('surveyId', sql.BigInt, surveyId);

      if (config.heroTitle !== undefined) {
        updateFields.push('HeroTitle = @heroTitle');
        request.input('heroTitle', sql.NVarChar(500), config.heroTitle);
      }

      if (config.heroSubtitle !== undefined) {
        updateFields.push('HeroSubtitle = @heroSubtitle');
        request.input('heroSubtitle', sql.NVarChar(500), config.heroSubtitle);
      }

      if (config.heroImageUrl !== undefined) {
        updateFields.push('HeroImageUrl = @heroImageUrl');
        request.input('heroImageUrl', sql.NVarChar(500), config.heroImageUrl);
      }

      if (config.logoUrl !== undefined) {
        updateFields.push('LogoUrl = @logoUrl');
        request.input('logoUrl', sql.NVarChar(500), config.logoUrl);
      }

      if (config.backgroundColor !== undefined) {
        updateFields.push('BackgroundColor = @backgroundColor');
        request.input('backgroundColor', sql.NVarChar(50), config.backgroundColor);
      }

      if (config.backgroundImageUrl !== undefined) {
        updateFields.push('BackgroundImageUrl = @backgroundImageUrl');
        request.input('backgroundImageUrl', sql.NVarChar(500), config.backgroundImageUrl);
      }

      if (config.primaryColor !== undefined) {
        updateFields.push('PrimaryColor = @primaryColor');
        request.input('primaryColor', sql.NVarChar(50), config.primaryColor);
      }

      if (config.secondaryColor !== undefined) {
        updateFields.push('SecondaryColor = @secondaryColor');
        request.input('secondaryColor', sql.NVarChar(50), config.secondaryColor);
      }

      if (config.fontFamily !== undefined) {
        updateFields.push('FontFamily = @fontFamily');
        request.input('fontFamily', sql.NVarChar(100), config.fontFamily);
      }

      if (config.buttonStyle !== undefined) {
        updateFields.push('ButtonStyle = @buttonStyle');
        request.input('buttonStyle', sql.NVarChar(50), config.buttonStyle);
      }

      if (config.showProgressBar !== undefined) {
        updateFields.push('ShowProgressBar = @showProgressBar');
        request.input('showProgressBar', sql.Bit, config.showProgressBar);
      }

      if (config.showPageNumbers !== undefined) {
        updateFields.push('ShowPageNumbers = @showPageNumbers');
        request.input('showPageNumbers', sql.Bit, config.showPageNumbers);
      }

      if (config.multiPage !== undefined) {
        updateFields.push('MultiPage = @multiPage');
        request.input('multiPage', sql.Bit, config.multiPage);
      }
      if (config.heroImagePositionX !== undefined) {
        updateFields.push('HeroImagePositionX = @heroImagePositionX');
        request.input('heroImagePositionX', sql.Int, config.heroImagePositionX);
      }
      if (config.heroImagePositionY !== undefined) {
        updateFields.push('HeroImagePositionY = @heroImagePositionY');
        request.input('heroImagePositionY', sql.Int, config.heroImagePositionY);
      }
      if (config.logoPositionX !== undefined) {
        updateFields.push('LogoPositionX = @logoPositionX');
        request.input('logoPositionX', sql.Int, config.logoPositionX);
      }
      if (config.logoPositionY !== undefined) {
        updateFields.push('LogoPositionY = @logoPositionY');
        request.input('logoPositionY', sql.Int, config.logoPositionY);
      }
      if (config.backgroundPositionX !== undefined) {
        updateFields.push('BackgroundPositionX = @backgroundPositionX');
        request.input('backgroundPositionX', sql.Int, config.backgroundPositionX);
      }
      if (config.backgroundPositionY !== undefined) {
        updateFields.push('BackgroundPositionY = @backgroundPositionY');
        request.input('backgroundPositionY', sql.Int, config.backgroundPositionY);
      }

      if (updateFields.length > 0) {
        updateFields.push('UpdatedAt = GETDATE()');
        await request.query(`
          UPDATE EventConfiguration
          SET ${updateFields.join(', ')}
          WHERE SurveyId = @surveyId
        `);
      }
      return;
    }

    await new sql.Request(transaction)
      .input('surveyId', sql.BigInt, surveyId)
      .input('heroTitle', sql.NVarChar(500), config.heroTitle || null)
      .input('heroSubtitle', sql.NVarChar(500), config.heroSubtitle || null)
      .input('heroImageUrl', sql.NVarChar(500), config.heroImageUrl || null)
      .input('logoUrl', sql.NVarChar(500), config.logoUrl || null)
      .input('backgroundColor', sql.NVarChar(50), config.backgroundColor || null)
      .input('backgroundImageUrl', sql.NVarChar(500), config.backgroundImageUrl || null)
      .input('primaryColor', sql.NVarChar(50), config.primaryColor || null)
      .input('secondaryColor', sql.NVarChar(50), config.secondaryColor || null)
      .input('fontFamily', sql.NVarChar(100), config.fontFamily || null)
      .input('buttonStyle', sql.NVarChar(50), config.buttonStyle || null)
      .input('showProgressBar', sql.Bit, config.showProgressBar !== false)
      .input('showPageNumbers', sql.Bit, config.showPageNumbers !== false)
      .input('multiPage', sql.Bit, config.multiPage === true)
      .input('heroImagePositionX', sql.Int, Number.isInteger(config.heroImagePositionX) ? config.heroImagePositionX : 50)
      .input('heroImagePositionY', sql.Int, Number.isInteger(config.heroImagePositionY) ? config.heroImagePositionY : 50)
      .input('logoPositionX', sql.Int, Number.isInteger(config.logoPositionX) ? config.logoPositionX : 50)
      .input('logoPositionY', sql.Int, Number.isInteger(config.logoPositionY) ? config.logoPositionY : 50)
      .input('backgroundPositionX', sql.Int, Number.isInteger(config.backgroundPositionX) ? config.backgroundPositionX : 50)
      .input('backgroundPositionY', sql.Int, Number.isInteger(config.backgroundPositionY) ? config.backgroundPositionY : 50)
      .query(`
        INSERT INTO EventConfiguration (
          SurveyId, HeroTitle, HeroSubtitle, HeroImageUrl, LogoUrl,
          BackgroundColor, BackgroundImageUrl, PrimaryColor, SecondaryColor,
          FontFamily, ButtonStyle, ShowProgressBar, ShowPageNumbers, MultiPage,
          HeroImagePositionX, HeroImagePositionY,
          LogoPositionX, LogoPositionY,
          BackgroundPositionX, BackgroundPositionY,
          CreatedAt
        )
        VALUES (
          @surveyId, @heroTitle, @heroSubtitle, @heroImageUrl, @logoUrl,
          @backgroundColor, @backgroundImageUrl, @primaryColor, @secondaryColor,
          @fontFamily, @buttonStyle, @showProgressBar, @showPageNumbers, @multiPage,
          @heroImagePositionX, @heroImagePositionY,
          @logoPositionX, @logoPositionY,
          @backgroundPositionX, @backgroundPositionY,
          GETDATE()
        )
      `);
    return;
  }

  if (configCheck.recordset.length === 0) {
    await new sql.Request(transaction)
      .input('surveyId', sql.BigInt, surveyId)
      .input('showProgressBar', sql.Bit, true)
      .input('showPageNumbers', sql.Bit, true)
      .input('multiPage', sql.Bit, false)
      .query(`
        INSERT INTO EventConfiguration (
          SurveyId, ShowProgressBar, ShowPageNumbers, MultiPage, CreatedAt
        )
        VALUES (
          @surveyId, @showProgressBar, @showPageNumbers, @multiPage, GETDATE()
        )
      `);
  }
}

async function syncSurveyQuestions(transaction, surveyId, questions, isUpdate, userId, validateQuestionType, validateLayoutOrientation) {
  if (!questions || !Array.isArray(questions)) {
    return;
  }

  if (isUpdate) {
    const existingQuestionsResult = await new sql.Request(transaction)
      .input('surveyId', sql.BigInt, surveyId)
      .query('SELECT QuestionId FROM Questions WHERE SurveyId = @surveyId');

    const existingQuestionIds = existingQuestionsResult.recordset.map(q => q.QuestionId);
    const providedQuestionIds = questions
      .filter(q => q.QuestionId)
      .map(q => q.QuestionId);

    for (const existingId of existingQuestionIds) {
      if (!providedQuestionIds.includes(existingId)) {
        await new sql.Request(transaction)
          .input('questionId', sql.BigInt, existingId)
          .query('DELETE FROM Questions WHERE QuestionId = @questionId');
      }
    }
  }

  for (const question of questions) {
    validateQuestionType(question.type);

    if (question.layoutOrientation) {
      validateLayoutOrientation(question.layoutOrientation);
    }

    const optionsJson = question.options ? JSON.stringify(question.options) : null;

    if (question.QuestionId) {
      await new sql.Request(transaction)
        .input('questionId', sql.BigInt, question.QuestionId)
        .input('type', sql.NVarChar(50), question.type)
        .input('promptText', sql.NVarChar(sql.MAX), question.promptText)
        .input('subtitle', sql.NVarChar(500), question.subtitle || null)
        .input('imageUrl', sql.NVarChar(500), question.imageUrl || null)
        .input('isMandatory', sql.Bit, question.isMandatory || false)
        .input('displayOrder', sql.Int, question.displayOrder)
        .input('pageNumber', sql.Int, question.pageNumber || 1)
        .input('layoutOrientation', sql.NVarChar(20), question.layoutOrientation || null)
        .input('options', sql.NVarChar(sql.MAX), optionsJson)
        .input('commentRequiredBelowRating', sql.Int, question.commentRequiredBelowRating || null)
        .input('updatedBy', sql.BigInt, userId)
        .query(`
          UPDATE Questions
          SET Type = @type, PromptText = @promptText, Subtitle = @subtitle,
              ImageUrl = @imageUrl, IsMandatory = @isMandatory,
              DisplayOrder = @displayOrder, PageNumber = @pageNumber,
              LayoutOrientation = @layoutOrientation, Options = @options,
              CommentRequiredBelowRating = @commentRequiredBelowRating,
              UpdatedBy = @updatedBy, UpdatedAt = GETDATE()
          WHERE QuestionId = @questionId
        `);
      continue;
    }

    await new sql.Request(transaction)
      .input('surveyId', sql.BigInt, surveyId)
      .input('type', sql.NVarChar(50), question.type)
      .input('promptText', sql.NVarChar(sql.MAX), question.promptText)
      .input('subtitle', sql.NVarChar(500), question.subtitle || null)
      .input('imageUrl', sql.NVarChar(500), question.imageUrl || null)
      .input('isMandatory', sql.Bit, question.isMandatory || false)
      .input('displayOrder', sql.Int, question.displayOrder)
      .input('pageNumber', sql.Int, question.pageNumber || 1)
      .input('layoutOrientation', sql.NVarChar(20), question.layoutOrientation || null)
      .input('options', sql.NVarChar(sql.MAX), optionsJson)
      .input('commentRequiredBelowRating', sql.Int, question.commentRequiredBelowRating || null)
      .input('createdBy', sql.BigInt, userId)
      .query(`
        INSERT INTO Questions (
          SurveyId, Type, PromptText, Subtitle, ImageUrl,
          IsMandatory, DisplayOrder, PageNumber, LayoutOrientation,
          Options, CommentRequiredBelowRating, CreatedBy, CreatedAt
        )
        VALUES (
          @surveyId, @type, @promptText, @subtitle, @imageUrl,
          @isMandatory, @displayOrder, @pageNumber, @layoutOrientation,
          @options, @commentRequiredBelowRating, @createdBy, GETDATE()
        )
      `);
  }
}

async function updateSurveyCore(transaction, data, existingSurvey, dependencies) {
  const {
    normalizeDateValue,
    validateDates,
    validatePublishWindow,
    validateStatus
  } = dependencies;

  const nextStartDate = data.startDate !== undefined
    ? normalizeDateValue(data.startDate, 'start date')
    : (existingSurvey.StartDate ? new Date(existingSurvey.StartDate) : null);
  const nextEndDate = data.endDate !== undefined
    ? normalizeDateValue(data.endDate, 'end date')
    : (existingSurvey.EndDate ? new Date(existingSurvey.EndDate) : null);
  const nextStatus = data.status !== undefined ? data.status : existingSurvey.Status;

  if (nextStartDate && nextEndDate) {
    validateDates(nextStartDate, nextEndDate);
  }

  validatePublishWindow(nextStatus, nextStartDate, nextEndDate);

  const updateFields = [];
  const request = new sql.Request(transaction);
  request.input('surveyId', sql.BigInt, data.surveyId);

  if (data.title !== undefined) {
    if (!data.title || data.title.trim().length === 0) {
      throw new ValidationError('Title cannot be empty');
    }
    if (data.title.length > 500) {
      throw new ValidationError('Title must not exceed 500 characters');
    }
    updateFields.push('Title = @title');
    request.input('title', sql.NVarChar(500), data.title);
  }

  if (data.description !== undefined) {
    updateFields.push('Description = @description');
    request.input('description', sql.NVarChar(sql.MAX), data.description);
  }

  if (data.startDate !== undefined) {
    updateFields.push('StartDate = @startDate');
    request.input('startDate', sql.DateTime2, nextStartDate);
  }

  if (data.endDate !== undefined) {
    updateFields.push('EndDate = @endDate');
    request.input('endDate', sql.DateTime2, nextEndDate);
  }

  if (data.status !== undefined) {
    validateStatus(data.status);
    updateFields.push('Status = @status');
    request.input('status', sql.NVarChar(50), data.status);
  }

  if (data.assignedAdminId !== undefined) {
    updateFields.push('AssignedAdminId = @assignedAdminId');
    request.input('assignedAdminId', sql.BigInt, data.assignedAdminId);
  }

  if (data.targetRespondents !== undefined) {
    updateFields.push('TargetRespondents = @targetRespondents');
    request.input('targetRespondents', sql.Int, data.targetRespondents);
  }

  if (data.targetScore !== undefined) {
    if (data.targetScore !== null && (data.targetScore < 0 || data.targetScore > 10)) {
      throw new ValidationError('Target score must be between 0 and 10');
    }
    updateFields.push('TargetScore = @targetScore');
    request.input('targetScore', sql.Decimal(5, 2), data.targetScore);
  }

  if (data.duplicatePreventionEnabled !== undefined) {
    updateFields.push('DuplicatePreventionEnabled = @duplicatePreventionEnabled');
    request.input('duplicatePreventionEnabled', sql.Bit, data.duplicatePreventionEnabled);
  }

  if (updateFields.length > 0) {
    updateFields.push('UpdatedBy = @updatedBy');
    updateFields.push('UpdatedAt = GETDATE()');
    request.input('updatedBy', sql.BigInt, data.userId);

    const surveyResult = await request.query(`
      UPDATE Surveys
      SET ${updateFields.join(', ')}
      OUTPUT INSERTED.*
      WHERE SurveyId = @surveyId
    `);

    return surveyResult.recordset[0];
  }

  const surveyResult = await new sql.Request(transaction)
    .input('surveyId', sql.BigInt, data.surveyId)
    .query('SELECT * FROM Surveys WHERE SurveyId = @surveyId');

  return surveyResult.recordset[0];
}

async function createSurveyCore(transaction, data, dependencies) {
  const {
    normalizeDateValue,
    validateDates,
    validatePublishWindow
  } = dependencies;

  if (!data.title || data.title.trim().length === 0) {
    throw new ValidationError('Title is required');
  }

  if (data.title.length > 500) {
    throw new ValidationError('Title must not exceed 500 characters');
  }

  if (!data.startDate || !data.endDate) {
    throw new ValidationError('Start date and end date are required');
  }

  const startDate = normalizeDateValue(data.startDate, 'start date');
  const endDate = normalizeDateValue(data.endDate, 'end date');
  validateDates(startDate, endDate);
  validatePublishWindow(data.status || 'Draft', startDate, endDate);

  if (data.targetScore !== undefined && data.targetScore !== null) {
    if (data.targetScore < 0 || data.targetScore > 10) {
      throw new ValidationError('Target score must be between 0 and 10');
    }
  }

  // Auto-create parent Event if no eventId provided
  let eventId = data.eventId;
  if (!eventId) {
    const eventResult = await new sql.Request(transaction)
      .input('title', sql.NVarChar(500), data.title)
      .input('description', sql.NVarChar(sql.MAX), data.description || null)
      .input('createdBy', sql.BigInt, data.userId)
      .query(`
        INSERT INTO Events (Title, Description, Status, CreatedBy, CreatedAt)
        OUTPUT INSERTED.SurveyId
        VALUES (@title, @description, 'Draft', @createdBy, GETDATE())
      `);
    eventId = eventResult.recordset[0].SurveyId;
  }

  const surveyResult = await new sql.Request(transaction)
    .input('title', sql.NVarChar(500), data.title)
    .input('description', sql.NVarChar(sql.MAX), data.description || null)
    .input('startDate', sql.DateTime2, startDate)
    .input('endDate', sql.DateTime2, endDate)
    .input('status', sql.NVarChar(50), data.status || 'Draft')
    .input('targetRespondents', sql.Int, data.targetRespondents || null)
    .input('targetScore', sql.Decimal(5, 2), data.targetScore || null)
    .input('duplicatePreventionEnabled', sql.Bit, data.duplicatePreventionEnabled !== false)
    .input('eventId', sql.BigInt, eventId)
    .input('createdBy', sql.BigInt, data.userId)
    .query(`
      INSERT INTO Surveys (
        EventId, Title, Description, StartDate, EndDate, Status,
        TargetRespondents, TargetScore,
        DuplicatePreventionEnabled, CreatedBy, CreatedAt
      )
      OUTPUT INSERTED.*
      VALUES (
        @eventId, @title, @description, @startDate, @endDate, @status,
        @targetRespondents, @targetScore,
        @duplicatePreventionEnabled, @createdBy, GETDATE()
      )
    `);

  return surveyResult.recordset[0];
}

async function loadExistingSurveyForSave(transaction, surveyId) {
  const surveyCheck = await new sql.Request(transaction)
    .input('surveyId', sql.BigInt, surveyId)
    .query('SELECT SurveyId, EventId, Status, StartDate, EndDate FROM Surveys WHERE SurveyId = @surveyId');

  if (surveyCheck.recordset.length === 0) {
    throw new NotFoundError('Survey not found');
  }

  return surveyCheck.recordset[0];
}

module.exports = {
  createSurveyCore,
  loadExistingSurveyForSave,
  syncSurveyConfiguration,
  syncSurveyQuestions,
  updateSurveyCore
};
