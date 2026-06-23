/**
 * Form Encryption Service — AES-256-GCM
 *
 * Handles server-side generation of one-time encryption challenges and
 * decryption of client-encrypted form data.
 *
 * Satisfies Secure Programming Checklist item #9:
 * "Encrypt all sensitive data at form input using AES256"
 *
 * Flow:
 * 1. Client requests GET /auth/encryption-challenge
 * 2. Server generates random 256-bit AES key + challengeId, stores in memory (TTL 5 min)
 * 3. Client encrypts password with that key using AES-256-GCM (Web Crypto API)
 * 4. Client sends { encryptedPassword, challengeId } on login
 * 5. Server looks up key by challengeId, decrypts, then verifies password normally
 */

const crypto = require('crypto');
const logger = require('../config/logger');

// In-memory store for challenges (TTL-based cleanup)
const challenges = new Map();
const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CHALLENGES = 10000;

// Cleanup expired challenges periodically
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of challenges) {
    if (now - entry.createdAt > CHALLENGE_TTL_MS) {
      challenges.delete(id);
    }
  }
}, 60 * 1000); // every 60 seconds

/**
 * Generate a new encryption challenge.
 * @returns {{ challengeId: string, key: string }} challengeId + base64 AES key
 */
function generateChallenge() {
  // Prevent memory exhaustion
  if (challenges.size >= MAX_CHALLENGES) {
    // Evict oldest 20%
    const entries = [...challenges.entries()]
      .sort((a, b) => a[1].createdAt - b[1].createdAt);
    const evictCount = Math.ceil(MAX_CHALLENGES * 0.2);
    for (let i = 0; i < evictCount; i++) {
      challenges.delete(entries[i][0]);
    }
  }

  const challengeId = crypto.randomUUID();
  const keyBytes = crypto.randomBytes(32); // 256 bits

  challenges.set(challengeId, {
    key: keyBytes,
    createdAt: Date.now()
  });

  return {
    challengeId,
    key: keyBytes.toString('base64')
  };
}

/**
 * Decrypt an encrypted password using a previously issued challenge.
 * The challenge is consumed (one-time use).
 *
 * @param {string} encryptedBase64 - Base64 string: iv(12) + ciphertext + authTag(16)
 * @param {string} challengeId - The challenge ID from generateChallenge()
 * @returns {string|null} Decrypted plaintext password, or null on failure
 */
function decryptPassword(encryptedBase64, challengeId) {
  if (!encryptedBase64 || !challengeId) return null;

  const entry = challenges.get(challengeId);
  if (!entry) {
    logger.warn('Encryption challenge not found or expired', { challengeId });
    return null;
  }

  // One-time use
  challenges.delete(challengeId);

  // Check TTL
  if (Date.now() - entry.createdAt > CHALLENGE_TTL_MS) {
    logger.warn('Encryption challenge expired', { challengeId });
    return null;
  }

  try {
    const encrypted = Buffer.from(encryptedBase64, 'base64');

    // iv (12 bytes) + ciphertext + authTag (16 bytes appended by GCM)
    if (encrypted.length < 12 + 16 + 1) {
      logger.warn('Encrypted payload too short');
      return null;
    }

    const iv = encrypted.subarray(0, 12);
    // In AES-GCM, the auth tag is the last 16 bytes of the ciphertext buffer
    const ciphertextWithTag = encrypted.subarray(12);
    const authTag = ciphertextWithTag.subarray(ciphertextWithTag.length - 16);
    const ciphertext = ciphertextWithTag.subarray(0, ciphertextWithTag.length - 16);

    const decipher = crypto.createDecipheriv('aes-256-gcm', entry.key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, null, 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    logger.warn('Failed to decrypt form data', { challengeId, error: error.message });
    return null;
  }
}

module.exports = {
  generateChallenge,
  decryptPassword
};
