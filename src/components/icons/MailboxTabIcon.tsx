import { FoldedHeartGroup } from '@/components/icons/FoldedHeartIcon';
import { FollowPeopleGroup } from '@/components/icons/FollowPeopleIcon';
import { memo } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

export type MailboxIconState = 'allRead' | 'messages' | 'likes' | 'follows';

type MailboxTabIconProps = {
    size?: number;
    color?: string;
    focused?: boolean;
    state?: MailboxIconState;
};

const ACCENT = '#FFB800';

/**
 * US mailbox on a post — filled two-tone SVG at 30px (viewBox 30×30).
 * Body/post use tab tint; unread accents (#FFB800) are gapped by real negative space.
 * Priority when multiple unread: messages > likes > follows.
 */
const MailboxTabIcon = memo(function MailboxTabIcon({
    size = 30,
    color = '#000000',
    focused = false,
    state = 'allRead',
}: MailboxTabIconProps) {
    const opacity = focused ? 1 : 0.72;
    const flagUp = state !== 'allRead';

    // ── Layout (30×30) — traced from user reference ─────────────────────────
    const bodyL = 7.8;
    const bodyR = 22.6;
    const bodyTop = 13.1;
    const bodyBot = 22.5;
    const doorTop = 15.4;
    const doorBot = 20.6;

    const fill = { fill: color, opacity };

    return (
        <Svg width={size} height={size} viewBox="0 0 30 30" fill="none">
            {/* Post — thick stake, centered under body */}
            <Rect x={13.2} y={22.7} width={3.6} height={6.7} rx={0.75} {...fill} />

            {/* Slot overlay: envelope / heart / people */}
            {state === 'messages' ? (
                <EnvelopeAccent />
            ) : state === 'likes' ? (
                <FoldedHeartGroup x={1.0} y={12.6} scale={0.42} />
            ) : state === 'follows' ? (
                <FollowPeopleGroup
                    x={1.4}
                    y={13.4}
                    scale={0.44}
                    color={color}
                    strokeWidth={focused ? 1.2 : 1.05}
                />
            ) : null}

            {/* Mailbox body — domed top, open-mouth bite on left */}
            <Path
                d={[
                    `M ${bodyL} ${bodyBot}`,
                    `H ${bodyR}`,
                    `V ${bodyTop}`,
                    `A 8.85 4.75 0 0 0 ${bodyL} ${bodyTop}`,
                    `V ${doorTop}`,
                    `C ${bodyL - 1.65} ${doorTop + 1.55} ${bodyL - 1.7} ${doorBot - 1.55} ${bodyL} ${doorBot}`,
                    'Z',
                ].join(' ')}
                {...fill}
            />

            {flagUp ? <FlagUpAccent bodyRight={bodyR} /> : <FlagDown bodyRight={bodyR} color={color} opacity={opacity} />}
        </Svg>
    );
});

/** Goldenrod envelope — gapped left of opening; V flap leaves transparent groove. */
function EnvelopeAccent() {
    const l = 1.4;
    const r = 5.6;
    const bot = 19.3;
    const top = 16.9;
    const flapBase = 16.65;
    const flapTip = 14.6;
    const mid = (l + r) / 2;

    return (
        <>
            <Path d={`M ${l} ${bot} H ${r} V ${top} H ${l} Z`} fill={ACCENT} />
            <Path d={`M ${l} ${flapBase} L ${l} ${flapTip} L ${mid} ${flapBase} Z`} fill={ACCENT} />
            <Path d={`M ${r} ${flapBase} L ${r} ${flapTip} L ${mid} ${flapBase} Z`} fill={ACCENT} />
        </>
    );
}

/** Flag up — pole + hinge pill + right swallowtail; gapped from body right edge. */
function FlagUpAccent({ bodyRight }: { bodyRight: number }) {
    const gap = 1.05;
    const poleL = bodyRight + gap;
    const poleW = 1.1;
    const poleTop = 7.9;
    const poleBot = 19.6;
    const pillL = bodyRight + 0.2;
    const pillW = 2.55;
    const pillY = 19.75;
    const pillH = 1.35;
    const pennantL = poleL + poleW / 2;
    const pennantR = 28.8;
    const notchX = 27.2;

    return (
        <>
            <Rect x={poleL} y={poleTop} width={poleW} height={poleBot - poleTop} rx={0.55} fill={ACCENT} />
            <Rect x={pillL} y={pillY} width={pillW} height={pillH} rx={pillH / 2} fill={ACCENT} />
            <Path
                d={`M ${pennantL} ${poleTop - 0.2} H ${pennantR} L ${notchX} ${poleTop + 1.05} L ${pennantR} ${poleTop + 2.3} H ${pennantL} Z`}
                fill={ACCENT}
            />
        </>
    );
}

/** Flag down — horizontal stem + left swallowtail; tab tint when all read. */
function FlagDown({
    bodyRight,
    color,
    opacity,
}: {
    bodyRight: number;
    color: string;
    opacity: number;
}) {
    const stemL = 12.5;
    const stemR = bodyRight - 0.4;
    const stemY = 20.0;
    const stemH = 1.3;

    return (
        <>
            <Rect
                x={bodyRight - 2.25}
                y={19.55}
                width={2.5}
                height={1.45}
                rx={0.72}
                fill={color}
                opacity={opacity}
            />
            <Rect
                x={stemL}
                y={stemY}
                width={stemR - stemL}
                height={stemH}
                rx={stemH / 2}
                fill={color}
                opacity={opacity}
            />
            <Path
                d={`M ${stemL} ${stemY - 0.9} V ${stemY + stemH + 0.9} H ${stemL - 4.3} L ${stemL - 2.55} ${stemY + stemH / 2} ${stemL - 4.3} ${stemY - 0.9} Z`}
                fill={color}
                opacity={opacity}
            />
        </>
    );
}

export default MailboxTabIcon;
