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

/** disc → gap → inner arc → bigger gap → outer arc */
const ARC_DISC_GAP = 1.9;
const ARC_PAIR_GAP = 2.6;

/** Bottom motion arcs (reference direction) — radii pushed outward from disc. */
const BOTTOM_ARC_INNER = { r: DISC.r + ARC_DISC_GAP, start: 64, end: 110 };
const BOTTOM_ARC_OUTER = {
    r: DISC.r + ARC_DISC_GAP + ARC_PAIR_GAP,
    start: 60,
    end: 106,
};

/** Top-left arcs — point-mirror of bottom pair (same radii, stroke, spacing). */
const TOP_ARC_INNER = {
    r: BOTTOM_ARC_INNER.r,
    start: BOTTOM_ARC_INNER.start + 180,
    end: BOTTOM_ARC_INNER.end + 180,
};
const TOP_ARC_OUTER = {
    r: BOTTOM_ARC_OUTER.r,
    start: BOTTOM_ARC_OUTER.start + 180,
    end: BOTTOM_ARC_OUTER.end + 180,
};

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
 * DJ scratching hand — palm on right, four finger bumps toward spindle,
 * thumb below index; wrist exits bottom-right. Simple outline icon style.
 */
const HAND_PATH = [
    'M 23.00 22.00',
    'L 21.00 18.50',
    'C 19.00 15.00 17.50 13.00 16.50 12.00',
    'C 16.00 11.40 15.40 10.70 15.90 10.30',
    'C 16.40 9.90 17.00 10.80 17.20 11.40',
    'C 15.40 9.80 14.60 8.90 15.00 8.50',
    'C 15.40 8.10 16.10 9.20 16.40 10.00',
    'C 14.00 8.20 13.00 7.00 13.40 6.60',
    'C 13.80 6.20 14.60 7.50 15.00 8.80',
    'C 12.40 7.60 11.70 6.90 12.00 7.30',
    'C 12.30 7.70 13.00 9.20 13.50 10.60',
    'C 13.00 11.80 12.80 13.20 14.00 14.50',
    'C 15.20 15.60 16.80 14.40 17.50 13.20',
    'C 19.50 15.40 21.50 18.00 23.00 22.00',
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
