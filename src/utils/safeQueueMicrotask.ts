/** Typed wrapper around bootstrap queueMicrotask helpers (CommonJS). */
export function ensureQueueMicrotask(): void {
    try {
        require('@/bootstrap/ensureQueueMicrotask').ensureQueueMicrotask();
    } catch {
        // tests / web
    }
}

export function safeQueueMicrotask(callback: () => void): void {
    try {
        require('@/bootstrap/ensureQueueMicrotask').safeQueueMicrotask(callback);
    } catch {
        Promise.resolve().then(callback);
    }
}
