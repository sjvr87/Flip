import { FoldedHeartGroup } from '@/components/icons/FoldedHeartIcon';
import { FollowPeopleGroup } from '@/components/icons/FollowPeopleIcon';
import { useTheme } from '@/contexts/ThemeContext';
import { memo } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type MailboxIconState = 'allRead' | 'messages' | 'likes' | 'follows';

type MailboxTabIconProps = {
    size?: number;
    color?: string;
    focused?: boolean;
    state?: MailboxIconState;
};

const FLAG_RED = '#E53935';
const ENVELOPE_FILL = '#FFFFFF';

/**
 * US mailbox on a post — outlined silhouette at 30px (viewBox 30×30).
 * Body/post keep theme contrast; accent tint applies to body outline only when focused.
 * White envelope + red flag stay visible in all tab states.
 * Priority when multiple unread: messages > likes > follows.
 */
const MailboxTabIcon = memo(function MailboxTabIcon({
    size = 30,
    color = '#000000',
    focused = false,
    state = 'allRead',
}: MailboxTabIconProps) {
    const { isDark } = useTheme();
    const iconOpacity = focused ? 1 : 0.72;
    const bodyFill = isDark ? '#E8E8E8' : '#1C1C1C';
    const detailStroke = isDark ? '#555555' : '#666666';
    const bodyStroke = focused ? color : detailStroke;
    const bodyStrokeWidth = focused ? 1.15 : 0.9;
    const envelopeStroke = isDark ? '#2A2A2A' : '#3A3A3A';
    const slotPeopleColor = isDark ? '#2A2A2A' : '#F0F0F0';

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
            {/* Post — centered under body */}
            <Rect
                x={13.4}
                y={22.6}
                width={3.2}
                height={6.9}
                rx={0.65}
                fill={bodyFill}
                fillOpacity={iconOpacity}
                stroke={bodyStroke}
                strokeWidth={bodyStrokeWidth * 0.85}
                strokeOpacity={iconOpacity}
            />

            {/* Slot accent: envelope (default) / heart / people */}
            {showEnvelope ? (
                <EnvelopeAccent strokeColor={envelopeStroke} opacity={iconOpacity} />
            ) : state === 'likes' ? (
                <FoldedHeartGroup x={0.8} y={12.4} scale={0.42} />
            ) : state === 'follows' ? (
                <FollowPeopleGroup
                    x={1.2}
                    y={13.2}
                    scale={0.44}
                    color={slotPeopleColor}
                    strokeWidth={focused ? 1.2 : 1.05}
                />
            ) : null}

            {/* Mailbox body — domed top, arched opening on left */}
            <Path
                d={bodyPath}
                fill={bodyFill}
                fillOpacity={iconOpacity}
                stroke={bodyStroke}
                strokeWidth={bodyStrokeWidth}
                strokeOpacity={iconOpacity}
                strokeLinejoin="round"
            />

            {/* Dome seam — defines curved roof */}
            <Path
                d={`M ${bodyL + 0.5} ${bodyTop + 0.35} A 6.5 3.8 0 0 1 ${bodyR - 0.5} ${bodyTop + 0.35}`}
                stroke={detailStroke}
                strokeWidth={0.55}
                strokeOpacity={iconOpacity * 0.75}
                fill="none"
                strokeLinecap="round"
            />

            {/* Opening inner edge */}
            <Path
                d={`M ${bodyL} ${openTop + 0.15} C ${bodyL - 1.55} ${openTop + 0.65} ${bodyL - 1.55} ${openBot - 0.65} ${bodyL} ${openBot - 0.15}`}
                stroke={detailStroke}
                strokeWidth={0.6}
                strokeOpacity={iconOpacity * 0.8}
                fill="none"
                strokeLinecap="round"
            />

            {/* Door lip — thin arch over envelope opening */}
            <Path
                d={`M ${bodyL - 0.1} ${bodyTop + 0.35} Q ${bodyL - 3.6} ${bodyTop + 1.1} ${bodyL - 4.0} ${openTop - 0.15}`}
                stroke={bodyStroke}
                strokeWidth={focused ? 0.95 : 0.75}
                strokeLinecap="round"
                fill="none"
                opacity={iconOpacity}
            />

            <FlagRaised bodyRight={bodyR} opacity={iconOpacity} />
        </Svg>
    );
});

/** White envelope — larger rectangle + V flap, emerging from left opening. */
function EnvelopeAccent({ strokeColor, opacity }: { strokeColor: string; opacity: number }) {
    const l = 0.35;
    const r = 8.1;
    const bot = 20.75;
    const top = 17.05;
    const flapBase = 16.95;
    const flapTip = 13.85;
    const mid = (l + r) / 2;
    const sw = 0.7;

    return (
        <>
            <Path
                d={`M ${l} ${bot} H ${r} V ${top} H ${l} Z`}
                fill={ENVELOPE_FILL}
                fillOpacity={opacity}
                stroke={strokeColor}
                strokeWidth={sw}
            />
            <Path
                d={`M ${l} ${flapBase} L ${l} ${flapTip} L ${mid} ${flapBase} Z`}
                fill={ENVELOPE_FILL}
                fillOpacity={opacity}
                stroke={strokeColor}
                strokeWidth={sw * 0.85}
                strokeLinejoin="round"
            />
            <Path
                d={`M ${r} ${flapBase} L ${r} ${flapTip} L ${mid} ${flapBase} Z`}
                fill={ENVELOPE_FILL}
                fillOpacity={opacity}
                stroke={strokeColor}
                strokeWidth={sw * 0.85}
                strokeLinejoin="round"
            />
            <Path
                d={`M ${l + 0.35} ${flapBase} L ${mid} ${flapTip + 0.45} L ${r - 0.35} ${flapBase}`}
                stroke={strokeColor}
                strokeWidth={sw * 0.65}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={opacity}
            />
            <Path
                d={`M ${l + 0.25} ${flapBase} H ${r - 0.25}`}
                stroke={strokeColor}
                strokeWidth={sw * 0.5}
                fill="none"
                opacity={opacity * 0.75}
            />
        </>
    );
}

/** Raised flag — circular base on mailbox side, stem, right swallowtail pennant. */
function FlagRaised({ bodyRight, opacity }: { bodyRight: number; opacity: number }) {
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
    const flagStroke = '#B71C1C';

    return (
        <>
            <Circle
                cx={baseCx}
                cy={baseCy}
                r={baseR}
                fill={FLAG_RED}
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
                fill={FLAG_RED}
                fillOpacity={opacity}
                stroke={flagStroke}
                strokeWidth={0.4}
                strokeOpacity={opacity * 0.85}
            />
            <Path
                d={`M ${pennantL} ${pennantTop} H ${pennantR} L ${notchX} ${(pennantTop + pennantBot) / 2} L ${pennantR} ${pennantBot} H ${pennantL} Z`}
                fill={FLAG_RED}
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
