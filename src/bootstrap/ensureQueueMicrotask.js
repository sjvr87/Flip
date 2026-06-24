'use strict';

/**
 * Keep global + globalThis.queueMicrotask aligned with RN's implementation.
 * Expo winter may leave a broken globalThis shim; navigation.dispatch and
 * explore tab cache writes call queueMicrotask and throw if it is missing.
 */
function resolveQueueMicrotaskFn() {
    if (typeof global.queueMicrotask === 'function') {
        return global.queueMicrotask;
    }
    try {
        const mod = require('react-native/Libraries/Core/Timers/queueMicrotask.js');
        const rnQueueMicrotask = mod && (mod.default ?? mod);
        if (typeof rnQueueMicrotask === 'function') {
            return rnQueueMicrotask;
        }
    } catch {
        // RN internal path unavailable in tests
    }
    if (typeof globalThis.queueMicrotask === 'function') {
        return globalThis.queueMicrotask;
    }
    return null;
}

function ensureQueueMicrotask() {
    const fn = resolveQueueMicrotaskFn();
    if (typeof fn !== 'function') {
        return;
    }
    global.queueMicrotask = fn;
    globalThis.queueMicrotask = fn;
}

function safeQueueMicrotask(callback) {
    ensureQueueMicrotask();
    const fn = global.queueMicrotask ?? globalThis.queueMicrotask;
    if (typeof fn === 'function') {
        fn(callback);
        return;
    }
    Promise.resolve()
        .then(callback)
        .catch((error) => {
            setTimeout(() => {
                throw error;
            });
        });
}

module.exports = { ensureQueueMicrotask, safeQueueMicrotask };
