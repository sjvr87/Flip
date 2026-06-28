/**
 * React Native / Hermes lacks AbortSignal.timeout, AbortSignal.prototype.throwIfAborted,
 * and the `reason` property on AbortSignal / AbortController.abort(reason).
 *
 * @atproto/oauth-client calls all of these during post-authorize identity resolution
 * (verifyIssuer → PLC DID resolution → combineSignals → throwIfAborted).
 *
 * The `abort-controller` npm polyfill (used by RN in setUpXHR.js) does not support:
 *   - AbortSignal.prototype.throwIfAborted
 *   - AbortSignal.prototype.reason
 *   - AbortController.prototype.abort(reason)
 *   - AbortSignal.timeout(ms)
 *
 * Without these, OAuth sign-in fails after Authorize with "Failed to resolve identity"
 * or expo-router deep links throw "undefined is not a function".
 *
 * Must run after InitializeCore (see index.js require order) so that the RN
 * lazy-getter for AbortSignal has been materialized.
 *
 * @see https://github.com/bluesky-social/atproto/issues/4332
 * @see https://github.com/facebook/react-native/issues/42042
 */

declare global {
    var __abortSignalReasons: WeakMap<AbortSignal, unknown> | undefined;
}

type AbortSignalWithReason = AbortSignal & {
    throwIfAborted?: () => void;
    reason?: unknown;
};

type AbortControllerWithReason = AbortController & {
    abort: (reason?: unknown) => void;
};

let installed = false;

/**
 * Patch AbortSignal.prototype.throwIfAborted if missing.
 */
function patchThrowIfAborted(proto: AbortSignalWithReason): void {
    if (typeof proto.throwIfAborted === 'function') {
        return;
    }
    Object.defineProperty(proto, 'throwIfAborted', {
        value: function throwIfAborted(this: AbortSignalWithReason): void {
            if (this.aborted) {
                const reason =
                    this.reason ??
                    (typeof DOMException === 'function'
                        ? new DOMException('The operation was aborted.', 'AbortError')
                        : new Error('The operation was aborted.'));
                throw reason;
            }
        },
        writable: true,
        configurable: true,
    });
}

/**
 * Patch AbortSignal.prototype.reason if not present.
 * The `abort-controller` polyfill does not define `reason` on signals.
 * We add a getter that returns `undefined` when not aborted and a generic
 * AbortError when aborted (unless a reason was explicitly set via our
 * patched AbortController.abort).
 */
function patchReason(proto: AbortSignalWithReason): void {
    // If the prototype already has `reason` as own property or accessor, skip.
    if (Object.getOwnPropertyDescriptor(proto, 'reason')) {
        return;
    }
    // Use a WeakMap to store explicit reasons set via abort(reason).
    if (!globalThis.__abortSignalReasons) {
        globalThis.__abortSignalReasons = new WeakMap<AbortSignal, unknown>();
    }
    const reasons = globalThis.__abortSignalReasons;
    Object.defineProperty(proto, 'reason', {
        get(this: AbortSignal): unknown {
            const explicit = reasons.get(this);
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

/**
 * Patch AbortController.prototype.abort to accept a reason argument.
 * The `abort-controller` polyfill ignores arguments: abort() { abortSignal(getSignal(this)); }
 * We wrap it to store the reason before calling the original.
 */
function patchAbortControllerAbort(): void {
    if (typeof AbortController === 'undefined') {
        return;
    }
    const proto = AbortController.prototype as AbortControllerWithReason;
    const original = proto.abort;
    if (!original) {
        return;
    }
    // Skip if already patched (check a marker).
    if ((original as { __flipPatched?: boolean }).__flipPatched) {
        return;
    }
    const patched = function abort(this: AbortController, reason?: unknown): void {
        // Store the reason so AbortSignal.prototype.reason getter can retrieve it.
        if (reason !== undefined && globalThis.__abortSignalReasons) {
            globalThis.__abortSignalReasons.set(this.signal, reason);
        } else if (globalThis.__abortSignalReasons) {
            // Default reason when no argument: standard AbortError
            const defaultReason =
                typeof DOMException === 'function'
                    ? new DOMException('The operation was aborted.', 'AbortError')
                    : new Error('The operation was aborted.');
            globalThis.__abortSignalReasons.set(this.signal, defaultReason);
        }
        original.call(this);
    };
    (patched as { __flipPatched?: boolean }).__flipPatched = true;
    Object.defineProperty(proto, 'abort', {
        value: patched,
        writable: true,
        configurable: true,
    });
}

/**
 * Patch AbortSignal.timeout static method if missing.
 */
function patchTimeout(): void {
    if (typeof AbortSignal.timeout === 'function') {
        return;
    }
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

export function installAbortSignalPolyfills(): void {
    if (installed) {
        return;
    }

    if (typeof AbortSignal === 'undefined') {
        return;
    }

    const proto = AbortSignal.prototype as AbortSignalWithReason;

    patchReason(proto);
    patchAbortControllerAbort();
    patchThrowIfAborted(proto);
    patchTimeout();

    installed = true;

    if (__DEV__) {
        console.log(
            '[bootstrap] AbortSignal polyfills active (throwIfAborted, timeout, reason, abort(reason))',
        );
    }
}

/**
 * Re-apply polyfills. Call after any event that might replace the global
 * AbortSignal (e.g. RN lazy-getter materialization, expo polyfill load).
 */
export function ensureAbortSignalPolyfills(): void {
    if (typeof AbortSignal === 'undefined') {
        return;
    }
    const proto = AbortSignal.prototype as AbortSignalWithReason;
    // Re-check each patch individually (prototype may have been replaced).
    patchReason(proto);
    patchAbortControllerAbort();
    patchThrowIfAborted(proto);
    patchTimeout();
}

installAbortSignalPolyfills();
