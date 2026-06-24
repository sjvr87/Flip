import { memo } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

type FollowAddBadgeIconProps = {
    size?: number;
};

/**
 * Person + plus badge on feed avatars when not following.
 * Solid white/cyan glyphs on a dark ring for visibility on any avatar.
 */
const FollowAddBadgeIcon = memo(function FollowAddBadgeIcon({ size = 22 }: FollowAddBadgeIconProps) {
    return (
        <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
            <Circle cx={11} cy={11} r={10} fill="#06B6D4" />
            <Circle cx={11} cy={11} r={9.25} fill="#0891B2" />

            <Path
                d="M5.4 5.4 H7.8 M6.6 4.6 V6.6"
                stroke="#FFFFFF"
                strokeWidth={1.5}
                strokeLinecap="round"
            />

            <Circle cx={12.2} cy={9.8} r={2.85} stroke="#FFFFFF" strokeWidth={1.35} />
            <Path
                d="M8.1 15.4 Q12.2 17.9 16.3 15.4"
                stroke="#FFFFFF"
                strokeWidth={1.35}
                strokeLinecap="round"
            />
        </Svg>
    );
});

export default FollowAddBadgeIcon;
