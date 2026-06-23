const bcrypt = require('bcrypt');

const BCRYPT_SALT_ROUNDS = 10;

/**
 * Hash a plaintext password using bcrypt (standard).
 * @param {string} password
 * @returns {Promise<string>} bcrypt hash
 */
async function hashPassword(password) {
  return bcrypt.hash(String(password || ''), BCRYPT_SALT_ROUNDS);
}

function isBcryptHash(hash) {
  return typeof hash === 'string' && /^\$2[aby]\$/.test(hash);
}

/**
 * Verify a password against a stored hash.
 * Only bcrypt hashes are accepted.
 * @param {string} password
 * @param {string} storedHash
 * @returns {Promise<boolean>}
 */
async function verifyPassword(password, storedHash) {
  if (!storedHash) {
    return false;
  }

  if (!isBcryptHash(storedHash)) {
    return false;
  }

  return bcrypt.compare(password, storedHash);
}

module.exports = {
  hashPassword,
  isBcryptHash,
  verifyPassword
};
