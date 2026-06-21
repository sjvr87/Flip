import { memo, useId } from 'react';
import Svg, { Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';

/** Light-purple ribbon palette — matches @mention purple preference. */
export const HEART_SHADOW = '#7C3AED';
export const HEART_DEEP = '#A78BFA';
export const HEART_MID = '#C084FC';
export const HEART_LIGHT = '#E9D5FF';
export const HEART_OUTLINE = '#C084FC';

const VIEWBOX = '0 0 26 26';

/** Uniform ribbon width traced from reference (~4.2px at 26×26). */
const RIBBON_STROKE = 4.2;
const OUTLINE_STROKE = 1.75;

/**
 * Single continuous ribbon centerline traced from reference PNG:
 * top-left start → outer left lobe → bottom point → right lobe →
 * top-right fold tuck → inward dive → nested inner V tip → left arm → end.
 */
const RIBBON_CENTERLINE =
    'M 6.2 3.4' +
    'C 4.2 3.8 2.4 6.2 2.6 9.2' +
    'C 3.2 13.8 7.2 18.2 13 19.5' +
    'C 18.8 18.2 22.8 13.8 23.4 9.2' +
    'C 23.6 6.2 21.8 3.8 19.8 3.4' +
    'C 19.2 2.9 18.5 3.5 18.0 4.8' +
    'C 17.5 6.0 16.5 6.8 15.5 7.8' +
    'C 14.5 9.0 13.8 11.0 13.3 12.5' +
    'C 13.1 13.2 13.0 13.8 13.0 14.2' +
    'C 12.5 13.2 11.8 11.5 11.2 10.0' +
    'C 10.6 8.8 11.0 7.5 12.5 7.0' +
    'C 13.8 6.6 15.0 6.5 15.8 7.0';

/** Dark tuck shadow at top-right fold where ribbon passes under itself. */
const FOLD_SHADOW = 'M 18.8 2.6 L 22.4 3.2 L 20.2 4.6 Z';

const STROKE_PROPS = {
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    fill: 'none',
};

function HeartGradientDefs({ id }) {
    return (
        <Defs>
            <LinearGradient
                id={id}
                x1="2"
                y1="22"
                x2="24"
                y2="2"
                gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor={HEART_SHADOW} />
                <Stop offset="0.32" stopColor={HEART_DEEP} />
                <Stop offset="0.68" stopColor={HEART_MID} />
                <Stop offset="1" stopColor={HEART_LIGHT} />
            </LinearGradient>
        </Defs>
    );
}

/**
 * Folded ribbon heart paths — embed inside a parent Svg via FoldedHeartGroup.
 * @param {'filled' | 'outline'} variant
 */
export function FoldedHeartPaths({ variant = 'filled', gradientId }) {
    if (variant === 'outline') {
        return (
            <Path
                d={RIBBON_CENTERLINE}
                stroke={HEART_OUTLINE}
                strokeWidth={OUTLINE_STROKE}
                {...STROKE_PROPS}
            />
        );
    }

    return (
        <>
            <HeartGradientDefs id={gradientId} />
            <Path
                d={RIBBON_CENTERLINE}
                stroke={`url(#${gradientId})`}
                strokeWidth={RIBBON_STROKE}
                {...STROKE_PROPS}
            />
            <Path d={FOLD_SHADOW} fill={HEART_SHADOW} opacity={0.42} />
        </>
    );
}

/** Scaled group for embedding in MailboxTabIcon. */
export function FoldedHeartGroup({
    x = 0,
    y = 0,
    scale = 1,
    variant = 'filled',
    gradientId: gradientIdProp,
}) {
    const autoId = useId();
    const gradientId = gradientIdProp ?? autoId;

    return (
        <G transform={`translate(${x}, ${y}) scale(${scale})`}>
            <FoldedHeartPaths variant={variant} gradientId={gradientId} />
        </G>
    );
}

/**
 * Folded-ribbon heart — continuous light-purple gradient stroke with fold shadow.
 * Scales via size prop (~26px action rail, ~11px mailbox overlay at scale 0.42).
 */
const FoldedHeartIcon = memo(function FoldedHeartIcon({ size = 26, variant = 'filled' }) {
    const gradientId = useId();

    return (
        <Svg width={size} height={size} viewBox={VIEWBOX} fill="none">
            <FoldedHeartPaths variant={variant} gradientId={gradientId} />
        </Svg>
    );
});

export default FoldedHeartIcon;
