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
                throw this.reason ?? new Error('Aborted');
            }
        };
    }

    if (typeof AbortSignal.timeout !== 'function') {
        AbortSignal.timeout = function timeout(ms: number): AbortSignal {
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
        };
    }
}

installAbortSignalPolyfills();
