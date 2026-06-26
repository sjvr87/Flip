import crypto from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;

function getKey(): Buffer {
    const secret = process.env.FLIP_TOKEN_ENCRYPTION_KEY;
    if (!secret || secret.length < 32) {
        throw new Error('FLIP_TOKEN_ENCRYPTION_KEY must be set (min 32 chars)');
    }
    return crypto.createHash('sha256').update(secret).digest();
}

export function encryptToken(plaintext: string): string {
    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptToken(payload: string): string {
    const [ivB64, tagB64, dataB64] = payload.split(':');
    if (!ivB64 || !tagB64 || !dataB64) {
        throw new Error('Invalid encrypted token payload');
    }
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const data = Buffer.from(dataB64, 'base64');
    const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

/** Redact secrets from log/error strings. */
export function redactSecrets(input: string): string {
    return input
        .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
        .replace(/"accessJwt"\s*:\s*"[^"]+"/gi, '"accessJwt":"[REDACTED]"')
        .replace(/"refreshJwt"\s*:\s*"[^"]+"/gi, '"refreshJwt":"[REDACTED]"')
        .replace(/"appPassword"\s*:\s*"[^"]+"/gi, '"appPassword":"[REDACTED]"');
}
