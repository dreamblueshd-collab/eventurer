function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ''));
}

async function resolveSurveyIdentifier(db, sql, NotFoundError, surveyIdentifier) {
  const normalizedIdentifier = String(surveyIdentifier || '').trim();
  if (!normalizedIdentifier) {
    throw new NotFoundError('Survey not found');
  }

  // Numeric ID — direct lookup
  if (/^\d+$/.test(normalizedIdentifier)) {
    const surveyId = Number(normalizedIdentifier);
    if (Number.isSafeInteger(surveyId) && surveyId > 0) {
      return surveyId;
    }
    throw new NotFoundError('Survey not found');
  }

  // Non-numeric — resolve by exact SurveyLink path suffix (token-based URLs use exact match for security)
  const pool = typeof db.getPool === 'function' ? await db.getPool() : db;

  // Try exact suffix match first (new token-based URLs: slug-{8hex})
  const exactResult = await pool.request()
    .input('exactPattern', sql.NVarChar(500), `%/survey/${normalizedIdentifier}`)
    .query('SELECT SurveyId FROM Surveys WHERE SurveyLink = @exactPattern OR SurveyLink LIKE @exactPattern ORDER BY SurveyId DESC');

  // For token-based URLs (slug-{8hex}), the stored SurveyLink contains the full URL.
  // We match via encoded and decoded forms.
  const decodedIdentifier = (() => { try { return decodeURIComponent(normalizedIdentifier); } catch { return normalizedIdentifier; } })();

  let finalResult = exactResult;

  if (exactResult.recordset.length === 0 && decodedIdentifier !== normalizedIdentifier) {
    finalResult = await pool.request()
      .input('decodedPattern', sql.NVarChar(500), `%/survey/${decodedIdentifier}`)
      .query('SELECT SurveyId FROM Surveys WHERE SurveyLink LIKE @decodedPattern ORDER BY SurveyId DESC');
  }

  if (finalResult.recordset.length === 0) {
    throw new NotFoundError('Survey not found');
  }

  return Number(finalResult.recordset[0].SurveyId);
}

