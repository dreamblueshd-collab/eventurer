const bcrypt = require('bcrypt');
const {
  hashPassword,
  isBcryptHash,
  verifyPassword
} = require('../passwordHash');

describe('passwordHash', () => {
  describe('hashPassword (bcrypt)', () => {
    it('produces a valid bcrypt hash', async () => {
      const hash = await hashPassword('admin123');
      expect(isBcryptHash(hash)).toBe(true);
      expect(hash).toMatch(/^\$2b\$10\$/);
    });

    it('produces different hashes for same password (random salt)', async () => {
      const h1 = await hashPassword('admin123');
      const h2 = await hashPassword('admin123');
      expect(h1).not.toBe(h2);
    });

    it('generated hash is verifiable', async () => {
      const hash = await hashPassword('MySecret!');
      const match = await bcrypt.compare('MySecret!', hash);
      expect(match).toBe(true);
    });
  });

  describe('isBcryptHash', () => {
    it('detects bcrypt hashes', async () => {
      const bcryptHash = await bcrypt.hash('Admin123!', 10);
      expect(isBcryptHash(bcryptHash)).toBe(true);
    });

    it('rejects non-bcrypt strings', () => {
      expect(isBcryptHash('aaAAshkiubw96QgvBvxd3w==')).toBe(false);
      expect(isBcryptHash(null)).toBe(false);
      expect(isBcryptHash('')).toBe(false);
      expect(isBcryptHash('plaintext')).toBe(false);
    });
  });

  describe('verifyPassword', () => {
    it('verifies bcrypt hashes', async () => {
      const storedHash = await bcrypt.hash('Admin123!', 10);
      await expect(verifyPassword('Admin123!', storedHash)).resolves.toBe(true);
      await expect(verifyPassword('Wrong123!', storedHash)).resolves.toBe(false);
    });

    it('rejects non-bcrypt hashes', async () => {
      await expect(verifyPassword('Admin123!', 'aaAAshkiubw96QgvBvxd3w==')).resolves.toBe(false);
    });

    it('returns false for null/empty hash', async () => {
      await expect(verifyPassword('admin123', null)).resolves.toBe(false);
      await expect(verifyPassword('admin123', '')).resolves.toBe(false);
    });
  });
});
