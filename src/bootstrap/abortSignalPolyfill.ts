/**
 * React Native / Hermes lacks AbortSignal.timeout and AbortSignal.prototype.throwIfAborted.
 * @atproto/oauth-client calls both during post-authorize verifyIssuer (PLC DID resolution).
 * Without these polyfills, sign-in fails after Authorize with "Failed to resolve identity"
 * or expo-router deep links throw "undefined is not a function".
 *
 * Must run after InitializeCore (see index.js require order).
 *
 * @see https://github.com/bluesky-social/atproto/issues/4332
 * @see https://github.com/facebook/react-native/issues/42042
 */

type AbortSignalWithThrow = AbortSignal & { throwIfAborted?: () => void };

let installed = false;

function installQueueMicrotaskPolyfill(): void {
    if (typeof queueMicrotask === 'function') {
        return;
    }
    globalThis.queueMicrotask = (callback: () => void) => {
        Promise.resolve()
            .then(callback)
            .catch((error) => {
                setTimeout(() => {
                    throw error;
                });
            });
    };
}

export function installAbortSignalPolyfills(): void {
    if (installed) {
        return;
    }

    installQueueMicrotaskPolyfill();

    if (typeof AbortSignal === 'undefined') {
        return;
    }

    const proto = AbortSignal.prototype as AbortSignalWithThrow;

    if (typeof proto.throwIfAborted !== 'function') {
        Object.defineProperty(proto, 'throwIfAborted', {
            value: function throwIfAborted(this: AbortSignal): void {
                if (this.aborted) {
                    throw this.reason ?? new Error('Aborted');
                }
            },
            writable: true,
            configurable: true,
        });
    }

    if (typeof AbortSignal.timeout !== 'function') {
        Object.defineProperty(AbortSignal, 'timeout', {
            value: function timeout(ms: number): AbortSignal {
                const controller = new AbortController();
                setTimeout(() => {
                    const message = `The operation timed out after ${ms} ms`;
                    const reason =
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

    installed = true;

    if (__DEV__) {
        console.log('[bootstrap] AbortSignal polyfills active (throwIfAborted, timeout)');
    }
}

installAbortSignalPolyfills();
