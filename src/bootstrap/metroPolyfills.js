/**
 * Metro bundle polyfills - run before RN default polyfills and InitializeCore.
 *
 * AbortSignal / AbortController patches here cover the case where Hermes
 * provides a native AbortSignal that lacks throwIfAborted, timeout, and reason.
 * A second install pass runs post-InitializeCore in abortSignalPolyfill.ts to
 * handle the RN abort-controller polyfill replacing the global.
 */
'use strict';

(function installQueueMicrotaskGuard() {
    var flipBound = null;

    function promiseFallback(callback) {
        Promise.resolve()
            .then(callback)
            .catch(function (error) {
                setTimeout(function () {
                    throw error;
                });
            });
    }

    function delegate(callback) {
        if (typeof callback !== 'function') {
            throw new TypeError('queueMicrotask must be called with a function');
        }
        if (flipBound) {
            return flipBound(callback);
        }
        return promiseFallback(callback);
    }

    function installOn(target) {
        try {
            Object.defineProperty(target, 'queueMicrotask', {
                value: delegate,
                writable: true,
                enumerable: true,
                configurable: true,
            });
            return true;
        } catch {
            try {
                target.queueMicrotask = delegate;
                return true;
            } catch {
                return false;
            }
        }
    }

    installOn(global);
    installOn(globalThis);

    global.__flipBindQueueMicrotask = function bindQueueMicrotask(fn) {
        if (typeof fn !== 'function') {
            return;
        }
        flipBound = fn;
        installOn(global);
        installOn(globalThis);
    };

    global.__flipQueueMicrotaskImpl = delegate;
})();

(function installAbortPolyfills() {
    if (typeof AbortSignal === 'undefined') {
        return;
    }

    // WeakMap for storing abort reasons (abort-controller polyfill has no reason support).
    if (!globalThis.__abortSignalReasons) {
        globalThis.__abortSignalReasons = new WeakMap();
    }

    var proto = AbortSignal.prototype;

    // -- AbortSignal.prototype.reason --
    if (!Object.getOwnPropertyDescriptor(proto, 'reason')) {
        Object.defineProperty(proto, 'reason', {
            get: function () {
                var explicit = globalThis.__abortSignalReasons.get(this);
                if (explicit !== undefined) {
                    return explicit;
                }
                if (this.aborted) {
                    return typeof DOMException === 'function'
                        ? new DOMException('The operation was aborted.', 'AbortError')
                        : new Error('The operation was aborted.');
                }
                return undefined;
            },
            configurable: true,
            enumerable: true,
        });
    }

    // -- AbortController.prototype.abort(reason) --
    if (typeof AbortController !== 'undefined') {
        var acProto = AbortController.prototype;
        var originalAbort = acProto.abort;
        if (originalAbort && !originalAbort.__flipPatched) {
            var patched = function abort(reason) {
                if (reason !== undefined && globalThis.__abortSignalReasons) {
                    globalThis.__abortSignalReasons.set(this.signal, reason);
                } else if (globalThis.__abortSignalReasons) {
                    var defaultReason =
                        typeof DOMException === 'function'
                            ? new DOMException('The operation was aborted.', 'AbortError')
                            : new Error('The operation was aborted.');
                    globalThis.__abortSignalReasons.set(this.signal, defaultReason);
                }
                originalAbort.call(this);
            };
            patched.__flipPatched = true;
            Object.defineProperty(acProto, 'abort', {
                value: patched,
                writable: true,
                configurable: true,
            });
        }
    }

    // -- AbortSignal.prototype.throwIfAborted --
    if (typeof proto.throwIfAborted !== 'function') {
        Object.defineProperty(proto, 'throwIfAborted', {
            value: function throwIfAborted() {
                if (this.aborted) {
                    var reason = this.reason;
                    if (reason != null) {
                        throw reason;
                    }
                    throw typeof DOMException === 'function'
                        ? new DOMException('The operation was aborted.', 'AbortError')
                        : new Error('The operation was aborted.');
                }
            },
            writable: true,
            configurable: true,
        });
    }

    // -- AbortSignal.timeout --
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
})();
