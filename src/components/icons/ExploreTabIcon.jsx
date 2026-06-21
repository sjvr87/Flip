import { memo } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

/**
 * Ornate compass rose — simplified for 26px tab bar.
 * Circular frame + 8-point star (long N-S, medium E-W, short diagonals).
 * Stroke/fill tint follows tabBarActiveTintColor / tabBarInactiveTintColor.
 */
const ExploreTabIcon = memo(function ExploreTabIcon({
    size = 26,
    color = '#000000',
    focused = false,
}) {
    const strokeWidth = focused ? 1.75 : 1.3;
    const strokeOpacity = focused ? 1 : 0.72;
    const hubRadius = focused ? 0.85 : 0.72;
    const dimOpacity = strokeOpacity * 0.55;
    const midOpacity = strokeOpacity * 0.78;

    return (
        <Svg width={size} height={size} viewBox="0 0 26 26" fill="none">
            {/* Outer ring */}
            <Circle
                cx={13}
                cy={13}
                r={9.6}
                stroke={color}
                strokeWidth={strokeWidth}
                strokeOpacity={strokeOpacity}
            />

            {/* N-S cardinal needles — faceted halves for vertical emphasis */}
            <Path
                d="M13 4.15 11.35 12.2 13 13 14.65 12.2Z"
                fill={color}
                opacity={strokeOpacity}
            />
            <Path
                d="M13 21.85 11.35 13.8 13 13 14.65 13.8Z"
                fill={color}
                opacity={dimOpacity}
            />

            {/* E-W cardinal accents — medium length */}
            <Path
                d="M20.35 13 12.3 11.55 13 13 12.3 14.45Z"
                fill={color}
                opacity={midOpacity}
            />
            <Path
                d="M5.65 13 13.7 14.45 13 13 13.7 11.55Z"
                fill={color}
                opacity={midOpacity}
            />

            {/* Ordinal diagonals — short points */}
            <Path
                d="M17.05 8.95 12.55 11.85 13 13 14.05 12.05Z"
                fill={color}
                opacity={dimOpacity}
            />
            <Path
                d="M17.05 17.05 14.05 13.95 13 13 12.55 14.15Z"
                fill={color}
                opacity={dimOpacity}
            />
            <Path
                d="M8.95 17.05 11.95 13.95 13 13 11.45 14.15Z"
                fill={color}
                opacity={dimOpacity}
            />
            <Path
                d="M8.95 8.95 11.45 11.85 13 13 11.95 12.05Z"
                fill={color}
                opacity={dimOpacity}
            />

            {/* N-S center needle line */}
            <Path
                d="M13 4.6V21.4"
                stroke={color}
                strokeWidth={focused ? 0.55 : 0.42}
                strokeOpacity={strokeOpacity}
                strokeLinecap="round"
            />

            {/* Center hub */}
            <Circle cx={13} cy={13} r={hubRadius} fill={color} opacity={strokeOpacity} />
        </Svg>
    );
});

export default ExploreTabIcon;
