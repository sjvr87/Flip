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
 * US mailbox on a post — pure react-native-svg line art at 30px.
 * Body/post use tab tint; unread accents (#FFB800) are separated by real gaps.
 * Priority when multiple unread: messages > likes > follows.
 */
const MailboxTabIcon = memo(function MailboxTabIcon({
    size = 30,
    color = '#000000',
    focused = false,
    state = 'allRead',
}: MailboxTabIconProps) {
    const sw = focused ? 1.75 : 1.3;
    const opacity = focused ? 1 : 0.72;
    const flagUp = state !== 'allRead';

    const stroke = {
        stroke: color,
        strokeWidth: sw,
        strokeOpacity: opacity,
        strokeLinecap: 'round' as const,
        strokeLinejoin: 'round' as const,
        fill: 'none' as const,
    };

    // ── Layout (26×26 viewBox) ──────────────────────────────────────────────
    const bodyL = 5.55;
    const bodyR = 19.85;
    const bodyBot = 19.15;
    const doorTop = 12.35;
    const doorBot = 17.65;

    return (
        <Svg width={size} height={size} viewBox="0 0 26 26" fill="none">
            {/* Thick post — centered under body */}
            <Rect
                x={11.55}
                y={19.55}
                width={2.9}
                height={5.85}
                rx={0.65}
                fill={color}
                opacity={opacity}
            />

            {/* Left-slot overlay: envelope / heart / people (never with flag-down) */}
            {state === 'messages' ? (
                <EnvelopeAccent />
            ) : state === 'likes' ? (
                <FoldedHeartGroup x={0.85} y={10.9} scale={0.36} />
            ) : state === 'follows' ? (
                <FollowPeopleGroup
                    x={1.2}
                    y={11.6}
                    scale={0.44}
                    color={color}
                    strokeWidth={focused ? 1.2 : 1.05}
                />
            ) : null}

            {/* Mailbox body — domed top, open left; right edge breaks for flag halo */}
            <Path d={`M ${bodyL} ${bodyBot} H ${bodyR}`} {...stroke} />
            {flagUp ? (
                <>
                    <Path d={`M ${bodyR} ${bodyBot} V 18.55`} {...stroke} />
                    <Path d={`M ${bodyR} 16.15 V 11.15`} {...stroke} />
                </>
            ) : (
                <Path d={`M ${bodyR} ${bodyBot} V 11.15`} {...stroke} />
            )}
            <Path d={`M ${bodyR} 11.15 A 7.55 4.05 0 0 0 ${bodyL} 11.15`} {...stroke} />

            {/* Left wall segments — door opening is negative space between them */}
            <Path d={`M ${bodyL} 11.15 V ${doorTop}`} {...stroke} />
            <Path d={`M ${bodyL} ${doorBot} V ${bodyBot}`} {...stroke} />
            <Path
                d={`M ${bodyL + 0.05} ${doorTop - 0.05} C ${bodyL - 1.05} ${doorTop + 1.55} ${bodyL - 1.1} ${doorBot - 1.55} ${bodyL + 0.05} ${doorBot + 0.05}`}
                {...stroke}
            />

            {flagUp ? <FlagUpAccent bodyRight={bodyR} /> : <FlagDown bodyRight={bodyR} color={color} opacity={opacity} />}
        </Svg>
    );
});

/** Goldenrod envelope — spaced left of opening; V flap uses transparent notch. */
function EnvelopeAccent() {
    const l = 1.25;
    const r = 6.45;
    const bodyTop = 15.05;
    const bodyBot = 17.15;
    const flapBase = 14.8;
    const flapTip = 13.05;
    const mid = (l + r) / 2;

    return (
        <>
            <Path d={`M ${l} ${bodyBot} H ${r} V ${bodyTop} H ${l} Z`} fill={ACCENT} />
            <Path d={`M ${l} ${flapBase} L ${l} ${flapTip} L ${mid} ${flapBase} Z`} fill={ACCENT} />
            <Path d={`M ${r} ${flapBase} L ${r} ${flapTip} L ${mid} ${flapBase} Z`} fill={ACCENT} />
        </>
    );
}

/** Flag up — pole + hinge pill + swallowtail; halo gap keeps pole off body stroke. */
function FlagUpAccent({ bodyRight }: { bodyRight: number }) {
    const poleL = bodyRight + 0.75;
    const poleW = 0.95;
    const poleTop = 6.85;
    const poleBot = 16.05;
    const pillL = bodyRight + 0.55;
    const pillW = 2.35;
    const pillY = 16.2;
    const pillH = 1.2;

    return (
        <>
            <Rect x={poleL} y={poleTop} width={poleW} height={poleBot - poleTop} rx={0.48} fill={ACCENT} />
            <Rect x={pillL} y={pillY} width={pillW} height={pillH} rx={pillH / 2} fill={ACCENT} />
            <Path
                d={`M ${poleL + poleW / 2 - 0.05} ${poleTop - 0.15} H 25.05 L 23.55 8.45 25.05 10.25 H ${poleL + poleW / 2 - 0.05} Z`}
                fill={ACCENT}
            />
        </>
    );
}

/** Flag down — horizontal stem + left swallowtail; tab tint, no accent. */
function FlagDown({
    bodyRight,
    color,
    opacity,
}: {
    bodyRight: number;
    color: string;
    opacity: number;
}) {
    const stemL = 10.85;
    const stemR = bodyRight - 0.35;
    const stemY = 17.35;
    const stemH = 1.15;

    return (
        <>
            <Rect
                x={bodyRight - 1.95}
                y={16.95}
                width={2.15}
                height={1.25}
                rx={0.62}
                fill={color}
                opacity={opacity}
            />
            <Rect x={stemL} y={stemY} width={stemR - stemL} height={stemH} rx={stemH / 2} fill={color} opacity={opacity} />
            <Path
                d={`M ${stemL} ${stemY - 0.8} V ${stemY + stemH + 0.8} H ${stemL - 3.75} L ${stemL - 2.2} ${stemY + stemH / 2} ${stemL - 3.75} ${stemY - 0.8} Z`}
                fill={color}
                opacity={opacity}
            />
        </>
    );
}

export default MailboxTabIcon;
