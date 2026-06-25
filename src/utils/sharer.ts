import * as Clipboard from 'expo-clipboard';
import { Share } from 'react-native';

import {
    cacheVideoForShare,
    executeShareTarget,
    type ShareTargetId,
} from '@/utils/shareTargets';

interface ShareParams {
    message: string;
    url?: string;
}

/** @deprecated Use ShareTargetId from shareTargets instead. */
export type ShareAppTarget = 'whatsapp' | 'telegram' | 'sms' | 'x';

const LEGACY_TARGET_MAP: Record<ShareAppTarget, ShareTargetId> = {
    whatsapp: 'whatsapp',
    telegram: 'telegram',
    sms: 'messages',
    x: 'x',
};

export const shareContent = async ({ message, url }: ShareParams) => {
    const result = await executeShareTarget({
        targetId: 'other',
        message,
        url,
    });
    return {
        action: result ? Share.sharedAction : Share.dismissedAction,
    };
};

export const copyLinkToClipboard = async (url: string) => {
    await Clipboard.setStringAsync(url);
};

export const shareToAppTarget = async ({
    target,
    message,
    url,
}: {
    target: ShareAppTarget;
    message: string;
    url?: string;
}) => {
    return executeShareTarget({
        targetId: LEGACY_TARGET_MAP[target],
        message,
        url,
    });
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
    await cacheVideoForShare(videoUrl);
    const opened = await executeShareTarget({
        targetId: 'share_video',
        message,
        url: fallbackUrl,
        videoUrl,
    });
    return {
        action: opened ? Share.sharedAction : Share.dismissedAction,
    };
};

export {
    cacheVideoForShare,
    executeShareTarget,
    getAvailableShareTargets,
    SHARE_TARGET_DEFINITIONS,
    type ShareTargetId,
} from '@/utils/shareTargets';
