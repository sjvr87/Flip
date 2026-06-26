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

function parseEnvBool(raw: string | undefined): boolean | undefined {
    if (raw === undefined) return undefined;
    return raw === '1' || raw.toLowerCase() === 'true';
}

function readAtprotoFlag(): boolean {
    const fromEnv = parseEnvBool(process.env.EXPO_PUBLIC_FF_PROVIDER_ATPROTO);
    if (fromEnv !== undefined) return fromEnv;
    const fromExtra = extra.ffProviderAtproto;
    if (typeof fromExtra === 'boolean') return fromExtra;
    return true;
}

function readNostrFlag(): boolean {
    const fromEnv = parseEnvBool(process.env.EXPO_PUBLIC_FF_PROVIDER_NOSTR);
    if (fromEnv !== undefined) return fromEnv;
    const fromExtra = extra.ffProviderNostr;
    if (typeof fromExtra === 'boolean') return fromExtra;
    return false;
}

function readActivitypubFlag(): boolean {
    const fromEnv = parseEnvBool(process.env.EXPO_PUBLIC_FF_PROVIDER_ACTIVITYPUB);
    if (fromEnv !== undefined) return fromEnv;
    const fromExtra = extra.ffProviderActivitypub;
    if (typeof fromExtra === 'boolean') return fromExtra;
    return false;
}

export function isProviderEnabled(provider: keyof typeof MultiverseProviderIds): boolean {
    switch (provider) {
        case 'FLIP_LOCAL':
            return true;
        case 'ATPROTO':
            return readAtprotoFlag();
        case 'NOSTR':
            return readNostrFlag();
        case 'ACTIVITYPUB':
            return readActivitypubFlag();
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
    if (provider === MultiverseProviderIds.ATPROTO || provider === 'bluesky')
        return 'cloud-outline';
    if (provider === MultiverseProviderIds.NOSTR) return 'flash-outline';
    if (provider === MultiverseProviderIds.ACTIVITYPUB) return 'globe-outline';
    return 'videocam-outline';
}