async function getSurveys(db, sql, filter = {}) {
  const pool = await db.getPool();
  const request = pool.request();

  let query = `
    SELECT 
      s.*,
      e.Title AS EventTitle,
      e.Description AS EventDescription,
      e.AssignedAdminId,
      e.EventTypeId,
      CASE
        WHEN s.Status = 'Active' AND s.EndDate IS NOT NULL AND s.EndDate < GETDATE() THEN 'Closed'
        ELSE s.Status
      END AS EffectiveStatus,
      COALESCE(NULLIF(STUFF((
        SELECT ', ' + u2.DisplayName
        FROM EventAdminAssignments saa2
        INNER JOIN Users u2 ON u2.UserId = saa2.AdminUserId
        WHERE saa2.SurveyId = s.EventId
        FOR XML PATH(''), TYPE
      ).value('.', 'NVARCHAR(MAX)'), 1, 2, ''), ''), admin.DisplayName) AS AssignedAdminName,
      NULLIF(STUFF((
        SELECT ', ' + u2.DisplayName
        FROM EventAdminAssignments saa2
        INNER JOIN Users u2 ON u2.UserId = saa2.AdminUserId
        WHERE saa2.SurveyId = s.EventId
        FOR XML PATH(''), TYPE
      ).value('.', 'NVARCHAR(MAX)'), 1, 2, ''), '') AS AssignedAdminNames,
      NULLIF(STUFF((
        SELECT ', ' + u2.Username
        FROM EventAdminAssignments saa2
        INNER JOIN Users u2 ON u2.UserId = saa2.AdminUserId
        WHERE saa2.SurveyId = s.EventId
        FOR XML PATH(''), TYPE
      ).value('.', 'NVARCHAR(MAX)'), 1, 2, ''), '') AS AssignedAdminUsernames,
      NULLIF(STUFF((
        SELECT ',' + CAST(saa2.AdminUserId AS NVARCHAR(36))
        FROM EventAdminAssignments saa2
        WHERE saa2.SurveyId = s.EventId
        FOR XML PATH(''), TYPE
      ).value('.', 'NVARCHAR(MAX)'), 1, 1, ''), '') AS AssignedAdminIdsCsv,
      ISNULL(resp.RespondentCount, 0) AS RespondentCount,
      CASE WHEN pc.GeneratedAt IS NOT NULL THEN 1 ELSE 0 END AS HasGeneratedReport,
      sc.ConfigId, sc.HeroTitle, sc.HeroSubtitle, sc.HeroImageUrl,
      sc.LogoUrl, sc.BackgroundColor, sc.BackgroundImageUrl,
      sc.PrimaryColor, sc.SecondaryColor, sc.FontFamily, sc.ButtonStyle,
      sc.ShowProgressBar, sc.ShowPageNumbers, sc.MultiPage,
      sc.HeroImagePositionX, sc.HeroImagePositionY,
      sc.LogoPositionX, sc.LogoPositionY,
      sc.BackgroundPositionX, sc.BackgroundPositionY
    FROM Surveys s
    INNER JOIN Events e ON s.EventId = e.SurveyId
    LEFT JOIN (
      SELECT
        SurveyId,
        COUNT(DISTINCT CASE
          WHEN NULLIF(LTRIM(RTRIM(RespondentEmail)), '') IS NOT NULL
            THEN LOWER(LTRIM(RTRIM(RespondentEmail)))
          ELSE CONCAT(
            LOWER(COALESCE(LTRIM(RTRIM(RespondentName)), '')),
            '|', COALESCE(CONVERT(NVARCHAR(36), BusinessUnitId), ''),
            '|', COALESCE(CONVERT(NVARCHAR(36), DivisionId), ''),
            '|', COALESCE(CONVERT(NVARCHAR(36), DepartmentId), ''),
            '|', COALESCE(CONVERT(NVARCHAR(36), PublishCycleId), ''),
            '|', COALESCE(LTRIM(RTRIM(IpAddress)), '')
          )
        END) AS RespondentCount
      FROM Responses
      GROUP BY SurveyId
    ) resp ON resp.SurveyId = s.SurveyId
    LEFT JOIN Users admin ON (
      admin.UserId = TRY_CONVERT(BIGINT, e.AssignedAdminId)
      OR admin.Username = CONVERT(NVARCHAR(255), e.AssignedAdminId)
    )
    LEFT JOIN EventConfiguration sc ON s.SurveyId = sc.SurveyId
    LEFT JOIN EventPublishCycles pc ON pc.SurveyId = s.SurveyId AND pc.IsCurrent = 1
    WHERE 1=1
  `;

  if (filter.status) {
    query += ' AND s.Status = @status';
    request.input('status', sql.NVarChar(50), filter.status);
  }

  if (filter.assignedAdminId) {
    const numericAdminId = Number(filter.assignedAdminId);
    const isNumeric = Number.isInteger(numericAdminId) && numericAdminId > 0;
    const assignedAdminUsername = String(filter.assignedAdminUsername || filter.assignedAdminId || '').trim();
    query += ` AND (
      EXISTS (
        SELECT 1
        FROM EventAdminAssignments saaFilter
        INNER JOIN Users assignedFilterUser ON assignedFilterUser.UserId = saaFilter.AdminUserId
        WHERE saaFilter.SurveyId = s.EventId
          AND (
            saaFilter.AdminUserId = @assignedAdminUuid
            OR assignedFilterUser.Username = @assignedAdminUsername
          )
      )
      OR (
        @assignedAdminUuid IS NOT NULL
        AND TRY_CONVERT(BIGINT, e.AssignedAdminId) = @assignedAdminUuid
      )
      OR (
        @assignedAdminUsername <> ''
        AND (
          (';' + CONVERT(NVARCHAR(500), e.AssignedAdminId) + ';') LIKE ('%;' + @assignedAdminUsername + ';%')
          OR
          (',' + CONVERT(NVARCHAR(500), e.AssignedAdminId) + ',') LIKE ('%,' + @assignedAdminUsername + ',%')
        )
      )
    )`;
    request.input('assignedAdminUuid', sql.BigInt, isNumeric ? numericAdminId : null);
    request.input('assignedAdminUsername', sql.NVarChar(255), assignedAdminUsername);
  }

  if (filter.eventId) {
    query += ' AND s.EventId = @eventId';
    request.input('eventId', sql.BigInt, Number(filter.eventId));
  }

  query += ' ORDER BY s.CreatedAt DESC';

  const result = await request.query(query);
  return result.recordset.map(mapSurveyListRow);
}

