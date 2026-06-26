import { describe, expect, it } from 'vitest';
import {
    canTransition,
    computeBackoffMs,
    isTerminal,
    nextStatusAfterAttempt,
} from '../src/queue/deliveryState.js';

describe('delivery state machine', () => {
    it('allows pending → sent', () => {
        expect(canTransition('pending', 'sent')).toBe(true);
    });

    it('allows pending → failed', () => {
        expect(canTransition('pending', 'failed')).toBe(true);
    });

    it('blocks sent → pending', () => {
        expect(canTransition('sent', 'pending')).toBe(false);
    });

    it('allows failed → pending for retry', () => {
        expect(canTransition('failed', 'pending')).toBe(true);
    });

    it('marks sent and failed as terminal', () => {
        expect(isTerminal('sent')).toBe(true);
        expect(isTerminal('failed')).toBe(true);
        expect(isTerminal('pending')).toBe(false);
    });

    it('returns sent on success', () => {
        expect(nextStatusAfterAttempt('pending', true, 1, 5)).toBe('sent');
    });

    it('stays pending below max attempts', () => {
        expect(nextStatusAfterAttempt('pending', false, 2, 5)).toBe('pending');
    });

    it('fails at max attempts', () => {
        expect(nextStatusAfterAttempt('pending', false, 5, 5)).toBe('failed');
    });

    it('marks not_implemented as terminal', () => {
        expect(isTerminal('not_implemented')).toBe(true);
        expect(canTransition('pending', 'not_implemented')).toBe(true);
        expect(canTransition('not_implemented', 'pending')).toBe(false);
    });

    it('preserves not_implemented on retry logic', () => {
        expect(nextStatusAfterAttempt('not_implemented', false, 1, 5)).toBe('not_implemented');
    });

    it('applies exponential backoff', () => {
        const first = computeBackoffMs(1);
        const second = computeBackoffMs(2);
        expect(second).toBeGreaterThan(first);
    });
});
