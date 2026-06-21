import { memo } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

/**
 * Person bust inside a broken circle — tab bar reference at 26px.
 * Stroke-only line art; tint follows tabBarActiveTintColor / tabBarInactiveTintColor.
 */
const ProfileTabIcon = memo(function ProfileTabIcon({
    size = 26,
    color = '#000000',
    focused = false,
}) {
    const strokeWidth = focused ? 1.75 : 1.3;
    const strokeOpacity = focused ? 1 : 0.72;
    const dotRadius = focused ? 0.52 : 0.44;

    return (
        <Svg width={size} height={size} viewBox="-1 -1 28 28" fill="none">
            {/* Outer ring — gap on left (~10–8 o'clock) */}
            <Path
                d="M 5.21 17.5 A 9 9 0 1 1 5.21 8.5"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeOpacity={strokeOpacity}
                strokeLinecap="round"
            />

            {/* Three dots along the missing arc */}
            <Circle cx={4.56} cy={9.62} r={dotRadius} fill={color} opacity={strokeOpacity} />
            <Circle cx={4} cy={13} r={dotRadius} fill={color} opacity={strokeOpacity} />
            <Circle cx={4.66} cy={16.38} r={dotRadius} fill={color} opacity={strokeOpacity} />

            {/* Head */}
            <Circle
                cx={13}
                cy={10.25}
                r={2.3}
                stroke={color}
                strokeWidth={strokeWidth}
                strokeOpacity={strokeOpacity}
            />

            {/* Shoulders — wide shallow U */}
            <Path
                d="M 9.05 12.7 A 3.95 2.2 0 0 0 16.95 12.7"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeOpacity={strokeOpacity}
                strokeLinecap="round"
            />
        </Svg>
    );
});

export default ProfileTabIcon;
