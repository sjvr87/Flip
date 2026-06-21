import { memo } from 'react';
import Svg, { G, Path } from 'react-native-svg';

export const HEART_DEEP = '#C0266B';
export const HEART_LIGHT = '#F472B6';

const VIEWBOX = '0 0 24 22';

const RIBBON_STROKE = 4.75;
const OUTLINE_STROKE = 1.55;

const STROKE_PROPS = {
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    fill: 'none',
};

/** Outer ribbon — left lobe top, left leg, right leg (magenta). */
const MAGENTA_SEGMENTS = [
    'M5.2 9.2C4.6 6.2 7.5 4 10.8 5.4C11.5 5 12.5 5 13.2 5.4C15.6 4.2 18.2 5.8 18.4 9',
    'M5.2 9.2L12 20.5',
    'M18.4 9L12 20.5',
];

/** Top-right fold + inner nested V (hot pink). */
const LIGHT_SEGMENTS = [
    'M18.2 8.8C16.4 10.5 14 12.2 12 14.2',
    'M12 14.2L8 10.5',
];

const ALL_SEGMENTS = [...MAGENTA_SEGMENTS, ...LIGHT_SEGMENTS];

/**
 * Folded ribbon heart paths — embed inside a parent Svg via FoldedHeartGroup.
 * @param {'filled' | 'outline'} variant
 */
export function FoldedHeartPaths({ variant = 'filled', color = '#FFFFFF' }) {
    if (variant === 'outline') {
        return ALL_SEGMENTS.map((d, i) => (
            <Path
                key={i}
                d={d}
                stroke={color}
                strokeWidth={OUTLINE_STROKE}
                {...STROKE_PROPS}
            />
        ));
    }

    return (
        <>
            {MAGENTA_SEGMENTS.map((d, i) => (
                <Path
                    key={`m${i}`}
                    d={d}
                    stroke={HEART_DEEP}
                    strokeWidth={RIBBON_STROKE}
                    {...STROKE_PROPS}
                />
            ))}
            {LIGHT_SEGMENTS.map((d, i) => (
                <Path
                    key={`l${i}`}
                    d={d}
                    stroke={HEART_LIGHT}
                    strokeWidth={RIBBON_STROKE - 0.15}
                    {...STROKE_PROPS}
                />
            ))}
        </>
    );
}

/** Scaled group for embedding in MailboxTabIcon. */
export function FoldedHeartGroup({
    x = 0,
    y = 0,
    scale = 1,
    variant = 'filled',
    color = '#FFFFFF',
}) {
    return (
        <G transform={`translate(${x}, ${y}) scale(${scale})`}>
            <FoldedHeartPaths variant={variant} color={color} />
        </G>
    );
}

/**
 * Classic folded-ribbon heart — two-tone magenta fill with hot-pink fold highlight.
 * Scales via size prop (~24–28px action rail, ~9px mailbox overlay).
 */
const FoldedHeartIcon = memo(function FoldedHeartIcon({
    size = 26,
    variant = 'filled',
    color = '#FFFFFF',
}) {
    return (
        <Svg width={size} height={size * (22 / 24)} viewBox={VIEWBOX} fill="none">
            <FoldedHeartPaths variant={variant} color={color} />
        </Svg>
    );
});

export default FoldedHeartIcon;
