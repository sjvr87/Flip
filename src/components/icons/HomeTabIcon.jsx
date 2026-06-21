import { memo } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

/**
 * Stylized house inside a circle — matches tab bar reference at 26px.
 * Stroke-only line art; tint follows tabBarActiveTintColor / tabBarInactiveTintColor.
 */
const HomeTabIcon = memo(function HomeTabIcon({
    size = 26,
    color = '#000000',
    focused = false,
}) {
    const strokeWidth = focused ? 1.9 : 1.5;
    const dotRadius = focused ? 0.55 : 0.48;
    const knobRadius = focused ? 0.42 : 0.36;

    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            {/* Circle — long arc with intentional gap at upper-right (~2 o'clock) */}
            <Path
                d="M17.35 6.65 A7.6 7.6 0 1 1 19.3 10.05"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
            />
            {/* Short pill segment in the gap */}
            <Path
                d="M16.05 5.55 A7.6 7.6 0 0 0 15.1 5.25"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
            />
            {/* Dot on circle at ~10 o'clock */}
            <Circle cx={5.45} cy={8.2} r={dotRadius} fill={color} />

            {/* Roof with eaves */}
            <Path
                d="M8.15 12.35 12 9.1 15.85 12.35"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {/* Left wall */}
            <Path
                d="M8.7 12.35V16.85"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
            />
            {/* Right wall */}
            <Path
                d="M15.3 12.35V16.85"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
            />
            {/* Floor */}
            <Path
                d="M8.7 16.85h6.6"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
            />
            {/* Door frame */}
            <Path
                d="M10.8 16.85v-2.55h2.4V16.85"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {/* Door panel line */}
            <Path
                d="M11.25 14.3v2.55"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
            />
            {/* Door knob */}
            <Circle cx={12.6} cy={15.6} r={knobRadius} fill={color} />
        </Svg>
    );
});

export default HomeTabIcon;
