import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY) {
  throw new Error('ENCRYPTION_KEY environment variable is required');
}

// Key must be 32 bytes for aes-256
const key = Buffer.from(ENCRYPTION_KEY, 'hex');

if (key.length !== 32) {
  throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
}

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Combine: iv (16 bytes) + authTag (16 bytes) + encrypted data
  const combined = Buffer.concat([
    iv,
    authTag,
    Buffer.from(encrypted, 'hex'),
  ]);
  
  return combined.toString('base64');
}

export function decrypt(encryptedText: string): string {
  const combined = Buffer.from(encryptedText, 'base64');
  
  // Extract iv (first 16 bytes)
  const iv = combined.subarray(0, 16);
  // Extract authTag (next 16 bytes)
  const authTag = combined.subarray(16, 32);
  // Extract encrypted data (remaining bytes)
  const encrypted = combined.subarray(32);
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

export function maskToken(token: string): string {
  if (!token) return '';
  if (token.length <= 8) return '********';
  return token.slice(0, 4) + '••••' + token.slice(-4);
}
