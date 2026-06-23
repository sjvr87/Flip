import { memo } from 'react';
import Svg, { Circle, Ellipse, Rect, Text } from 'react-native-svg';

const CX = 13;

/** Shared label styling — smaller caps avoid top clip; wider tracking preserves width. */
const LABEL_FONT_SIZE = 5.0;
const LABEL_LETTER_SPACING = 0.72;

/**
 * FLIP (above) + camera (center) + IT (below) — Create tab icon.
 * Square 26×26 viewBox matches other tab icons; camera scaled to same visual weight.
 */
const CreateCameraTabIcon = memo(function CreateCameraTabIcon({
    size = 30,
    color = '#000000',
    focused = false,
}) {
    const strokeWidth = focused ? 1.75 : 1.3;
    const innerStroke = focused ? 1.1 : 0.85;
    const strokeOpacity = focused ? 1 : 0.72;

    const lensCy = 13.5;
    const lensR = 5.2;

    return (
        <Svg width={size} height={size} viewBox="0 0 26 26" fill="none">
            <Text
                x={CX}
                y={3.7}
                fill={color}
                opacity={strokeOpacity}
                fontSize={LABEL_FONT_SIZE}
                fontWeight="700"
                letterSpacing={LABEL_LETTER_SPACING}
                textAnchor="middle">
                FLIP
            </Text>

            {/* Camera body — scaled to match other tab icon visual weight */}
            <Rect
                x={2.6}
                y={7.5}
                width={20.8}
                height={12.0}
                rx={1.1}
                stroke={color}
                strokeWidth={strokeWidth}
                strokeOpacity={strokeOpacity}
            />

            {/* Viewfinder / hot shoe */}
            <Rect
                x={6.2}
                y={5.7}
                width={10.2}
                height={2.1}
                rx={0.35}
                stroke={color}
                strokeWidth={innerStroke}
                strokeOpacity={strokeOpacity}
            />

            {/* Shutter / mode button */}
            <Rect
                x={19.2}
                y={6.2}
                width={2.3}
                height={2.3}
                rx={0.25}
                stroke={color}
                strokeWidth={innerStroke}
                strokeOpacity={strokeOpacity}
            />

            {/* Front sensor / flash pill */}
            <Ellipse
                cx={4.5}
                cy={13.3}
                rx={1.0}
                ry={0.58}
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
                r={3.85}
                stroke={color}
                strokeWidth={innerStroke}
                strokeOpacity={strokeOpacity * 0.92}
            />
            <Circle
                cx={CX}
                cy={lensCy}
                r={2.25}
                stroke={color}
                strokeWidth={innerStroke}
                strokeOpacity={strokeOpacity * 0.88}
            />
            <Circle cx={CX} cy={lensCy} r={0.55} fill={color} opacity={strokeOpacity} />

            <Text
                x={CX}
                y={25.0}
                fill={color}
                opacity={strokeOpacity}
                fontSize={LABEL_FONT_SIZE}
                fontWeight="700"
                letterSpacing={LABEL_LETTER_SPACING}
                textAnchor="middle">
                IT
            </Text>
        </Svg>
    );
});

export default CreateCameraTabIcon;
