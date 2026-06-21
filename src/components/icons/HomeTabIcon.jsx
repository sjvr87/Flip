import { memo } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

/**
 * House inside a broken circle — tab bar reference at 26px.
 * Stroke-only line art; tint follows tabBarActiveTintColor / tabBarInactiveTintColor.
 */
const HomeTabIcon = memo(function HomeTabIcon({
    size = 26,
    color = '#000000',
    focused = false,
}) {
    const strokeWidth = focused ? 1.75 : 1.3;
    const strokeOpacity = focused ? 1 : 0.72;
    const dotRadius = focused ? 0.52 : 0.44;
    const knobRadius = focused ? 0.4 : 0.34;

    return (
        <Svg width={size} height={size} viewBox="0 0 26 26" fill="none">
            {/* Main circle arc — skips top gap and upper-right gap */}
            <Path
                d="M21.33 9.58 A9 9 0 1 1 11.24 4.48"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeOpacity={strokeOpacity}
                strokeLinecap="round"
            />
            {/* Short arc bridging the top gap */}
            <Path
                d="M14.76 4.48 A9 9 0 0 1 19.09 6.84"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeOpacity={strokeOpacity}
                strokeLinecap="round"
            />
            {/* Dash in the upper-right gap */}
            <Path
                d="M20.15 7.15 A9 9 0 0 1 20.76 8.05"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeOpacity={strokeOpacity}
                strokeLinecap="round"
            />

            {/* Decorative dot above left roof eave */}
            <Circle cx={7.4} cy={10.5} r={dotRadius} fill={color} opacity={strokeOpacity} />

            {/* Roof with eaves */}
            <Path
                d="M7.9 12.1 13 8.8 18.1 12.1"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeOpacity={strokeOpacity}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {/* Left wall */}
            <Path
                d="M8.3 12.1V17.3"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeOpacity={strokeOpacity}
                strokeLinecap="round"
            />
            {/* Right wall */}
            <Path
                d="M17.7 12.1V17.3"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeOpacity={strokeOpacity}
                strokeLinecap="round"
            />
            {/* Floor */}
            <Path
                d="M8.3 17.3h9.4"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeOpacity={strokeOpacity}
                strokeLinecap="round"
            />
            {/* Door */}
            <Path
                d="M11.7 17.3V14.5h2.6V17.3"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeOpacity={strokeOpacity}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {/* Door knob */}
            <Circle cx={13.85} cy={15.9} r={knobRadius} fill={color} opacity={strokeOpacity} />
        </Svg>
    );
});

export default HomeTabIcon;
