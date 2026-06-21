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

/** Folded ribbon heart overlay for unread likes. */
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
                <LinearGradient id="mailboxHeartGrad" x1="2" y1="16" x2="18" y2="2">
                    <Stop offset="0" stopColor="#C0005A" />
                    <Stop offset="1" stopColor="#FF1E6D" />
                </LinearGradient>
            </Defs>
            <Path
                d="M10 16.2S1.5 11.2 1.5 6.4C1.5 3.8 3.5 2 5.8 2c1.4 0 2.7.7 3.5 1.8.8-1.1 2.1-1.8 3.5-1.8 2.3 0 4.3 1.8 4.3 4.4 0 4.8-8.5 9.8-8.5 9.8z"
                fill="url(#mailboxHeartGrad)"
            />
            <Path d="M10 5.2 12.8 8.6 10 11.2 7.2 8.6Z" fill="#C0005A" opacity={0.55} />
        </Svg>
    );
}

/**
 * Classic US mailbox on a post — stroke-only line art at 30px.
 * Tint follows tabBarActiveTintColor / tabBarInactiveTintColor like other tab icons.
 * Priority when multiple unread: messages > likes > follows.
 */
const MailboxTabIcon = memo(function MailboxTabIcon({
    size = 30,
    color = '#000000',
    focused = false,
    state = 'allRead',
}: MailboxTabIconProps) {
    const strokeWidth = focused ? 1.75 : 1.3;
    const strokeOpacity = focused ? 1 : 0.72;
    const flagUp = state !== 'allRead';

    const stroke = {
        stroke: color,
        strokeWidth,
        strokeOpacity,
        strokeLinecap: 'round' as const,
        strokeLinejoin: 'round' as const,
        fill: 'none' as const,
    };

    return (
        <Svg width={size} height={size} viewBox="0 0 26 26" fill="none">
            {/* Post — centered under body */}
            <Rect
                x={11.5}
                y={19.7}
                width={3}
                height={5.8}
                rx={0.55}
                {...stroke}
            />

            {/* Envelope (messages) — peeks from left opening */}
            {state === 'messages' ? (
                <>
                    <Rect
                        x={1.5}
                        y={12.35}
                        width={7.7}
                        height={4.85}
                        rx={0.35}
                        fill={UNREAD_ACCENT}
                    />
                    <Path
                        d="M1.5 12.7 5.35 15.05 9.2 12.7"
                        stroke="#E6A600"
                        strokeWidth={0.68}
                        strokeLinejoin="round"
                        fill="none"
                    />
                </>
            ) : null}

            {/* Mailbox body — side profile, domed top; left wall omitted for door gap */}
            <Path d="M5.1 19.5 H20.4 V11.3 A7.65 4.1 0 0 0 5.1 11.3" {...stroke} />
            {/* Left wall above door */}
            <Path d="M5.1 11.3 V12.2" {...stroke} />
            {/* Left wall below door */}
            <Path d="M5.1 18.2 V19.5" {...stroke} />
            {/* Open-door lip — curved arc in tab color, not a white fill */}
            <Path
                d="M5.2 12.05 C4.3 13.75 4.2 16.05 5.25 18.35"
                {...stroke}
            />

            {flagUp ? (
                <>
                    {/* Flag stem — vertical when unread */}
                    <Rect
                        x={19.95}
                        y={6.85}
                        width={1.1}
                        height={10.15}
                        rx={0.55}
                        fill={UNREAD_ACCENT}
                    />
                    {/* Hinge pill at body junction */}
                    <Rect
                        x={19.85}
                        y={16.95}
                        width={2.2}
                        height={1.25}
                        rx={0.625}
                        fill={UNREAD_ACCENT}
                    />
                    {/* Swallowtail pennant — up, points right */}
                    <Path
                        d="M20.45 6.6 H25.15 L23.6 8.5 25.15 10.4 H20.45 V6.6 Z"
                        fill={UNREAD_ACCENT}
                    />
                </>
            ) : (
                <>
                    {/* Hinge knob on right side */}
                    <Rect
                        x={19.55}
                        y={17.05}
                        width={2.25}
                        height={1.3}
                        rx={0.65}
                        fill={color}
                        opacity={strokeOpacity}
                    />
                    {/* Flag stem — horizontal when all read */}
                    <Rect
                        x={11.4}
                        y={17.35}
                        width={8.4}
                        height={1.2}
                        rx={0.6}
                        fill={color}
                        opacity={strokeOpacity}
                    />
                    {/* Swallowtail pennant — down, points left */}
                    <Path
                        d="M11.4 16.55 V19.35 H7.2 L8.75 17.95 7.2 16.55 H11.4 Z"
                        fill={color}
                        opacity={strokeOpacity}
                    />
                </>
            )}

            {state === 'likes' ? <FoldedHeart x={2.6} y={11.5} scale={0.92} /> : null}

            {state === 'follows' ? (
                <FollowPeopleGroup
                    x={2.4}
                    y={11.3}
                    scale={0.44}
                    color={color}
                    strokeWidth={focused ? 1.2 : 1.05}
                />
            ) : null}
        </Svg>
    );
});

export default MailboxTabIcon;
