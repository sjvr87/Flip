import type { ShareTargetIcon } from '@/utils/shareTargets';

export type ProfileLinkPlatformId =
    | 'instagram'
    | 'whatsapp'
    | 'tiktok'
    | 'x'
    | 'youtube'
    | 'lemonade'
    | 'threads'
    | 'facebook'
    | 'snapchat'
    | 'spotify'
    | 'linkedin'
    | 'telegram'
    | 'discord'
    | 'twitch'
    | 'pinterest'
    | 'reddit'
    | 'github'
    | 'website';

export type ProfileLinkPlatform = {
    id: ProfileLinkPlatformId;
    label: string;
    icon: ShareTargetIcon;
    brandColor: string;
    /** Icon tint on the colored circle */
    iconColor: string;
};

const PLATFORMS: Record<ProfileLinkPlatformId, ProfileLinkPlatform> = {
    instagram: {
        id: 'instagram',
        label: 'Instagram',
        icon: 'logo-instagram',
        brandColor: '#E4405F',
        iconColor: '#FFFFFF',
    },
    whatsapp: {
        id: 'whatsapp',
        label: 'WhatsApp',
        icon: 'logo-whatsapp',
        brandColor: '#25D366',
        iconColor: '#FFFFFF',
    },
    tiktok: {
        id: 'tiktok',
        label: 'TikTok',
        icon: 'musical-notes',
        brandColor: '#010101',
        iconColor: '#FFFFFF',
    },
    x: {
        id: 'x',
        label: 'X',
        icon: 'logo-twitter',
        brandColor: '#000000',
        iconColor: '#FFFFFF',
    },
    youtube: {
        id: 'youtube',
        label: 'YouTube',
        icon: 'logo-youtube',
        brandColor: '#FF0000',
        iconColor: '#FFFFFF',
    },
    lemonade: {
        id: 'lemonade',
        label: 'Lemonade',
        icon: 'sparkles',
        brandColor: '#FACC15',
        iconColor: '#422006',
    },
    threads: {
        id: 'threads',
        label: 'Threads',
        icon: 'at',
        brandColor: '#000000',
        iconColor: '#FFFFFF',
    },
    facebook: {
        id: 'facebook',
        label: 'Facebook',
        icon: 'logo-facebook',
        brandColor: '#1877F2',
        iconColor: '#FFFFFF',
    },
    snapchat: {
        id: 'snapchat',
        label: 'Snapchat',
        icon: 'logo-snapchat',
        brandColor: '#FFFC00',
        iconColor: '#000000',
    },
    spotify: {
        id: 'spotify',
        label: 'Spotify',
        icon: 'logo-spotify',
        brandColor: '#1DB954',
        iconColor: '#FFFFFF',
    },
    linkedin: {
        id: 'linkedin',
        label: 'LinkedIn',
        icon: 'logo-linkedin',
        brandColor: '#0A66C2',
        iconColor: '#FFFFFF',
    },
    telegram: {
        id: 'telegram',
        label: 'Telegram',
        icon: 'paper-plane',
        brandColor: '#26A5E4',
        iconColor: '#FFFFFF',
    },
    discord: {
        id: 'discord',
        label: 'Discord',
        icon: 'logo-discord',
        brandColor: '#5865F2',
        iconColor: '#FFFFFF',
    },
    twitch: {
        id: 'twitch',
        label: 'Twitch',
        icon: 'logo-twitch',
        brandColor: '#9146FF',
        iconColor: '#FFFFFF',
    },
    pinterest: {
        id: 'pinterest',
        label: 'Pinterest',
        icon: 'logo-pinterest',
        brandColor: '#E60023',
        iconColor: '#FFFFFF',
    },
    reddit: {
        id: 'reddit',
        label: 'Reddit',
        icon: 'logo-reddit',
        brandColor: '#FF4500',
        iconColor: '#FFFFFF',
    },
    github: {
        id: 'github',
        label: 'GitHub',
        icon: 'logo-github',
        brandColor: '#24292F',
        iconColor: '#FFFFFF',
    },
    website: {
        id: 'website',
        label: 'Link',
        icon: 'link',
        brandColor: '#6B7280',
        iconColor: '#FFFFFF',
    },
};

/** Platforms shown as quick-add chips in settings. */
export const QUICK_ADD_PLATFORMS: ProfileLinkPlatformId[] = [
    'instagram',
    'tiktok',
    'whatsapp',
    'x',
    'youtube',
    'lemonade',
    'threads',
    'spotify',
];

type HostRule = { hosts: string[]; platform: ProfileLinkPlatformId };

