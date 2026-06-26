import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { decryptToken, encryptToken, redactSecrets } from '../src/crypto/tokens.js';

const TEST_KEY = 'test-encryption-key-32-chars-min!!';

describe('token encryption', () => {
    beforeEach(() => {
        process.env.FLIP_TOKEN_ENCRYPTION_KEY = TEST_KEY;
    });

    afterEach(() => {
        delete process.env.FLIP_TOKEN_ENCRYPTION_KEY;
    });

    it('round-trips plaintext', () => {
        const plaintext = 'eyJhbGciOiJIUzI1NiJ9.access.jwt.token';
        const encrypted = encryptToken(plaintext);
        expect(encrypted).not.toContain(plaintext);
        expect(decryptToken(encrypted)).toBe(plaintext);
    });

    it('rejects missing encryption key', () => {
        delete process.env.FLIP_TOKEN_ENCRYPTION_KEY;
        expect(() => encryptToken('secret')).toThrow(/FLIP_TOKEN_ENCRYPTION_KEY/);
    });

    it('rejects tampered ciphertext', () => {
        const encrypted = encryptToken('token');
        const parts = encrypted.split(':');
        parts[2] = 'AAAA';
        expect(() => decryptToken(parts.join(':'))).toThrow();
    });
});

describe('redactSecrets', () => {
    it('redacts Bearer tokens', () => {
        const input = 'Request failed: Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig';
        expect(redactSecrets(input)).toBe('Request failed: Bearer [REDACTED]');
    });

    it('redacts JWT JSON fields', () => {
        const input = '{"accessJwt":"secret-jwt","refreshJwt":"refresh-jwt"}';
        const out = redactSecrets(input);
        expect(out).toContain('[REDACTED]');
        expect(out).not.toContain('secret-jwt');
        expect(out).not.toContain('refresh-jwt');
    });

    it('redacts appPassword fields', () => {
        const input = 'callback body: {"appPassword":"abcd-efgh-ijkl-mnop"}';
        const out = redactSecrets(input);
        expect(out).toContain('[REDACTED]');
        expect(out).not.toContain('abcd-efgh');
    });
});
