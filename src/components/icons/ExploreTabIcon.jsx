import { memo } from 'react';
import Svg, { Circle, Line, Path } from 'react-native-svg';

const CX = 13;
const CY = 13;

function polar(cx, cy, r, angleDeg) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return {
        x: cx + r * Math.cos(rad),
        y: cy + r * Math.sin(rad),
    };
}

function wedgePath(cx, cy, angleDeg, length, halfAngleDeg) {
    const baseR = 1.15;
    const tip = polar(cx, cy, length, angleDeg);
    const left = polar(cx, cy, baseR, angleDeg - halfAngleDeg);
    const right = polar(cx, cy, baseR, angleDeg + halfAngleDeg);
    return `M ${left.x.toFixed(2)} ${left.y.toFixed(2)} L ${tip.x.toFixed(2)} ${tip.y.toFixed(2)} L ${right.x.toFixed(2)} ${right.y.toFixed(2)} Z`;
}

/** 8-point compass star — long N/S, medium E/W, short diagonals. */
const STAR_RAYS = [
    { angle: 0, length: 10.6, halfAngle: 13 },
    { angle: 180, length: 10.6, halfAngle: 13 },
    { angle: 90, length: 9, halfAngle: 14 },
    { angle: 270, length: 9, halfAngle: 14 },
    { angle: 45, length: 5.9, halfAngle: 11 },
    { angle: 135, length: 5.9, halfAngle: 11 },
    { angle: 225, length: 5.9, halfAngle: 11 },
    { angle: 315, length: 5.9, halfAngle: 11 },
];

const TICK_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

/**
 * Compass rose tab icon — stroke + fill line art at 30px.
 * Tint follows tabBarActiveTintColor / tabBarInactiveTintColor.
 */
const ExploreTabIcon = memo(function ExploreTabIcon({
    size = 30,
    color = '#000000',
    focused = false,
}) {
    const strokeWidth = focused ? 1.75 : 1.3;
    const strokeOpacity = focused ? 1 : 0.72;
    const innerStroke = focused ? 1.15 : 0.85;
    const hubRadius = focused ? 1.15 : 1.0;
    const tickInner = 6.55;
    const tickOuter = 7.35;

    return (
        <Svg width={size} height={size} viewBox="0 0 26 26" fill="none">
            {STAR_RAYS.map(({ angle, length, halfAngle }) => (
                <Path
                    key={angle}
                    d={wedgePath(CX, CY, angle, length, halfAngle)}
                    fill={color}
                    opacity={strokeOpacity}
                />
            ))}

            <Circle
                cx={CX}
                cy={CY}
                r={9}
                stroke={color}
                strokeWidth={strokeWidth}
                strokeOpacity={strokeOpacity}
            />
            <Circle
                cx={CX}
                cy={CY}
                r={6.35}
                stroke={color}
                strokeWidth={innerStroke}
                strokeOpacity={strokeOpacity * 0.85}
            />

            {TICK_ANGLES.map((angle) => {
                const inner = polar(CX, CY, tickInner, angle);
                const outer = polar(CX, CY, tickOuter, angle);
                return (
                    <Line
                        key={`tick-${angle}`}
                        x1={inner.x}
                        y1={inner.y}
                        x2={outer.x}
                        y2={outer.y}
                        stroke={color}
                        strokeWidth={focused ? 1.1 : 0.85}
                        strokeOpacity={strokeOpacity}
                        strokeLinecap="round"
                    />
                );
            })}

            <Circle cx={CX} cy={CY} r={hubRadius} fill={color} opacity={strokeOpacity} />
        </Svg>
    );
});

export default ExploreTabIcon;
