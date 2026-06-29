import * as Clipboard from 'expo-clipboard';
import { Alert } from 'react-native';

type ProfileLike = {
    url?: string | null;
    acct?: string | null;
    username?: string | null;
    id?: string | null;
};

export function getProfileUrl(profile: ProfileLike | null | undefined): string | undefined {
    if (!profile) return undefined;

    if (profile.url) return profile.url;

    const handle = profile.acct || profile.username;
    if (handle) return `https://bsky.app/profile/${handle}`;

    if (profile.id) return `https://bsky.app/profile/${profile.id}`;

    return undefined;
}

export function getProfileHandle(profile: ProfileLike | null | undefined): string {
    const raw = profile?.acct || profile?.username;
    if (!raw) return '';
    const normalized = raw.replace(/^@+/, '');
    return normalized ? `@${normalized}` : '';
}

export async function copyText(
    text: string,
    options?: { showAlert?: boolean; alertTitle?: string; alertMessage?: string },
): Promise<boolean> {
    if (!text) return false;
    await Clipboard.setStringAsync(text);
    if (options?.showAlert) {
        Alert.alert(options.alertTitle ?? 'Copied', options.alertMessage ?? 'Copied to clipboard');
    }
    return true;
}

export async function copyProfileHandle(
    profile: ProfileLike | null | undefined,
    options?: { showAlert?: boolean },
): Promise<boolean> {
    const handle = getProfileHandle(profile);
    if (!handle) return false;
    return copyText(handle, {
        showAlert: options?.showAlert,
        alertMessage: 'Handle copied to clipboard',
    });
}

export async function copyProfileLink(
    profile: ProfileLike | null | undefined,
    options?: { showAlert?: boolean; message?: string },
): Promise<boolean> {
    const url = getProfileUrl(profile);
    if (!url) return false;

    return copyText(url, {
        showAlert: options?.showAlert ?? true,
        alertMessage: options?.message ?? 'Profile link copied to clipboard',
    });
}
