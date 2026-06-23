function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 200);
}

async function generateSurveyLink(db, sql, config, NotFoundError, logger, surveyId, shortenUrl = false) {
  const pool = await db.getPool();
  const surveyIdText = String(surveyId);

  const surveyResult = await pool.request()
    .input('surveyId', sql.BigInt, surveyId)
    .query('SELECT SurveyId, Title, ShortenedLink, SurveyLink FROM Surveys WHERE SurveyId = @surveyId');

  if (surveyResult.recordset.length === 0) {
    throw new NotFoundError('Survey not found');
  }

  const surveyRow = surveyResult.recordset[0];

  // Re-use existing token from SurveyLink if already generated (preserve existing URLs)
  let token = null;
  if (surveyRow.SurveyLink) {
    const existingTokenMatch = surveyRow.SurveyLink.match(/\/survey\/[^/]+-([a-f0-9]{8})$/);
    if (existingTokenMatch) {
      token = existingTokenMatch[1];
    }
  }

  // Generate new random token if none exists
  if (!token) {
    const crypto = require('crypto');
    token = crypto.randomBytes(4).toString('hex'); // 8 hex chars, 32-bit entropy
  }

  const slugPart = slugify(surveyRow.Title) || surveyIdText;
  const surveyLink = `${config.publicSurveyBaseUrl}/survey/${encodeURIComponent(`${slugPart}-${token}`)}`;
  let shortenedLink = null;

  if (shortenUrl) {
    // Re-use existing short code if already generated
    const existing = surveyResult.recordset[0].ShortenedLink;
    if (existing) {
      const existingMatch = existing.match(/\/([A-Za-z0-9]{6})$/);
      if (existingMatch) {
        shortenedLink = `${config.publicSurveyBaseUrl}/${existingMatch[1]}`;
      }
    }

    if (!shortenedLink) {
      // Generate unique 6-char alphanumeric code
      const crypto = require('crypto');
      let shortCode;
      let attempts = 0;
      do {
        shortCode = crypto.randomBytes(4).toString('base64url').replace(/[^A-Za-z0-9]/g, '').slice(0, 6);
        if (shortCode.length < 6) {
          shortCode = crypto.randomBytes(6).toString('base64url').replace(/[^A-Za-z0-9]/g, '').slice(0, 6);
        }
        // Check uniqueness — exact suffix match to avoid false-positives from LIKE
        const dup = await pool.request()
          .input('shortCode', sql.NVarChar(20), shortCode)
          .query(`SELECT COUNT(*) AS cnt FROM Surveys WHERE RIGHT(ShortenedLink, LEN(@shortCode) + 1) = '/' + @shortCode`);
        if (dup.recordset[0].cnt === 0) break;
        attempts++;
      } while (attempts < 10);

      shortenedLink = `${config.publicSurveyBaseUrl}/${shortCode}`;
    }
  }

  await pool.request()
    .input('surveyId', sql.BigInt, surveyId)
    .input('surveyLink', sql.NVarChar(500), surveyLink)
    .input('shortenedLink', sql.NVarChar(500), shortenedLink)
    .query(`
      UPDATE Surveys
      SET SurveyLink = @surveyLink,
          ShortenedLink = @shortenedLink,
          UpdatedAt = GETDATE()
      WHERE SurveyId = @surveyId
    `);

  logger.info(`Survey link generated for survey ${surveyId}`);

  return {
    surveyLink,
    shortenedLink
  };
}

async function generateQRCode(db, sql, NotFoundError, logger, generateSurveyLinkFn, surveyId) {
  const pool = await db.getPool();

  const surveyResult = await pool.request()
    .input('surveyId', sql.BigInt, surveyId)
    .query('SELECT SurveyId, SurveyLink, ShortenedLink FROM Surveys WHERE SurveyId = @surveyId');

  if (surveyResult.recordset.length === 0) {
    throw new NotFoundError('Survey not found');
  }

  const survey = surveyResult.recordset[0];
  let linkToEncode = survey.ShortenedLink || survey.SurveyLink;

  if (!linkToEncode) {
    const linkResult = await generateSurveyLinkFn(surveyId, false);
    linkToEncode = linkResult.surveyLink;
  }

  const QRCode = require('qrcode');
  const qrCodeDataUrl = await QRCode.toDataURL(linkToEncode, {
    errorCorrectionLevel: 'M',
    type: 'image/png',
    width: 300,
    margin: 2
  });

  await pool.request()
    .input('surveyId', sql.BigInt, surveyId)
    .input('qrCodeDataUrl', sql.NVarChar(sql.MAX), qrCodeDataUrl)
    .query(`
      UPDATE Surveys
      SET QRCodeDataUrl = @qrCodeDataUrl,
          UpdatedAt = GETDATE()
      WHERE SurveyId = @surveyId
    `);

  logger.info(`QR code generated for survey ${surveyId}`);

  return qrCodeDataUrl;
}

async function generateEmbedCode(db, sql, NotFoundError, logger, generateSurveyLinkFn, surveyId) {
  const pool = await db.getPool();

  const surveyResult = await pool.request()
    .input('surveyId', sql.BigInt, surveyId)
    .query('SELECT SurveyId, SurveyLink, Title FROM Surveys WHERE SurveyId = @surveyId');

  if (surveyResult.recordset.length === 0) {
    throw new NotFoundError('Survey not found');
  }

  const survey = surveyResult.recordset[0];
  let surveyLink = survey.SurveyLink;

  if (!surveyLink) {
    const linkResult = await generateSurveyLinkFn(surveyId, false);
    surveyLink = linkResult.surveyLink;
  }

  const embedCode = `<iframe src="${surveyLink}" width="100%" height="600px" frameborder="0" title="${survey.Title || 'Survey'}"></iframe>`;

  await pool.request()
    .input('surveyId', sql.BigInt, surveyId)
    .input('embedCode', sql.NVarChar(sql.MAX), embedCode)
    .query(`
      UPDATE Surveys
      SET EmbedCode = @embedCode,
          UpdatedAt = GETDATE()
      WHERE SurveyId = @surveyId
    `);

  logger.info(`Embed code generated for survey ${surveyId}`);

  return embedCode;
}

module.exports = {
  generateEmbedCode,
  generateQRCode,
  generateSurveyLink,
  slugify
};
