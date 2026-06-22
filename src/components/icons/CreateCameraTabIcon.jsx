import { memo } from 'react';
import Svg, { Circle, Defs, Ellipse, Path, Rect, Text, TextPath } from 'react-native-svg';

const CX = 13;
const TOP_ARC_ID = 'createCamFlipArc';
const BOTTOM_ARC_ID = 'createCamItArc';

/**
 * FLIP (curved above) + camera (center) + IT (curved below) — Create tab icon.
 * Taller 26×30 viewBox centers in the 42px tab slot; stroke-only line art.
 */
const CreateCameraTabIcon = memo(function CreateCameraTabIcon({
    size = 30,
    color = '#000000',
    focused = false,
}) {
    const strokeWidth = 1.35;
    const innerStroke = 0.88;
    const strokeOpacity = focused ? 1 : 0.72;

    // Arcs centered on CX=13; endpoints equidistant from center for true horizontal centering.
    const flipArcD = 'M 3.2 3.6 A 9.8 2.35 0 0 1 22.8 3.6';
    const itArcD = 'M 5.4 24.0 A 7.6 1.75 0 0 0 20.6 24.0';

    const lensCy = 15.4;
    const lensR = 4.85;

    return (
        <Svg width={size} height={size} viewBox="0 0 26 30" fill="none">
            <Defs>
                <Path id={TOP_ARC_ID} d={flipArcD} />
                <Path id={BOTTOM_ARC_ID} d={itArcD} />
            </Defs>

            <Text
                fill={color}
                opacity={strokeOpacity}
                fontSize={3.55}
                fontWeight="700"
                letterSpacing={0.34}
            >
                <TextPath href={`#${TOP_ARC_ID}`} startOffset="50%" textAnchor="middle">
                    FLIP
                </TextPath>
            </Text>
            <Text
                fill={color}
                opacity={strokeOpacity}
                fontSize={3.55}
                fontWeight="700"
                letterSpacing={0.4}
            >
                <TextPath href={`#${BOTTOM_ARC_ID}`} startOffset="50%" textAnchor="middle">
                    IT
                </TextPath>
            </Text>

            {/* Camera body — scaled to match other tab icon visual weight */}
            <Rect
                x={3.2}
                y={9.4}
                width={19.6}
                height={10.8}
                rx={1}
                stroke={color}
                strokeWidth={strokeWidth}
                strokeOpacity={strokeOpacity}
            />

            {/* Viewfinder / hot shoe */}
            <Rect
                x={6.8}
                y={7.6}
                width={9.4}
                height={2.4}
                rx={0.35}
                stroke={color}
                strokeWidth={innerStroke}
                strokeOpacity={strokeOpacity}
            />

            {/* Shutter / mode button */}
            <Rect
                x={18.75}
                y={8.35}
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
                cy={15.1}
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
                r={3.55}
                stroke={color}
                strokeWidth={innerStroke}
                strokeOpacity={strokeOpacity * 0.92}
            />
            <Circle
                cx={CX}
                cy={lensCy}
                r={2.1}
                stroke={color}
                strokeWidth={innerStroke}
                strokeOpacity={strokeOpacity * 0.88}
            />
            <Circle cx={CX} cy={lensCy} r={0.48} fill={color} opacity={strokeOpacity} />
        </Svg>
    );
});

export default CreateCameraTabIcon;
