import { memo, useId } from 'react';
import { View } from 'react-native';
import Svg, { Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';

/** Design-space canvas — feed like button renders at this size. */
export const FOLDED_HEART_DESIGN_SIZE = 26;
/** Activities / notification badge size — same shape, proportionally smaller. */
export const FOLDED_HEART_ACTIVITY_SIZE = 20;

/** Magenta / raspberry ribbon palette — matches reference PNG. */
export const HEART_SHADOW = '#8E1040';
export const HEART_DEEP = '#C2185B';
export const HEART_MID = '#E8387A';
export const HEART_LIGHT = '#FF5C9A';
export const HEART_OUTLINE = '#FFB8D4';

const VIEWBOX = `0 0 ${FOLDED_HEART_DESIGN_SIZE} ${FOLDED_HEART_DESIGN_SIZE}`;

/** Uniform ribbon width traced from reference (~4.2px at 26×26). */
const RIBBON_STROKE = 4.2;
const OUTLINE_STROKE = 1.75;

/**
 * Single continuous ribbon centerline traced from reference PNG:
 * top-center flat cap → outer left lobe → bottom point → outer right wall →
 * top-right lobe → inward fold tuck → nested inner V tip → middle-left flat cap.
 */
const RIBBON_CENTERLINE =
    'M 13.0 2.7' +
    'C 9.2 2.3 5.2 3.8 3.0 7.0' +
    'C 1.4 9.8 1.5 13.2 3.2 16.4' +
    'C 5.5 19.8 9.0 22.6 13.0 24.0' +
    'C 17.0 22.6 20.5 19.8 22.8 16.4' +
    'C 24.5 13.2 24.6 9.8 23.2 7.2' +
    'C 24.2 5.5 24.5 3.8 23.5 2.6' +
    'C 22.0 4.2 21.0 6.0 20.2 7.8' +
    'C 19.0 10.0 17.2 12.5 15.2 14.5' +
    'C 14.2 16.0 13.5 17.5 13.0 18.8' +
    'C 11.5 17.0 10.0 14.5 9.0 12.0' +
    'C 8.5 10.0 8.3 8.0 8.8 6.5';

/** Dark tuck shadow at top-right fold where ribbon passes under itself. */
const FOLD_SHADOW = 'M 21.8 2.2 L 24.2 3.0 L 22.5 5.5 Z';

const FILLED_STROKE_PROPS = {
    strokeLinecap: 'butt',
    strokeLinejoin: 'round',
    fill: 'none',
};

const OUTLINE_STROKE_PROPS = {
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
                y1="24"
                x2="22"
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
                opacity={0.92}
                {...OUTLINE_STROKE_PROPS}
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
                {...FILLED_STROKE_PROPS}
            />
            <Path d={FOLD_SHADOW} fill={HEART_SHADOW} opacity={0.58} />
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

function FoldedHeartSvg({ variant, gradientId }) {
    return (
        <Svg
            width={FOLDED_HEART_DESIGN_SIZE}
            height={FOLDED_HEART_DESIGN_SIZE}
            viewBox={VIEWBOX}
            fill="none">
            <FoldedHeartPaths variant={variant} gradientId={gradientId} />
        </Svg>
    );
}

/**
 * Folded-ribbon heart — continuous magenta gradient stroke with fold shadow.
 * Renders at design size then uniformly scales so ribbon proportions match feed at any size.
 */
const FoldedHeartIcon = memo(function FoldedHeartIcon({
    size = FOLDED_HEART_DESIGN_SIZE,
    variant = 'filled',
}) {
    const gradientId = useId();

    if (size === FOLDED_HEART_DESIGN_SIZE) {
        return <FoldedHeartSvg variant={variant} gradientId={gradientId} />;
    }

    const scale = size / FOLDED_HEART_DESIGN_SIZE;

    return (
        <View
            style={{
                width: size,
                height: size,
                alignItems: 'center',
                justifyContent: 'center',
            }}>
            <View style={{ transform: [{ scale }] }}>
                <FoldedHeartSvg variant={variant} gradientId={gradientId} />
            </View>
        </View>
    );
});

export default FoldedHeartIcon;
