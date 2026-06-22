import { FoldedHeartGroup } from '@/components/icons/FoldedHeartIcon';
import { FollowPeopleGroup } from '@/components/icons/FollowPeopleIcon';
import { memo } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type MailboxIconState = 'allRead' | 'messages' | 'likes' | 'follows';

type MailboxTabIconProps = {
    size?: number;
    color?: string;
    focused?: boolean;
    state?: MailboxIconState;
    /** Activity notifications (likes, comments, etc.) — turns flag bright green. */
    hasUnreadActivity?: boolean;
    /** DM/inbox messages — turns envelope bright green. */
    hasUnreadMessages?: boolean;
};

const FLAG_RED = '#E53935';
const FLAG_RED_STROKE = '#B71C1C';
const FLAG_GREEN = '#22C55E';
const FLAG_GREEN_STROKE = '#15803D';
const ENVELOPE_FILL = '#FFFFFF';
const ENVELOPE_UNREAD_FILL = '#22C55E';

/**
 * US mailbox on a post — hollow outline silhouette for tab bar.
 * Body/post are stroke-defined (transparent interior); tint follows tabBarActiveTintColor / tabBarInactiveTintColor.
 * White envelope + red flag stay visible in all tab states.
 * Flag/envelope turn bright green when their category has unread items.
 * Priority when multiple unread: messages > likes > follows.
 */
const MailboxTabIcon = memo(function MailboxTabIcon({
    size = 30,
    color = '#000000',
    focused = false,
    state = 'allRead',
    hasUnreadActivity = false,
    hasUnreadMessages = false,
}: MailboxTabIconProps) {
    const strokeOpacity = focused ? 1 : 0.72;
    const strokeWidth = focused ? 1.75 : 1.3;
    const detailStrokeWidth = focused ? 1.15 : 0.85;
    const envelopeStroke = color;
    const slotPeopleColor = color;

    // ── Layout (30×30) — traced from inbox reference ────────────────────────
    const bodyL = 8.0;
    const bodyR = 22.4;
    const bodyTop = 13.0;
    const bodyBot = 22.5;
    const openTop = 16.7;
    const openBot = 20.8;

    const bodyPath = [
        `M ${bodyL} ${bodyBot}`,
        `H ${bodyR}`,
        `V ${bodyTop}`,
        `A 7.2 4.85 0 0 0 ${bodyL} ${bodyTop}`,
        `V ${openTop}`,
        `C ${bodyL - 2.15} ${openTop + 0.55} ${bodyL - 2.15} ${openBot - 0.55} ${bodyL} ${openBot}`,
        'Z',
    ].join(' ');

    const showEnvelope = state === 'allRead' || state === 'messages';

    return (
        <Svg width={size} height={size} viewBox="0 0 30 30" fill="none">
            {/* Post — hollow stroke, centered under body */}
            <Rect
                x={13.4}
                y={22.6}
                width={3.2}
                height={6.9}
                rx={0.65}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeOpacity={strokeOpacity}
            />

            {/* Slot accent: envelope (default) / heart / people */}
            {showEnvelope ? (
                <EnvelopeAccent
                    strokeColor={envelopeStroke}
                    opacity={strokeOpacity}
                    unread={hasUnreadMessages}
                />
            ) : state === 'likes' ? (
                <FoldedHeartGroup x={0.8} y={12.4} scale={0.42} />
            ) : state === 'follows' ? (
                <FollowPeopleGroup
                    x={1.2}
                    y={13.2}
                    scale={0.44}
                    color={slotPeopleColor}
                    strokeWidth={strokeWidth}
                />
            ) : null}

            {/* Mailbox body — hollow outline: dome, sides, arched opening */}
            <Path
                d={bodyPath}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeOpacity={strokeOpacity}
                strokeLinejoin="round"
                strokeLinecap="round"
            />

            {/* Dome seam — curved roof ridge */}
            <Path
                d={`M ${bodyL + 0.5} ${bodyTop + 0.35} A 6.5 3.8 0 0 1 ${bodyR - 0.5} ${bodyTop + 0.35}`}
                stroke={color}
                strokeWidth={detailStrokeWidth}
                strokeOpacity={strokeOpacity * 0.85}
                fill="none"
                strokeLinecap="round"
            />

            {/* Opening inner edge — depth inside the mail slot */}
            <Path
                d={`M ${bodyL} ${openTop + 0.15} C ${bodyL - 1.55} ${openTop + 0.65} ${bodyL - 1.55} ${openBot - 0.65} ${bodyL} ${openBot - 0.15}`}
                stroke={color}
                strokeWidth={detailStrokeWidth}
                strokeOpacity={strokeOpacity * 0.9}
                fill="none"
                strokeLinecap="round"
            />

            {/* Door lip — thin arch over envelope opening */}
            <Path
                d={`M ${bodyL - 0.1} ${bodyTop + 0.35} Q ${bodyL - 3.6} ${bodyTop + 1.1} ${bodyL - 4.0} ${openTop - 0.15}`}
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                fill="none"
                strokeOpacity={strokeOpacity}
            />

            {/* Base lip — bottom edge of mailbox body */}
            <Path
                d={`M ${bodyL + 0.4} ${bodyBot - 0.15} H ${bodyR - 0.4}`}
                stroke={color}
                strokeWidth={detailStrokeWidth}
                strokeOpacity={strokeOpacity * 0.8}
                fill="none"
                strokeLinecap="round"
            />

            <FlagRaised bodyRight={bodyR} opacity={strokeOpacity} unread={hasUnreadActivity} />
        </Svg>
    );
});

