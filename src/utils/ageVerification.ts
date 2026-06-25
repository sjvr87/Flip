/**
 * 21+ age verification gate — disabled by default.
 * See docs/AGE_VERIFICATION.md for full spec.
 */

function isTruthyEnv(value: string | undefined): boolean {
    return value === '1' || value === 'true';
}

/** Master switch. Default off — no behavior change unless explicitly enabled. */
export const AGE_VERIFY_ENABLED = isTruthyEnv(process.env.EXPO_PUBLIC_AGE_VERIFY_ENABLED);

/** Dev-only skip. Never enable in production builds. */
export const AGE_VERIFY_BYPASS = __DEV__ && isTruthyEnv(process.env.EXPO_PUBLIC_AGE_VERIFY_BYPASS);

export function isAgeVerificationRequired(ageVerified: boolean): boolean {
    if (!AGE_VERIFY_ENABLED) return false;
    if (AGE_VERIFY_BYPASS) return false;
    return !ageVerified;
}

export type PostAuthRoute = '/(tabs)' | '/verify-age';

export function getPostAuthRoute(ageVerified: boolean): PostAuthRoute {
    return isAgeVerificationRequired(ageVerified) ? '/verify-age' : '/(tabs)';
}
