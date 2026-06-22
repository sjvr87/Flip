import { memo } from 'react';
import Svg, { Circle, Defs, Ellipse, Path, Rect, Text, TextPath } from 'react-native-svg';

const CX = 13;
const TOP_ARC_ID = 'createCamFlipArc';
const BOTTOM_ARC_ID = 'createCamItArc';

/**
 * FLIP (curved above) + camera (center) + IT (curved below) — Create tab icon.
 * Stroke-only line art; tint follows tabBarActiveTintColor / tabBarInactiveTintColor.
 */
const CreateCameraTabIcon = memo(function CreateCameraTabIcon({
    size = 30,
    color = '#000000',
    focused = false,
}) {
    const strokeWidth = 1.35;
    const innerStroke = 0.88;
    const strokeOpacity = focused ? 1 : 0.72;

    // Gentle arcs tucked above / below the camera — not overlapping the body.
    const flipArcD = 'M 5.4 6.7 A 7.6 2.1 0 0 1 20.6 6.7';
    const itArcD = 'M 8.4 20.4 A 4.6 1.55 0 0 0 17.6 20.4';

    return (
        <Svg width={size} height={size} viewBox="0 0 26 26" fill="none">
            <Defs>
                <Path id={TOP_ARC_ID} d={flipArcD} />
                <Path id={BOTTOM_ARC_ID} d={itArcD} />
            </Defs>

            <Text
                fill={color}
                opacity={strokeOpacity}
                fontSize={3.1}
                fontWeight="700"
                letterSpacing={0.32}
            >
                <TextPath href={`#${TOP_ARC_ID}`} startOffset="50%" textAnchor="middle">
                    FLIP
                </TextPath>
            </Text>
            <Text
                fill={color}
                opacity={strokeOpacity}
                fontSize={3.35}
                fontWeight="700"
                letterSpacing={0.38}
            >
                <TextPath href={`#${BOTTOM_ARC_ID}`} startOffset="50%" textAnchor="middle">
                    IT
                </TextPath>
            </Text>

            {/* Camera body */}
            <Rect
                x={4.1}
                y={10.4}
                width={17.8}
                height={9.1}
                rx={1}
                stroke={color}
                strokeWidth={strokeWidth}
                strokeOpacity={strokeOpacity}
            />

            {/* Viewfinder / hot shoe */}
            <Rect
                x={7.9}
                y={8.1}
                width={7.9}
                height={2.05}
                rx={0.35}
                stroke={color}
                strokeWidth={innerStroke}
                strokeOpacity={strokeOpacity}
            />

            {/* Shutter / mode button */}
            <Rect
                x={18.35}
                y={8.85}
                width={1.95}
                height={1.95}
                rx={0.25}
                stroke={color}
                strokeWidth={innerStroke}
                strokeOpacity={strokeOpacity}
            />

            {/* Front sensor / flash pill */}
            <Ellipse
                cx={5.45}
                cy={14.55}
                rx={0.85}
                ry={0.5}
                stroke={color}
                strokeWidth={innerStroke}
                strokeOpacity={strokeOpacity}
            />

            {/* Lens — concentric rings */}
            <Circle
                cx={CX}
                cy={14.85}
                r={4.2}
                stroke={color}
                strokeWidth={strokeWidth}
                strokeOpacity={strokeOpacity}
            />
            <Circle
                cx={CX}
                cy={14.85}
                r={3.05}
                stroke={color}
                strokeWidth={innerStroke}
                strokeOpacity={strokeOpacity * 0.92}
            />
            <Circle
                cx={CX}
                cy={14.85}
                r={1.82}
                stroke={color}
                strokeWidth={innerStroke}
                strokeOpacity={strokeOpacity * 0.88}
            />
            <Circle cx={CX} cy={14.85} r={0.45} fill={color} opacity={strokeOpacity} />
        </Svg>
    );
});

export default CreateCameraTabIcon;
