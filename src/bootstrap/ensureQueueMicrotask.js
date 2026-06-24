'use strict';

/**
 * Keep global.queueMicrotask callable on Hermes bridgeless (NativeMicrotasks may be missing or broken).
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

function fallbackQueueMicrotask(callback) {
    if (typeof callback !== 'function') {
        throw new TypeError('queueMicrotask must be called with a function');
    }
    promiseFallback(callback);
}

function boundQueueMicrotask(callback) {
    fallbackQueueMicrotask(callback);
}

function shouldForcePromiseFallback() {
    try {
        if (global.RN$Bridgeless !== true) {
            return false;
        }
        const { Platform } = require('react-native');
        return Platform.OS === 'android';
    } catch {
        return false;
    }
}

function assignCallableQueueMicrotask(impl) {
    const fn = typeof impl === 'function' ? impl : fallbackQueueMicrotask;
    for (const target of [global, globalThis]) {
        try {
            target.queueMicrotask = fn;
        } catch {
            try {
                Object.defineProperty(target, 'queueMicrotask', {
                    value: fn,
                    writable: true,
                    enumerable: true,
                    configurable: true,
                });
            } catch {
                // ignore
            }
        }
    }
    if (typeof global.__flipBindQueueMicrotask === 'function') {
        global.__flipBindQueueMicrotask(fn);
    }
}

function patchPolyfillGlobalQueueMicrotask() {
    try {
        const pf = require('react-native/Libraries/Utilities/PolyfillFunctions');
        if (pf.__flipQueueMicrotaskPatched) {
            return;
        }
        const original = pf.polyfillGlobal;
        pf.polyfillGlobal = function flipPolyfillGlobal(name, getValue) {
            if (name !== 'queueMicrotask') {
                return original(name, getValue);
            }
            return original(name, function flipQueueMicrotaskFactory() {
                if (shouldForcePromiseFallback()) {
                    return fallbackQueueMicrotask;
                }
                let nativeImpl;
                try {
                    nativeImpl = getValue();
                } catch {
                    nativeImpl = null;
                }
                if (typeof nativeImpl === 'function') {
                    return function wrappedQueueMicrotask(callback) {
                        try {
                            nativeImpl(callback);
                        } catch {
                            fallbackQueueMicrotask(callback);
                        }
                    };
                }
                if (typeof __DEV__ !== 'undefined' && __DEV__) {
                    console.warn('[bootstrap] Native queueMicrotask missing - using Promise fallback');
                }
                return fallbackQueueMicrotask;
            });
        };
        pf.__flipQueueMicrotaskPatched = true;
    } catch {
        // RN not loaded (tests / web)
    }
}

function verifyQueueMicrotaskCallable() {
    try {
        const qm = global.queueMicrotask;
        if (typeof qm !== 'function') {
            return false;
        }
        qm(() => {});
        return true;
    } catch {
        return false;
    }
}

function ensureQueueMicrotask() {
    patchPolyfillGlobalQueueMicrotask();
    if (shouldForcePromiseFallback()) {
        assignCallableQueueMicrotask(fallbackQueueMicrotask);
        return;
    }
    if (!verifyQueueMicrotaskCallable()) {
        assignCallableQueueMicrotask(boundQueueMicrotask);
    }
    if (!verifyQueueMicrotaskCallable()) {
        assignCallableQueueMicrotask(fallbackQueueMicrotask);
    }
}

function safeQueueMicrotask(callback) {
    boundQueueMicrotask(callback);
}

module.exports = {
    ensureQueueMicrotask,
    safeQueueMicrotask,
    boundQueueMicrotask,
    patchPolyfillGlobalQueueMicrotask,
    fallbackQueueMicrotask,
};
