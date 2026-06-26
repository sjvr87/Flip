import { ACTIVITY_COMMENT_BADGE_SIZE } from '@/utils/avatarShape';
import { memo } from 'react';
import Svg, { Circle, G, Path } from 'react-native-svg';

/** Matches feed action rail `ICON_SLOT` (30px). */
export const MEGAPHONE_COMMENT_DESIGN_SIZE = 30;
/** Activity notifications — slightly smaller than feed follow badge; sits off the avatar corner. */
export const MEGAPHONE_COMMENT_ACTIVITY_SIZE = ACTIVITY_COMMENT_BADGE_SIZE;

type MegaphoneCommentIconProps = {
    size?: number;
    color?: string;
};

const VIEW = 24;
/** Expanded crop — exaggerated bell + sound arcs on the left after mirror. */
const VIEW_BOX = '0 -3.5 33 27';

/** Detached circular head — small gap below before torso/neck. */
const HEAD = { cx: 13.6, cy: 3.25, r: 2.28 };

/**
 * Thick torso leaning toward megaphone side — wider shoulders, tapered waist.
 */
const TORSO_PATH = [
    'M 11.0 7.45',
    'L 15.9 6.75',
    'L 14.6 14.4',
    'L 10.2 15.0',
    'Z',
].join(' ');

/**
 * Raised arm — limb weight matches holding arm (~leg thickness minus a hair), modest hand taper.
 * Slightly shortened reach vs prior revision.
 */
const RAISED_ARM_PATH = [
    'M 13.5 8.0',
    'L 11.0 4.5',
    'L 8.3 2.0',
    'L 7.2 1.65',
    'L 6.5 2.3',
    'L 9.0 4.8',
    'L 11.5 8.3',
    'Z',
].join(' ');

/** Shoulder-to-elbow — thick upper arm, elbow out and down for a clear bend. */
const HOLDING_UPPER_ARM_PATH = [
    'M 15.9 6.75',
    'L 17.0 8.0',
    'L 23.0 7.2',
    'L 21.8 6.0',
    'L 15.3 5.9',
    'Z',
].join(' ');

/** Forearm — natural upward bend from elbow to megaphone grip. */
const HOLDING_FOREARM_PATH = [
    'M 21.8 6.0',
    'L 23.0 7.2',
    'L 18.2 2.5',
    'L 17.2 1.7',
    'L 17.8 1.2',
    'L 19.0 2.0',
    'Z',
].join(' ');

/**
 * Megaphone — exaggerated cone: narrow mouthpiece at cheek (gap from head), wide bell to the right
 * (renders on the left after horizontal mirror). Deliberately larger than the head.
 */
const MEGAPHONE_PATH = [
    'M 16.8 1.8',
    'L 29.0 -3.0',
    'L 27.5 4.8',
    'L 16.8 4.2',
    'Z',
].join(' ');

/**
 * Viewer's right leg (figure left) — hip overlaps torso edge so thigh reads attached.
 */
const LEFT_LEG_PATH = [
    'M 10.45 14.55',
    'L 10.2 15.0',
    'L 9.28 14.72',
    'L 8.45 20.8',
    'L 6.8 20.8',
    'L 5.8 21.2',
    'L 7.0 22.2',
    'L 9.6 22.2',
    'L 10.45 15.35',
    'Z',
].join(' ');

/** Viewer's left leg — mirrored hip blend at torso junction. */
const RIGHT_LEG_PATH = [
    'M 14.35 14.55',
    'L 14.6 14.4',
    'L 15.52 14.72',
    'L 16.35 20.8',
    'L 18.0 20.8',
    'L 19.0 21.2',
    'L 17.8 22.2',
    'L 15.2 22.2',
    'L 14.35 15.35',
    'Z',
].join(' ');

const WAVE_ORIGIN = { cx: 28.2, cy: 0.85 };
const WAVE_STROKE = 1.08;
/** Three arcs increasing in radius — emanate from enlarged megaphone bell. */
const SOUND_WAVES = [
    { r: 2.6, start: -58, end: 28 },
    { r: 4.5, start: -60, end: 32 },
    { r: 6.4, start: -62, end: 36 },
];

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
 * Person-with-megaphone silhouette — feed comment button.
 * Artwork traced facing right from reference; rendered mirrored so megaphone sits on the left.
 */
const MegaphoneCommentIcon = memo(function MegaphoneCommentIcon({
    size = MEGAPHONE_COMMENT_DESIGN_SIZE,
    color = '#FFFFFF',
}: MegaphoneCommentIconProps) {
    return (
        <Svg width={size} height={size} viewBox={VIEW_BOX} fill="none">
            <G transform={`translate(${VIEW}, 0) scale(-1, 1)`}>
                {SOUND_WAVES.map((wave, index) => (
                    <Path
                        key={`wave-${index}`}
                        d={arcPath(WAVE_ORIGIN.cx, WAVE_ORIGIN.cy, wave.r, wave.start, wave.end)}
                        stroke={color}
                        strokeWidth={WAVE_STROKE}
                        strokeLinecap="round"
                        fill="none"
                    />
                ))}

                <Path d={LEFT_LEG_PATH} fill={color} />
                <Path d={RIGHT_LEG_PATH} fill={color} />
                <Path d={TORSO_PATH} fill={color} />
                <Path d={RAISED_ARM_PATH} fill={color} />
                <Path d={HOLDING_UPPER_ARM_PATH} fill={color} />
                <Path d={HOLDING_FOREARM_PATH} fill={color} />
                <Path d={MEGAPHONE_PATH} fill={color} />
                <Circle cx={HEAD.cx} cy={HEAD.cy} r={HEAD.r} fill={color} />
            </G>
        </Svg>
    );
});

export default MegaphoneCommentIcon;
