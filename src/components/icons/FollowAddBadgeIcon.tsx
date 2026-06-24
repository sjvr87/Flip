import { memo } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

type FollowAddBadgeIconProps = {
    size?: number;
    color?: string;
};

const VIEW = 36;
const STROKE = 2.65;
const PLUS_STROKE = 4.0;
const CENTER_X = 18;

/**
 * Person bust with + (left) and ? (right) along the lower edge — feed avatar follow affordance.
 * Stroke-only, no outer ring; white on dark feed backgrounds; matches action-rail icon weight.
 */
const FollowAddBadgeIcon = memo(function FollowAddBadgeIcon({
    size = 32,
    color = '#FFFFFF',
}: FollowAddBadgeIconProps) {
    return (
        <Svg width={size} height={size} viewBox={`0 0 ${VIEW} ${VIEW}`} fill="none">
            {/* Person bust — centered */}
            <Circle
                cx={CENTER_X}
                cy={13.8}
                r={3.8}
                stroke={color}
                strokeWidth={STROKE}
            />
            <Path
                d="M9.8 22.4 Q18 28.4 26.2 22.4"
                stroke={color}
                strokeWidth={STROKE}
                strokeLinecap="round"
            />

            {/* Plus — lower left, well clear of shoulder curve */}
            <Path
                d="M1.8 16.4 H7.2 M4.5 13.8 V19.0"
                stroke={color}
                strokeWidth={PLUS_STROKE}
                strokeLinecap="round"
            />

            {/* Question mark — lower right, separated from bust */}
            <Path
                d="M26.2 17.6 C26.2 15.2 28.4 14 30.2 14 C32.4 14 34.2 15.6 34.2 17.8 C34.2 19.8 32.2 20.8 31 21.8 C30.2 22.5 29.8 23.6 29.8 24.6"
                stroke={color}
                strokeWidth={STROKE}
                strokeLinecap="round"
            />
            <Circle cx={29.8} cy={27.2} r={1.5} fill={color} />
        </Svg>
    );
});

export default FollowAddBadgeIcon;
