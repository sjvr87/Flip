import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import { Linking, Platform } from 'react-native';
import Share, { Social } from 'react-native-share';

export type ShareTargetId =
    | 'copy_link'
    | 'whatsapp'
    | 'instagram'
    | 'instagram_stories'
    | 'facebook_messenger'
    | 'facebook_stories'
    | 'snapchat'
    | 'snapchat_stories'
    | 'tiktok'
    | 'telegram'
    | 'messages'
    | 'x'
    | 'share_video'
    | 'other';

export type ShareTargetIcon = keyof typeof import('@expo/vector-icons').Ionicons.glyphMap;

export interface ShareTargetDefinition {
    id: ShareTargetId;
    label: string;
    icon: ShareTargetIcon;
    iconColor: string;
    backgroundColor: string;
    requiresVideo?: boolean;
    requiresUrl?: boolean;
    storyTarget?: boolean;
}

/** Stories-first ordering, then messaging apps, then generic fallbacks. */
export const SHARE_TARGET_DEFINITIONS: ShareTargetDefinition[] = [
    {
        id: 'copy_link',
        label: 'Copy link',
        icon: 'link-outline',
        iconColor: '#111827',
        backgroundColor: '#E5E7EB',
        requiresUrl: true,
    },
    {
        id: 'instagram_stories',
        label: 'IG Story',
        icon: 'logo-instagram',
        iconColor: '#FFFFFF',
        backgroundColor: '#E4405F',
        requiresVideo: true,
        storyTarget: true,
    },
    {
        id: 'facebook_stories',
        label: 'FB Story',
        icon: 'logo-facebook',
        iconColor: '#FFFFFF',
        backgroundColor: '#1877F2',
        requiresVideo: true,
        storyTarget: true,
    },
    {
        id: 'snapchat_stories',
        label: 'Snap Story',
        icon: 'logo-snapchat',
        iconColor: '#000000',
        backgroundColor: '#FFFC00',
        requiresVideo: true,
        storyTarget: true,
    },
    {
        id: 'whatsapp',
        label: 'WhatsApp',
        icon: 'logo-whatsapp',
        iconColor: '#FFFFFF',
        backgroundColor: '#25D366',
    },
    {
        id: 'instagram',
        label: 'Instagram',
        icon: 'logo-instagram',
        iconColor: '#FFFFFF',
        backgroundColor: '#C13584',
    },
    {
        id: 'facebook_messenger',
        label: 'Messenger',
        icon: 'chatbubble-ellipses',
        iconColor: '#FFFFFF',
        backgroundColor: '#0084FF',
    },
    {
        id: 'snapchat',
        label: 'Snapchat',
        icon: 'logo-snapchat',
        iconColor: '#000000',
        backgroundColor: '#FFFC00',
        requiresVideo: true,
    },
    {
        id: 'tiktok',
        label: 'TikTok',
        icon: 'musical-notes',
        iconColor: '#FFFFFF',
        backgroundColor: '#010101',
        requiresVideo: true,
    },
    {
        id: 'telegram',
        label: 'Telegram',
        icon: 'paper-plane',
        iconColor: '#FFFFFF',
        backgroundColor: '#26A5E4',
    },
    {
        id: 'messages',
        label: 'Messages',
        icon: 'chatbubble-outline',
        iconColor: '#FFFFFF',
        backgroundColor: '#34C759',
    },
    {
        id: 'x',
        label: 'X',
        icon: 'logo-twitter',
        iconColor: '#FFFFFF',
        backgroundColor: '#000000',
    },
    {
        id: 'share_video',
        label: 'Share video',
        icon: 'videocam',
        iconColor: '#FFFFFF',
        backgroundColor: '#6366F1',
        requiresVideo: true,
    },
    {
        id: 'other',
        label: 'More',
        icon: 'ellipsis-horizontal',
        iconColor: '#111827',
        backgroundColor: '#E5E7EB',
    },
];

const ANDROID_PACKAGES: Partial<Record<ShareTargetId, string | string[]>> = {
    whatsapp: 'com.whatsapp',
    instagram: 'com.instagram.android',
    instagram_stories: 'com.instagram.android',
    facebook_messenger: 'com.facebook.orca',
    facebook_stories: 'com.facebook.katana',
    snapchat: 'com.snapchat.android',
    snapchat_stories: 'com.snapchat.android',
    tiktok: ['com.zhiliaoapp.musically', 'com.ss.android.ugc.trill'],
    telegram: 'org.telegram.messenger',
    x: 'com.twitter.android',
};

