// Re-export from shared error definitions
const { ValidationError, NotFoundError, DuplicateError } = require('../../utils/errors');

module.exports = {
  DuplicateError,
  NotFoundError,
  ValidationError
};
