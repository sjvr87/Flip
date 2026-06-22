import { memo } from 'react';
import Svg, { Circle, Defs, Ellipse, Path, Rect, Text, TextPath } from 'react-native-svg';

const CX = 13;
const CY = 13;
const TEXT_R = 10.55;
const TEXT_LEFT = CX - TEXT_R;
const TEXT_RIGHT = CX + TEXT_R;

const TOP_ARC_ID = 'createCamTopArc';
const BOTTOM_ARC_ID = 'createCamBottomArc';

/**
 * Camera with FLIP / IT curved text — Create tab icon.
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

    const topArcD = `M ${TEXT_LEFT.toFixed(2)} ${CY} A ${TEXT_R} ${TEXT_R} 0 0 1 ${TEXT_RIGHT.toFixed(2)} ${CY}`;
    const bottomArcD = `M ${TEXT_LEFT.toFixed(2)} ${CY} A ${TEXT_R} ${TEXT_R} 0 0 0 ${TEXT_RIGHT.toFixed(2)} ${CY}`;

    return (
        <Svg width={size} height={size} viewBox="0 0 26 26" fill="none">
            <Defs>
                <Path id={TOP_ARC_ID} d={topArcD} />
                <Path id={BOTTOM_ARC_ID} d={bottomArcD} />
            </Defs>

            <Text
                fill={color}
                opacity={strokeOpacity}
                fontSize={3.55}
                fontWeight="700"
                letterSpacing={0.38}
            >
                <TextPath href={`#${TOP_ARC_ID}`} startOffset="50%" textAnchor="middle">
                    FLIP
                </TextPath>
            </Text>
            <Text
                fill={color}
                opacity={strokeOpacity}
                fontSize={3.85}
                fontWeight="700"
                letterSpacing={0.45}
            >
                <TextPath href={`#${BOTTOM_ARC_ID}`} startOffset="50%" textAnchor="middle">
                    IT
                </TextPath>
            </Text>

            {/* Camera body */}
            <Rect
                x={5.5}
                y={11.1}
                width={15}
                height={7.8}
                rx={0.9}
                stroke={color}
                strokeWidth={strokeWidth}
                strokeOpacity={strokeOpacity}
            />

            {/* Viewfinder / hot shoe */}
            <Rect
                x={9.2}
                y={9.25}
                width={6.6}
                height={1.7}
                rx={0.3}
                stroke={color}
                strokeWidth={innerStroke}
                strokeOpacity={strokeOpacity}
            />

            {/* Shutter / mode button */}
            <Rect
                x={17.55}
                y={9.95}
                width={1.65}
                height={1.65}
                rx={0.22}
                stroke={color}
                strokeWidth={innerStroke}
                strokeOpacity={strokeOpacity}
            />

            {/* Front sensor / flash pill */}
            <Ellipse
                cx={6.75}
                cy={14.9}
                rx={0.78}
                ry={0.45}
                stroke={color}
                strokeWidth={innerStroke}
                strokeOpacity={strokeOpacity}
            />

            {/* Lens — concentric rings */}
            <Circle
                cx={CX}
                cy={15}
                r={3.75}
                stroke={color}
                strokeWidth={strokeWidth}
                strokeOpacity={strokeOpacity}
            />
            <Circle
                cx={CX}
                cy={15}
                r={2.7}
                stroke={color}
                strokeWidth={innerStroke}
                strokeOpacity={strokeOpacity * 0.92}
            />
            <Circle
                cx={CX}
                cy={15}
                r={1.62}
                stroke={color}
                strokeWidth={innerStroke}
                strokeOpacity={strokeOpacity * 0.88}
            />
            <Circle cx={CX} cy={15} r={0.42} fill={color} opacity={strokeOpacity} />
        </Svg>
    );
});

export default CreateCameraTabIcon;
