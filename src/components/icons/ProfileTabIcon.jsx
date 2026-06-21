import { memo } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

/**
 * Person bust inside a broken circle — tab bar reference at 30px.
 * Stroke-only line art; tint follows tabBarActiveTintColor / tabBarInactiveTintColor.
 *
 * Geometry (center 13,13, ring r=9) traced from reference PNG:
 * - Ring gap upper-left (~9–11 o'clock) with three filled dots along the missing arc
 * - Head: stroke circle, centered horizontally
 * - Shoulders: wide shallow arc below head (lines do not touch)
 */
const ProfileTabIcon = memo(function ProfileTabIcon({
    size = 30,
    color = '#000000',
    focused = false,
}) {
    const strokeWidth = focused ? 1.75 : 1.3;
    const strokeOpacity = focused ? 1 : 0.72;
    const dotRadius = focused ? 0.68 : 0.58;

    return (
        <Svg width={size} height={size} viewBox="0 0 26 26" fill="none">
            {/* Outer ring — gap upper-left (~9–11 o'clock); long arc clockwise */}
            <Path
                d="M 8.5 5.21 A 9 9 0 1 1 4 13"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeOpacity={strokeOpacity}
                strokeLinecap="round"
            />

            {/* Three dots evenly spaced along the missing upper-left arc */}
            <Circle cx={4.14} cy={11.43} r={dotRadius} fill={color} opacity={strokeOpacity} />
            <Circle cx={5.21} cy={8.5} r={dotRadius} fill={color} opacity={strokeOpacity} />
            <Circle cx={7.22} cy={6.11} r={dotRadius} fill={color} opacity={strokeOpacity} />

            {/* Head */}
            <Circle
                cx={13}
                cy={9.85}
                r={2.45}
                stroke={color}
                strokeWidth={strokeWidth}
                strokeOpacity={strokeOpacity}
            />

            {/* Shoulders — wide rounded arc (gap below head) */}
            <Path
                d="M 7.4 13.5 A 5.6 1.05 0 0 0 18.6 13.5"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeOpacity={strokeOpacity}
                strokeLinecap="round"
            />
        </Svg>
    );
});

export default ProfileTabIcon;
