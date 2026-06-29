import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};

function normalizeHost(value?: string): string {
    return (value ?? '')
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/\/+$/, '');
}

const envHost = normalizeHost(process.env.EXPO_PUBLIC_FLIP_STAGING_PDS_HOST);
const extraHost = normalizeHost(extra.flipStagingPdsHost as string | undefined);

const envHandleDomain = normalizeHost(process.env.EXPO_PUBLIC_FLIP_STAGING_HANDLE_DOMAIN);
const extraHandleDomain = normalizeHost(extra.flipStagingHandleDomain as string | undefined);

export const FLIP_STAGING_PDS_CONFIGURED = Boolean(envHost || extraHost);
export const FLIP_STAGING_PDS_HOST = envHost || extraHost || 'staging.flip.app';
export const FLIP_STAGING_PDS_URL = `https://${FLIP_STAGING_PDS_HOST}`;
export const FLIP_STAGING_HANDLE_DOMAIN =
    envHandleDomain || extraHandleDomain || FLIP_STAGING_PDS_HOST;
