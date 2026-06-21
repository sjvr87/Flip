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
};

const GOLD = '#F5B942';

/**
 * US mailbox on a post — flat two-tone SVG at 30px (viewBox 30×30).
 * Body/post use tab tint; gold accents (#F5B942) match inbox reference art.
 * Priority when multiple unread: messages > likes > follows.
 */
const MailboxTabIcon = memo(function MailboxTabIcon({
    size = 30,
    color = '#000000',
    focused = false,
    state = 'allRead',
}: MailboxTabIconProps) {
    const opacity = focused ? 1 : 0.72;
    const fill = { fill: color, opacity };

    // ── Layout (30×30) — traced from inbox reference ────────────────────────
    const bodyL = 8.0;
    const bodyR = 22.4;
    const bodyTop = 13.0;
    const bodyBot = 22.5;
    const openTop = 16.7;
    const openBot = 20.8;

    const showEnvelope = state === 'allRead' || state === 'messages';

    return (
        <Svg width={size} height={size} viewBox="0 0 30 30" fill="none">
            {/* Post — centered under body */}
            <Rect x={13.4} y={22.6} width={3.2} height={6.9} rx={0.65} {...fill} />

            {/* Slot accent: envelope (default) / heart / people */}
            {showEnvelope ? (
                <EnvelopeAccent />
            ) : state === 'likes' ? (
                <FoldedHeartGroup x={0.8} y={12.4} scale={0.42} />
            ) : state === 'follows' ? (
                <FollowPeopleGroup
                    x={1.2}
                    y={13.2}
                    scale={0.44}
                    color={color}
                    strokeWidth={focused ? 1.2 : 1.05}
                />
            ) : null}

            {/* Mailbox body — domed top, arched opening on left */}
            <Path
                d={[
                    `M ${bodyL} ${bodyBot}`,
                    `H ${bodyR}`,
                    `V ${bodyTop}`,
                    `A 7.2 4.85 0 0 0 ${bodyL} ${bodyTop}`,
                    `V ${openTop}`,
                    `C ${bodyL - 2.15} ${openTop + 0.55} ${bodyL - 2.15} ${openBot - 0.55} ${bodyL} ${openBot}`,
                    'Z',
                ].join(' ')}
                {...fill}
            />

            {/* Door lip — thin arch over envelope opening */}
            <Path
                d={`M ${bodyL - 0.1} ${bodyTop + 0.35} Q ${bodyL - 3.6} ${bodyTop + 1.1} ${bodyL - 4.0} ${openTop - 0.15}`}
                stroke={color}
                strokeWidth={0.75}
                strokeLinecap="round"
                fill="none"
                opacity={opacity}
            />

            <FlagRaised bodyRight={bodyR} />
        </Svg>
    );
});

/** Golden envelope — rectangle + V flap, emerging from left opening. */
function EnvelopeAccent() {
    const l = 1.5;
    const r = 5.75;
    const bot = 19.35;
    const top = 17.05;
    const flapBase = 16.85;
    const flapTip = 14.55;
    const mid = (l + r) / 2;

    return (
        <>
            <Path d={`M ${l} ${bot} H ${r} V ${top} H ${l} Z`} fill={GOLD} />
            <Path d={`M ${l} ${flapBase} L ${l} ${flapTip} L ${mid} ${flapBase} Z`} fill={GOLD} />
            <Path d={`M ${r} ${flapBase} L ${r} ${flapTip} L ${mid} ${flapBase} Z`} fill={GOLD} />
        </>
    );
}

/** Raised flag — circular base on mailbox side, stem, right swallowtail pennant. */
function FlagRaised({ bodyRight }: { bodyRight: number }) {
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

    return (
        <>
            <Circle cx={baseCx} cy={baseCy} r={baseR} fill={GOLD} />
            <Rect x={stemX} y={stemTop} width={stemW} height={stemBot - stemTop} rx={0.4} fill={GOLD} />
            <Path
                d={`M ${pennantL} ${pennantTop} H ${pennantR} L ${notchX} ${(pennantTop + pennantBot) / 2} L ${pennantR} ${pennantBot} H ${pennantL} Z`}
                fill={GOLD}
            />
        </>
    );
}

export default MailboxTabIcon;
