import { memo } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

const CX = 13;
const CY = 13;
const R = 9;

/** 0° = top, clockwise positive — matches tab-bar icon convention. */
function polar(angleDeg) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return {
        x: CX + R * Math.cos(rad),
        y: CY + R * Math.sin(rad),
    };
}

function arcPath(startDeg, endDeg) {
    const start = polar(startDeg);
    const end = polar(endDeg);
    let delta = endDeg - startDeg;
    if (delta < 0) delta += 360;
    const largeArc = delta > 180 ? 1 : 0;
    return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${R} ${R} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

/**
 * Broken ring segments (clockwise from top):
 * top gap → small arc → gap → tiny arc → gap → main arc completes the circle.
 */
const RING = {
    topGapEnd: 10,
    smallArcEnd: 35,
    midGapEnd: 47,
    tinyArcEnd: 54,
    rightGapEnd: 66, // gap after dot matches 12° gap before (47−35)
    mainArcEnd: 352,
};

/**
 * House inside a broken circle — tab bar reference at 30px.
 * Stroke-only line art; tint follows tabBarActiveTintColor / tabBarInactiveTintColor.
 */
const HomeTabIcon = memo(function HomeTabIcon({
    size = 30,
    color = '#000000',
    focused = false,
}) {
    const strokeWidth = 1.3;
    const strokeOpacity = focused ? 1 : 0.72;
    const chimneyRadius = 0.58;
    const knobRadius = 0.34;

    const ringStroke = {
        stroke: color,
        strokeWidth,
        strokeOpacity,
        strokeLinecap: 'round',
    };

    return (
        <Svg width={size} height={size} viewBox="0 0 26 26" fill="none">
            {/* Main arc — lower-right around to upper-left */}
            <Path d={arcPath(RING.rightGapEnd, RING.mainArcEnd)} {...ringStroke} />
            {/* Small arc after top gap */}
            <Path d={arcPath(RING.topGapEnd, RING.smallArcEnd)} {...ringStroke} />
            {/* Tiny arc on upper-right */}
            <Path d={arcPath(RING.midGapEnd, RING.tinyArcEnd)} {...ringStroke} />

            {/* Chimney dot on left roof slope — clear of ring and roof peak */}
            <Circle cx={7.2} cy={10.35} r={chimneyRadius} fill={color} opacity={strokeOpacity} />

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
