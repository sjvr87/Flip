import { Text, type TextStyle } from 'react-native';

type Props = {
    color?: string;
    style?: TextStyle;
};

/** Profile tab header brand: Flip-It File (not "My Profile"). */
export function FlipItFileTitle({ color = '#000', style }: Props) {
    return (
        <Text
            style={[{ color, fontSize: 17 }, style]}
            accessibilityRole="header"
            accessibilityLabel="Flip-It File">
            <Text style={{ fontWeight: '800' }}>Flip</Text>
            <Text style={{ fontWeight: '500' }}>-</Text>
            <Text style={{ fontWeight: '800' }}>It</Text>
            <Text style={{ fontWeight: '700' }}> File</Text>
        </Text>
    );
}
