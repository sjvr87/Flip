import { memo } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

type RemixVinylIconProps = {
    size?: number;
    color?: string;
};

const VIEW = 24;
/** Cropped to record + hand bounds for feed-rail optical parity with Ionicons. */
const VIEW_BOX = '2 3.5 19 19';
const RECORD = { cx: 10.2, cy: 12.8, r: 7.2 };

function contrastFill(color: string) {
    const normalized = color.toLowerCase();
    return normalized === '#ffffff' || normalized === 'white' ? '#000000' : '#FFFFFF';
}

/** Hand silhouette — flat palm scratching the record from the right. */
const HAND_PATH =
    'M 15.4 11.2 L 17.1 9.1 L 19.4 7.8 L 20.1 9.2 L 19.5 10.4 L 20.2 11.8 L 19.8 13.4 L 20.1 15.1 L 18.6 16.4 L 16.9 16.8 L 15.3 16.1 L 14.1 14.6 L 13.6 13.1 Z';

/**
 * Vinyl record with scratching hand and motion arcs — feed remix / use-audio button.
 * Transparent background; record + arcs use `color`, hole/wedge/hand outline use contrast cutouts.
 */
const RemixVinylIcon = memo(function RemixVinylIcon({
    size = 24,
    color = '#FFFFFF',
}: RemixVinylIconProps) {
    const detail = contrastFill(color);
    const { cx, cy, r } = RECORD;

    const wedgeOuterR = 5.1;
    const wedgeInnerR = 2.15;
    const wedgeStart = (-105 * Math.PI) / 180;
    const wedgeEnd = (-75 * Math.PI) / 180;
    const wedgePath = [
        `M ${cx + wedgeInnerR * Math.cos(wedgeStart)} ${cy + wedgeInnerR * Math.sin(wedgeStart)}`,
        `L ${cx + wedgeOuterR * Math.cos(wedgeStart)} ${cy + wedgeOuterR * Math.sin(wedgeStart)}`,
        `A ${wedgeOuterR} ${wedgeOuterR} 0 0 1 ${cx + wedgeOuterR * Math.cos(wedgeEnd)} ${cy + wedgeOuterR * Math.sin(wedgeEnd)}`,
        `L ${cx + wedgeInnerR * Math.cos(wedgeEnd)} ${cy + wedgeInnerR * Math.sin(wedgeEnd)}`,
        `A ${wedgeInnerR} ${wedgeInnerR} 0 0 0 ${cx + wedgeInnerR * Math.cos(wedgeStart)} ${cy + wedgeInnerR * Math.sin(wedgeStart)}`,
        'Z',
    ].join(' ');

    return (
        <Svg width={size} height={size} viewBox={VIEW_BOX} fill="none">
            <Path
                d="M 3.2 8.4 Q 5.4 5.2 8.6 4.1"
                stroke={color}
                strokeWidth={1.15}
                strokeLinecap="round"
            />
            <Path
                d="M 4.3 10.1 Q 6.2 7.6 8.9 6.4"
                stroke={color}
                strokeWidth={1.15}
                strokeLinecap="round"
            />

            <Circle cx={cx} cy={cy} r={r} fill={color} />

            <Path d={wedgePath} fill={detail} />

            <Circle cx={cx} cy={cy} r={1.15} fill={detail} />
            <Circle cx={cx} cy={cy} r={1.15} stroke={color} strokeWidth={0.35} fill={detail} />

            <Path
                d="M 8.8 20.2 Q 10.8 22.1 13.4 21.6"
                stroke={color}
                strokeWidth={1.15}
                strokeLinecap="round"
            />
            <Path
                d="M 9.9 21.5 Q 11.8 23.2 14.2 22.7"
                stroke={color}
                strokeWidth={1.15}
                strokeLinecap="round"
            />

            <Path
                d={HAND_PATH}
                fill={color}
                stroke={detail}
                strokeWidth={1.35}
                strokeLinejoin="round"
            />
        </Svg>
    );
});

export default RemixVinylIcon;
