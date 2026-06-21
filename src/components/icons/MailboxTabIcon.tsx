import { FollowPeopleGroup } from '@/components/icons/FollowPeopleIcon';
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
 * Classic US mailbox on a post — side profile, domed top, open door lip, side flag.
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
            {/* Post — thick stake centered under body */}
            <Rect x={11.1} y={19.6} width={3.8} height={6.4} rx={0.6} fill={color} />

            {/* Mailbox shell — side profile, flat bottom, domed top */}
            <Path
                d="M5.2 19.6h15.3V11.4a7.65 4.4 0 0 0-15.3 0v8.2z"
                fill={color}
            />

            {/* Open-door cavity — white curved lip like reference */}
            <Path
                d="M5.4 11.9c-1.15.7-1.45 2.2-.9 4.05"
                stroke="#FFFFFF"
                strokeWidth={0.9}
                strokeLinecap="round"
                fill="none"
                opacity={focused ? 0.96 : 0.84}
            />

            {/* Flag mount hinge on right side of body */}
            <Rect x={19.5} y={16.85} width={2.3} height={2.3} rx={1.15} fill={color} />

            {flagUp ? (
                <>
                    {/* Flag stem — vertical when unread */}
                    <Rect x={20.05} y={7.2} width={1.2} height={9.85} rx={0.6} fill={color} />
                    {/* Swallowtail pennant — up, accent yellow-orange */}
                    <Path
                        d="M20.65 6.9h5.1l-1.5 1.9 1.5 1.9H20.65V6.9z"
                        fill={UNREAD_ACCENT}
                    />
                </>
            ) : (
                <>
                    {/* Flag stem — horizontal when all read */}
                    <Rect x={12.4} y={17.3} width={7.7} height={1.4} rx={0.7} fill={color} />
                    {/* Swallowtail pennant — down, points left with fly-notch */}
                    <Path
                        d="M12.4 16.35v3.45H8.15l1.55-1.72L8.15 16.35H12.4z"
                        fill={color}
                    />
                </>
            )}

            {/* Envelope (unread DMs) — peeks out of open door */}
            {state === 'messages' ? (
                <>
                    <Rect x={2.2} y={12.3} width={7.4} height={5} rx={0.45} fill={UNREAD_ACCENT} />
                    <Path
                        d="M2.2 12.75 5.9 15.3 9.6 12.75"
                        stroke="#E6A600"
                        strokeWidth={0.72}
                        strokeLinejoin="round"
                        fill="none"
                    />
                </>
            ) : null}

            {/* Heart (unread likes) */}
            {state === 'likes' ? <FoldedHeart x={3.4} y={11.8} scale={0.92} /> : null}

            {/* Three people (unread follows) */}
            {state === 'follows' ? (
                <FollowPeopleGroup
                    x={3}
                    y={11.6}
                    scale={0.44}
                    color={color}
                    strokeWidth={focused ? 1.2 : 1.05}
                />
            ) : null}
        </Svg>
    );
});

export default MailboxTabIcon;
