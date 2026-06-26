export type DeliveryStatus = 'pending' | 'sent' | 'failed' | 'not_implemented';

const TERMINAL: ReadonlySet<DeliveryStatus> = new Set(['sent', 'failed', 'not_implemented']);

const ALLOWED: Record<DeliveryStatus, ReadonlySet<DeliveryStatus>> = {
    pending: new Set(['sent', 'failed', 'pending', 'not_implemented']),
    sent: new Set(['sent']),
    failed: new Set(['failed', 'pending']),
    not_implemented: new Set(['not_implemented']),
};

export function canTransition(from: DeliveryStatus, to: DeliveryStatus): boolean {
    return ALLOWED[from]?.has(to) ?? false;
}

export function isTerminal(status: DeliveryStatus): boolean {
    return TERMINAL.has(status);
}

export function nextStatusAfterAttempt(
    current: DeliveryStatus,
    success: boolean,
    attemptCount: number,
    maxAttempts: number,
): DeliveryStatus {
    if (success) return 'sent';
    if (attemptCount >= maxAttempts) return 'failed';
    if (current === 'sent') return 'sent';
    if (current === 'not_implemented') return 'not_implemented';
    return 'pending';
}

export function computeBackoffMs(attemptCount: number): number {
    const base = Number(process.env.FLIP_DELIVERY_BACKOFF_BASE_MS ?? 60_000);
    const cap = Number(process.env.FLIP_DELIVERY_BACKOFF_CAP_MS ?? 900_000);
    const ms = base * 2 ** Math.max(0, attemptCount - 1);
    return Math.min(ms, cap);
}
