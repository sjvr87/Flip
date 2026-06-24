import { memo } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

type RemixVinylIconProps = {
    size?: number;
    color?: string;
};

/** Matches feed action rail `ICON_SLOT` (30px) — viewBox padded so motion arcs are not clipped. */
const VIEW_BOX = '-4.5 -0.5 30 27';

/** Disc slightly left of center so hand + arcs fit the slot. */
const DISC = { cx: 7.6, cy: 12.2, r: 7.4 };
const RING_OUTER = 1.5;
const RING_INNER = 0.55;
const SPINDLE_R = 0.34;
const ARC_STROKE = 1.1;

const ARC_DISC_GAP = 1.85;
const ARC_PAIR_GAP = 2.45;

const BOTTOM_ARC_INNER = { r: DISC.r + ARC_DISC_GAP, start: 56, end: 118 };
const BOTTOM_ARC_OUTER = {
    r: DISC.r + ARC_DISC_GAP + ARC_PAIR_GAP,
    start: 52,
    end: 114,
};

/** Upper-left pair — hug left rim of the disc (shifted further left than prior art). */
const TOP_ARC_INNER = { r: BOTTOM_ARC_INNER.r, start: -168, end: -122 };
const TOP_ARC_OUTER = { r: BOTTOM_ARC_OUTER.r, start: -174, end: -116 };

const HAND_OUTLINE = 0.42;

/**
 * DJ scratch hand — lower-right of disc, wide palm, thumb hidden.
 * Curled fingers as two-segment capsules; index extended with parallel sides.
 */
const PALM_PATH = [
    'M 21.6 0.6',
    'L 25.2 0.8',
    'L 25.6 4.4',
    'L 24.8 8.2',
    'C 23.6 11.4 20.4 13.2 17.0 13.4',
    'L 15.4 13.0',
    'L 15.2 11.6',
    'C 15.6 9.8 16.2 8.0 17.0 6.2',
    'C 18.2 3.6 20.0 1.6 21.6 0.6',
    'Z',
].join(' ');

/** Extended index — parallel sides, rounded tip reaching disc lower-right. */
const INDEX_FINGER_PATH = [
    'M 15.4 12.0',
    'L 13.6 12.6',
    'L 7.8 17.8',
    'L 7.2 18.4',
    'Q 7.0 18.9 7.6 19.0',
    'Q 8.2 18.6 8.4 18.0',
    'L 14.2 12.4',
    'L 15.4 12.0',
    'Z',
].join(' ');

/** Curled middle — two visible segments (proximal + distal). */
const MIDDLE_FINGER_PATH = [
    'M 21.6 0.8',
    'L 20.2 1.2',
    'L 17.0 2.6',
    'L 15.0 4.8',
    'L 13.6 7.2',
    'L 12.8 9.0',
    'Q 12.4 9.8 13.0 10.0',
    'L 14.4 9.4',
    'L 15.8 7.0',
    'L 17.6 4.6',
    'L 19.8 2.8',
    'L 21.6 0.8',
    'Z',
].join(' ');

/** Curled ring — offset below middle, full segment length. */
const RING_FINGER_PATH = [
    'M 20.2 3.4',
    'L 18.8 3.8',
    'L 16.2 5.0',
    'L 14.4 7.0',
    'L 13.2 9.2',
    'L 12.6 10.8',
    'Q 12.2 11.4 12.8 11.6',
    'L 14.2 11.0',
    'L 15.4 8.8',
    'L 17.2 6.6',
    'L 19.2 4.8',
    'L 20.2 3.4',
    'Z',
].join(' ');

/** Curled pinky — shortest, lowest on hand. */
const PINKY_FINGER_PATH = [
    'M 18.8 5.8',
    'L 17.4 6.2',
    'L 15.2 7.4',
    'L 13.6 9.4',
    'L 12.6 11.4',
    'L 12.0 12.8',
    'Q 11.6 13.4 12.2 13.6',
    'L 13.6 13.0',
    'L 14.8 11.0',
    'L 16.4 9.0',
    'L 18.0 7.4',
    'L 18.8 5.8',
    'Z',
].join(' ');

const HAND_FILL_PATHS = [
    PALM_PATH,
    MIDDLE_FINGER_PATH,
    RING_FINGER_PATH,
    PINKY_FINGER_PATH,
    INDEX_FINGER_PATH,
].join(' ');

/** Subtle creases — knuckle bends + index joint. */
const HAND_KNUCKLE_CREASES = [
    'M 19.0 3.6 L 16.8 4.8',
    'M 17.8 5.6 L 15.6 6.8',
    'M 16.6 7.4 L 14.4 8.6',
    'M 15.2 9.0 L 13.2 10.2',
    'M 13.8 10.8 L 12.0 12.0',
    'M 13.4 12.4 L 11.6 13.2',
    'M 14.2 12.4 L 12.4 13.2',
].join(' ');

const HAND_INDEX_NAIL = 'M 8.0 18.2 Q 7.6 18.6 7.85 18.85 Q 8.1 18.5 8.0 18.2';

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
 * Vinyl record with DJ scratching hand and motion arcs — feed remix / use-audio button.
 * Transparent background; record + arcs use `color`, label/wedge/hand gap use contrast cutouts.
 */
const RemixVinylIcon = memo(function RemixVinylIcon({
    size = 30,
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
        <Svg width={size} height={size} viewBox={VIEW_BOX} fill="none">
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
                d={HAND_FILL_PATHS}
                fill={color}
                stroke={detail}
                strokeWidth={HAND_OUTLINE}
                strokeLinejoin="round"
            />
            <Path
                d={HAND_KNUCKLE_CREASES}
                stroke={detail}
                strokeWidth={0.38}
                strokeLinecap="round"
            />
            <Path
                d={HAND_INDEX_NAIL}
                stroke={detail}
                strokeWidth={0.38}
                strokeLinecap="round"
                fill="none"
            />

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
