import { memo } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

/**
 * Person bust inside a broken circle — tab bar reference at 26px.
 * Stroke-only line art; tint follows tabBarActiveTintColor / tabBarInactiveTintColor.
 *
 * Geometry (center 13,13, ring r=9) traced from reference:
 * - Ring gap on left (~8–10 o'clock) with three filled dots on the missing arc
 * - Head: stroke circle centered in ring
 * - Shoulders: wide shallow U (large rx, tiny ry)
 */
const ProfileTabIcon = memo(function ProfileTabIcon({
    size = 26,
    color = '#000000',
    focused = false,
}) {
    const strokeWidth = focused ? 1.75 : 1.3;
    const strokeOpacity = focused ? 1 : 0.72;
    const dotRadius = focused ? 0.52 : 0.44;

    // Ring center (13,13), r=9. Gap on left from 10 o'clock to 8 o'clock.
    const ringStartX = 5.21;
    const ringStartY = 8.5;
    const ringEndX = 5.21;
    const ringEndY = 17.5;

    // Three dots evenly on missing arc (250°, 270°, 290° clockwise from 12 o'clock).
    const dots = [
        { cx: 4.54, cy: 10.06 },
        { cx: 4, cy: 13 },
        { cx: 4.54, cy: 16.06 },
    ];

    return (
        <Svg width={size} height={size} viewBox="0 0 26 26" fill="none">
            {/* Outer ring — long arc clockwise, skipping left gap */}
            <Path
                d={`M ${ringStartX} ${ringStartY} A 9 9 0 1 1 ${ringEndX} ${ringEndY}`}
                stroke={color}
                strokeWidth={strokeWidth}
                strokeOpacity={strokeOpacity}
                strokeLinecap="round"
            />

            {dots.map((dot, index) => (
                <Circle
                    key={index}
                    cx={dot.cx}
                    cy={dot.cy}
                    r={dotRadius}
                    fill={color}
                    opacity={strokeOpacity}
                />
            ))}

            {/* Head — centered horizontally in ring */}
            <Circle
                cx={13}
                cy={10.4}
                r={2.5}
                stroke={color}
                strokeWidth={strokeWidth}
                strokeOpacity={strokeOpacity}
            />

            {/* Shoulders — wide shallow U (rx=5.65, ry=0.45) */}
            <Path
                d="M 7.0 13.35 A 5.65 0.45 0 0 0 19.0 13.35"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeOpacity={strokeOpacity}
                strokeLinecap="round"
            />
        </Svg>
    );
});

export default ProfileTabIcon;
