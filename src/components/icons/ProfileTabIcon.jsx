import { memo } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

/**
 * Person bust inside a broken circle — tab bar reference at 26px.
 * Stroke-only line art; tint follows tabBarActiveTintColor / tabBarInactiveTintColor.
 *
 * Geometry traced from reference PNG (center 13,13, ring r=9):
 * - Ring gap on left (~8–10 o'clock) with three filled dots along the missing arc
 * - Head: stroke circle centered in ring
 * - Shoulders: single wide shallow arc (not a deep bowl)
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
            {/* Outer ring — gap on left (~8–10 o'clock); long arc clockwise */}
            <Path
                d="M 5.21 17.5 A 9 9 0 1 1 5.21 8.5"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeOpacity={strokeOpacity}
                strokeLinecap="round"
            />

            {/* Three dots evenly spaced along the missing left arc (8.5h, 9h, 9.5h) */}
            <Circle cx={4.3} cy={10.67} r={dotRadius} fill={color} opacity={strokeOpacity} />
            <Circle cx={4} cy={13} r={dotRadius} fill={color} opacity={strokeOpacity} />
            <Circle cx={4.3} cy={15.33} r={dotRadius} fill={color} opacity={strokeOpacity} />

            {/* Head */}
            <Circle
                cx={13}
                cy={10.35}
                r={2.55}
                stroke={color}
                strokeWidth={strokeWidth}
                strokeOpacity={strokeOpacity}
            />

            {/* Shoulders — wide shallow U (rx=5.1, ry=0.65) */}
            <Path
                d="M 7.9 13.15 A 5.1 0.65 0 0 0 18.1 13.15"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeOpacity={strokeOpacity}
                strokeLinecap="round"
            />
        </Svg>
    );
});

export default ProfileTabIcon;
