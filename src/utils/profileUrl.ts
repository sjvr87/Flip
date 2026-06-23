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

export async function copyProfileLink(
    profile: ProfileLike | null | undefined,
    options?: { message?: string },
): Promise<boolean> {
    const url = getProfileUrl(profile);
    if (!url) return false;

    await Clipboard.setStringAsync(url);
    Alert.alert('Copied', options?.message ?? 'Profile link copied to clipboard');
    return true;
}
