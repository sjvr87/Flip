import { memo } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

type FollowAddBadgeIconProps = {
    size?: number;
    color?: string;
    accentColor?: string;
};

const VIEW_W = 40;
const VIEW_H = 36;
const STROKE = 1.65;

/**
 * Clustered + / person-in-circle / ? outlines — feed avatar follow affordance.
 * Proportions traced from user reference; stroke-only for dark feed backgrounds.
 */
const FollowAddBadgeIcon = memo(function FollowAddBadgeIcon({
    size = 32,
    color = '#FFFFFF',
    accentColor = '#22D3EE',
}: FollowAddBadgeIconProps) {
    const height = (size * VIEW_H) / VIEW_W;

    return (
        <Svg width={size} height={height} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} fill="none">
            {/* Plus — upper left */}
            <Path
                d="M5.5 8.5 H10.5 M8 6 V11"
                stroke={accentColor}
                strokeWidth={STROKE}
                strokeLinecap="round"
            />

            {/* Question mark — upper right */}
            <Path
                d="M29.5 7 C29.5 4.8 31.4 3.5 33.4 3.5 C35.6 3.5 37.2 5.2 37.2 7.4 C37.2 9.5 35.1 10.4 33.8 11.5 C32.9 12.3 32.4 13.3 32.4 14.6"
                stroke={color}
                strokeWidth={STROKE}
                strokeLinecap="round"
            />
            <Circle cx={32.4} cy={17.2} r={1.05} fill={color} />

            {/* Person in circle — bottom center, largest glyph */}
            <Circle cx={20} cy={26.5} r={9.2} stroke={color} strokeWidth={STROKE} />
            <Circle cx={20} cy={21.8} r={3.15} stroke={color} strokeWidth={STROKE} />
            <Path
                d="M12.2 32.2 Q20 36.2 27.8 32.2"
                stroke={color}
                strokeWidth={STROKE}
                strokeLinecap="round"
            />
        </Svg>
    );
});

export default FollowAddBadgeIcon;
