import { memo } from 'react';
import Svg, { Path } from 'react-native-svg';

/**
 * Stylized house inside a circle — matches tab bar reference at 26px.
 * Stroke-only line art; tint follows tabBarActiveTintColor / tabBarInactiveTintColor.
 */
const HomeTabIcon = memo(function HomeTabIcon({
    size = 26,
    color = '#000000',
    focused = false,
}) {
    const strokeWidth = focused ? 1.85 : 1.55;

    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            {/* Circle with a small gap at the upper-right */}
            <Path
                d="M12 3.25a8.75 8.75 0 1 0 7.35 12.1"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
            />
            {/* Roof */}
            <Path
                d="M8.25 12.75 12 9.25l3.75 3.5"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {/* Left wall */}
            <Path
                d="M9 12.75V17"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
            />
            {/* Right wall */}
            <Path
                d="M15 12.75V17"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
            />
            {/* Floor */}
            <Path
                d="M9 17h6"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
            />
            {/* Door */}
            <Path
                d="M11.15 17v-2.35h1.7V17"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </Svg>
    );
});

export default HomeTabIcon;