/** White envelope — large rectangle + V flap, emerging from left opening. */
function EnvelopeAccent({
    strokeColor,
    opacity,
    unread = false,
}: {
    strokeColor: string;
    opacity: number;
    unread?: boolean;
}) {
    const fill = unread ? ENVELOPE_UNREAD_FILL : ENVELOPE_FILL;
    const l = -0.6;
    const r = 8.9;
    const bot = 21.7;
    const top = 14.5;
    const flapBase = 14.4;
    const flapTip = 10.9;
    const mid = (l + r) / 2;
    const sw = 0.8;

    return (
        <>
            <Path
                d={`M ${l} ${bot} H ${r} V ${top} H ${l} Z`}
                fill={fill}
                fillOpacity={opacity}
                stroke={strokeColor}
                strokeWidth={sw}
                strokeLinejoin="round"
            />
            <Path
                d={`M ${l} ${flapBase} L ${l} ${flapTip} L ${mid} ${flapBase} Z`}
                fill={fill}
                fillOpacity={opacity}
                stroke={strokeColor}
                strokeWidth={sw * 0.9}
                strokeLinejoin="round"
            />
            <Path
                d={`M ${r} ${flapBase} L ${r} ${flapTip} L ${mid} ${flapBase} Z`}
                fill={fill}
                fillOpacity={opacity}
                stroke={strokeColor}
                strokeWidth={sw * 0.9}
                strokeLinejoin="round"
            />
            {/* V crease — center fold of flap */}
            <Path
                d={`M ${l + 0.4} ${flapBase} L ${mid} ${flapTip + 0.5} L ${r - 0.4} ${flapBase}`}
                stroke={strokeColor}
                strokeWidth={sw * 0.7}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={opacity}
            />
            {/* Flap hinge line */}
            <Path
                d={`M ${l + 0.3} ${flapBase} H ${r - 0.3}`}
                stroke={strokeColor}
                strokeWidth={sw * 0.55}
                fill="none"
                opacity={opacity * 0.85}
            />
            {/* Body fold — horizontal crease below flap */}
            <Path
                d={`M ${l + 0.5} ${top + 2.1} H ${r - 0.5}`}
                stroke={strokeColor}
                strokeWidth={sw * 0.45}
                fill="none"
                strokeLinecap="round"
                opacity={opacity * 0.7}
            />
        </>
    );
}

/** Raised flag — circular base on mailbox side, stem, right swallowtail pennant. */
function FlagRaised({
    bodyRight,
    opacity,
    unread = false,
}: {
    bodyRight: number;
    opacity: number;
    unread?: boolean;
}) {
    const baseCx = bodyRight - 1.05;
    const baseCy = 20.15;
    const baseR = 1.15;
    const stemX = baseCx - 0.42;
    const stemW = 0.85;
    const stemTop = 8.35;
    const stemBot = baseCy - baseR + 0.15;
    const pennantL = baseCx;
    const pennantR = 28.65;
    const pennantTop = stemTop - 0.15;
    const pennantBot = stemTop + 2.15;
    const notchX = 27.05;
    const flagFill = unread ? FLAG_GREEN : FLAG_RED;
    const flagStroke = unread ? FLAG_GREEN_STROKE : FLAG_RED_STROKE;

    return (
        <>
            <Circle
                cx={baseCx}
                cy={baseCy}
                r={baseR}
                fill={flagFill}
                fillOpacity={opacity}
                stroke={flagStroke}
                strokeWidth={0.45}
                strokeOpacity={opacity * 0.85}
            />
            <Rect
                x={stemX}
                y={stemTop}
                width={stemW}
                height={stemBot - stemTop}
                rx={0.4}
                fill={flagFill}
                fillOpacity={opacity}
                stroke={flagStroke}
                strokeWidth={0.4}
                strokeOpacity={opacity * 0.85}
            />
            <Path
                d={`M ${pennantL} ${pennantTop} H ${pennantR} L ${notchX} ${(pennantTop + pennantBot) / 2} L ${pennantR} ${pennantBot} H ${pennantL} Z`}
                fill={flagFill}
                fillOpacity={opacity}
                stroke={flagStroke}
                strokeWidth={0.45}
                strokeLinejoin="round"
                strokeOpacity={opacity * 0.85}
            />
        </>
    );
}

export default MailboxTabIcon;
