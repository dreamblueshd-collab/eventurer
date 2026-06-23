async function markAsBestComment(pool, sql, errors, responseId, questionId, markedBy) {
  const { NotFoundError, ValidationError } = errors;

  if (!responseId || !questionId || !markedBy) {
    throw new ValidationError('Response ID, Question ID, dan user yang menandai wajib diisi');
  }

  const checkResult = await pool.request()
    .input('responseId', sql.BigInt, responseId)
    .input('questionId', sql.BigInt, questionId)
    .query(`SELECT QuestionResponseId, IsBestComment, CommentValue FROM QuestionResponses
            WHERE ResponseId = @responseId AND QuestionId = @questionId`);

  if (checkResult.recordset.length === 0) {
    throw new NotFoundError('Data jawaban tidak ditemukan');
  }

  const questionResponse = checkResult.recordset[0];
  if (!questionResponse.CommentValue) {
    throw new ValidationError('Tidak dapat menandai sebagai best comment — tidak ada komentar pada jawaban ini');
  }
  if (questionResponse.IsBestComment) {
    return {
      success: true,
      questionResponseId: questionResponse.QuestionResponseId,
      isBestComment: true,
      alreadyBest: true
    };
  }

  await pool.request()
    .input('responseId', sql.BigInt, responseId)
    .input('questionId', sql.BigInt, questionId)
    .query(`UPDATE QuestionResponses SET IsBestComment = 1
            WHERE ResponseId = @responseId AND QuestionId = @questionId`);

  return {
    success: true,
    questionResponseId: questionResponse.QuestionResponseId,
    isBestComment: true
  };
}

async function unmarkBestComment(pool, sql, errors, responseId, questionId, unmarkedBy) {
  const { NotFoundError, ValidationError } = errors;

  if (!responseId || !questionId || !unmarkedBy) {
    throw new ValidationError('Response ID, Question ID, dan user yang membatalkan wajib diisi');
  }

  const checkResult = await pool.request()
    .input('responseId', sql.BigInt, responseId)
    .input('questionId', sql.BigInt, questionId)
    .query(`SELECT QuestionResponseId, IsBestComment FROM QuestionResponses
            WHERE ResponseId = @responseId AND QuestionId = @questionId`);

  if (checkResult.recordset.length === 0) {
    throw new NotFoundError('Data jawaban tidak ditemukan');
  }

  const questionResponse = checkResult.recordset[0];
  if (!questionResponse.IsBestComment) {
    throw new ValidationError('Komentar ini belum ditandai sebagai best comment');
  }

  await pool.request()
    .input('responseId', sql.BigInt, responseId)
    .input('questionId', sql.BigInt, questionId)
    .query(`UPDATE QuestionResponses SET IsBestComment = 0
            WHERE ResponseId = @responseId AND QuestionId = @questionId`);

  return {
    success: true,
    questionResponseId: questionResponse.QuestionResponseId,
    isBestComment: false
  };
}

async function submitBestCommentFeedback(pool, sql, errors, feedback) {
  const { NotFoundError, ValidationError } = errors;
  let { questionResponseId } = feedback;
  const { responseId, questionId, itLeadUserId, feedbackText } = feedback;

  if (!itLeadUserId || !feedbackText) {
    throw new ValidationError('User IT Lead dan teks feedback wajib diisi');
  }

  if (!questionResponseId && responseId && questionId) {
    const resolved = await pool.request()
      .input('responseId', sql.BigInt, responseId)
      .input('questionId', sql.BigInt, questionId)
      .query(`
        SELECT TOP 1 QuestionResponseId
        FROM QuestionResponses
        WHERE ResponseId = @responseId
          AND QuestionId = @questionId
      `);
    questionResponseId = resolved.recordset?.[0]?.QuestionResponseId || null;
  }

  if (!questionResponseId) {
    throw new ValidationError('QuestionResponseId wajib diisi');
  }

  const checkResult = await pool.request()
    .input('questionResponseId', sql.BigInt, questionResponseId)
    .query(`SELECT IsBestComment FROM QuestionResponses WHERE QuestionResponseId = @questionResponseId`);

  if (checkResult.recordset.length === 0) {
    throw new NotFoundError('Data jawaban tidak ditemukan');
  }
  if (!checkResult.recordset[0].IsBestComment) {
    throw new ValidationError('Jawaban ini belum ditandai sebagai best comment');
  }

  const existingFeedback = await pool.request()
    .input('questionResponseId', sql.BigInt, questionResponseId)
    .input('itLeadUserId', sql.BigInt, itLeadUserId)
    .query(`SELECT FeedbackId FROM BestCommentFeedback
            WHERE QuestionResponseId = @questionResponseId AND ITLeadUserId = @itLeadUserId`);

  if (existingFeedback.recordset.length > 0) {
    await pool.request()
      .input('feedbackId', sql.BigInt, existingFeedback.recordset[0].FeedbackId)
      .input('feedbackText', sql.NVarChar, feedbackText)
      .input('updatedAt', sql.DateTime2, new Date())
      .query(`UPDATE BestCommentFeedback SET FeedbackText = @feedbackText, UpdatedAt = @updatedAt
              WHERE FeedbackId = @feedbackId`);

    return {
      success: true,
      feedbackId: existingFeedback.recordset[0].FeedbackId,
      updated: true
    };
  }

  const result = await pool.request()
    .input('questionResponseId', sql.BigInt, questionResponseId)
    .input('itLeadUserId', sql.BigInt, itLeadUserId)
    .input('feedbackText', sql.NVarChar, feedbackText)
    .query(`INSERT INTO BestCommentFeedback (QuestionResponseId, ITLeadUserId, FeedbackText)
            OUTPUT INSERTED.FeedbackId VALUES (@questionResponseId, @itLeadUserId, @feedbackText)`);

  return {
    success: true,
    feedbackId: result.recordset[0].FeedbackId,
    updated: false
  };
}

async function getBestCommentFeedback(pool, sql, errors, questionResponseId) {
  const { ValidationError } = errors;

  if (!questionResponseId) {
    throw new ValidationError('QuestionResponseId is required');
  }

  const result = await pool.request()
    .input('questionResponseId', sql.BigInt, questionResponseId)
    .query(`SELECT bcf.FeedbackId, bcf.FeedbackText, bcf.CreatedAt, bcf.UpdatedAt,
                   u.DisplayName as ITLeadName, u.Email as ITLeadEmail
            FROM BestCommentFeedback bcf
            INNER JOIN Users u ON bcf.ITLeadUserId = u.UserId
            WHERE bcf.QuestionResponseId = @questionResponseId
            ORDER BY bcf.CreatedAt DESC`);

  return result.recordset;
}

module.exports = {
  getBestCommentFeedback,
  markAsBestComment,
  submitBestCommentFeedback,
  unmarkBestComment
};
