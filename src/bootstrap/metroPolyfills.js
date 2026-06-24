/**
 * Metro bundle polyfills - run before RN default polyfills and InitializeCore.
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
