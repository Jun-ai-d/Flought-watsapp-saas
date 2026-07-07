import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

// We require a 32-byte (256-bit) key for aes-256
// In production, this must be set in process.env.DB_ENCRYPTION_KEY
// Fallback is provided ONLY for local testing convenience.
const getSecretKey = () => {
  const envKey = process.env.DB_ENCRYPTION_KEY;
  if (!envKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: DB_ENCRYPTION_KEY must be set in production');
    }
    // Fallback is provided ONLY for local testing convenience.
    return Buffer.from('flought_local_dev_mock_key_32_ch'.padEnd(32, '0').slice(0, 32), 'utf-8');
  }
  // Ensure the key is exactly 32 bytes by padding or slicing
  return Buffer.from(envKey.padEnd(32, '0').slice(0, 32), 'utf-8');
};

/**
 * Encrypts a plaintext string using AES-256-GCM
 * Returns format: iv.authTag.encryptedData (all hex encoded)
 */
export function encryptToken(text: string): string {
  if (!text) return '';
  
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getSecretKey(), iv);
  
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
  
  // If it doesn't look like our format, assume it's an old plaintext token
  if (!encryptedString.includes('.')) {
    return encryptedString;
  }

  try {
    const parts = encryptedString.split('.');
    if (parts.length !== 3) return encryptedString;

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encryptedData = parts[2];

    const decipher = crypto.createDecipheriv(ALGORITHM, getSecretKey(), iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    // Do NOT silently return the ciphertext — that would send garbled data to the BSP API,
    // producing a mysterious 401 with no indication the real cause is decryption.
    throw new Error(`Decryption failed for stored token. The DB_ENCRYPTION_KEY may have been rotated or is incorrect. Original error: ${error}`);
  }
}
