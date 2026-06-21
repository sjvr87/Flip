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
 * Classic US mailbox on a post — traced from user reference at 26px.
 *
 * Side-profile domed body, white open-mouth curve, yellow-orange flag + envelope.
 * Priority when multiple unread: messages > likes > follows.
 */
const MailboxTabIcon = memo(function MailboxTabIcon({
    size = 26,
    color = '#000000',
    focused = false,
    state = 'allRead',
}: MailboxTabIconProps) {
    const hasUnread = state !== 'allRead';
    const flagUp = hasUnread;
    const lipStroke = focused ? 0.95 : 0.82;
    const lipWidth = focused ? 0.9 : 0.8;

    return (
        <Svg width={size} height={size} viewBox="0 0 26 26" fill="none">
            {/* Post — thick stake, centered under body */}
            <Rect x={11.5} y={19.7} width={3} height={5.8} rx={0.55} fill={color} />

            {/* Envelope (messages) — behind body, peeks from left opening */}
            {state === 'messages' ? (
                <>
                    <Rect x={1.5} y={12.35} width={7.7} height={4.85} rx={0.35} fill={UNREAD_ACCENT} />
                    <Path
                        d="M1.5 12.7 5.35 15.05 9.2 12.7"
                        stroke="#FFFFFF"
                        strokeWidth={0.68}
                        strokeLinejoin="round"
                        fill="none"
                    />
                </>
            ) : null}

            {/* Mailbox body — side profile, flat bottom, domed top */}
            <Path
                d="M5.1 19.5 H20.4 V11.3 A7.65 4.1 0 0 0 5.1 11.3 V19.5 Z"
                fill={color}
            />

            {/* Open-door mouth — white curved cavity lip */}
            <Path
                d="M5.2 12.05 C4.3 13.75 4.2 16.05 5.25 18.35"
                stroke="#FFFFFF"
                strokeWidth={lipWidth}
                strokeLinecap="round"
                fill="none"
                opacity={lipStroke}
            />

            {flagUp ? (
                <>
                    {/* White halo between flag stem and mailbox body */}
                    <Rect x={19.7} y={6.65} width={1.6} height={10.55} rx={0.5} fill="#FFFFFF" />
                    <Rect x={19.75} y={16.85} width={2.35} height={1.45} rx={0.725} fill="#FFFFFF" />
                    {/* Flag stem — vertical, accent when unread */}
                    <Rect x={19.95} y={6.85} width={1.1} height={10.15} rx={0.55} fill={UNREAD_ACCENT} />
                    {/* Hinge pill at body junction */}
                    <Rect x={19.85} y={16.95} width={2.2} height={1.25} rx={0.625} fill={UNREAD_ACCENT} />
                    {/* Swallowtail pennant — up, points right */}
                    <Path
                        d="M20.45 6.6 H25.15 L23.6 8.5 25.15 10.4 H20.45 V6.6 Z"
                        fill={UNREAD_ACCENT}
                    />
                </>
            ) : (
                <>
                    {/* Hinge knob on right side */}
                    <Rect x={19.55} y={17.05} width={2.25} height={1.3} rx={0.65} fill={color} />
                    {/* Flag stem — horizontal when all read */}
                    <Rect x={11.4} y={17.35} width={8.4} height={1.2} rx={0.6} fill={color} />
                    {/* Swallowtail pennant — down, points left */}
                    <Path
                        d="M11.4 16.55 V19.35 H7.2 L8.75 17.95 7.2 16.55 H11.4 Z"
                        fill={color}
                    />
                </>
            )}

            {/* Heart (unread likes) */}
            {state === 'likes' ? <FoldedHeart x={2.6} y={11.5} scale={0.92} /> : null}

            {/* Three people (unread follows) */}
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
