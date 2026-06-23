async function createSurvey(db, sql, logger, publishCycleService, ValidationError, helpers, data) {
  const { normalizeAssignedAdminIds, syncSurveyAdminAssignments, validateAssignedAdmins, validateDates } = helpers;
  const pool = await db.getPool();
  const transaction = new sql.Transaction(pool);

  try {
    if (!data.title || data.title.trim().length === 0) {
      throw new ValidationError('Title is required');
    }
    if (data.title.length > 500) {
      throw new ValidationError('Title must not exceed 500 characters');
    }
    if (!data.createdBy) {
      throw new ValidationError('CreatedBy is required');
    }
    if (data.startDate && data.endDate) {
      validateDates(data.startDate, data.endDate);
    }

    const hasAssignmentPayload = data.assignedAdminIds !== undefined || data.assignedAdminId !== undefined;
    const assignedAdminIds = hasAssignmentPayload ? normalizeAssignedAdminIds(data) : null;
    if (assignedAdminIds && assignedAdminIds.length > 0) {
      await validateAssignedAdmins(pool, assignedAdminIds);
    }

    if (data.targetScore !== undefined && data.targetScore !== null) {
      if (data.targetScore < 0 || data.targetScore > 10) {
        throw new ValidationError('Target score must be between 0 and 10');
      }
    }

    await transaction.begin();

    let eventId = data.eventId ? Number(data.eventId) : null;

    // If no eventId provided, create a new Event first
    if (!eventId) {
      const eventResult = await new sql.Request(transaction)
        .input('title', sql.NVarChar(500), data.title)
        .input('description', sql.NVarChar(sql.MAX), data.description || null)
        .input('assignedAdminId', sql.BigInt, data.assignedAdminId || null)
        .input('createdBy', sql.BigInt, data.createdBy)
        .query(`
          INSERT INTO Events (
            Title, Description, AssignedAdminId, Status, CreatedBy, CreatedAt, EventTypeId
          )
          OUTPUT INSERTED.*
          VALUES (
            @title, @description, @assignedAdminId, 'Draft', @createdBy, GETDATE(),
            (SELECT TOP 1 EventTypeId FROM EventTypes WHERE Code = 'SURVEY' AND IsActive = 1)
          )
        `);
      eventId = eventResult.recordset[0].SurveyId;

      if (assignedAdminIds) {
        await syncSurveyAdminAssignments(transaction, eventId, assignedAdminIds);
      }
    }

    // Create the Survey under the Event
    const surveyResult = await new sql.Request(transaction)
      .input('eventId', sql.BigInt, eventId)
      .input('title', sql.NVarChar(500), data.title)
      .input('description', sql.NVarChar(sql.MAX), data.description || null)
      .input('startDate', sql.NVarChar(32), data.startDate || null)
      .input('endDate', sql.NVarChar(32), data.endDate || null)
      .input('status', sql.NVarChar(50), 'Draft')
      .input('targetRespondents', sql.Int, data.targetRespondents || null)
      .input('targetScore', sql.Decimal(5, 2), data.targetScore || null)
      .input('duplicatePreventionEnabled', sql.Bit, data.duplicatePreventionEnabled !== false)
      .input('requireApproval', sql.Bit, data.requireApproval ? 1 : 0)
      .input('sortOrder', sql.Int, data.sortOrder || 0)
      .input('createdBy', sql.BigInt, data.createdBy)
      .query(`
        INSERT INTO Surveys (
          EventId, Title, Description, StartDate, EndDate, Status,
          TargetRespondents, TargetScore, DuplicatePreventionEnabled,
          RequireApproval, SortOrder, CreatedBy, CreatedAt
        )
        OUTPUT INSERTED.*
        VALUES (
          @eventId, @title, @description,
          CONVERT(DATETIME2, @startDate, 126), CONVERT(DATETIME2, @endDate, 126), @status,
          @targetRespondents, @targetScore, @duplicatePreventionEnabled,
          @requireApproval, @sortOrder, @createdBy, GETDATE()
        )
      `);

    const survey = surveyResult.recordset[0];

    const config = data.configuration || {};
    const configResult = await new sql.Request(transaction)
      .input('surveyId', sql.BigInt, survey.SurveyId)
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
        OUTPUT INSERTED.*
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

    await transaction.commit();

    logger.info('Survey created', { surveyId: survey.SurveyId, eventId, title: data.title });

    return {
      ...survey,
      EventId: eventId,
      configuration: configResult.recordset[0]
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function updateSurvey(db, sql, logger, publishCycleService, errors, helpers, surveyId, data) {
  const { NotFoundError, ValidationError } = errors;
  const {
    normalizeAssignedAdminIds,
    resolveUpdatedSchedule,
    syncSurveyAdminAssignments,
    validateAssignedAdmins,
    validateStatus
  } = helpers;

  const pool = await db.getPool();
  const transaction = new sql.Transaction(pool);

  const surveyCheck = await pool.request()
    .input('surveyId', sql.BigInt, surveyId)
    .query('SELECT SurveyId, EventId, Status, StartDate, EndDate FROM Surveys WHERE SurveyId = @surveyId');

  if (surveyCheck.recordset.length === 0) {
    throw new NotFoundError('Survey not found');
  }

  const currentSurvey = surveyCheck.recordset[0];

  if (data.status) {
    validateStatus(data.status);
  }
  const { nextStartDate, nextEndDate, nextStatus } = resolveUpdatedSchedule(
    currentSurvey,
    data,
  );
  const hasAssignmentPayload = data.assignedAdminIds !== undefined || data.assignedAdminId !== undefined;
  const assignedAdminIds = hasAssignmentPayload ? normalizeAssignedAdminIds(data) : null;
  if (assignedAdminIds && assignedAdminIds.length > 0) {
    await validateAssignedAdmins(pool, assignedAdminIds);
  }
  if (data.targetScore !== undefined && data.targetScore !== null) {
    if (data.targetScore < 0 || data.targetScore > 10) {
      throw new ValidationError('Target score must be between 0 and 10');
    }
  }

  const updateFields = [];
  if (data.title !== undefined) {
    if (!data.title || data.title.trim().length === 0) {
      throw new ValidationError('Title cannot be empty');
    }
    if (data.title.length > 500) {
      throw new ValidationError('Title must not exceed 500 characters');
    }
    updateFields.push('Title = @title');
  }
  if (data.description !== undefined) updateFields.push('Description = @description');
  if (data.startDate !== undefined) updateFields.push('StartDate = CONVERT(DATETIME2, @startDate, 126)');
  if (data.endDate !== undefined) updateFields.push('EndDate = CONVERT(DATETIME2, @endDate, 126)');
  if (data.status !== undefined) updateFields.push('Status = @status');
  if (data.targetRespondents !== undefined) updateFields.push('TargetRespondents = @targetRespondents');
  if (data.targetScore !== undefined) updateFields.push('TargetScore = @targetScore');
  if (data.duplicatePreventionEnabled !== undefined) updateFields.push('DuplicatePreventionEnabled = @duplicatePreventionEnabled');

  if (updateFields.length === 0) {
    throw new ValidationError('No fields to update');
  }

  await transaction.begin();
  try {
    const request = new sql.Request(transaction);
    request.input('surveyId', sql.BigInt, surveyId);
    if (data.title !== undefined) request.input('title', sql.NVarChar(500), data.title);
    if (data.description !== undefined) request.input('description', sql.NVarChar(sql.MAX), data.description);
    if (data.startDate !== undefined) request.input('startDate', sql.NVarChar(32), nextStartDate);
    if (data.endDate !== undefined) request.input('endDate', sql.NVarChar(32), nextEndDate);
    if (data.status !== undefined) request.input('status', sql.NVarChar(50), nextStatus);
    if (data.targetRespondents !== undefined) request.input('targetRespondents', sql.Int, data.targetRespondents);
    if (data.targetScore !== undefined) request.input('targetScore', sql.Decimal(5, 2), data.targetScore);
    if (data.duplicatePreventionEnabled !== undefined) request.input('duplicatePreventionEnabled', sql.Bit, data.duplicatePreventionEnabled);
    if (data.updatedBy) {
      updateFields.push('UpdatedBy = @updatedBy');
      request.input('updatedBy', sql.BigInt, data.updatedBy);
    }
    updateFields.push('UpdatedAt = GETDATE()');

    const result = await request.query(`
      UPDATE Surveys
      SET ${updateFields.join(', ')}
      OUTPUT INSERTED.*
      WHERE SurveyId = @surveyId
    `);

    // Keep event-level compatibility fields in sync when provided.
    if (data.assignedAdminId !== undefined || data.requireApproval !== undefined) {
      const eventRequest = new sql.Request(transaction);
      eventRequest.input('eventId', sql.BigInt, currentSurvey.EventId);
      const eventUpdateFields = [];
      if (data.assignedAdminId !== undefined) {
        eventUpdateFields.push('AssignedAdminId = @assignedAdminId');
        eventRequest.input('assignedAdminId', sql.BigInt, data.assignedAdminId);
      }
      if (data.requireApproval !== undefined) {
        eventUpdateFields.push('RequireApproval = @requireApproval');
        eventRequest.input('requireApproval', sql.Bit, data.requireApproval);
      }
      eventUpdateFields.push('UpdatedAt = GETDATE()');
      await eventRequest.query(`UPDATE Events SET ${eventUpdateFields.join(', ')} WHERE EventId = @eventId`);
    }

    if (data.requireApproval !== undefined) {
      await new sql.Request(transaction)
        .input('surveyId', sql.BigInt, surveyId)
        .input('requireApproval', sql.Bit, data.requireApproval)
        .query(`
          UPDATE Surveys
          SET RequireApproval = @requireApproval
          WHERE SurveyId = @surveyId
        `);
    }

    if (assignedAdminIds) {
      await syncSurveyAdminAssignments(transaction, currentSurvey.EventId, assignedAdminIds);
    }

    const previousStatus = currentSurvey.Status;
    if (nextStatus === 'Active' && previousStatus !== 'Active') {
      await publishCycleService.activateNewCycle(transaction, surveyId, data.updatedBy || null);
    }

    await transaction.commit();

    logger.info('Survey updated', { surveyId });
    return result.recordset[0];
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function deleteSurvey(db, sql, logger, errors, surveyId) {
  const { NotFoundError, ValidationError } = errors;
  const pool = await db.getPool();

  const surveyCheck = await pool.request()
    .input('surveyId', sql.BigInt, surveyId)
    .query('SELECT SurveyId, EventId FROM Surveys WHERE SurveyId = @surveyId');
  if (surveyCheck.recordset.length === 0) {
    throw new NotFoundError('Survey not found');
  }

  const responseCheck = await pool.request()
    .input('surveyId', sql.BigInt, surveyId)
    .query('SELECT COUNT(*) as count FROM Responses WHERE SurveyId = @surveyId');
  if (responseCheck.recordset[0].count > 0) {
    throw new ValidationError('Cannot delete survey: responses exist');
  }

  // Delete related records within a transaction for data integrity
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    await transaction.request()
      .input('surveyId', sql.BigInt, surveyId)
      .query('DELETE FROM EventConfiguration WHERE SurveyId = @surveyId');

    await transaction.request()
      .input('surveyId', sql.BigInt, surveyId)
      .query('DELETE FROM Questions WHERE SurveyId = @surveyId');

    await transaction.request()
      .input('surveyId', sql.BigInt, surveyId)
      .query('DELETE FROM EventPublishCycles WHERE SurveyId = @surveyId');

    await transaction.request()
      .input('surveyId', sql.BigInt, surveyId)
      .query('DELETE FROM ScheduledOperations WHERE SurveyId = @surveyId');

    const result = await transaction.request()
      .input('surveyId', sql.BigInt, surveyId)
      .query('DELETE FROM Surveys WHERE SurveyId = @surveyId');

    await transaction.commit();

    const affectedRows = result?.rowsAffected?.[0] ?? 0;
    logger.info('Survey deleted', { surveyId });
    return affectedRows > 0;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function createEvent(db, sql, logger, ValidationError, helpers, data) {
  const {
    getPrimaryAssignedAdminId,
    normalizeAssignedAdminIds,
    syncSurveyAdminAssignments,
    validateAssignedAdmins
  } = helpers;
  const pool = await db.getPool();
  const transaction = new sql.Transaction(pool);
  let transactionBegun = false;

  // Log function entry with all input data
  logger.info('createEvent function called', {
    hasTitle: !!data.title,
    titleLength: data.title?.length,
    hasDescription: !!data.description,
    createdBy: data.createdBy,
    createdByType: typeof data.createdBy,
    hasAssignedAdminIds: !!data.assignedAdminIds,
    hasAssignedAdminId: !!data.assignedAdminId,
    eventTypeId: data.eventTypeId,
    eventTypeIdType: typeof data.eventTypeId,
    requireApproval: data.requireApproval,
    dataKeys: Object.keys(data || {})
  });

  // ---- Phase 1: Validation (no transaction yet) ----
  try {
    if (!data.title || data.title.trim().length === 0) {
      logger.warn('createEvent validation failed: Title is required');
      throw new ValidationError('Title is required');
    }
    if (data.title.length > 500) {
      throw new ValidationError('Title must not exceed 500 characters');
    }
    if (!data.createdBy) {
      throw new ValidationError('CreatedBy is required');
    }

    const hasAssignmentPayload = data.assignedAdminIds !== undefined || data.assignedAdminId !== undefined;
    const assignedAdminIds = hasAssignmentPayload ? normalizeAssignedAdminIds(data) : null;
    
    logger.info('Admin assignment validation', {
      hasAssignmentPayload,
      assignedAdminIds: assignedAdminIds,
      assignedAdminIdsCount: assignedAdminIds?.length || 0
    });
    
    if (assignedAdminIds && assignedAdminIds.length > 0) {
      await validateAssignedAdmins(pool, assignedAdminIds);
      logger.info('Admin validation passed', { assignedAdminIds });
    }

    const primaryAssignedAdminId = getPrimaryAssignedAdminId(assignedAdminIds);
    logger.info('Primary admin resolved for Events.AssignedAdminId', {
      assignedAdminIds,
      primaryAssignedAdminId
    });

    // Resolve EventTypeId — accept from payload or default to SURVEY
    let eventTypeId = data.eventTypeId || null;
    
    logger.info('EventTypeId resolution started', {
      rawEventTypeId: data.eventTypeId,
      rawType: typeof data.eventTypeId,
      initialEventTypeId: eventTypeId
    });

    // Normalise eventTypeId: it may arrive as a string from JSON, or as an empty string.
    if (eventTypeId !== null && eventTypeId !== undefined) {
      const parsed = parseInt(eventTypeId, 10);
      eventTypeId = Number.isFinite(parsed) ? parsed : null;
      logger.info('EventTypeId parsed', { parsed, isFinite: Number.isFinite(parsed), finalEventTypeId: eventTypeId });
    }

    // If no eventTypeId provided, validate that SURVEY EventType exists and is active
    if (!eventTypeId) {
      logger.info('No eventTypeId provided, querying for SURVEY EventType');
      
      const surveyTypeCheck = await pool.request().query(`
        SELECT TOP 1 EventTypeId FROM EventTypes WHERE Code = 'SURVEY' AND IsActive = 1
      `);

      logger.info('SURVEY EventType query result', {
        recordCount: surveyTypeCheck.recordset.length,
        recordset: surveyTypeCheck.recordset
      });

      if (surveyTypeCheck.recordset.length === 0) {
        logger.error('SURVEY EventType not found in database');
        throw new ValidationError(
          'EventType "SURVEY" not found or inactive. Please contact system administrator to initialize EventTypes table.'
        );
      }

      eventTypeId = surveyTypeCheck.recordset[0].EventTypeId;
      logger.info('EventTypeId resolved from database', { eventTypeId });
    }

    // Normalise createdBy: may be a string from JSON body
    logger.info('Normalizing createdBy', { rawCreatedBy: data.createdBy, rawType: typeof data.createdBy });
    const createdById = parseInt(data.createdBy, 10);
    if (!Number.isFinite(createdById)) {
      logger.error('Invalid createdBy value', { rawCreatedBy: data.createdBy, parsedCreatedById: createdById });
      throw new ValidationError('CreatedBy must be a valid numeric user id');
    }
    logger.info('createdBy normalized successfully', { createdById });

    // ---- Phase 2: Transactional insert ----
    logger.info('Starting transaction for event insertion');
    await transaction.begin();
    transactionBegun = true;
    logger.info('Transaction started successfully');

    logger.info('Preparing INSERT query with parameters', {
      title: data.title,
      hasDescription: !!data.description,
      primaryAssignedAdminId,
      requireApproval: data.requireApproval ? 1 : 0,
      createdById,
      eventTypeId
    });

    const eventResult = await new sql.Request(transaction)
      .input('title', sql.NVarChar(500), data.title)
      .input('description', sql.NVarChar(sql.MAX), data.description || null)
      .input('assignedAdminId', sql.BigInt, primaryAssignedAdminId)
      .input('requireApproval', sql.Bit, data.requireApproval ? 1 : 0)
      .input('createdBy', sql.BigInt, createdById)
      .input('eventTypeId', sql.BigInt, eventTypeId)
      .query(`
        INSERT INTO Events (
          Title, Description, AssignedAdminId, RequireApproval, Status, CreatedBy, CreatedAt, EventTypeId
        )
        OUTPUT INSERTED.*
        VALUES (
          @title, @description, @assignedAdminId, @requireApproval, 'Draft', @createdBy, GETDATE(),
          @eventTypeId
        )
      `);

    logger.info('INSERT query executed successfully', {
      recordCount: eventResult.recordset.length,
      recordsetLength: eventResult.recordset.length
    });

    const event = eventResult.recordset[0];
    logger.info('Event record extracted', {
      eventId: event.SurveyId,
      title: event.Title,
      status: event.Status,
      eventKeys: Object.keys(event || {})
    });

    if (assignedAdminIds) {
      logger.info('Syncing admin assignments', { eventId: event.SurveyId, assignedAdminIds });
      await syncSurveyAdminAssignments(transaction, event.SurveyId, assignedAdminIds);
      logger.info('Admin assignments synced successfully');
    }

    logger.info('Committing transaction');
    await transaction.commit();
    transactionBegun = false;
    logger.info('Transaction committed successfully');

    logger.info('Event created successfully', { eventId: event.SurveyId, title: data.title });
    return {
      EventId: event.SurveyId,
      Title: event.Title,
      Description: event.Description,
      AssignedAdminId: event.AssignedAdminId,
      RequireApproval: data.requireApproval ? 1 : 0,
      Status: event.Status,
      CreatedAt: event.CreatedAt,
      CreatedBy: event.CreatedBy
    };
  } catch (error) {
    // Enhanced error logging with full context
    logger.error('createEvent function error', {
      errorMessage: error.message,
      errorName: error.name,
      errorStack: error.stack,
      errorCode: error.code,
      errorNumber: error.number,
      errorState: error.state,
      errorClass: error.class,
      errorServerName: error.serverName,
      errorProcName: error.procName,
      errorLineNumber: error.lineNumber,
      statusCode: error?.statusCode,
      transactionBegun,
      inputData: {
        hasTitle: !!data.title,
        titleLength: data.title?.length,
        title: data.title,
        hasDescription: !!data.description,
        createdBy: data.createdBy,
        createdByType: typeof data.createdBy,
        hasAssignedAdminIds: !!data.assignedAdminIds,
        hasAssignedAdminId: !!data.assignedAdminId,
        assignedAdminIds: data.assignedAdminIds,
        assignedAdminId: data.assignedAdminId,
        eventTypeId: data.eventTypeId,
        eventTypeIdType: typeof data.eventTypeId,
        requireApproval: data.requireApproval,
        dataKeys: Object.keys(data || {})
      }
    });

    // Only rollback if the transaction was actually started.
    if (transactionBegun) {
      try {
        logger.info('Attempting to rollback transaction');
        await transaction.rollback();
        logger.info('Transaction rolled back successfully');
      } catch (rollbackError) {
        logger.warn('Rollback failed after error', {
          rollbackMessage: rollbackError.message,
          rollbackStack: rollbackError.stack
        });
      }
    }
    throw error;
  }
}

async function deleteEvent(db, sql, logger, errors, eventId) {
  const { NotFoundError, ValidationError } = errors;
  const pool = await db.getPool();

  const eventCheck = await pool.request()
    .input('eventId', sql.BigInt, eventId)
    .query('SELECT SurveyId FROM Events WHERE SurveyId = @eventId');
  if (eventCheck.recordset.length === 0) {
    throw new NotFoundError('Event not found');
  }

  // Check if any survey under this event has responses
  const responseCheck = await pool.request()
    .input('eventId', sql.BigInt, eventId)
    .query(`
      SELECT COUNT(*) as count FROM Responses r
      INNER JOIN Surveys s ON s.SurveyId = r.SurveyId
      WHERE s.EventId = @eventId
    `);
  if (responseCheck.recordset[0].count > 0) {
    throw new ValidationError('Cannot delete event: surveys with responses exist');
  }

  // Delete all child surveys and their dependencies in a transaction
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    await transaction.request()
      .input('eventId', sql.BigInt, eventId)
      .query('DELETE FROM EventConfiguration WHERE SurveyId IN (SELECT SurveyId FROM Surveys WHERE EventId = @eventId)');

    await transaction.request()
      .input('eventId', sql.BigInt, eventId)
      .query('DELETE FROM Questions WHERE SurveyId IN (SELECT SurveyId FROM Surveys WHERE EventId = @eventId)');

    await transaction.request()
      .input('eventId', sql.BigInt, eventId)
      .query('DELETE FROM EventPublishCycles WHERE SurveyId IN (SELECT SurveyId FROM Surveys WHERE EventId = @eventId)');

    await transaction.request()
      .input('eventId', sql.BigInt, eventId)
      .query('DELETE FROM ScheduledOperations WHERE SurveyId IN (SELECT SurveyId FROM Surveys WHERE EventId = @eventId)');

    await transaction.request()
      .input('eventId', sql.BigInt, eventId)
      .query('DELETE FROM Surveys WHERE EventId = @eventId');

    await transaction.request()
      .input('eventId', sql.BigInt, eventId)
      .query('DELETE FROM EventAdminAssignments WHERE SurveyId = @eventId');

    await transaction.request()
      .input('eventId', sql.BigInt, eventId)
      .query('DELETE FROM Events WHERE SurveyId = @eventId');

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }

  logger.info('Event deleted', { eventId });
  return true;
}

async function updateEvent(db, sql, logger, errors, helpers, eventId, data) {
  const { NotFoundError, ValidationError } = errors;
  const {
    getPrimaryAssignedAdminId,
    normalizeAssignedAdminIds,
    syncSurveyAdminAssignments,
    validateAssignedAdmins
  } = helpers;

  const pool = await db.getPool();
  const transaction = new sql.Transaction(pool);

  const eventCheck = await pool.request()
    .input('eventId', sql.BigInt, eventId)
    .query('SELECT SurveyId, Status FROM Events WHERE SurveyId = @eventId');

  if (eventCheck.recordset.length === 0) {
    throw new NotFoundError('Event not found');
  }

  const currentEvent = eventCheck.recordset[0];

  // State machine: validate allowed status transitions for parent events
  if (data.status !== undefined && data.status !== currentEvent.Status) {
    const ALLOWED_TRANSITIONS = {
      'Draft': ['Active', 'Closed'],
      'Active': ['Closed'],
      'Closed': []
    };
    const allowed = ALLOWED_TRANSITIONS[currentEvent.Status] || [];
    if (!allowed.includes(data.status)) {
      throw new ValidationError(`Transisi status tidak valid: ${currentEvent.Status} → ${data.status}`);
    }
  }

  const hasAssignmentPayload = data.assignedAdminIds !== undefined || data.assignedAdminId !== undefined;
  const assignedAdminIds = hasAssignmentPayload ? normalizeAssignedAdminIds(data) : null;
  
  if (assignedAdminIds && assignedAdminIds.length > 0) {
    await validateAssignedAdmins(pool, assignedAdminIds);
  }

  const updateFields = [];
  if (data.title !== undefined) {
    if (!data.title || data.title.trim().length === 0) {
      throw new ValidationError('Title cannot be empty');
    }
    if (data.title.length > 500) {
      throw new ValidationError('Title must not exceed 500 characters');
    }
    updateFields.push('Title = @title');
  }
  if (data.description !== undefined) updateFields.push('Description = @description');
  if (data.status !== undefined) updateFields.push('Status = @status');
  if (data.requireApproval !== undefined) updateFields.push('RequireApproval = @requireApproval');

  if (updateFields.length === 0 && (!assignedAdminIds || assignedAdminIds.length === 0)) {
    throw new ValidationError('No fields to update');
  }

  await transaction.begin();
  try {
    let primaryAssignedAdminId = null;
    if (assignedAdminIds && assignedAdminIds.length > 0) {
      primaryAssignedAdminId = getPrimaryAssignedAdminId(assignedAdminIds);
      updateFields.push('AssignedAdminId = @assignedAdminId');
    }

    if (updateFields.length > 0) {
      const request = new sql.Request(transaction);
      request.input('eventId', sql.BigInt, eventId);
      if (data.title !== undefined) request.input('title', sql.NVarChar(500), data.title);
      if (data.description !== undefined) request.input('description', sql.NVarChar(sql.MAX), data.description);
      if (data.status !== undefined) request.input('status', sql.NVarChar(50), data.status);
      if (data.requireApproval !== undefined) request.input('requireApproval', sql.Bit, data.requireApproval);
      if (primaryAssignedAdminId !== null) request.input('assignedAdminId', sql.BigInt, primaryAssignedAdminId);
      if (data.updatedBy) {
        updateFields.push('UpdatedBy = @updatedBy');
        request.input('updatedBy', sql.BigInt, data.updatedBy);
      }
      updateFields.push('UpdatedAt = GETDATE()');

      const result = await request.query(`
        UPDATE Events
        SET ${updateFields.join(', ')}
        OUTPUT INSERTED.*
        WHERE SurveyId = @eventId
      `);

      if (assignedAdminIds) {
        await syncSurveyAdminAssignments(transaction, eventId, assignedAdminIds);
      }

      await transaction.commit();

      logger.info('Event updated', { eventId });
      return result.recordset[0];
    } else {
      // Only admin assignments to update
      if (assignedAdminIds) {
        await syncSurveyAdminAssignments(transaction, eventId, assignedAdminIds);
      }
      await transaction.commit();
      logger.info('Event admin assignments updated', { eventId });
      return currentEvent;
    }
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

module.exports = {
  createEvent,
  createSurvey,
  deleteEvent,
  deleteSurvey,
  updateEvent,
  updateSurvey
};
