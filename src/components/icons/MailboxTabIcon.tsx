import { FollowPeopleGroup } from '@/components/icons/FollowPeopleIcon';
import { Image } from 'expo-image';
import { memo } from 'react';
import { View, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

export type MailboxIconState = 'allRead' | 'messages' | 'likes' | 'follows';

type MailboxTabIconProps = {
    size?: number;
    color?: string;
    focused?: boolean;
    state?: MailboxIconState;
};

const MAILBOX_MESSAGES = require('../../../assets/images/mailbox-tab-reference.png');
const MAILBOX_EMPTY = require('../../../assets/images/mailbox-tab-empty.png');
const MAILBOX_UNREAD_BASE = require('../../../assets/images/mailbox-tab-unread-base.png');

/** Envelope slot on the reference art — fraction of icon box. */
const SLOT = { left: 0.17, top: 0.04, width: 0.33, height: 0.58 } as const;

/** Folded ribbon heart overlay for unread likes. */
function FoldedHeart({ size }: { size: number }) {
    const slotW = size * SLOT.width;
    const slotH = size * SLOT.height;
    return (
        <Svg
            width={slotW}
            height={slotH}
            viewBox="0 0 20 18"
            fill="none"
            style={{
                position: 'absolute',
                left: size * SLOT.left,
                top: size * SLOT.top,
            }}>
            <Defs>
                <LinearGradient id="mailboxHeartGrad" x1="2" y1="16" x2="18" y2="2">
                    <Stop offset="0" stopColor="#C0005A" />
                    <Stop offset="1" stopColor="#FF1E6D" />
                </LinearGradient>
            </Defs>
            <Path
                d="M10 16.2S1.5 11.2 1.5 6.4C1.5 3.8 3.5 2 5.8 2c1.4 0 2.7.7 3.5 1.8.8-1.1 2.1-1.8 3.5-1.8 2.3 0 4.3 1.8 4.3 4.4 0 4.8-8.5 9.8-8.5 9.8z"
                fill="url(#mailboxHeartGrad)"
            />
            <Path d="M10 5.2 12.8 8.6 10 11.2 7.2 8.6Z" fill="#C0005A" opacity={0.55} />
        </Svg>
    );
}

/**
 * Inbox tab icon — user reference PNG at 26px for exact mailbox fidelity.
 * Priority when multiple unread: messages > likes > follows.
 */
const MailboxTabIcon = memo(function MailboxTabIcon({
    size = 26,
    focused = false,
    state = 'allRead',
}: MailboxTabIconProps) {
    const opacity = focused ? 1 : 0.72;
    const imageStyle: ViewStyle = { width: size, height: size, opacity };

    if (state === 'messages') {
        return (
            <Image
                source={MAILBOX_MESSAGES}
                style={imageStyle}
                contentFit="contain"
                accessibilityIgnoresInvertColors
            />
        );
    }

    if (state === 'allRead') {
        return (
            <Image
                source={MAILBOX_EMPTY}
                style={imageStyle}
                contentFit="contain"
                accessibilityIgnoresInvertColors
            />
        );
    }

    return (
        <View style={{ width: size, height: size }}>
            <Image
                source={MAILBOX_UNREAD_BASE}
                style={imageStyle}
                contentFit="contain"
                accessibilityIgnoresInvertColors
            />
            {state === 'likes' ? <FoldedHeart size={size} /> : null}
            {state === 'follows' ? (
                <Svg
                    width={size}
                    height={size}
                    viewBox={`0 0 ${size} ${size}`}
                    style={{ position: 'absolute', left: 0, top: 0 }}>
                    <FollowPeopleGroup
                        x={size * SLOT.left}
                        y={size * (SLOT.top + 0.02)}
                        scale={(size / 26) * 0.44}
                        color="#000000"
                        strokeWidth={focused ? 1.2 : 1.05}
                    />
                </Svg>
            ) : null}
        </View>
    );
});

export default MailboxTabIcon;
