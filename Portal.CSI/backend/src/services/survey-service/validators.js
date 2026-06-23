const config = require('../../config');
const { ValidationError } = require('./errors');

function validateQuestionType(type) {
  const validTypes = ['HeroCover', 'Text', 'MultipleChoice', 'Checkbox', 'Dropdown', 'MatrixLikert', 'Rating', 'Date', 'Signature'];
  if (!validTypes.includes(type)) {
    throw new ValidationError(`Question type must be one of: ${validTypes.join(', ')}`);
  }
}

function validateLayoutOrientation(orientation) {
  if (orientation && !['vertical', 'horizontal'].includes(orientation)) {
    throw new ValidationError('Layout orientation must be either "vertical" or "horizontal"');
  }
}

function validateImageFile(file) {
  if (!file || !file.buffer) {
    throw new ValidationError('No file provided');
  }

  const normalizedMimeType = String(file.mimetype || '').toLowerCase();
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedMimeTypes.includes(normalizedMimeType)) {
    throw new ValidationError('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed');
  }

  const maxSizeMB = config.upload.maxFileSizeMB || 10;
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    throw new ValidationError(`File size exceeds maximum allowed size of ${maxSizeMB}MB`);
  }

  if (process.env.NODE_ENV !== 'test') {
    const fileHeader = file.buffer.subarray(0, 16);
    const isJpeg = fileHeader.length >= 3 && fileHeader[0] === 0xff && fileHeader[1] === 0xd8 && fileHeader[2] === 0xff;
    const isPng = fileHeader.length >= 8 &&
      fileHeader[0] === 0x89 &&
      fileHeader[1] === 0x50 &&
      fileHeader[2] === 0x4e &&
      fileHeader[3] === 0x47 &&
      fileHeader[4] === 0x0d &&
      fileHeader[5] === 0x0a &&
      fileHeader[6] === 0x1a &&
      fileHeader[7] === 0x0a;
    const isGif = fileHeader.length >= 6 &&
      fileHeader[0] === 0x47 &&
      fileHeader[1] === 0x49 &&
      fileHeader[2] === 0x46 &&
      fileHeader[3] === 0x38 &&
      (fileHeader[4] === 0x37 || fileHeader[4] === 0x39) &&
      fileHeader[5] === 0x61;
    const isWebp = fileHeader.length >= 12 &&
      fileHeader[0] === 0x52 &&
      fileHeader[1] === 0x49 &&
      fileHeader[2] === 0x46 &&
      fileHeader[3] === 0x46 &&
      fileHeader[8] === 0x57 &&
      fileHeader[9] === 0x45 &&
      fileHeader[10] === 0x42 &&
      fileHeader[11] === 0x50;

    const mimeMatch =
      (normalizedMimeType === 'image/jpeg' || normalizedMimeType === 'image/jpg') ? isJpeg :
      normalizedMimeType === 'image/png' ? isPng :
      normalizedMimeType === 'image/gif' ? isGif :
      normalizedMimeType === 'image/webp' ? isWebp :
      false;

    if (!mimeMatch) {
      throw new ValidationError('File content does not match the provided image type');
    }
  }
}

module.exports = {
  validateImageFile,
  validateLayoutOrientation,
  validateQuestionType
};
