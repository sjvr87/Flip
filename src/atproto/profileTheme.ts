import { getAgent, withAuthenticatedFetch } from './agent';

/** Flip profile personalization — MySpace-style theming stored on the user's repo. */
export const PROFILE_THEME_COLLECTION = 'flip.social.profileTheme';
export const PROFILE_THEME_RKEY = 'self';

export type FlipProfileTheme = {
    backgroundColor?: string;
    accentColor?: string;
    backgroundImage?: string;
    updatedAt?: string;
};

type ProfileThemeRecord = FlipProfileTheme & { $type?: string };

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

function sanitizeColor(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return HEX_COLOR.test(trimmed) ? trimmed : undefined;
}

function fromRecord(value: ProfileThemeRecord | null | undefined): FlipProfileTheme | null {
    if (!value) return null;
    const backgroundColor = sanitizeColor(value.backgroundColor);
    const accentColor = sanitizeColor(value.accentColor);
    const backgroundImage =
        typeof value.backgroundImage === 'string' && value.backgroundImage.startsWith('https://')
            ? value.backgroundImage
            : undefined;

    if (!backgroundColor && !accentColor && !backgroundImage) return null;

    return {
        backgroundColor,
        accentColor,
        backgroundImage,
        updatedAt: value.updatedAt,
    };
}

export async function fetchProfileTheme(actorDid: string): Promise<FlipProfileTheme | null> {
    try {
        const res = await withAuthenticatedFetch(() =>
            getAgent().com.atproto.repo.getRecord({
                repo: actorDid,
                collection: PROFILE_THEME_COLLECTION,
                rkey: PROFILE_THEME_RKEY,
            }),
        );
        return fromRecord(res.data.value as ProfileThemeRecord);
    } catch {
        return null;
    }
}

export async function saveProfileTheme(
    patch: Partial<Pick<FlipProfileTheme, 'backgroundColor' | 'accentColor' | 'backgroundImage'>>,
): Promise<FlipProfileTheme> {
    const repo = getAgent().session?.did;
    if (!repo) throw new Error('Not authenticated');

    const existing = (await fetchProfileTheme(repo)) ?? {};

    const resolveColor = (
        key: 'backgroundColor' | 'accentColor',
    ): string | undefined => {
        if (key in patch) {
            const raw = patch[key];
            if (raw === '' || raw === undefined) return undefined;
            return sanitizeColor(raw);
        }
        return existing[key];
    };

    const resolveImage = (): string | undefined => {
        if ('backgroundImage' in patch) {
            const raw = patch.backgroundImage;
            if (raw === '' || raw === undefined) return undefined;
            return typeof raw === 'string' && raw.startsWith('https://') ? raw : undefined;
        }
        return existing.backgroundImage;
    };

    const record: ProfileThemeRecord = {
        $type: PROFILE_THEME_COLLECTION,
        backgroundColor: resolveColor('backgroundColor'),
        accentColor: resolveColor('accentColor'),
        backgroundImage: resolveImage(),
        updatedAt: new Date().toISOString(),
    };

    const hasContent =
        !!record.backgroundColor || !!record.accentColor || !!record.backgroundImage;

    await withAuthenticatedFetch(() => {
        if (!hasContent) {
            return getAgent().com.atproto.repo.deleteRecord({
                repo,
                collection: PROFILE_THEME_COLLECTION,
                rkey: PROFILE_THEME_RKEY,
            });
        }
        return getAgent().com.atproto.repo.putRecord({
            repo,
            collection: PROFILE_THEME_COLLECTION,
            rkey: PROFILE_THEME_RKEY,
            record,
        });
    });

    return fromRecord(record) ?? {};
}
