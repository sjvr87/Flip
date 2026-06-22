import { memo } from 'react';
import Svg, { Circle, Ellipse, Rect, Text } from 'react-native-svg';

const CX = 13;

/**
 * FLIP (above) + camera (center) + IT (below) — Create tab icon.
 * Taller viewBox fits straight labels without clipping; stroke-only line art.
 */
const CreateCameraTabIcon = memo(function CreateCameraTabIcon({
    size = 30,
    color = '#000000',
    focused = false,
}) {
    const strokeWidth = 1.35;
    const innerStroke = 0.88;
    const strokeOpacity = focused ? 1 : 0.72;

    const lensCy = 17.8;
    const lensR = 4.6;

    return (
        <Svg width={size} height={size} viewBox="0 0 26 36" fill="none">
            <Text
                x={CX}
                y={7.2}
                fill={color}
                opacity={strokeOpacity}
                fontSize={6.6}
                fontWeight="700"
                letterSpacing={0.28}
                textAnchor="middle"
            >
                FLIP
            </Text>

            {/* Camera body — scaled to match other tab icon visual weight */}
            <Rect
                x={3.2}
                y={11.8}
                width={19.6}
                height={10.2}
                rx={1}
                stroke={color}
                strokeWidth={strokeWidth}
                strokeOpacity={strokeOpacity}
            />

            {/* Viewfinder / hot shoe */}
            <Rect
                x={6.8}
                y={10.0}
                width={9.4}
                height={2.2}
                rx={0.35}
                stroke={color}
                strokeWidth={innerStroke}
                strokeOpacity={strokeOpacity}
            />

            {/* Shutter / mode button */}
            <Rect
                x={18.75}
                y={10.55}
                width={2.15}
                height={2.15}
                rx={0.25}
                stroke={color}
                strokeWidth={innerStroke}
                strokeOpacity={strokeOpacity}
            />

            {/* Front sensor / flash pill */}
            <Ellipse
                cx={5.05}
                cy={17.5}
                rx={0.9}
                ry={0.52}
                stroke={color}
                strokeWidth={innerStroke}
                strokeOpacity={strokeOpacity}
            />

            {/* Lens — concentric rings */}
            <Circle
                cx={CX}
                cy={lensCy}
                r={lensR}
                stroke={color}
                strokeWidth={strokeWidth}
                strokeOpacity={strokeOpacity}
            />
            <Circle
                cx={CX}
                cy={lensCy}
                r={3.35}
                stroke={color}
                strokeWidth={innerStroke}
                strokeOpacity={strokeOpacity * 0.92}
            />
            <Circle
                cx={CX}
                cy={lensCy}
                r={1.95}
                stroke={color}
                strokeWidth={innerStroke}
                strokeOpacity={strokeOpacity * 0.88}
            />
            <Circle cx={CX} cy={lensCy} r={0.48} fill={color} opacity={strokeOpacity} />

            <Text
                x={CX}
                y={33.4}
                fill={color}
                opacity={strokeOpacity}
                fontSize={6.6}
                fontWeight="700"
                letterSpacing={0.36}
                textAnchor="middle"
            >
                IT
            </Text>
        </Svg>
    );
});

export default CreateCameraTabIcon;
