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

/** Bottom motion arcs — radii pushed outward; wider sweep so curves read complete. */
const BOTTOM_ARC_INNER = { r: DISC.r + ARC_DISC_GAP, start: 58, end: 114 };
const BOTTOM_ARC_OUTER = {
    r: DISC.r + ARC_DISC_GAP + ARC_PAIR_GAP,
    start: 54,
    end: 110,
};

/**
 * Top-left arcs — same radii/spacing as bottom, shifted left along the disc rim
 * (not a strict 180° mirror so the pair hugs the upper-left quadrant).
 */
const TOP_ARC_INNER = { r: BOTTOM_ARC_INNER.r, start: -142, end: -96 };
const TOP_ARC_OUTER = { r: BOTTOM_ARC_OUTER.r, start: -148, end: -92 };

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
    const span = Math.abs(endDeg - startDeg);
    const largeArc = span > 180 ? 1 : 0;
    return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} ${sweep} ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

/**
 * DJ mix grip — four fingers flat on the vinyl toward the spindle, thumb offset
 * to the right; simple outline with fingertip ridges and inter-finger valleys.
 */
const HAND_PATH = [
    'M 23.10 21.90',
    'C 22.20 19.50 20.80 17.30 19.50 16.10',
    'C 21.50 15.20 23.00 14.00 22.80 12.80',
    'C 22.40 11.90 21.00 12.50 20.10 13.40',
    'C 19.60 14.00 19.30 14.60 19.10 15.00',
    'C 17.20 14.50 15.00 14.00 13.80 13.70',
    'C 14.50 13.30 16.50 13.40 17.80 14.00',
    'C 15.80 12.80 13.80 12.20 12.60 11.90',
    'C 13.40 11.40 15.60 11.50 17.00 12.20',
    'C 14.60 10.90 13.00 10.30 12.10 10.00',
    'C 13.00 9.50 15.20 9.60 16.60 10.30',
    'C 14.00 8.80 13.00 8.40 12.40 8.10',
    'C 13.80 7.80 16.20 8.80 17.60 10.20',
    'C 19.00 11.80 20.20 14.20 21.20 16.80',
    'C 22.00 18.80 22.80 20.50 23.10 21.90',
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
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" overflow="visible">
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
