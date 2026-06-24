'use strict';

/**
 * Keep globalThis.queueMicrotask aligned with RN's global.queueMicrotask.
 * Expo winter may leave a broken globalThis shim; navigation.dispatch needs the real one.
 */
function ensureQueueMicrotask() {
    if (typeof global.queueMicrotask === 'function') {
        globalThis.queueMicrotask = global.queueMicrotask;
        return;
    }
    try {
        const mod = require('react-native/Libraries/Core/Timers/queueMicrotask.js');
        const rnQueueMicrotask = mod && (mod.default ?? mod);
        if (typeof rnQueueMicrotask === 'function') {
            globalThis.queueMicrotask = rnQueueMicrotask;
            global.queueMicrotask = rnQueueMicrotask;
        }
    } catch {
        // RN internal path unavailable in tests
    }
}

module.exports = { ensureQueueMicrotask };