const HOST_RULES: HostRule[] = [
    { hosts: ['instagram.com', 'instagr.am'], platform: 'instagram' },
    {
        hosts: ['wa.me', 'whatsapp.com', 'api.whatsapp.com', 'chat.whatsapp.com'],
        platform: 'whatsapp',
    },
    { hosts: ['tiktok.com', 'vm.tiktok.com'], platform: 'tiktok' },
    { hosts: ['twitter.com', 'x.com'], platform: 'x' },
    { hosts: ['youtube.com', 'youtu.be', 'music.youtube.com'], platform: 'youtube' },
    { hosts: ['lemonade.social'], platform: 'lemonade' },
    { hosts: ['threads.net'], platform: 'threads' },
    { hosts: ['facebook.com', 'fb.com', 'fb.me', 'm.facebook.com'], platform: 'facebook' },
    { hosts: ['snapchat.com'], platform: 'snapchat' },
    { hosts: ['open.spotify.com', 'spotify.com'], platform: 'spotify' },
    { hosts: ['linkedin.com'], platform: 'linkedin' },
    { hosts: ['t.me', 'telegram.me', 'telegram.org'], platform: 'telegram' },
    { hosts: ['discord.gg', 'discord.com', 'discordapp.com'], platform: 'discord' },
    { hosts: ['twitch.tv'], platform: 'twitch' },
    { hosts: ['pinterest.com', 'pin.it'], platform: 'pinterest' },
    { hosts: ['reddit.com', 'redd.it'], platform: 'reddit' },
    { hosts: ['github.com'], platform: 'github' },
];

function normalizeHost(hostname: string): string {
    return hostname.toLowerCase().replace(/^www\./, '');
}

export function detectProfileLinkPlatform(url: string): ProfileLinkPlatform {
    try {
        const parsed = new URL(url.trim());
        const host = normalizeHost(parsed.hostname);
        for (const rule of HOST_RULES) {
            if (rule.hosts.some((h) => host === h || host.endsWith(`.${h}`))) {
                return PLATFORMS[rule.platform];
            }
        }
    } catch {
        // fall through
    }
    return PLATFORMS.website;
}

export function getProfileLinkPlatform(id: ProfileLinkPlatformId): ProfileLinkPlatform {
    return PLATFORMS[id];
}

/** Strip @ and whitespace from a handle/username fragment. */
function cleanHandle(raw: string): string {
    return raw.trim().replace(/^@+/, '');
}

/**
 * Build a canonical https URL from a platform + handle, or pass through full URLs.
 */
export function buildProfileLinkUrl(platformId: ProfileLinkPlatformId, input: string): string {
    const trimmed = input.trim();
    if (!trimmed) return '';

    if (trimmed.startsWith('https://')) {
        return trimmed;
    }

    const handle = cleanHandle(trimmed);

    switch (platformId) {
        case 'instagram':
            return `https://instagram.com/${handle}`;
        case 'tiktok':
            return `https://tiktok.com/@${handle}`;
        case 'whatsapp':
            return `https://wa.me/${handle.replace(/\D/g, '')}`;
        case 'x':
            return `https://x.com/${handle}`;
        case 'youtube':
            if (handle.startsWith('UC') || handle.startsWith('@')) {
                return handle.startsWith('@')
                    ? `https://youtube.com/${handle}`
                    : `https://youtube.com/channel/${handle}`;
            }
            return `https://youtube.com/@${handle}`;
        case 'lemonade':
            return `https://lemonade.social/${handle}`;
        case 'threads':
            return `https://threads.net/@${handle}`;
        case 'facebook':
            return `https://facebook.com/${handle}`;
        case 'snapchat':
            return `https://snapchat.com/add/${handle}`;
        case 'spotify':
            return trimmed.includes('spotify.com')
                ? `https://${trimmed.replace(/^https?:\/\//, '')}`
                : `https://open.spotify.com/user/${handle}`;
        case 'linkedin':
            return handle.includes('linkedin.com')
                ? `https://${handle.replace(/^https?:\/\//, '')}`
                : `https://linkedin.com/in/${handle}`;
        case 'telegram':
            return `https://t.me/${handle}`;
        case 'discord':
            return handle.includes('discord.')
                ? `https://${handle.replace(/^https?:\/\//, '')}`
                : `https://discord.gg/${handle}`;
        case 'twitch':
            return `https://twitch.tv/${handle}`;
        case 'pinterest':
            return `https://pinterest.com/${handle}`;
        case 'reddit':
            return `https://reddit.com/user/${handle}`;
        case 'github':
            return `https://github.com/${handle}`;
        default:
            return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
    }
}

/**
 * Normalize user input: auto-prefix https://, detect platform from pasted URL,
 * or build from selected platform + handle.
 */
export function normalizeProfileLinkInput(
    input: string,
    selectedPlatform?: ProfileLinkPlatformId | null,
): string {
    let trimmed = input.trim();
    if (!trimmed) return '';

    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
        if (selectedPlatform && selectedPlatform !== 'website') {
            return buildProfileLinkUrl(selectedPlatform, trimmed);
        }
        if (trimmed.includes('.') && !trimmed.includes(' ')) {
            trimmed = `https://${trimmed}`;
        } else {
            return trimmed;
        }
    }

    if (trimmed.startsWith('http://')) {
        trimmed = `https://${trimmed.slice('http://'.length)}`;
    }

    return trimmed;
}

export function validateProfileLinkUrl(url: string): string | null {
    const trimmed = url.trim();
    if (!trimmed) return 'URL is required';
    if (!trimmed.startsWith('https://')) return 'URL must start with https://';
    if (trimmed.length > 120) return 'URL must be 120 characters or less';
    try {
        new URL(trimmed);
    } catch {
        return 'Please enter a valid URL';
    }
    return null;
}
