import { MENTION_AT_COLOR, MENTION_HANDLE_COLOR } from '@/constants/loopsPalette';
import React from 'react';
import { StyleProp, Text, TextStyle } from 'react-native';

export type MentionTextProps = {
    username?: string | null;
    style?: StyleProp<TextStyle>;
    atStyle?: StyleProp<TextStyle>;
    handleStyle?: StyleProp<TextStyle>;
    numberOfLines?: number;
};

export default function MentionText({
    username,
    style,
    atStyle,
    handleStyle,
    numberOfLines,
}: MentionTextProps) {
    if (!username) return null;

    return (
        <Text style={style} numberOfLines={numberOfLines}>
            <Text style={[{ color: MENTION_AT_COLOR }, atStyle]}>@</Text>
            <Text style={[{ color: MENTION_HANDLE_COLOR }, handleStyle]}>{username}</Text>
        </Text>
    );
}
