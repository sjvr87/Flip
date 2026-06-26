import Constants from 'expo-constants';
import { MultiverseProviderIds } from './types';

const extra = Constants.expoConfig?.extra ?? {};

/** Multiverse API base URL (no trailing slash). */
export function getMultiverseApiBase(): string {
    const fromEnv = process.env.EXPO_PUBLIC_FLIP_API_URL;
    if (fromEnv) return fromEnv.replace(/\/$/, '');

    const fromExtra = extra.flipMultiverseApiUrl as string | undefined;
    if (fromExtra) return fromExtra.replace(/\/$/, '');

    // Android emulator → host loopback; device dev uses adb reverse or LAN IP
    return 'http://127.0.0.1:8788';
}

export function isMultiverseEnabled(): boolean {
    const flag = extra.flipMultiverseEnabled;
    if (flag === false) return false;
    return true;
}

function readBoolFlag(envKey: string, extraKey: string, defaultValue: boolean): boolean {
    const fromEnv = process.env[envKey];
    if (fromEnv !== undefined) {
        return fromEnv === '1' || fromEnv.toLowerCase() === 'true';
    }
    const fromExtra = extra[extraKey];
    if (typeof fromExtra === 'boolean') return fromExtra;
    return defaultValue;
}

export function isProviderEnabled(provider: keyof typeof MultiverseProviderIds): boolean {
    switch (provider) {
        case 'FLIP_LOCAL':
            return true;
        case 'ATPROTO':
            return readBoolFlag('EXPO_PUBLIC_FF_PROVIDER_ATPROTO', 'ffProviderAtproto', true);
        case 'NOSTR':
            return readBoolFlag('EXPO_PUBLIC_FF_PROVIDER_NOSTR', 'ffProviderNostr', false);
        case 'ACTIVITYPUB':
            return readBoolFlag('EXPO_PUBLIC_FF_PROVIDER_ACTIVITYPUB', 'ffProviderActivitypub', false);
        default:
            return false;
    }
}

export function providerLabel(provider: string): string {
    if (provider === MultiverseProviderIds.ATPROTO || provider === 'bluesky') return 'ATProto';
    if (provider === MultiverseProviderIds.NOSTR) return 'Nostr';
    if (provider === MultiverseProviderIds.ACTIVITYPUB) return 'ActivityPub';
    return 'Flip';
}

export function providerIconName(
    provider: string,
): 'videocam-outline' | 'cloud-outline' | 'flash-outline' | 'globe-outline' {
    if (provider === MultiverseProviderIds.ATPROTO || provider === 'bluesky') return 'cloud-outline';
    if (provider === MultiverseProviderIds.NOSTR) return 'flash-outline';
    if (provider === MultiverseProviderIds.ACTIVITYPUB) return 'globe-outline';
    return 'videocam-outline';
}
