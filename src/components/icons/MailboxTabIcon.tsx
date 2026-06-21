import FollowPeopleIcon from '@/components/icons/FollowPeopleIcon';
import { memo } from 'react';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

export type MailboxIconState = 'allRead' | 'messages' | 'likes' | 'follows';

type MailboxTabIconProps = {
    size?: number;
    color?: string;
    focused?: boolean;
    state?: MailboxIconState;
};

const UNREAD_ACCENT = '#FFB800';

/** Folded ribbon heart — simplified for 26px tab bar legibility. */
function FoldedHeart({ x, y, scale }: { x: number; y: number; scale: number }) {
    return (
        <Svg
            x={x}
            y={y}
            width={10 * scale}
            height={9 * scale}
            viewBox="0 0 20 18"
            fill="none">
            <Defs>
                <LinearGradient id="heartGrad" x1="2" y1="16" x2="18" y2="2">
                    <Stop offset="0" stopColor="#C0005A" />
                    <Stop offset="1" stopColor="#FF1E6D" />
                </LinearGradient>
            </Defs>
            <Path
                d="M10 16.2S1.5 11.2 1.5 6.4C1.5 3.8 3.5 2 5.8 2c1.4 0 2.7.7 3.5 1.8.8-1.1 2.1-1.8 3.5-1.8 2.3 0 4.3 1.8 4.3 4.4 0 4.8-8.5 9.8-8.5 9.8z"
                fill="url(#heartGrad)"
            />
            <Path
                d="M10 5.2 12.8 8.6 10 11.2 7.2 8.6Z"
                fill="#C0005A"
                opacity={0.55}
            />
        </Svg>
    );
}

/**
 * Classic US mailbox on a post — domed top, open door lip, side flag.
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
            {/* Post stake — thick, centered under body */}
            <Rect x={11} y={19.2} width={4} height={6.3} rx={0.7} fill={color} />

            {/* Mailbox body — semi-cylindrical dome top, flat bottom */}
            <Path
                d="M4.8 19.2V10.6a8.2 4.6 0 0 1 16.4 0v8.6H4.8z"
                fill={color}
            />
            {/* Dome seam — reinforces rounded-top silhouette */}
            <Path
                d="M6.6 11.2a6.4 3.4 0 0 1 12.8 0"
                stroke={color}
                strokeWidth={0.55}
                strokeOpacity={focused ? 0.3 : 0.18}
                fill="none"
            />

            {/* Open door cavity lip (front-left opening) */}
            <Path
                d="M4.8 13.6c-1.1 0.9-1.5 2.2-1.1 3.8"
                stroke={color}
                strokeWidth={0.7}
                strokeOpacity={0.32}
                strokeLinecap="round"
                fill="none"
            />
            {/* Door flap hinged down at front */}
            <Path
                d="M4.8 13.4C3.1 14.8 2.4 16.6 3.4 19.2h3.6c-0.8-1.6-0.4-3.4-2.2-5.8z"
                fill={color}
                opacity={0.9}
            />

            {/* Flag assembly — hinge on right side of mailbox */}
            {flagUp ? (
                <>
                    <Rect x={20.2} y={6.2} width={1.2} height={7.6} rx={0.6} fill={color} />
                    <Rect x={19.7} y={12.4} width={2.1} height={2.1} rx={1.05} fill={color} />
                    <Path
                        d="M21 6.4h5.6l-1.75 2.3 1.75 2.3H21V6.4z"
                        fill={UNREAD_ACCENT}
                    />
                </>
            ) : (
                <>
                    <Rect x={19.7} y={17.1} width={2.1} height={2.1} rx={1.05} fill={color} />
                    <Rect x={12.8} y={17.6} width={7.8} height={1.35} rx={0.65} fill={color} />
                </>
            )}

            {/* Envelope (unread DMs) — sits in open door */}
            {state === 'messages' ? (
                <>
                    <Rect x={3.6} y={11.8} width={6.8} height={4.6} rx={0.55} fill={UNREAD_ACCENT} />
                    <Path
                        d="M3.6 12.2 7 14.6 10.4 12.2"
                        stroke="#E6A600"
                        strokeWidth={0.65}
                        strokeLinejoin="round"
                    />
                </>
            ) : null}

            {/* Heart (unread likes) */}
            {state === 'likes' ? <FoldedHeart x={3.2} y={11.2} scale={0.95} /> : null}

            {/* Three people (unread follows) */}
            {state === 'follows' ? (
                <FollowPeopleIcon
                    x={2.8}
                    y={11.4}
                    width={10}
                    height={8}
                    color={color}
                    strokeWidth={focused ? 1.2 : 1.05}
                />
            ) : null}
        </Svg>
    );
});

export default MailboxTabIcon;
