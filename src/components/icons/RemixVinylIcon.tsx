import { memo } from 'react';
import Svg, { Circle, ClipPath, Defs, G, Path } from 'react-native-svg';

type RemixVinylIconProps = {
    size?: number;
    color?: string;
};

/** Traced from reference vinyl-scratch icon (24×24 artboard). */
const DISC = { cx: 8.75, cy: 12.1, r: 6.4 };
const RING_OUTER = 2.85;
const RING_INNER = 1.05;
const SPINDLE_R = 0.65;
const ARC_STROKE = 1.15;
const HAND_OUTLINE = 1.3;

function contrastFill(color: string) {
    const normalized = color.toLowerCase();
    return normalized === '#ffffff' || normalized === 'white' ? '#000000' : '#FFFFFF';
}

function polarPoint(cx: number, cy: number, r: number, deg: number) {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
    const start = polarPoint(cx, cy, r, startDeg);
    const end = polarPoint(cx, cy, r, endDeg);
    const sweep = endDeg > startDeg ? 1 : 0;
    return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 0 ${sweep} ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

/** Hand silhouette traced from reference — fingers toward spindle, palm off right edge. */
const HAND_PATH =
    'M 11.53 6.60 C 12.05 6.35 13.35 7.55 14.54 9.53 C 15.45 10.35 16.55 10.45 17.39 10.53 C 18.35 11.55 19.35 13.05 19.67 14.08 C 20.35 15.55 20.55 16.85 20.48 16.40 C 20.15 17.65 19.05 17.85 18.33 17.73 C 16.55 18.45 13.45 19.45 12.22 19.55 C 11.55 19.85 11.40 18.40 11.53 16.73 C 11.48 15.35 11.50 14.05 11.53 13.69 C 11.58 12.05 11.68 10.65 11.75 11.60 C 11.52 9.85 11.45 8.05 11.53 6.60 Z';

/**
 * Vinyl record with scratching hand and motion arcs — feed remix / use-audio button.
 * Transparent background; record + arcs use `color`, label/wedge/hand gap use contrast cutouts.
 */
const RemixVinylIcon = memo(function RemixVinylIcon({
    size = 24,
    color = '#FFFFFF',
}: RemixVinylIconProps) {
    const detail = contrastFill(color);
    const { cx, cy, r } = DISC;

    const wedgeStart = -58;
    const wedgeEnd = -12;
    const wedgeInner = polarPoint(cx, cy, RING_OUTER, wedgeStart);
    const wedgeOuterStart = polarPoint(cx, cy, r, wedgeStart);
    const wedgeOuterEnd = polarPoint(cx, cy, r, wedgeEnd);
    const wedgeInnerEnd = polarPoint(cx, cy, RING_OUTER, wedgeEnd);
    const wedgePath = [
        `M ${wedgeInner.x.toFixed(2)} ${wedgeInner.y.toFixed(2)}`,
        `L ${wedgeOuterStart.x.toFixed(2)} ${wedgeOuterStart.y.toFixed(2)}`,
        `A ${r} ${r} 0 0 1 ${wedgeOuterEnd.x.toFixed(2)} ${wedgeOuterEnd.y.toFixed(2)}`,
        `L ${wedgeInnerEnd.x.toFixed(2)} ${wedgeInnerEnd.y.toFixed(2)}`,
        `A ${RING_OUTER} ${RING_OUTER} 0 0 0 ${wedgeInner.x.toFixed(2)} ${wedgeInner.y.toFixed(2)}`,
        'Z',
    ].join(' ');

    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Defs>
                <ClipPath id="remixDiscClip">
                    <Circle cx={cx} cy={cy} r={r} />
                </ClipPath>
            </Defs>

            <Path
                d={arcPath(cx, cy, 7.25, -125, -108)}
                stroke={color}
                strokeWidth={ARC_STROKE}
                strokeLinecap="round"
            />
            <Path
                d={arcPath(cx, cy, 8.45, -128, -104)}
                stroke={color}
                strokeWidth={ARC_STROKE}
                strokeLinecap="round"
            />

            <Circle cx={cx} cy={cy} r={r} fill={color} />

            <Path d={wedgePath} fill={detail} />

            <Circle cx={cx} cy={cy} r={RING_OUTER} fill={detail} />
            <Circle cx={cx} cy={cy} r={RING_INNER} fill={color} />
            <Circle cx={cx} cy={cy} r={SPINDLE_R} fill={color} />

            <G clipPath="url(#remixDiscClip)">
                <Path
                    d={HAND_PATH}
                    stroke={detail}
                    strokeWidth={HAND_OUTLINE}
                    strokeLinejoin="round"
                    fill="none"
                />
            </G>
            <Path d={HAND_PATH} fill={color} />

            <Path
                d={arcPath(cx, cy, 7.35, 8, 72)}
                stroke={color}
                strokeWidth={ARC_STROKE}
                strokeLinecap="round"
            />
            <Path
                d={arcPath(cx, cy, 9.2, 5, 68)}
                stroke={color}
                strokeWidth={ARC_STROKE}
                strokeLinecap="round"
            />
        </Svg>
    );
});

export default RemixVinylIcon;
