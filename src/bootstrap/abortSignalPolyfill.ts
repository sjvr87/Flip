/**
 * React Native / Hermes lacks AbortSignal.timeout and AbortSignal.prototype.throwIfAborted.
 * @atproto/oauth-client calls both during post-authorize verifyIssuer (PLC DID resolution).
 */

type AbortSignalWithThrow = AbortSignal & { throwIfAborted?: () => void };

function installAbortSignalPolyfills(): void {
    if (typeof AbortSignal === 'undefined') {
        return;
    }

    const proto = AbortSignal.prototype as AbortSignalWithThrow;

    if (typeof proto.throwIfAborted !== 'function') {
        proto.throwIfAborted = function throwIfAborted(this: AbortSignal): void {
            if (this.aborted) {
                throw this.reason ?? new Error('The operation was aborted');
            }
        };
    }

    if (typeof AbortSignal.timeout !== 'function') {
        AbortSignal.timeout = function timeout(ms: number): AbortSignal {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                const message = `The operation timed out after ${ms} ms`;
                const timeoutError = new Error(message);
                timeoutError.name = 'TimeoutError';
                const reason =
                    typeof DOMException === 'function'
                        ? new DOMException(message, 'TimeoutError')
                        : timeoutError;
                controller.abort(reason);
            }, ms);
            controller.signal.addEventListener('abort', () => clearTimeout(timeoutId), {
                once: true,
            });
            return controller.signal;
        };
    }
}

installAbortSignalPolyfills();