const IOS_SCHEMES: Partial<Record<ShareTargetId, string | string[]>> = {
    whatsapp: 'whatsapp://',
    instagram: 'instagram://',
    instagram_stories: 'instagram-stories://',
    facebook_messenger: 'fb-messenger://',
    facebook_stories: 'facebook-stories://',
    snapchat: 'snapchat://',
    snapchat_stories: 'snapchat://',
    tiktok: ['tiktoksharesdk://', 'snssdk1233://'],
    telegram: 'tg://',
    x: 'twitter://',
};

const META_APP_ID =
    (Constants.expoConfig?.extra as { metaAppId?: string } | undefined)?.metaAppId ??
    process.env.EXPO_PUBLIC_META_APP_ID ??
    '';

function formatShareText(message: string, url?: string): string {
    return url ? `${message}\n\n${url}` : message;
}

function withFileScheme(pathOrUri: string): string {
    if (pathOrUri.startsWith('file://') || pathOrUri.startsWith('content://')) {
        return pathOrUri;
    }
    return `file://${pathOrUri}`;
}

async function isAndroidPackageInstalled(packageName: string): Promise<boolean> {
    try {
        const result = await Share.isPackageInstalled(packageName);
        return result.isInstalled;
    } catch {
        return false;
    }
}

async function isIosSchemeAvailable(scheme: string): Promise<boolean> {
    try {
        return await Linking.canOpenURL(scheme);
    } catch {
        return false;
    }
}

async function isTargetAppInstalled(targetId: ShareTargetId): Promise<boolean> {
    if (targetId === 'copy_link' || targetId === 'share_video' || targetId === 'other') {
        return true;
    }

    if (Platform.OS === 'android') {
        const packages = ANDROID_PACKAGES[targetId];
        if (!packages) return targetId === 'messages';
        const names = Array.isArray(packages) ? packages : [packages];
        for (const pkg of names) {
            if (await isAndroidPackageInstalled(pkg)) return true;
        }
        return false;
    }

    const schemes = IOS_SCHEMES[targetId];
    if (!schemes) return targetId === 'messages';
    const values = Array.isArray(schemes) ? schemes : [schemes];
    for (const scheme of values) {
        if (await isIosSchemeAvailable(scheme)) return true;
    }
    return false;
}

export interface CachedShareVideo {
    localUri: string;
    contentUri?: string;
    mimeType: string;
}

export async function cacheVideoForShare(videoUrl: string): Promise<CachedShareVideo> {
    const extMatch = videoUrl.match(/\.([a-zA-Z0-9]{2,5})(?:\?|$)/);
    const ext = (extMatch?.[1] ?? 'mp4').toLowerCase();
    const destination = `${FileSystem.cacheDirectory}flip-share-${Date.now()}.${ext}`;
    const download = await FileSystem.downloadAsync(videoUrl, destination);
    const localUri = withFileScheme(download.uri);
    const mimeType = ext === 'mov' ? 'video/quicktime' : 'video/mp4';

    if (Platform.OS === 'android') {
        const contentUri = await FileSystem.getContentUriAsync(download.uri);
        return { localUri, contentUri, mimeType };
    }

    return { localUri, mimeType };
}

