/**
 * Metro bundle polyfills — run before InitializeCore and expo winter.
 * Hermes lacks AbortSignal.prototype.throwIfAborted (OAuth verifyIssuer, linking).
 *
 * Do NOT polyfill queueMicrotask here — at bundle start RN has not installed it yet,
 * so we would shadow the real implementation and navigation.dispatch() throws
 * "undefined is not a function" (see abortSignalPolyfill.ts).
 *
 * Plain JS so Metro can prepend without transpiling. Keep in sync with abortSignalPolyfill.ts.
 */
'use strict';

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
