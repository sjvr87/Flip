import { FollowPeopleGroup } from '@/components/icons/FollowPeopleIcon';
import { memo } from 'react';
import Svg, { Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

export type MailboxIconState = 'allRead' | 'messages' | 'likes' | 'follows';

type MailboxTabIconProps = {
    size?: number;
    color?: string;
    focused?: boolean;
    state?: MailboxIconState;
};

const ENVELOPE_COLOR = '#FFB800';
const HEART_MAGENTA = '#C0005A';
const HEART_PINK = '#FF1E6D';

/** Folded ribbon heart — simplified for 26px tab bar legibility. */
function FoldedHeart() {
    return (
        <G transform="translate(2.8, 10.6) scale(0.5)">
            <Defs>
                <LinearGradient id="mailboxHeartGrad" x1="2" y1="16" x2="18" y2="2">
                    <Stop offset="0" stopColor={HEART_MAGENTA} />
                    <Stop offset="1" stopColor={HEART_PINK} />
                </LinearGradient>
            </Defs>
            <Path
                d="M10 16.2S1.5 11.2 1.5 6.4C1.5 3.8 3.5 2 5.8 2c1.4 0 2.7.7 3.5 1.8.8-1.1 2.1-1.8 3.5-1.8 2.3 0 4.3 1.8 4.3 4.4 0 4.8-8.5 9.8-8.5 9.8z"
                fill="url(#mailboxHeartGrad)"
            />
            <Path
                d="M10 5.2 12.8 8.6 10 11.2 7.2 8.6Z"
                fill={HEART_MAGENTA}
                opacity={0.55}
            />
        </G>
    );
}

/**
 * Dynamic mailbox tab icon.
 *
 * Priority when multiple unread: messages > likes > follows.
 * Documented in notificationStore.mailboxIconState.
 */
const MailboxTabIcon = memo(function MailboxTabIcon({
    size = 26,
    color = '#000000',
    focused = false,
    state = 'allRead',
}: MailboxTabIconProps) {
    const hasUnread = state !== 'allRead';
    const flagUp = hasUnread;
    return (
        <Svg width={size} height={size} viewBox="0 0 26 26" fill="none">
            {/* Post */}
            <Rect x={11.5} y={17.5} width={3} height={6.5} rx={0.5} fill={color} />

            {/* Mailbox body */}
            <Path
                d="M6.5 17.5h13a1.2 1.2 0 0 0 1.2-1.2V11.2a4.8 4.8 0 0 0-4.8-4.8H10.1a4.8 4.8 0 0 0-4.8 4.8v5.1a1.2 1.2 0 0 0 1.2 1.2z"
                fill={color}
            />
            <Path
                d="M10.1 6.4h5.8a4.8 4.8 0 0 1 4.8 4.8"
                stroke={color}
                strokeWidth={0.6}
                strokeOpacity={0.35}
            />

            {/* Flag pole */}
            <Rect x={18.6} y={flagUp ? 7.2 : 12.8} width={0.9} height={5.2} rx={0.45} fill={color} />
            <Rect x={18.1} y={flagUp ? 11.8 : 17.2} width={1.9} height={1.9} rx={0.95} fill={color} />

            {/* Flag pennant */}
            {flagUp ? (
                <Path
                    d="M19.5 7.4h5.2l-1.6 2.1 1.6 2.1H19.5V7.4z"
                    fill={hasUnread ? ENVELOPE_COLOR : color}
                />
            ) : (
                <Path d="M13.2 18.8h5.5v2.4h-5.5v-2.4z" fill={color} opacity={0.85} />
            )}

            {/* Envelope (unread DMs) */}
            {state === 'messages' ? (
                <>
                    <Rect x={3.2} y={11.4} width={7.2} height={5} rx={0.6} fill={ENVELOPE_COLOR} />
                    <Path
                        d="M3.2 11.8 6.8 14.6 10.4 11.8"
                        stroke="#E6A600"
                        strokeWidth={0.7}
                        strokeLinejoin="round"
                    />
                </>
            ) : null}

            {/* Heart (unread likes, only when no unread DMs) */}
            {state === 'likes' ? <FoldedHeart /> : null}

            {/* Three people (unread follows, only when no DMs or likes) */}
            {state === 'follows' ? (
                <FollowPeopleGroup x={2.4} y={10.8} scale={0.48} color={color} strokeWidth={1.2} />
            ) : null}
        </Svg>
    );
});

export default MailboxTabIcon;
