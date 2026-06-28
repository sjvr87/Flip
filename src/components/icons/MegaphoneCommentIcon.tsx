import { ACTIVITY_COMMENT_BADGE_SIZE } from '@/utils/avatarShape';
import { memo } from 'react';
import { View, type ViewStyle } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';

/** Matches feed action rail `ICON_SLOT` (30px). */
export const MEGAPHONE_COMMENT_DESIGN_SIZE = 30;
/** Activity notifications — sits off the avatar corner (position in NotificationItem). */
export const MEGAPHONE_COMMENT_ACTIVITY_SIZE = ACTIVITY_COMMENT_BADGE_SIZE;

/** Feed `CommentActionIcon` optical tuning — figure only, no sound arcs in the clipped slot. */
export const MEGAPHONE_COMMENT_OPTICAL_SCALE = 1.17;
export const MEGAPHONE_COMMENT_OPTICAL_OFFSET_X = 5;

type MegaphoneCommentIconProps = {
    size?: number;
    color?: string;
};

const VIEW = 24;
/** Figure + megaphone only (feed clips this inside a square slot). */
const VIEW_BOX = '0 -3.5 33 27';

const HEAD = { cx: 13.6, cy: 3.25, r: 2.28 };

const TORSO_PATH = [
    'M 11.0 7.45',
    'L 15.9 6.75',
    'L 14.6 14.4',
    'L 10.2 15.0',
    'Z',
].join(' ');

const RAISED_ARM_PATH = [
    'M 13.5 8.0',
    'L 11.0 4.5',
    'L 8.3 2.0',
    'L 7.2 1.65',
    'L 6.5 2.3',
    'L 9.0 4.8',
    'L 11.5 8.3',
    'Z',
].join(' ');

const HOLDING_UPPER_ARM_PATH = [
    'M 15.9 6.75',
    'L 17.0 8.0',
    'L 23.0 7.2',
    'L 21.8 6.0',
    'L 15.3 5.9',
    'Z',
].join(' ');

const HOLDING_FOREARM_PATH = [
    'M 21.8 6.0',
    'L 23.0 7.2',
    'L 18.2 2.5',
    'L 17.2 1.7',
    'L 17.8 1.2',
    'L 19.0 2.0',
    'Z',
].join(' ');

const MEGAPHONE_PATH = [
    'M 16.8 1.8',
    'L 29.0 -3.0',
    'L 27.5 4.8',
    'L 16.8 4.2',
    'Z',
].join(' ');

const LEFT_LEG_PATH = [
    'M 10.45 14.55',
    'L 10.2 15.0',
    'L 9.28 14.72',
    'L 8.45 20.8',
    'L 6.8 20.8',
    'L 5.8 21.2',
    'L 7.0 22.2',
    'L 9.6 22.2',
    'L 10.45 15.35',
    'Z',
].join(' ');

const RIGHT_LEG_PATH = [
    'M 14.35 14.55',
    'L 14.6 14.4',
    'L 15.52 14.72',
    'L 16.35 20.8',
    'L 18.0 20.8',
    'L 19.0 21.2',
    'L 17.8 22.2',
    'L 15.2 22.2',
    'L 14.35 15.35',
    'Z',
].join(' ');

/**
 * Person-with-megaphone silhouette — feed comment button.
 * Rendered mirrored so megaphone sits on the left; no sound-wave arcs (feed slot clips to figure).
 */
const MegaphoneCommentIcon = memo(function MegaphoneCommentIcon({
    size = MEGAPHONE_COMMENT_DESIGN_SIZE,
    color = '#FFFFFF',
}: MegaphoneCommentIconProps) {
    return (
        <Svg width={size} height={size} viewBox={VIEW_BOX} fill="none">
            <G transform={`translate(${VIEW}, 0) scale(-1, 1)`}>
                <Path d={LEFT_LEG_PATH} fill={color} />
                <Path d={RIGHT_LEG_PATH} fill={color} />
                <Path d={TORSO_PATH} fill={color} />
                <Path d={RAISED_ARM_PATH} fill={color} />
                <Path d={HOLDING_UPPER_ARM_PATH} fill={color} />
                <Path d={HOLDING_FOREARM_PATH} fill={color} />
                <Path d={MEGAPHONE_PATH} fill={color} />
                <Circle cx={HEAD.cx} cy={HEAD.cy} r={HEAD.r} fill={color} />
            </G>
        </Svg>
    );
});

type MegaphoneCommentIconSlotProps = {
    size?: number;
    color?: string;
    style?: ViewStyle;
};

/**
 * Same clipped optical framing as feed `CommentActionIcon` (scale + offset inside overflow hidden).
 * Use this anywhere the comment icon must match the video feed exactly.
 */
export const MegaphoneCommentIconSlot = memo(function MegaphoneCommentIconSlot({
    size = MEGAPHONE_COMMENT_DESIGN_SIZE,
    color = '#FFFFFF',
    style,
}: MegaphoneCommentIconSlotProps) {
    const offsetX = (MEGAPHONE_COMMENT_OPTICAL_OFFSET_X / MEGAPHONE_COMMENT_DESIGN_SIZE) * size;

    return (
        <View
            style={[
                {
                    width: size,
                    height: size,
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                },
                style,
            ]}>
            <View
                style={{
                    alignItems: 'center',
                    justifyContent: 'center',
                    transform: [
                        { translateX: offsetX },
                        { scale: MEGAPHONE_COMMENT_OPTICAL_SCALE },
                    ],
                }}>
                <MegaphoneCommentIcon size={size} color={color} />
            </View>
        </View>
    );
});

export default MegaphoneCommentIcon;
