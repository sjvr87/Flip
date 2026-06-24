import { memo } from 'react';
import Svg, { Circle, Rect } from 'react-native-svg';

/** Matches feed action rail `ICON_SIZE` (Ionicons, remix, share, comment). */
export const SPEAKER_SOUND_DESIGN_SIZE = 30;

type SpeakerSoundIconProps = {
    size?: number;
    color?: string;
};

const VIEW = 24;
const CABINET = { x: 8.75, y: 4, w: 6.5, h: 16, rx: 1.75 };
const BAR_WIDTH = 0.9;
/** Outside → inside: short, medium, tall, medium, short */
const BAR_HEIGHTS = [5, 8, 11, 8, 5];
const LEFT_BAR_CENTERS = [2.35, 3.8, 5.25, 6.7, 8.05];
const RIGHT_BAR_CENTERS = LEFT_BAR_CENTERS.map((x) => VIEW - x);

function contrastFill(color: string) {
    const normalized = color.toLowerCase();
    return normalized === '#ffffff' || normalized === 'white' ? '#000000' : '#FFFFFF';
}

/**
 * Speaker cabinet with twin drivers and pill-shaped sound bars — matches feed mute control reference.
 * Transparent background; cabinet + waves use `color`, driver/screw details use contrast cutouts.
 */
const SpeakerSoundIcon = memo(function SpeakerSoundIcon({
    size = SPEAKER_SOUND_DESIGN_SIZE,
    color = '#FFFFFF',
}: SpeakerSoundIconProps) {
    const detail = contrastFill(color);
    const barCy = 12;

    return (
        <Svg width={size} height={size} viewBox={`0 0 ${VIEW} ${VIEW}`} fill="none">
            {LEFT_BAR_CENTERS.map((cx, index) => {
                const h = BAR_HEIGHTS[index];
                return (
                    <Rect
                        key={`l-${index}`}
                        x={cx - BAR_WIDTH / 2}
                        y={barCy - h / 2}
                        width={BAR_WIDTH}
                        height={h}
                        rx={BAR_WIDTH / 2}
                        fill={color}
                    />
                );
            })}

            <Rect
                x={CABINET.x}
                y={CABINET.y}
                width={CABINET.w}
                height={CABINET.h}
                rx={CABINET.rx}
                fill={color}
            />

            {[
                [9.65, 5.1],
                [14.35, 5.1],
                [9.65, 18.9],
                [14.35, 18.9],
            ].map(([cx, cy], index) => (
                <Circle key={`screw-${index}`} cx={cx} cy={cy} r={0.45} fill={detail} />
            ))}

            <Circle cx={12} cy={8.2} r={1.35} stroke={detail} strokeWidth={0.85} fill="none" />
            <Circle cx={12} cy={8.2} r={0.55} fill={detail} />

            <Circle cx={12} cy={15.5} r={2.65} stroke={detail} strokeWidth={0.85} fill={color} />
            <Circle cx={12} cy={15.5} r={1.85} fill={detail} />
            <Circle cx={12} cy={15.5} r={1.05} fill={color} />

            {RIGHT_BAR_CENTERS.map((cx, index) => {
                const h = BAR_HEIGHTS[index];
                return (
                    <Rect
                        key={`r-${index}`}
                        x={cx - BAR_WIDTH / 2}
                        y={barCy - h / 2}
                        width={BAR_WIDTH}
                        height={h}
                        rx={BAR_WIDTH / 2}
                        fill={color}
                    />
                );
            })}
        </Svg>
    );
});

export default SpeakerSoundIcon;