function mapSurveyConfiguration(row) {
  return {
    ConfigId: row.ConfigId,
    HeroTitle: row.HeroTitle,
    HeroSubtitle: row.HeroSubtitle,
    HeroImageUrl: row.HeroImageUrl,
    LogoUrl: row.LogoUrl,
    BackgroundColor: row.BackgroundColor,
    BackgroundImageUrl: row.BackgroundImageUrl,
    PrimaryColor: row.PrimaryColor,
    SecondaryColor: row.SecondaryColor,
    FontFamily: row.FontFamily,
    ButtonStyle: row.ButtonStyle,
    ShowProgressBar: row.ShowProgressBar,
    ShowPageNumbers: row.ShowPageNumbers,
    MultiPage: row.MultiPage,
    HeroImagePositionX: row.HeroImagePositionX,
    HeroImagePositionY: row.HeroImagePositionY,
    LogoPositionX: row.LogoPositionX,
    LogoPositionY: row.LogoPositionY,
    BackgroundPositionX: row.BackgroundPositionX,
    BackgroundPositionY: row.BackgroundPositionY
  };
}

function toPositiveInt(value) {
  const parsed = typeof value === 'number' ? value : Number(String(value || '').trim());
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function mapSurveyListRow(row) {
  const assignedAdminId = row.AssignedAdminId || null;
  const survey = {
    SurveyId: row.SurveyId,
    EventId: row.EventId,
    EventTitle: row.EventTitle || null,
    Title: row.Title,
    Description: row.Description,
    StartDate: row.StartDate,
    EndDate: row.EndDate,
    Status: row.EffectiveStatus || row.Status,
    AssignedAdminId: assignedAdminId,
    AssignedAdminName: row.AssignedAdminName || null,
    AssignedAdminNames: row.AssignedAdminNames
      ? row.AssignedAdminNames.split(',').map((name) => name.trim()).filter(Boolean)
      : (row.AssignedAdminName ? [row.AssignedAdminName] : []),
    AssignedAdminUsernames: row.AssignedAdminUsernames
      ? row.AssignedAdminUsernames.split(',').map((name) => name.trim()).filter(Boolean)
      : [],
    AssignedAdminIds: row.AssignedAdminIdsCsv
      ? row.AssignedAdminIdsCsv
        .split(',')
        .map((id) => Number(id.trim()))
        .filter((id) => Number.isInteger(id) && id > 0)
      : (assignedAdminId ? [assignedAdminId] : []),
    TargetRespondents: row.TargetRespondents,
    TargetScore: row.TargetScore,
    CurrentScore: row.CurrentScore,
    RespondentCount: row.RespondentCount || 0,
    SurveyLink: row.SurveyLink,
    ShortenedLink: row.ShortenedLink,
    QRCodeDataUrl: row.QRCodeDataUrl,
    EmbedCode: row.EmbedCode,
    DuplicatePreventionEnabled: row.DuplicatePreventionEnabled,
    RequireApproval: row.RequireApproval ?? false,
    HasGeneratedReport: row.HasGeneratedReport === 1,
    CreatedAt: row.CreatedAt,
    CreatedBy: row.CreatedBy,
    UpdatedAt: row.UpdatedAt,
    UpdatedBy: row.UpdatedBy
  };

  if (row.ConfigId) {
    survey.configuration = mapSurveyConfiguration(row);
  }

  return survey;
}

async function getSurveyById(db, sql, NotFoundError, surveyIdentifier) {
  const surveyId = await resolveSurveyIdentifier(db, sql, NotFoundError, surveyIdentifier);
  const pool = await db.getPool();
  const result = await pool.request()
    .input('surveyId', sql.BigInt, surveyId)
    .query(`
      SELECT 
        s.*,
        e.Title AS EventTitle,
        e.Description AS EventDescription,
        e.AssignedAdminId,
        e.EventTypeId,
        CASE
          WHEN s.Status = 'Active' AND s.EndDate IS NOT NULL AND s.EndDate < GETDATE() THEN 'Closed'
          ELSE s.Status
        END AS EffectiveStatus,
        COALESCE(NULLIF(STUFF((
          SELECT ', ' + u2.DisplayName
          FROM EventAdminAssignments saa2
          INNER JOIN Users u2 ON u2.UserId = saa2.AdminUserId
          WHERE saa2.SurveyId = s.EventId
          FOR XML PATH(''), TYPE
        ).value('.', 'NVARCHAR(MAX)'), 1, 2, ''), ''), admin.DisplayName) AS AssignedAdminName,
        NULLIF(STUFF((
          SELECT ', ' + u2.DisplayName
          FROM EventAdminAssignments saa2
          INNER JOIN Users u2 ON u2.UserId = saa2.AdminUserId
          WHERE saa2.SurveyId = s.EventId
          FOR XML PATH(''), TYPE
        ).value('.', 'NVARCHAR(MAX)'), 1, 2, ''), '') AS AssignedAdminNames,
        NULLIF(STUFF((
          SELECT ', ' + u2.Username
          FROM EventAdminAssignments saa2
          INNER JOIN Users u2 ON u2.UserId = saa2.AdminUserId
          WHERE saa2.SurveyId = s.EventId
          FOR XML PATH(''), TYPE
        ).value('.', 'NVARCHAR(MAX)'), 1, 2, ''), '') AS AssignedAdminUsernames,
        NULLIF(STUFF((
          SELECT ',' + CAST(saa2.AdminUserId AS NVARCHAR(36))
          FROM EventAdminAssignments saa2
          WHERE saa2.SurveyId = s.EventId
          FOR XML PATH(''), TYPE
        ).value('.', 'NVARCHAR(MAX)'), 1, 1, ''), '') AS AssignedAdminIdsCsv,
        sc.ConfigId, sc.HeroTitle, sc.HeroSubtitle, sc.HeroImageUrl,
        sc.LogoUrl, sc.BackgroundColor, sc.BackgroundImageUrl,
        sc.PrimaryColor, sc.SecondaryColor, sc.FontFamily, sc.ButtonStyle,
        sc.ShowProgressBar, sc.ShowPageNumbers, sc.MultiPage,
        sc.HeroImagePositionX, sc.HeroImagePositionY,
        sc.LogoPositionX, sc.LogoPositionY,
        sc.BackgroundPositionX, sc.BackgroundPositionY
      FROM Surveys s
      INNER JOIN Events e ON s.EventId = e.SurveyId
      LEFT JOIN Users admin ON (
        admin.UserId = TRY_CONVERT(BIGINT, e.AssignedAdminId)
        OR admin.Username = CONVERT(NVARCHAR(255), e.AssignedAdminId)
      )
      LEFT JOIN EventConfiguration sc ON s.SurveyId = sc.SurveyId
      WHERE s.SurveyId = @surveyId
    `);

  if (result.recordset.length === 0) {
    throw new NotFoundError('Survey not found');
  }

  const row = result.recordset[0];
  const assignedAdminId = row.AssignedAdminId || null;
  const survey = {
    SurveyId: row.SurveyId,
    EventId: row.EventId,
    EventTitle: row.EventTitle || null,
    Title: row.Title,
    Description: row.Description,
    StartDate: row.StartDate,
    EndDate: row.EndDate,
    Status: row.EffectiveStatus || row.Status,
    AssignedAdminId: assignedAdminId,
    AssignedAdminName: row.AssignedAdminName || null,
    AssignedAdminNames: row.AssignedAdminNames
      ? row.AssignedAdminNames.split(',').map((name) => name.trim()).filter(Boolean)
      : (row.AssignedAdminName ? [row.AssignedAdminName] : []),
    AssignedAdminUsernames: row.AssignedAdminUsernames
      ? row.AssignedAdminUsernames.split(',').map((name) => name.trim()).filter(Boolean)
      : [],
    AssignedAdminIds: row.AssignedAdminIdsCsv
      ? row.AssignedAdminIdsCsv
        .split(',')
        .map((id) => Number(id.trim()))
        .filter((id) => Number.isInteger(id) && id > 0)
      : (assignedAdminId ? [assignedAdminId] : []),
    TargetRespondents: row.TargetRespondents,
    TargetScore: row.TargetScore,
    CurrentScore: row.CurrentScore,
    SurveyLink: row.SurveyLink,
    ShortenedLink: row.ShortenedLink,
    QRCodeDataUrl: row.QRCodeDataUrl,
    EmbedCode: row.EmbedCode,
    DuplicatePreventionEnabled: row.DuplicatePreventionEnabled,
    RequireApproval: row.RequireApproval ?? false,
    CreatedAt: row.CreatedAt,
    CreatedBy: row.CreatedBy,
    UpdatedAt: row.UpdatedAt,
    UpdatedBy: row.UpdatedBy
  };

  if (row.ConfigId) {
    survey.configuration = mapSurveyConfiguration(row);
  }

  const questionsResult = await pool.request()
    .input('surveyId', sql.BigInt, surveyId)
    .query(`
      SELECT * FROM Questions
      WHERE SurveyId = @surveyId
      ORDER BY PageNumber, DisplayOrder
    `);

  const questions = questionsResult.recordset.map((question) => {
    if (question.Options) {
      try {
        question.Options = JSON.parse(question.Options);
      } catch (e) {
        logger.warn(`Question ${question.QuestionId} has invalid JSON Options`, e);
        question.Options = [];
      }
    }
    return question;
  });

  if (survey.configuration && survey.configuration.MultiPage) {
    const pages = {};
    questions.forEach((question) => {
      const pageNum = question.PageNumber || 1;
      if (!pages[pageNum]) {
        pages[pageNum] = [];
      }
      pages[pageNum].push(question);
    });
    survey.pages = pages;
  }

  survey.questions = questions;
  return survey;
}

async function getEvents(db, sql, filter = {}) {
  const pool = await db.getPool();
  const request = pool.request();

  let query = `
    SELECT
      e.SurveyId AS EventId,
      e.Title,
      e.Description,
      e.AssignedAdminId,
      e.EventTypeId,
      e.RequireApproval,
      e.Status,
      e.CreatedAt,
      e.CreatedBy,
      e.UpdatedAt,
      e.UpdatedBy,
      COALESCE(NULLIF(STUFF((
        SELECT ', ' + u2.DisplayName
        FROM EventAdminAssignments saa2
        INNER JOIN Users u2 ON u2.UserId = saa2.AdminUserId
        WHERE saa2.SurveyId = e.SurveyId
        FOR XML PATH(''), TYPE
      ).value('.', 'NVARCHAR(MAX)'), 1, 2, ''), ''), admin.DisplayName) AS AssignedAdminName,
      STUFF((
        SELECT ',' + CAST(saa3.AdminUserId AS VARCHAR(20))
        FROM EventAdminAssignments saa3
        WHERE saa3.SurveyId = e.SurveyId
        FOR XML PATH(''), TYPE
      ).value('.', 'NVARCHAR(MAX)'), 1, 1, '') AS AssignedAdminIdsCsv,
      ISNULL(surveyCount.Total, 0) AS SurveyCount
    FROM Events e
    LEFT JOIN Users admin ON (
      admin.UserId = TRY_CONVERT(BIGINT, e.AssignedAdminId)
      OR admin.Username = CONVERT(NVARCHAR(255), e.AssignedAdminId)
    )
    LEFT JOIN (
      SELECT EventId, COUNT(*) AS Total FROM Surveys GROUP BY EventId
    ) surveyCount ON surveyCount.EventId = e.SurveyId
    WHERE 1=1
  `;

  if (filter.status) {
    query += ' AND e.Status = @status';
    request.input('status', sql.NVarChar(50), filter.status);
  }

  if (filter.assignedAdminId) {
    const numericAdminId = Number(filter.assignedAdminId);
    const isNumeric = Number.isInteger(numericAdminId) && numericAdminId > 0;
    const assignedAdminUsername = String(filter.assignedAdminUsername || filter.assignedAdminId || '').trim();
    query += ` AND (
      EXISTS (
        SELECT 1
        FROM EventAdminAssignments saaFilter
        INNER JOIN Users assignedFilterUser ON assignedFilterUser.UserId = saaFilter.AdminUserId
        WHERE saaFilter.SurveyId = e.SurveyId
          AND (
            saaFilter.AdminUserId = @assignedAdminUuid
            OR assignedFilterUser.Username = @assignedAdminUsername
          )
      )
      OR (
        @assignedAdminUuid IS NOT NULL
        AND TRY_CONVERT(BIGINT, e.AssignedAdminId) = @assignedAdminUuid
      )
      OR (
        @assignedAdminUsername <> ''
        AND (
          (';' + CONVERT(NVARCHAR(500), e.AssignedAdminId) + ';') LIKE ('%;' + @assignedAdminUsername + ';%')
          OR
          (',' + CONVERT(NVARCHAR(500), e.AssignedAdminId) + ',') LIKE ('%,' + @assignedAdminUsername + ',%')
        )
      )
    )`;
    request.input('assignedAdminUuid', sql.BigInt, isNumeric ? numericAdminId : null);
    request.input('assignedAdminUsername', sql.NVarChar(255), assignedAdminUsername);
  }

  query += ' ORDER BY e.CreatedAt DESC';

  const result = await request.query(query);
  return result.recordset.map((row) => ({
    EventId: row.EventId,
    SurveyId: row.EventId,
    Title: row.Title,
    Description: row.Description,
    AssignedAdminId: row.AssignedAdminId || null,
    AssignedAdminIds: row.AssignedAdminIdsCsv
      ? row.AssignedAdminIdsCsv.split(',').map(Number).filter(n => n > 0)
      : [],
    AssignedAdminName: row.AssignedAdminName || null,
    EventTypeId: row.EventTypeId,
    RequireApproval: row.RequireApproval ?? false,
    Status: row.Status,
    SurveyCount: row.SurveyCount,
    CreatedAt: row.CreatedAt,
    CreatedBy: row.CreatedBy,
    UpdatedAt: row.UpdatedAt,
    UpdatedBy: row.UpdatedBy
  }));
}

async function getEventById(db, sql, NotFoundError, eventId) {
  const pool = await db.getPool();
  const numericId = Number(String(eventId || '').trim());
  if (!Number.isSafeInteger(numericId) || numericId <= 0) {
    throw new NotFoundError('Event not found');
  }

  const result = await pool.request()
    .input('eventId', sql.BigInt, numericId)
    .query(`
      SELECT
        e.SurveyId AS EventId,
        e.Title,
        e.Description,
        e.AssignedAdminId,
        e.EventTypeId,
        e.RequireApproval,
        e.Status,
        e.CreatedAt,
        e.CreatedBy,
        e.UpdatedAt,
        e.UpdatedBy,
        COALESCE(NULLIF(STUFF((
          SELECT ', ' + u2.DisplayName
          FROM EventAdminAssignments saa2
          INNER JOIN Users u2 ON u2.UserId = saa2.AdminUserId
          WHERE saa2.SurveyId = e.SurveyId
          FOR XML PATH(''), TYPE
        ).value('.', 'NVARCHAR(MAX)'), 1, 2, ''), ''), admin.DisplayName) AS AssignedAdminName,
        NULLIF(STUFF((
          SELECT ',' + CAST(saa2.AdminUserId AS NVARCHAR(36))
          FROM EventAdminAssignments saa2
          WHERE saa2.SurveyId = e.SurveyId
          FOR XML PATH(''), TYPE
        ).value('.', 'NVARCHAR(MAX)'), 1, 1, ''), '') AS AssignedAdminIdsCsv,
        NULLIF(STUFF((
          SELECT ', ' + u2.DisplayName
          FROM EventAdminAssignments saa2
          INNER JOIN Users u2 ON u2.UserId = saa2.AdminUserId
          WHERE saa2.SurveyId = e.SurveyId
          FOR XML PATH(''), TYPE
        ).value('.', 'NVARCHAR(MAX)'), 1, 2, ''), '') AS AssignedAdminNames,
        NULLIF(STUFF((
          SELECT ', ' + u2.Username
          FROM EventAdminAssignments saa2
          INNER JOIN Users u2 ON u2.UserId = saa2.AdminUserId
          WHERE saa2.SurveyId = e.SurveyId
          FOR XML PATH(''), TYPE
        ).value('.', 'NVARCHAR(MAX)'), 1, 2, ''), '') AS AssignedAdminUsernames
      FROM Events e
      LEFT JOIN Users admin ON (
        admin.UserId = TRY_CONVERT(BIGINT, e.AssignedAdminId)
        OR admin.Username = CONVERT(NVARCHAR(255), e.AssignedAdminId)
      )
      WHERE e.SurveyId = @eventId
    `);

  if (result.recordset.length === 0) {
    throw new NotFoundError('Event not found');
  }

  const row = result.recordset[0];

  // Get surveys belonging to this event
  const surveysResult = await pool.request()
    .input('eventId', sql.BigInt, numericId)
    .query(`
      SELECT
        s.SurveyId,
        s.Title,
        s.Description,
        s.SortOrder,
        s.StartDate,
        s.EndDate,
        s.Status,
        CASE
          WHEN s.Status = 'Active' AND s.EndDate IS NOT NULL AND s.EndDate < GETDATE() THEN 'Closed'
          ELSE s.Status
        END AS EffectiveStatus,
        s.TargetRespondents,
        s.TargetScore,
        s.CurrentScore,
        s.SurveyLink,
        s.CreatedAt,
        ISNULL(resp.RespondentCount, 0) AS RespondentCount,
        ISNULL(qCount.QuestionCount, 0) AS QuestionCount
      FROM Surveys s
      LEFT JOIN (
        SELECT SurveyId, COUNT(DISTINCT CASE
          WHEN NULLIF(LTRIM(RTRIM(RespondentEmail)), '') IS NOT NULL
            THEN LOWER(LTRIM(RTRIM(RespondentEmail)))
          ELSE CONCAT(LOWER(COALESCE(LTRIM(RTRIM(RespondentName)), '')), '|', COALESCE(CONVERT(NVARCHAR(36), BusinessUnitId), ''))
        END) AS RespondentCount
        FROM Responses GROUP BY SurveyId
      ) resp ON resp.SurveyId = s.SurveyId
      LEFT JOIN (
        SELECT SurveyId, COUNT(*) AS QuestionCount FROM Questions GROUP BY SurveyId
      ) qCount ON qCount.SurveyId = s.SurveyId
      WHERE s.EventId = @eventId
      ORDER BY s.SortOrder, s.CreatedAt
    `);

  // Get doorprize events linked to this parent event
  const doorprizesResult = await pool.request()
    .input('parentEventId', sql.BigInt, numericId)
    .query(`
      SELECT
        dp.DoorprizeEventId,
        dp.Name,
        dp.EventDate,
        dp.ImagePath,
        dp.Status,
        dp.CreatedAt,
        ISNULL(gCount.GiftCount, 0) AS GiftCount,
        ISNULL(pCount.ParticipantCount, 0) AS ParticipantCount
      FROM DoorprizeEvents dp
      LEFT JOIN (
        SELECT DoorprizeEventId, COUNT(*) AS GiftCount FROM DoorprizeGifts GROUP BY DoorprizeEventId
      ) gCount ON gCount.DoorprizeEventId = dp.DoorprizeEventId
      LEFT JOIN (
        SELECT DoorprizeEventId, COUNT(*) AS ParticipantCount FROM DoorprizeParticipants GROUP BY DoorprizeEventId
      ) pCount ON pCount.DoorprizeEventId = dp.DoorprizeEventId
      WHERE dp.ParentEventId = @parentEventId
      ORDER BY dp.CreatedAt
    `);

  return {
    EventId: row.EventId,
    Title: row.Title,
    Description: row.Description,
    AssignedAdminId: row.AssignedAdminId || null,
    AssignedAdminName: row.AssignedAdminName || null,
    AssignedAdminIds: row.AssignedAdminIdsCsv
      ? row.AssignedAdminIdsCsv.split(',').map(Number).filter(n => n > 0)
      : [],
    AssignedAdminNames: row.AssignedAdminNames
      ? row.AssignedAdminNames.split(',').map((name) => name.trim()).filter(Boolean)
      : (row.AssignedAdminName ? [row.AssignedAdminName] : []),
    AssignedAdminUsernames: row.AssignedAdminUsernames
      ? row.AssignedAdminUsernames.split(',').map((name) => name.trim()).filter(Boolean)
      : [],
    EventTypeId: row.EventTypeId,
    RequireApproval: row.RequireApproval ?? false,
    Status: row.Status,
    CreatedAt: row.CreatedAt,
    CreatedBy: row.CreatedBy,
    UpdatedAt: row.UpdatedAt,
    UpdatedBy: row.UpdatedBy,
    Surveys: surveysResult.recordset.map((s) => ({
      SurveyId: s.SurveyId,
      Title: s.Title,
      Description: s.Description,
      SortOrder: s.SortOrder,
      StartDate: s.StartDate,
      EndDate: s.EndDate,
      Status: s.EffectiveStatus || s.Status,
      TargetRespondents: s.TargetRespondents,
      TargetScore: s.TargetScore,
      CurrentScore: s.CurrentScore,
      SurveyLink: s.SurveyLink,
      RespondentCount: s.RespondentCount,
      QuestionCount: s.QuestionCount,
      CreatedAt: s.CreatedAt
    })),
    Doorprizes: doorprizesResult.recordset.map((d) => ({
      DoorprizeEventId: d.DoorprizeEventId,
      Name: d.Name,
      EventDate: d.EventDate,
      ImagePath: d.ImagePath,
      Status: d.Status,
      GiftCount: d.GiftCount,
      ParticipantCount: d.ParticipantCount,
      CreatedAt: d.CreatedAt
    }))
  };
}

async function updateSurveyConfig(db, sql, errors, surveyIdentifier, config) {
  const { NotFoundError, ValidationError } = errors;
  const surveyId = await resolveSurveyIdentifier(db, sql, NotFoundError, surveyIdentifier);
  const pool = await db.getPool();

  const surveyCheck = await pool.request()
    .input('surveyId', sql.BigInt, surveyId)
    .query('SELECT SurveyId FROM Surveys WHERE SurveyId = @surveyId');
  if (surveyCheck.recordset.length === 0) {
    throw new NotFoundError('Survey not found');
  }

  const configCheck = await pool.request()
    .input('surveyId', sql.BigInt, surveyId)
    .query('SELECT ConfigId FROM EventConfiguration WHERE SurveyId = @surveyId');
  if (configCheck.recordset.length === 0) {
    // Auto-create config row if it doesn't exist yet (new surveys may not have one)
    await pool.request()
      .input('surveyId', sql.BigInt, surveyId)
      .query(`INSERT INTO EventConfiguration (SurveyId, ShowProgressBar, ShowPageNumbers, MultiPage, CreatedAt)
              VALUES (@surveyId, 1, 1, 0, GETDATE())`);
  }

  const updateFields = [];
  const request = pool.request();
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

  if (updateFields.length === 0) {
    throw new ValidationError('No fields to update');
  }

  updateFields.push('UpdatedAt = GETDATE()');
  const result = await request.query(`
    UPDATE EventConfiguration
    SET ${updateFields.join(', ')}
    OUTPUT INSERTED.*
    WHERE SurveyId = @surveyId
  `);

  return result.recordset[0];
}

module.exports = {
  getSurveyById,
  getSurveys,
  getEvents,
  getEventById,
  resolveSurveyIdentifier,
  updateSurveyConfig
};
