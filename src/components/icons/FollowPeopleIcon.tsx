import { memo } from 'react';
import Svg, { Circle, G, Path } from 'react-native-svg';

type FollowPeopleIconProps = {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    color?: string;
    strokeWidth?: number;
};

/** Bust paths only — embed inside a parent Svg via FollowPeopleGroup. */
export function FollowPeoplePaths({
    color = '#000000',
    strokeWidth = 1.25,
}: Pick<FollowPeopleIconProps, 'color' | 'strokeWidth'>) {
    return (
        <>
            {/* Back-left (smallest) */}
            <Circle cx={5} cy={5.4} r={2.1} stroke={color} strokeWidth={strokeWidth} />
            <Path
                d="M2.5 8.1Q5 11 7.5 8.1"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
            />

            {/* Middle */}
            <Circle cx={10.5} cy={5} r={2.45} stroke={color} strokeWidth={strokeWidth} />
            <Path
                d="M7.4 7.9Q10.5 11.3 13.6 7.9"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
            />

            {/* Front-right (largest) */}
            <Circle cx={16.5} cy={4.8} r={2.85} stroke={color} strokeWidth={strokeWidth} />
            <Path
                d="M12.7 8.1Q16.5 12.2 20.3 8.1"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
            />
        </>
    );
}

/** Group wrapper for embedding in MailboxTabIcon. */
export function FollowPeopleGroup({
    x = 0,
    y = 0,
    scale = 0.48,
    color = '#000000',
    strokeWidth = 1.25,
}: Pick<FollowPeopleIconProps, 'x' | 'y' | 'color' | 'strokeWidth'> & { scale?: number }) {
    return (
        <G transform={`translate(${x}, ${y}) scale(${scale})`}>
            <FollowPeoplePaths color={color} strokeWidth={strokeWidth} />
        </G>
    );
}

/**
 * Three overlapping bust silhouettes (outline) — back-left smallest, front-right largest.
 * No speech bubble; matches mailbox tab reference for unread follow notifications.
 */
const FollowPeopleIcon = memo(function FollowPeopleIcon({
    x,
    y,
    width = 11,
    height = 9,
    color = '#000000',
    strokeWidth = 1.25,
}: FollowPeopleIconProps) {
    return (
        <Svg x={x} y={y} width={width} height={height} viewBox="0 0 22 14" fill="none">
            <FollowPeoplePaths color={color} strokeWidth={strokeWidth} />
        </Svg>
    );
});

export default FollowPeopleIcon;
