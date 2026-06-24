'use strict';

/**
 * Keep global + globalThis.queueMicrotask aligned with a stable Promise-based impl.
 * Expo winter / worklets may replace queueMicrotask after bootstrap; we never read
 * global.queueMicrotask (may be a broken shim) and re-bind through the metro guard
 * so navigation.dispatch never sees "undefined is not a function".
 */

function promiseFallback(callback) {
    Promise.resolve()
        .then(callback)
        .catch((error) => {
            setTimeout(() => {
                throw error;
            });
        });
}

/** Stable delegate — never delegates to global.queueMicrotask or RN deep imports. */
function boundQueueMicrotask(callback) {
    if (typeof callback !== 'function') {
        throw new TypeError('queueMicrotask must be called with a function');
    }
    promiseFallback(callback);
}

function lockQueueMicrotaskOn(target) {
    try {
        Object.defineProperty(target, 'queueMicrotask', {
            value: boundQueueMicrotask,
            writable: false,
            enumerable: true,
            configurable: false,
        });
        return true;
    } catch {
        target.queueMicrotask = boundQueueMicrotask;
        return false;
    }
}

function installThroughMetroGuard() {
    if (typeof global.__flipBindQueueMicrotask === 'function') {
        global.__flipBindQueueMicrotask(boundQueueMicrotask);
        return;
    }
    lockQueueMicrotaskOn(global);
    lockQueueMicrotaskOn(globalThis);
}

function ensureQueueMicrotask() {
    installThroughMetroGuard();
}

function safeQueueMicrotask(callback) {
    ensureQueueMicrotask();
    boundQueueMicrotask(callback);
}

module.exports = { ensureQueueMicrotask, safeQueueMicrotask, boundQueueMicrotask };
