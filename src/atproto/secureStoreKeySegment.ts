/**
 * Expo SecureStore keys: non-empty, [A-Za-z0-9._-] only.
 * Logical keys (DIDs, URLs, OAuth state ids) may contain : / % etc.
 */
export function secureStoreKeySegment(raw: string): string {
    if (!raw) {
        throw new Error('SecureStore key segment must not be empty');
    }
    return raw.replace(/[^A-Za-z0-9._-]/g, (char) => {
        const hex = char.charCodeAt(0).toString(16).padStart(2, '0');
        return `_${hex}`;
    });
}
