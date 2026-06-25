import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import { Linking, Platform, Share } from 'react-native';

interface ShareParams {
    message: string;
    url?: string;
}

export type ShareAppTarget = 'whatsapp' | 'telegram' | 'sms' | 'x';

function formatShareText(message: string, url?: string): string {
    return url ? `${message}\n\n${url}` : message;
}

function withFileScheme(pathOrUri: string): string {
    if (pathOrUri.startsWith('file://') || pathOrUri.startsWith('content://')) {
        return pathOrUri;
    }
    return `file://${pathOrUri}`;
}

export const shareContent = async ({ message, url }: ShareParams) => {
    try {
        const payload = Platform.select({
            ios: {
                message,
                url,
            },
            android: {
                message: formatShareText(message, url),
            },
            default: {
                message: formatShareText(message, url),
            },
        });

        const result = await Share.share(payload);
        return result;
    } catch (error) {
        console.error('Share error:', error);
        throw error;
    }
};

export const copyLinkToClipboard = async (url: string) => {
    await Clipboard.setStringAsync(url);
};

function appTargetUrls(target: ShareAppTarget, message: string, url?: string): string[] {
    const text = encodeURIComponent(formatShareText(message, url));

    switch (target) {
        case 'whatsapp':
            return [`whatsapp://send?text=${text}`, `https://wa.me/?text=${text}`];
        case 'telegram': {
            const encodedUrl = encodeURIComponent(url ?? '');
            const encodedMsg = encodeURIComponent(message);
            return [
                `tg://msg?text=${text}`,
                `https://t.me/share/url?url=${encodedUrl}&text=${encodedMsg}`,
            ];
        }
        case 'sms':
            return [Platform.OS === 'ios' ? `sms:&body=${text}` : `sms:?body=${text}`];
        case 'x':
            return [
                `twitter://post?message=${text}`,
                `https://twitter.com/intent/tweet?text=${text}`,
            ];
        default:
            return [];
    }
}

export const shareToAppTarget = async ({
    target,
    message,
    url,
}: {
    target: ShareAppTarget;
    message: string;
    url?: string;
}) => {
    const candidateUrls = appTargetUrls(target, message, url);
    for (const candidate of candidateUrls) {
        const supported = await Linking.canOpenURL(candidate);
        if (!supported) continue;
        await Linking.openURL(candidate);
        return true;
    }
    return false;
};

export const shareVideoFile = async ({
    videoUrl,
    message,
    fallbackUrl,
}: {
    videoUrl: string;
    message: string;
    fallbackUrl?: string;
}) => {
    const extMatch = videoUrl.match(/\.([a-zA-Z0-9]{2,5})(?:\?|$)/);
    const ext = (extMatch?.[1] ?? 'mp4').toLowerCase();
    const destination = `${FileSystem.cacheDirectory}flip-share-${Date.now()}.${ext}`;
    const download = await FileSystem.downloadAsync(videoUrl, destination);
    const localUri = withFileScheme(download.uri);

    const payload = Platform.select({
        ios: {
            message,
            url: localUri,
        },
        android: {
            message: formatShareText(message, fallbackUrl),
            title: 'Share video',
            url: localUri,
        },
        default: {
            message: formatShareText(message, fallbackUrl),
            url: localUri,
        },
    });

    return Share.share(payload);
};
