'use strict';

/**
 * Keep global + globalThis.queueMicrotask aligned with RN's implementation.
 * Expo winter / worklets may replace queueMicrotask after bootstrap; we cache RN's
 * impl in module scope and re-bind through the metro guard so navigation.dispatch
 * never sees a broken shim ("undefined is not a function").
 */

/** @type {((callback: () => void) => void) | null} */
let cachedRnQueueMicrotask = null;

function resolveRnQueueMicrotask() {
    if (cachedRnQueueMicrotask) {
        return cachedRnQueueMicrotask;
    }
    try {
        const mod = require('react-native/Libraries/Core/Timers/queueMicrotask.js');
        const fn = mod && (mod.default ?? mod);
        if (typeof fn === 'function') {
            cachedRnQueueMicrotask = fn;
            return fn;
        }
    } catch {
        // RN internal path unavailable in tests
    }
    return null;
}

function promiseFallback(callback) {
    Promise.resolve()
        .then(callback)
        .catch((error) => {
            setTimeout(() => {
                throw error;
            });
        });
}

/** Stable delegate — never reads global.queueMicrotask (may be a broken Expo winter shim). */
function boundQueueMicrotask(callback) {
    if (typeof callback !== 'function') {
        throw new TypeError('queueMicrotask must be called with a function');
    }
    const fn = resolveRnQueueMicrotask();
    if (fn) {
        fn(callback);
        return;
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
    resolveRnQueueMicrotask();
    installThroughMetroGuard();
}

function safeQueueMicrotask(callback) {
    ensureQueueMicrotask();
    boundQueueMicrotask(callback);
}

module.exports = { ensureQueueMicrotask, safeQueueMicrotask, boundQueueMicrotask };
