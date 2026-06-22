import { memo } from 'react';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

const CX = 13;
const CY = 13;
const RING_R = 11;

function polar(cx, cy, r, angleDeg) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return {
        x: cx + r * Math.cos(rad),
        y: cy + r * Math.sin(rad),
    };
}

/** Small chevron arrowhead at (x,y) pointing along angleDeg (0=north, clockwise). */
function arrowHeadPath(x, y, angleDeg, length, halfAngleDeg) {
    const tip = { x, y };
    const baseR = length * 0.55;
    const left = polar(x, y, baseR, angleDeg - 180 - halfAngleDeg);
    const right = polar(x, y, baseR, angleDeg - 180 + halfAngleDeg);
    return `M ${left.x.toFixed(2)} ${left.y.toFixed(2)} L ${tip.x.toFixed(2)} ${tip.y.toFixed(2)} L ${right.x.toFixed(2)} ${right.y.toFixed(2)}`;
}

/**
 * Flip camera inside circular flip arrows — Create tab icon.
 * Stroke-only line art; tint follows tabBarActiveTintColor / tabBarInactiveTintColor.
 */
const CreateCameraTabIcon = memo(function CreateCameraTabIcon({
    size = 30,
    color = '#000000',
    focused = false,
}) {
    const strokeWidth = focused ? 1.75 : 1.3;
    const strokeOpacity = focused ? 1 : 0.72;
    const innerStroke = focused ? 1.15 : 0.85;
    const dotRadius = focused ? 0.42 : 0.36;

    const topStart = polar(CX, CY, RING_R, 315);
    const topEnd = polar(CX, CY, RING_R, 45);
    const bottomStart = polar(CX, CY, RING_R, 135);
    const bottomEnd = polar(CX, CY, RING_R, 225);

    return (
        <Svg width={size} height={size} viewBox="0 0 26 26" fill="none">
            {/* Top flip arc — gaps at east/west */}
            <Path
                d={`M ${topStart.x.toFixed(2)} ${topStart.y.toFixed(2)} A ${RING_R} ${RING_R} 0 0 1 ${topEnd.x.toFixed(2)} ${topEnd.y.toFixed(2)}`}
                stroke={color}
                strokeWidth={strokeWidth}
                strokeOpacity={strokeOpacity}
                strokeLinecap="round"
            />
            <Path
                d={arrowHeadPath(topStart.x, topStart.y, 45, 2.1, 22)}
                stroke={color}
                strokeWidth={strokeWidth}
                strokeOpacity={strokeOpacity}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <Path
                d={arrowHeadPath(topEnd.x, topEnd.y, 225, 2.1, 22)}
                stroke={color}
                strokeWidth={strokeWidth}
                strokeOpacity={strokeOpacity}
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            {/* Bottom flip arc */}
            <Path
                d={`M ${bottomStart.x.toFixed(2)} ${bottomStart.y.toFixed(2)} A ${RING_R} ${RING_R} 0 0 1 ${bottomEnd.x.toFixed(2)} ${bottomEnd.y.toFixed(2)}`}
                stroke={color}
                strokeWidth={strokeWidth}
                strokeOpacity={strokeOpacity}
                strokeLinecap="round"
            />
            <Path
                d={arrowHeadPath(bottomStart.x, bottomStart.y, 225, 2.1, 22)}
                stroke={color}
                strokeWidth={strokeWidth}
                strokeOpacity={strokeOpacity}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <Path
                d={arrowHeadPath(bottomEnd.x, bottomEnd.y, 45, 2.1, 22)}
                stroke={color}
                strokeWidth={strokeWidth}
                strokeOpacity={strokeOpacity}
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            {/* Camera body */}
            <Rect
                x={7.4}
                y={11.6}
                width={11.2}
                height={6.6}
                rx={0.75}
                stroke={color}
                strokeWidth={strokeWidth}
                strokeOpacity={strokeOpacity}
            />

            {/* Viewfinder / hot shoe */}
            <Rect
                x={10.8}
                y={9.9}
                width={4.4}
                height={1.45}
                rx={0.25}
                stroke={color}
                strokeWidth={innerStroke}
                strokeOpacity={strokeOpacity}
            />

            {/* Shutter / mode button */}
            <Rect
                x={16.9}
                y={10.55}
                width={1.45}
                height={1.45}
                rx={0.2}
                stroke={color}
                strokeWidth={innerStroke}
                strokeOpacity={strokeOpacity}
            />

            {/* Front sensor / flash pill */}
            <Ellipse
                cx={8.55}
                cy={14.5}
                rx={0.65}
                ry={0.38}
                stroke={color}
                strokeWidth={innerStroke}
                strokeOpacity={strokeOpacity}
            />

            {/* Lens — concentric rings */}
            <Circle
                cx={CX}
                cy={14.35}
                r={3.05}
                stroke={color}
                strokeWidth={strokeWidth}
                strokeOpacity={strokeOpacity}
            />
            <Circle
                cx={CX}
                cy={14.35}
                r={2.2}
                stroke={color}
                strokeWidth={innerStroke}
                strokeOpacity={strokeOpacity * 0.9}
            />
            <Circle
                cx={CX}
                cy={14.35}
                r={1.35}
                stroke={color}
                strokeWidth={innerStroke}
                strokeOpacity={strokeOpacity * 0.85}
            />
            <Circle cx={CX} cy={14.35} r={dotRadius} fill={color} opacity={strokeOpacity} />
        </Svg>
    );
});

export default CreateCameraTabIcon;
