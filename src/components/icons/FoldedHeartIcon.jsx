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
 * top-right fold tuck → inward descent → nested inner V tip → up to end cap.
 */
const RIBBON_CENTERLINE =
    'M 6.6 2.8' +
    'C 5.0 2.0 2.8 3.8 2.1 6.0' +
    'C 1.5 8.5 1.7 11.0 2.8 13.5' +
    'C 4.2 16.0 6.5 17.5 9.7 17.8' +
    'C 11.5 19.0 12.5 21.5 13.0 23.2' +
    'C 13.5 21.5 14.5 19.0 16.3 17.8' +
    'C 18.5 17.0 21.0 14.0 23.0 11.0' +
    'C 24.5 8.0 25.5 5.0 24.3 2.8' +
    'C 23.0 2.0 21.0 3.0 19.5 5.0' +
    'C 18.5 6.5 17.8 8.5 17.2 10.5' +
    'C 16.5 12.5 15.5 14.5 14.5 16.5' +
    'C 13.8 18.5 13.3 20.0 13.0 21.5' +
    'C 14.0 18.5 15.5 15.0 16.5 12.0' +
    'C 17.2 9.5 17.6 7.5 17.5 6.2';

/** Dark tuck shadow at top-right fold where ribbon passes under itself. */
const FOLD_SHADOW = 'M 19.5 2.0 L 23.5 2.8 L 21.0 4.2 Z';

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
