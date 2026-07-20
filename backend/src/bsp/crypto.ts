import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

/**
 * Returns a validated 32-byte key buffer.
 * C-6 Fix: No more zero-padding. Key must be exactly 32 characters (UTF-8)
 * or 64 hex characters. Anything else throws in all environments.
 */
const getSecretKey = (): Buffer => {
  const envKey = process.env.DB_ENCRYPTION_KEY;

  if (!envKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: DB_ENCRYPTION_KEY must be set in production');
    }
    // Dev-only fallback: deterministic but never used in production
    console.warn('[Crypto] WARNING: Using dev-only encryption key. Set DB_ENCRYPTION_KEY in .env');
    return Buffer.from('flought_dev_only_key_do_not_use!', 'utf-8'); // exactly 32 bytes
  }

  // Accept either a 32-char UTF-8 string or a 64-char hex string
  if (envKey.length === 64 && /^[0-9a-fA-F]+$/.test(envKey)) {
    return Buffer.from(envKey, 'hex'); // 64 hex chars = 32 bytes
  }

  if (envKey.length === 32) {
    return Buffer.from(envKey, 'utf-8'); // exactly 32 UTF-8 bytes
  }

  throw new Error(
    `FATAL: DB_ENCRYPTION_KEY must be exactly 32 UTF-8 characters or 64 hex characters. ` +
    `Got ${envKey.length} characters. Run \`openssl rand -hex 32\` to generate a valid key.`
  );
};

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns format: iv.authTag.encryptedData (all hex encoded).
 */
export function encryptToken(text: string): string {
  if (!text) return '';

  const key = getSecretKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  // Format: IV . AuthTag . EncryptedData
  return `${iv.toString('hex')}.${authTag}.${encrypted}`;
}

/**
 * Decrypts a previously encrypted token string.
 * Returns the plaintext string.
 */
export function decryptToken(encryptedString: string): string {
  if (!encryptedString) return '';

  // If it doesn't look like our iv.tag.data format, it may be a legacy plaintext token
  if (!encryptedString.includes('.')) {
    console.warn('[Crypto] Token does not appear encrypted (no dots). Treating as plaintext. Migrate this token.');
    return encryptedString;
  }

  const parts = encryptedString.split('.');
  if (parts.length !== 3) {
    throw new Error(
      `Decryption failed: expected 3 parts (iv.tag.data) but got ${parts.length}. ` +
      `The DB_ENCRYPTION_KEY may be incorrect or the value is corrupted.`
    );
  }

  try {
    const key = getSecretKey();
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encryptedData = parts[2];

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    // Never silently return ciphertext — that sends garbled data to BSP APIs
    throw new Error(
      `Decryption failed. The DB_ENCRYPTION_KEY may have been rotated or is incorrect. ` +
      `Original error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
