type AuthFailureHandler = (reason?: string) => void;

let _handler: AuthFailureHandler | null = null;

export function setAuthFailureHandler(handler: AuthFailureHandler) {
    _handler = handler;
}

export function triggerAuthFailure(reason?: string) {
    _handler?.(reason);
}