function linkingUrlsForTarget(targetId: ShareTargetId, message: string, url?: string): string[] {
    const text = encodeURIComponent(formatShareText(message, url));

    switch (targetId) {
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
        case 'messages':
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

async function shareViaLinking(targetId: ShareTargetId, message: string, url?: string) {
    const candidates = linkingUrlsForTarget(targetId, message, url);
    for (const candidate of candidates) {
        if (await Linking.canOpenURL(candidate)) {
            await Linking.openURL(candidate);
            return true;
        }
    }
    return false;
}

async function shareSingleVideo(
    social: Social,
    cached: CachedShareVideo,
    message?: string,
    extras: Record<string, string | undefined> = {},
) {
    await Share.shareSingle({
        social,
        url: cached.localUri,
        type: cached.mimeType,
        message,
        useInternalStorage: true,
        ...extras,
    } as Parameters<typeof Share.shareSingle>[0]);
}

async function shareStory(
    social: Social.InstagramStories | Social.FacebookStories,
    cached: CachedShareVideo,
    url?: string,
) {
    const storyOptions = {
        social,
        backgroundVideo: cached.localUri,
        type: cached.mimeType,
        useInternalStorage: true,
        attributionURL: url,
        ...(META_APP_ID ? { appId: META_APP_ID } : {}),
    };

    await Share.shareSingle(storyOptions as Parameters<typeof Share.shareSingle>[0]);
}

export interface ShareTargetContext {
    hasVideo: boolean;
    hasUrl: boolean;
}

export async function getAvailableShareTargets(
    context: ShareTargetContext,
): Promise<ShareTargetId[]> {
    const available: ShareTargetId[] = [];

    for (const target of SHARE_TARGET_DEFINITIONS) {
        if (target.requiresVideo && !context.hasVideo) continue;
        if (target.requiresUrl && !context.hasUrl) continue;

        if (target.id === 'copy_link' || target.id === 'share_video' || target.id === 'other') {
            available.push(target.id);
            continue;
        }

        if (target.id === 'messages') {
            available.push(target.id);
            continue;
        }

        if (await isTargetAppInstalled(target.id)) {
            available.push(target.id);
        }
    }

    return available;
}

export interface ExecuteShareTargetParams {
    targetId: ShareTargetId;
    message: string;
    url?: string;
    videoUrl?: string;
}

export async function executeShareTarget({
    targetId,
    message,
    url,
    videoUrl,
}: ExecuteShareTargetParams): Promise<boolean> {
    const shareText = formatShareText(message, url);
    const needsVideo =
        targetId === 'share_video' ||
        targetId === 'whatsapp' ||
        targetId === 'instagram' ||
        targetId === 'instagram_stories' ||
        targetId === 'facebook_stories' ||
        targetId === 'facebook_messenger' ||
        targetId === 'snapchat' ||
        targetId === 'snapchat_stories' ||
        targetId === 'tiktok';

    const cached = needsVideo && videoUrl ? await cacheVideoForShare(videoUrl) : null;

    switch (targetId) {
        case 'whatsapp': {
            if (cached) {
                await shareSingleVideo(Social.Whatsapp, cached, shareText);
                return true;
            }
            return shareViaLinking('whatsapp', message, url);
        }
        case 'instagram': {
            if (cached) {
                await shareSingleVideo(Social.Instagram, cached, shareText);
                return true;
            }
            return shareViaLinking('instagram', message, url);
        }
        case 'instagram_stories': {
            if (!cached) return false;
            await shareStory(Social.InstagramStories, cached, url);
            return true;
        }
        case 'facebook_messenger': {
            if (cached) {
                await shareSingleVideo(Social.Messenger, cached, shareText);
                return true;
            }
            try {
                await Share.shareSingle({
                    social: Social.Messenger,
                    message: shareText,
                });
                return true;
            } catch {
                return shareViaLinking('facebook_messenger', message, url);
            }
        }
        case 'facebook_stories': {
            if (!cached) return false;
            await shareStory(Social.FacebookStories, cached, url);
            return true;
        }
        case 'snapchat':
        case 'snapchat_stories': {
            if (!cached) return false;
            await shareSingleVideo(Social.Snapchat, cached, message);
            return true;
        }
        case 'tiktok': {
            if (!cached) return false;
            await Share.open({
                url: cached.localUri,
                type: cached.mimeType,
                message,
                title: 'Share to TikTok',
                useInternalStorage: true,
                failOnCancel: false,
            });
            return true;
        }
        case 'telegram': {
            if (cached) {
                await shareSingleVideo(Social.Telegram, cached, shareText);
                return true;
            }
            return shareViaLinking('telegram', message, url);
        }
        case 'messages': {
            if (cached && Platform.OS === 'ios') {
                await Share.shareSingle({
                    social: Social.Sms,
                    url: cached.localUri,
                    type: cached.mimeType,
                    message: shareText,
                });
                return true;
            }
            return shareViaLinking('messages', message, url);
        }
        case 'x': {
            if (Platform.OS === 'ios') {
                await Share.shareSingle({
                    social: Social.Twitter,
                    message: shareText,
                    url,
                });
                return true;
            }
            return shareViaLinking('x', message, url);
        }
        case 'share_video': {
            if (!cached) return false;
            await Share.open({
                url: cached.localUri,
                type: cached.mimeType,
                message: shareText,
                title: 'Share video',
                useInternalStorage: true,
                failOnCancel: false,
            });
            return true;
        }
        case 'other': {
            if (cached) {
                await Share.open({
                    url: cached.localUri,
                    type: cached.mimeType,
                    message: shareText,
                    title: 'Share',
                    useInternalStorage: true,
                    failOnCancel: false,
                });
            } else {
                await Share.open({
                    message: shareText,
                    url,
                    failOnCancel: false,
                });
            }
            return true;
        }
        default:
            return false;
    }
}
