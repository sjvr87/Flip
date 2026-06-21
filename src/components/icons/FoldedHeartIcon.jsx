import { memo, useId } from 'react';
import { View } from 'react-native';
import Svg, { Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';

/** Design-space canvas — feed like button renders at this size. */
export const FOLDED_HEART_DESIGN_SIZE = 26;
/** Activities / notification badge size — same shape, proportionally smaller. */
export const FOLDED_HEART_ACTIVITY_SIZE = 20;

/** Magenta ribbon palette — traced from reference PNG. */
export const HEART_SHADOW = '#7A0C38';
export const HEART_DEEP = '#B8145A';
export const HEART_MID = '#E8307A';
export const HEART_LIGHT = '#FF4D8F';
export const HEART_OUTLINE = '#FFB8D4';

const VIEWBOX = `0 0 ${FOLDED_HEART_DESIGN_SIZE} ${FOLDED_HEART_DESIGN_SIZE}`;

/** Uniform ribbon width (~19% of viewBox, per reference). */
const RIBBON_STROKE = 5.0;
const OUTLINE_STROKE = 1.75;

/**
 * Single open ribbon centerline traced from reference PNG (skeleton + Catmull-Rom).
 * Upper-left shoulder start → left lobe → bottom point → right wall → top-right fold →
 * inner V cavity → end near upper-right inner fold (gap at upper-left).
 */
const RIBBON_CENTERLINE =
    'M 3.5 4.9' +
    'C 1.7 7.5 1.7 8.3 1.8 9.1' +
    'C 1.9 9.9 2.1 10.8 2.5 11.5' +
    'C 2.9 12.3 3.6 13.0 4.2 13.7' +
    'C 4.8 14.5 5.6 15.3 6.3 16.1' +
    'C 6.9 16.8 7.6 17.5 8.2 18.3' +
    'C 8.9 19.0 9.6 19.8 10.2 20.5' +
    'C 10.9 21.2 11.6 22.1 12.3 22.4' +
    'C 13.0 22.6 13.8 22.4 14.4 22.0' +
    'C 15.1 21.6 15.6 20.6 16.3 19.9' +
    'C 16.9 19.2 17.6 18.5 18.2 17.8' +
    'C 18.9 17.1 19.4 16.4 20.1 15.6' +
    'C 20.7 14.9 21.4 14.1 22.0 13.4' +
    'C 22.6 12.7 23.2 12.0 23.6 11.3' +
    'C 23.9 10.5 24.1 9.6 24.2 8.9' +
    'C 24.3 8.1 24.2 7.3 24.0 6.5' +
    'C 23.9 5.7 23.6 4.9 23.1 4.2' +
    'C 22.6 3.5 21.8 2.8 21.1 2.4' +
    'C 20.4 2.0 19.7 2.0 19.0 1.9' +
    'C 18.3 1.9 17.6 1.9 16.9 2.1' +
    'C 16.2 2.4 15.5 3.0 14.8 3.4' +
    'C 14.1 3.8 13.4 4.6 12.7 4.5' +
    'C 12.0 4.5 11.3 3.3 10.6 3.1' +
    'C 9.8 2.8 9.1 2.7 8.5 3.0' +
    'C 7.8 3.3 7.1 4.1 6.8 4.7' +
    'C 6.5 5.4 6.5 6.3 6.8 7.1' +
    'C 7.1 7.8 7.8 8.6 8.4 9.3' +
    'C 9.0 10.1 9.8 11.0 10.4 11.7' +
    'C 11.1 12.3 11.8 13.2 12.5 13.4' +
    'C 13.1 13.6 13.9 13.2 14.6 12.7' +
    'C 15.3 12.2 16.1 11.2 16.6 10.4' +
    'C 17.1 9.6 17.6 8.0 17.6 8.0';

/** Dark tuck shadow where ribbon passes under itself at top-right fold. */
const FOLD_SHADOW = 'M 21.8 1.8 L 24.6 3.0 L 22.8 5.6 Z';

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
                x1="1"
                y1="24"
                x2="23"
                y2="1"
                gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor={HEART_DEEP} />
                <Stop offset="0.28" stopColor={HEART_DEEP} />
                <Stop offset="0.55" stopColor={HEART_MID} />
                <Stop offset="0.82" stopColor={HEART_LIGHT} />
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
            <Path d={FOLD_SHADOW} fill={HEART_SHADOW} opacity={0.62} />
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
