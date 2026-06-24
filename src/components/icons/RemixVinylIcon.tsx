import { memo } from 'react';
import Svg, { Circle, ClipPath, Defs, G, Path } from 'react-native-svg';

type RemixVinylIconProps = {
    size?: number;
    color?: string;
};

/** Traced from reference artboard (24×24) — disc slightly left of center. */
const DISC = { cx: 7.84, cy: 12.16, r: 7.53 };
const RING_OUTER = 1.55;
const RING_INNER = 0.58;
const SPINDLE_R = 0.36;
const ARC_STROKE = 1.15;
const HAND_OUTLINE = 1.35;

/** Bottom motion arcs (reference). */
const BOTTOM_ARC_INNER = { r: 8.65, start: 64, end: 110 };
const BOTTOM_ARC_OUTER = { r: 10.45, start: 60, end: 106 };

/** Top-left arcs — tight parallel pair hugging disc edge (ecdd580 reference). */
const TOP_ARC_INNER = { r: 8.75, start: -130, end: -108 };
const TOP_ARC_OUTER = { r: 9.95, start: -134, end: -104 };

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

/**
 * DJ scratching hand — four rounded fingertips with valleys toward spindle,
 * thumb tucked below index, palm/wrist off the right edge.
 */
const HAND_PATH = [
    'M 22.10 20.80',
    'C 22.70 18.10 22.00 15.20 20.10 13.00',
    'L 19.05 12.05',
    'C 18.35 11.35 17.75 11.75 18.05 12.55',
    'L 17.00 11.35',
    'C 16.30 10.65 15.70 11.05 16.00 11.85',
    'L 14.85 10.55',
    'C 14.15 9.85 13.55 10.25 13.85 11.05',
    'L 12.55 9.45',
    'C 11.75 8.65 11.15 9.35 11.50 10.35',
    'C 11.35 12.10 12.60 14.60 14.70 16.40',
    'C 16.60 18.00 19.30 19.40 21.40 18.70',
    'C 22.00 19.40 22.15 20.10 22.10 20.80',
    'Z',
].join(' ');

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

    const wedgeStart = -50;
    const wedgeEnd = -16;
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
                d={arcPath(cx, cy, TOP_ARC_INNER.r, TOP_ARC_INNER.start, TOP_ARC_INNER.end)}
                stroke={color}
                strokeWidth={ARC_STROKE}
                strokeLinecap="round"
            />
            <Path
                d={arcPath(cx, cy, TOP_ARC_OUTER.r, TOP_ARC_OUTER.start, TOP_ARC_OUTER.end)}
                stroke={color}
                strokeWidth={ARC_STROKE}
                strokeLinecap="round"
            />

            <Circle cx={cx} cy={cy} r={r} fill={color} />

            <Path d={wedgePath} fill={detail} />

            <Circle cx={cx} cy={cy} r={RING_OUTER} fill={detail} />
            <Circle cx={cx} cy={cy} r={RING_INNER} fill={color} />
            <Circle cx={cx} cy={cy} r={SPINDLE_R} fill={detail} />

            <G clipPath="url(#remixDiscClip)">
                <Path
                    d={HAND_PATH}
                    fill="none"
                    stroke={detail}
                    strokeWidth={HAND_OUTLINE}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                />
            </G>
            <Path
                d={HAND_PATH}
                fill="none"
                stroke={detail}
                strokeWidth={HAND_OUTLINE}
                strokeLinejoin="round"
                strokeLinecap="round"
            />
            <Path d={HAND_PATH} fill={color} />

            <Path
                d={arcPath(cx, cy, BOTTOM_ARC_INNER.r, BOTTOM_ARC_INNER.start, BOTTOM_ARC_INNER.end)}
                stroke={color}
                strokeWidth={ARC_STROKE}
                strokeLinecap="round"
            />
            <Path
                d={arcPath(cx, cy, BOTTOM_ARC_OUTER.r, BOTTOM_ARC_OUTER.start, BOTTOM_ARC_OUTER.end)}
                stroke={color}
                strokeWidth={ARC_STROKE}
                strokeLinecap="round"
            />
        </Svg>
    );
});

export default RemixVinylIcon;
