import { memo } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

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
const HAND_OUTLINE = 2;

/** Bottom arcs (reference) — inner/outer radii and sweep kept as-is. */
const BOTTOM_ARC_INNER = { r: 8.65, start: 64, end: 110 };
const BOTTOM_ARC_OUTER = { r: 10.45, start: 60, end: 106 };

/**
 * Top-left arcs — same angular sweep as bottom, pushed further from disc
 * with a wider gap between the two strokes.
 */
const TOP_ARC_INNER = { r: 9.45, start: -158, end: -112 };
const TOP_ARC_OUTER = { r: 11.85, start: -162, end: -116 };

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
 * DJ scratching hand — four rounded fingers toward spindle, thumb below,
 * palm/wrist off the right edge. Valleys between finger tips read as separation.
 */
const HAND_PATH = [
    'M 22.00 21.50',
    'C 22.50 19.30 22.00 16.50 20.40 14.40',
    'L 18.80 12.80',
    'C 17.60 12.20 16.60 12.40 16.20 13.10',
    'C 15.90 13.70 16.10 14.30 16.60 14.80',
    'L 15.20 13.40',
    'C 14.40 12.70 13.90 12.50 14.00 13.10',
    'C 14.10 13.70 14.50 14.30 15.00 14.70',
    'L 13.60 13.00',
    'C 12.90 12.30 12.50 12.10 12.60 12.70',
    'C 12.70 13.30 13.10 13.90 13.60 14.30',
    'L 12.10 12.00',
    'C 11.50 11.10 11.20 10.40 11.30 9.60',
    'C 11.40 8.80 11.80 8.30 12.35 8.80',
    'C 12.80 9.25 13.05 9.95 13.20 10.55',
    'C 14.00 9.10 15.10 8.30 16.40 8.15',
    'C 17.70 8.05 18.85 8.70 19.65 9.85',
    'C 20.35 10.90 20.55 12.30 20.35 13.65',
    'C 20.10 15.00 19.35 16.30 18.20 17.25',
    'C 17.35 17.95 16.45 18.40 15.80 18.60',
    'C 15.25 18.80 15.45 18.30 16.20 17.55',
    'C 17.15 16.60 18.40 16.00 19.55 16.25',
    'C 20.70 16.50 21.55 17.55 21.95 19.00',
    'C 22.25 20.05 22.20 20.95 22.00 21.50',
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
