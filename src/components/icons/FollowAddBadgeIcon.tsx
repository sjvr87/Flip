import { memo } from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

type FollowAddBadgeIconProps = {
    size?: number;
};

/**
 * Watercolor-style person + plus badge — shown on feed avatar when not following.
 * Traced from user reference (person silhouette, + upper-left, soft gradient wash).
 */
const FollowAddBadgeIcon = memo(function FollowAddBadgeIcon({ size = 22 }: FollowAddBadgeIconProps) {
    return (
        <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
            <Defs>
                <LinearGradient id="followBadgeWash" x1="2" y1="2" x2="20" y2="20">
                    <Stop offset="0" stopColor="#5EEAD4" />
                    <Stop offset="0.42" stopColor="#67E8F9" />
                    <Stop offset="1" stopColor="#C4B5FD" />
                </LinearGradient>
                <LinearGradient id="followBadgeIcon" x1="6" y1="5" x2="16" y2="17">
                    <Stop offset="0" stopColor="#0E7490" />
                    <Stop offset="0.55" stopColor="#0891B2" />
                    <Stop offset="1" stopColor="#7C3AED" />
                </LinearGradient>
            </Defs>

            <Circle cx={11} cy={11} r={10} fill="url(#followBadgeWash)" />
            <Circle cx={4.2} cy={6.2} r={0.75} fill="#0E7490" opacity={0.35} />
            <Circle cx={17.5} cy={7} r={0.55} fill="#7C3AED" opacity={0.3} />
            <Circle cx={16.8} cy={16.2} r={0.65} fill="#0891B2" opacity={0.28} />

            <Path
                d="M5.2 5.2 H7.6 M6.4 4.4 V6.4"
                stroke="url(#followBadgeIcon)"
                strokeWidth={1.35}
                strokeLinecap="round"
            />

            <Circle
                cx={12.1}
                cy={9.9}
                r={3}
                stroke="url(#followBadgeIcon)"
                strokeWidth={1.25}
            />
            <Path
                d="M7.8 15.8 Q12.1 18.6 16.4 15.8"
                stroke="url(#followBadgeIcon)"
                strokeWidth={1.25}
                strokeLinecap="round"
            />
        </Svg>
    );
});

export default FollowAddBadgeIcon;
