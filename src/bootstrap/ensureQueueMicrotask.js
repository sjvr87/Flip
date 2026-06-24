'use strict';

/** Re-bind RN queueMicrotask if winter/metro left a broken global (breaks navigation.dispatch). */
function ensureQueueMicrotask() {
    if (typeof globalThis.queueMicrotask === 'function') {
        return;
    }
    globalThis.queueMicrotask =
        require('react-native/Libraries/Core/Timers/queueMicrotask.js').default;
}

module.exports = { ensureQueueMicrotask };
