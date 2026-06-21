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
        <Svg width={size} height={size} viewBox="0 0 26 26" fill="none">
            {/* Outer circle — gap on left (~8–10 o'clock) */}
            <Path
                d="M 5.21 17.52 A 9 9 0 1 1 5.21 8.48"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeOpacity={strokeOpacity}
                strokeLinecap="round"
            />

            {/* Three dots along the missing arc */}
            <Circle cx={4.52} cy={9.92} r={dotRadius} fill={color} opacity={strokeOpacity} />
            <Circle cx={4} cy={13} r={dotRadius} fill={color} opacity={strokeOpacity} />
            <Circle cx={4.52} cy={16.08} r={dotRadius} fill={color} opacity={strokeOpacity} />

            {/* Head */}
            <Circle
                cx={13}
                cy={10.35}
                r={2.35}
                stroke={color}
                strokeWidth={strokeWidth}
                strokeOpacity={strokeOpacity}
            />

            {/* Shoulders — wide rounded U */}
            <Path
                d="M 8.85 12.65 C 8.85 16.95 13 17.75 17.15 12.65"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeOpacity={strokeOpacity}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </Svg>
    );
});

export default ProfileTabIcon;
