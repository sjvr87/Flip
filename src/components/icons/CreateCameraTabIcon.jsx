import { memo } from 'react';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

/** Vintage box camera — flat vector colors traced from tab bar reference. */
const BODY_BROWN = '#C4864A';
const DARK_BROWN = '#5C3317';
const FLASH_GREY = '#C8C8C8';
const NECK_GREY = '#888888';
const BULB_GREY = '#ECECEC';
const BULB_BASE = '#666666';
const BLACK = '#000000';
const LENS_HIGHLIGHT = '#333333';

const STROKE = 1.15;

/**
 * Front-facing vintage box camera for the Create tab.
 * Keeps reference browns/greys; whole icon dims slightly when unfocused.
 */
const CreateCameraTabIcon = memo(function CreateCameraTabIcon({
    size = 37,
    focused = false,
}) {
    const opacity = focused ? 1 : 0.72;

    return (
        <Svg width={size} height={size} viewBox="0 0 26 28" fill="none" opacity={opacity}>
            {/* Left handle */}
            <Rect
                x={2.1}
                y={12.4}
                width={2.3}
                height={6.6}
                rx={1.1}
                fill={BODY_BROWN}
                stroke={BLACK}
                strokeWidth={STROKE}
            />
            <Line
                x1={4.4}
                y1={13.3}
                x2={7.4}
                y2={13.3}
                stroke={BLACK}
                strokeWidth={STROKE}
                strokeLinecap="round"
            />
            <Line
                x1={4.4}
                y1={18.1}
                x2={7.4}
                y2={18.1}
                stroke={BLACK}
                strokeWidth={STROKE}
                strokeLinecap="round"
            />

            {/* Right handle */}
            <Rect
                x={21.6}
                y={12.4}
                width={2.3}
                height={6.6}
                rx={1.1}
                fill={BODY_BROWN}
                stroke={BLACK}
                strokeWidth={STROKE}
            />
            <Line
                x1={18.6}
                y1={13.3}
                x2={21.6}
                y2={13.3}
                stroke={BLACK}
                strokeWidth={STROKE}
                strokeLinecap="round"
            />
            <Line
                x1={18.6}
                y1={18.1}
                x2={21.6}
                y2={18.1}
                stroke={BLACK}
                strokeWidth={STROKE}
                strokeLinecap="round"
            />

            {/* Base plate */}
            <Rect
                x={6.6}
                y={21.8}
                width={12.8}
                height={1.35}
                rx={0.2}
                fill={BODY_BROWN}
                stroke={BLACK}
                strokeWidth={STROKE}
            />

            {/* Main body — outer brown square */}
            <Rect
                x={7.4}
                y={10.4}
                width={11.2}
                height={11.2}
                fill={BODY_BROWN}
                stroke={BLACK}
                strokeWidth={STROKE}
            />

            {/* Recessed concentric frames */}
            <Rect
                x={8.25}
                y={11.25}
                width={9.5}
                height={9.5}
                fill={DARK_BROWN}
                stroke={BLACK}
                strokeWidth={STROKE * 0.85}
            />
            <Rect
                x={9.05}
                y={12.05}
                width={7.9}
                height={7.9}
                fill={BODY_BROWN}
                stroke={BLACK}
                strokeWidth={STROKE * 0.85}
            />
            <Rect
                x={9.85}
                y={12.85}
                width={6.3}
                height={6.3}
                fill={DARK_BROWN}
                stroke={BLACK}
                strokeWidth={STROKE * 0.85}
            />
            <Rect
                x={10.65}
                y={13.65}
                width={4.7}
                height={4.7}
                fill={BODY_BROWN}
                stroke={BLACK}
                strokeWidth={STROKE * 0.85}
            />

            {/* Lens */}
            <Circle cx={13} cy={16} r={3.35} fill={BLACK} stroke={BLACK} strokeWidth={STROKE * 0.6} />
            <Path
                d="M 11.05 14.55 A 2.2 2.2 0 0 1 13.35 12.95"
                stroke={LENS_HIGHLIGHT}
                strokeWidth={0.55}
                strokeLinecap="round"
                fill="none"
            />

            {/* Flash neck */}
            <Rect
                x={11.6}
                y={8.85}
                width={2.8}
                height={1.75}
                rx={0.25}
                fill={NECK_GREY}
                stroke={BLACK}
                strokeWidth={STROKE}
            />

            {/* Flash reflector */}
            <Circle
                cx={13}
                cy={5.15}
                r={3.85}
                fill={FLASH_GREY}
                stroke={BLACK}
                strokeWidth={STROKE}
            />

            {/* Lightbulb glass */}
            <Path
                d="M 13 2.55 C 11.35 2.55 10.35 3.75 10.35 4.95 C 10.35 6.05 11.05 6.55 11.55 7.05 L 11.55 7.45 L 14.45 7.45 L 14.45 7.05 C 14.95 6.55 15.65 6.05 15.65 4.95 C 15.65 3.75 14.65 2.55 13 2.55 Z"
                fill={BULB_GREY}
                stroke={BLACK}
                strokeWidth={STROKE * 0.75}
                strokeLinejoin="round"
            />
            {/* Screw base */}
            <Rect
                x={11.55}
                y={7.45}
                width={2.9}
                height={1.05}
                fill={BULB_BASE}
                stroke={BLACK}
                strokeWidth={STROKE * 0.65}
            />
            <Line x1={11.55} y1={7.75} x2={14.45} y2={7.75} stroke={BLACK} strokeWidth={0.45} />
            <Line x1={11.55} y1={8.05} x2={14.45} y2={8.05} stroke={BLACK} strokeWidth={0.45} />
            <Line x1={11.55} y1={8.35} x2={14.45} y2={8.35} stroke={BLACK} strokeWidth={0.45} />
            {/* Filament */}
            <Path
                d="M 12.35 5.05 C 12.35 4.35 13.65 4.35 13.65 5.05 C 13.65 5.75 12.35 5.75 12.35 5.05"
                stroke={BLACK}
                strokeWidth={0.55}
                fill="none"
                strokeLinecap="round"
            />
        </Svg>
    );
});

export default CreateCameraTabIcon;
