/**
 * Metro bundle polyfills — run before InitializeCore and expo winter.
 * Hermes lacks AbortSignal.prototype.throwIfAborted and sometimes queueMicrotask.
 * @atproto/oauth-client and expo-router linking call these during cold start.
 *
 * Plain JS so Metro can prepend without transpiling. Keep in sync with abortSignalPolyfill.ts.
 */
'use strict';

if (typeof globalThis.queueMicrotask !== 'function') {
    globalThis.queueMicrotask = function queueMicrotask(callback) {
        Promise.resolve()
            .then(callback)
            .catch(function (error) {
                setTimeout(function () {
                    throw error;
                });
            });
    };
}

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
