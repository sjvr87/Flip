import { memo, useId } from 'react';
import Svg, { Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';

export const HEART_DEEP = '#C0266B';
export const HEART_MID = '#DB2777';
export const HEART_LIGHT = '#F472B6';
export const HEART_SHADOW = '#9D174D';

const VIEWBOX = '0 0 26 26';

/** Uniform ribbon width traced from reference (~4.2px at 26×26). */
const RIBBON_STROKE = 4.2;
const OUTLINE_STROKE = 1.65;

/**
 * Single continuous ribbon centerline — outer heart shell looping inward to nested inner V.
 * Coordinates traced from reference PNG and smoothed with cubics.
 */
const RIBBON_CENTERLINE =
    'M 6.6 2.8' +
    'C 5.2 1.9 4.2 2.6 2.9 4' +
    'C 1.7 5.8 1.8 8.5 2.6 10.4' +
    'C 4.5 14.8 8.2 18 13 19.2' +
    'C 17.8 18 22 14.8 23.4 10.4' +
    'C 24.8 7 25.2 4.5 22 3.5' +
    'C 20.2 5 18.5 5.8 17.66 6.29' +
    'L 13 6.3' +
    'L 6.9 6.3';

/** Dark tuck shadow at top-right fold. */
const FOLD_SHADOW = 'M 18.6 2.2 L 22.6 2.6 L 20.4 4.1 Z';

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
                <Stop offset="0.35" stopColor={HEART_DEEP} />
                <Stop offset="0.72" stopColor={HEART_MID} />
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
                stroke={HEART_DEEP}
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
            <Path d={FOLD_SHADOW} fill={HEART_SHADOW} opacity={0.48} />
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
 * Folded-ribbon heart — continuous magenta→pink gradient stroke with fold shadow.
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
