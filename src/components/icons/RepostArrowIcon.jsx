import { LOOP_ACCENT } from '@/constants/loopsPalette';
import { memo } from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

/** Design-space canvas — feed repost button renders at this size. */
export const REPOST_ARROW_DESIGN_SIZE = 28;

const VIEWBOX = `0 0 ${REPOST_ARROW_DESIGN_SIZE} ${REPOST_ARROW_DESIGN_SIZE}`;

/** Medium stroke traced from reference (~2.2px at 28×28). */
const STROKE_WIDTH = 2.2;
const ACTIVE_STROKE_WIDTH = 2.45;

const STROKE_PROPS = {
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    fill: 'none',
};

/**
 * U-turn return arrow traced from reference PNG:
 * short top bar L→R → 90° down → 90° left → chevron arrowhead pointing left.
 */
const MAIN_PATH = 'M 9 6 H 16 V 17 H 10';
const ARROWHEAD_PATH = 'M 10 12 L 4 17 L 10 22';

function RepostArrowSvg({ color, strokeWidth }) {
    return (
        <Svg
            width={REPOST_ARROW_DESIGN_SIZE}
            height={REPOST_ARROW_DESIGN_SIZE}
            viewBox={VIEWBOX}
            fill="none">
            <Path
                d={MAIN_PATH}
                stroke={color}
                strokeWidth={strokeWidth}
                {...STROKE_PROPS}
            />
            <Path
                d={ARROWHEAD_PATH}
                stroke={color}
                strokeWidth={strokeWidth}
                {...STROKE_PROPS}
            />
        </Svg>
    );
}

/**
 * Hollow U-turn repost arrow — white outline on video, accent when active.
 */
const RepostArrowIcon = memo(function RepostArrowIcon({
    size = REPOST_ARROW_DESIGN_SIZE,
    color = '#FFFFFF',
    active = false,
    activeColor = LOOP_ACCENT,
}) {
    const strokeColor = active ? activeColor : color;
    const strokeWidth = active ? ACTIVE_STROKE_WIDTH : STROKE_WIDTH;

    if (size === REPOST_ARROW_DESIGN_SIZE) {
        return <RepostArrowSvg color={strokeColor} strokeWidth={strokeWidth} />;
    }

    const scale = size / REPOST_ARROW_DESIGN_SIZE;

    return (
        <View
            style={{
                width: size,
                height: size,
                alignItems: 'center',
                justifyContent: 'center',
            }}>
            <View style={{ transform: [{ scale }] }}>
                <RepostArrowSvg color={strokeColor} strokeWidth={strokeWidth} />
            </View>
        </View>
    );
});

export default RepostArrowIcon;
