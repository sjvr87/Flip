import InboxScreen from '@/components/inbox/InboxScreen';
import { useTheme } from '@/contexts/ThemeContext';
import { Button, Host, Menu } from '@expo/ui/swift-ui';
import { font, foregroundStyle, labelStyle } from '@expo/ui/swift-ui/modifiers';
import { useRouter } from 'expo-router';
import { Platform, View } from 'react-native';

function InboxHeaderMenu() {
    const router = useRouter();
    const { isDark } = useTheme();

    if (Platform.OS !== 'ios') return null;

    return (
        <View style={{ alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
            <Host matchContents>
                <Menu
                    label="Inbox menu"
                    systemImage="line.3.horizontal"
                    modifiers={[
                        labelStyle('iconOnly'),
                        foregroundStyle(isDark ? '#FFFFFF' : '#000000'),
                        font({ size: 30 }),
                    ]}>
                    <Button
                        label="Starter Kits"
                        onPress={() => router.push('/private/notifications/starterKits')}
                    />
                    <Button
                        label="System Notifications"
                        onPress={() => router.push('/private/notifications/system')}
                    />
                </Menu>
            </Host>
        </View>
    );
}

export default function NotificationScreen() {
    return <InboxScreen headerRight={() => <InboxHeaderMenu />} />;
}
