/**
 * Metro bundle polyfills — run before InitializeCore and expo winter.
 * Hermes lacks AbortSignal.prototype.throwIfAborted (OAuth verifyIssuer, linking).
 *
 * queueMicrotask: install a permanent delegate before InitializeCore; index.js binds
 * RN's real implementation after InitializeCore via __flipBindQueueMicrotask.
 *
 * Plain JS so Metro can prepend without transpiling. Keep in sync with abortSignalPolyfill.ts.
 */
'use strict';

(function installQueueMicrotaskGuard() {
    /** @type {((callback: () => void) => void) | null} */
    var flipBound = null;

    function delegate(callback) {
        if (typeof callback !== 'function') {
            throw new TypeError('queueMicrotask must be called with a function');
        }
        if (flipBound) {
            return flipBound(callback);
        }
        if (typeof Promise !== 'undefined') {
            Promise.resolve()
                .then(callback)
                .catch(function (error) {
                    setTimeout(function () {
                        throw error;
                    });
                });
            return;
        }
        setTimeout(callback, 0);
    }

    global.__flipBindQueueMicrotask = function bindQueueMicrotask(fn) {
        if (typeof fn !== 'function') {
            return;
        }
        flipBound = fn;
        try {
            Object.defineProperty(global, 'queueMicrotask', {
                value: delegate,
                writable: false,
                enumerable: true,
                configurable: false,
            });
            Object.defineProperty(globalThis, 'queueMicrotask', {
                value: delegate,
                writable: false,
                enumerable: true,
                configurable: false,
            });
        } catch {
            global.queueMicrotask = delegate;
            globalThis.queueMicrotask = delegate;
        }
    };

    if (typeof global.queueMicrotask !== 'function') {
        global.queueMicrotask = delegate;
        globalThis.queueMicrotask = delegate;
    }
})();

if (typeof AbortSignal !== 'undefined') {
    var proto = AbortSignal.prototype;
    if (typeof proto.throwIfAborted !== 'function') {
        Object.defineProperty(proto, 'throwIfAborted', {
            value: function throwIfAborted() {
                if (this.aborted) {
                    throw this.reason != null ? this.reason : new Error('Aborted');
                }
            },
            writable: true,
            configurable: true,
        });
    }

    if (typeof AbortSignal.timeout !== 'function') {
        Object.defineProperty(AbortSignal, 'timeout', {
            value: function timeout(ms) {
                var controller = new AbortController();
                setTimeout(function () {
                    var message = 'The operation timed out after ' + ms + ' ms';
                    var reason =
                        typeof DOMException === 'function'
                            ? new DOMException(message, 'TimeoutError')
                            : new Error(message);
                    controller.abort(reason);
                }, ms);
                return controller.signal;
            },
            writable: true,
            configurable: true,
        });
    }
}
