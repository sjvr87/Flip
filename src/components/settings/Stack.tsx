import { PressableHaptics } from '@/components/ui/PressableHaptics';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { Switch, Text, View } from 'react-native';
import { XStack, YStack } from '../ui/Stack';

export const SettingsItem = ({ icon, label, onPress, showChevron = true }) => {
    const { colors } = useTheme();
    const iconColor = colors.textSecondary;
    const chevronColor = colors.textMuted;

    return (
        <PressableHaptics
            onPress={onPress}
            accessibilityLabel={label}
            accessibilityRole="button"
            style={({ pressed }) => [
                {
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 16,
                    paddingHorizontal: 20,
                    backgroundColor: colors.background,
                },
                pressed && { backgroundColor: colors.surfaceElevated },
            ]}>
            <Ionicons name={icon} size={24} color={iconColor} style={{ marginRight: 16 }} />
            <Text style={{ flex: 1, fontSize: 16, fontWeight: '500', color: colors.text }}>
                {label}
            </Text>
            {showChevron && <Ionicons name="chevron-forward" size={20} color={chevronColor} />}
        </PressableHaptics>
    );
};

export const SectionHeader = ({ title }) => {
    const { colors } = useTheme();

    return (
        <View style={{ paddingHorizontal: 20, paddingVertical: 8, backgroundColor: colors.surface }}>
            <Text
                style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: colors.textMuted,
                    textTransform: 'uppercase',
                }}>
                {title}
            </Text>
        </View>
    );
};

export const Divider = () => {
    const { colors } = useTheme();
    return <View style={{ height: 1, backgroundColor: colors.border }} />;
};

export const SettingsToggleItem = ({ icon, label, value, onValueChange }) => {
    const { colors } = useTheme();

    return (
        <View
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 16,
                paddingHorizontal: 20,
                backgroundColor: colors.background,
            }}>
            <Ionicons name={icon} size={24} color={colors.text} style={{ marginRight: 16 }} />
            <Text style={{ flex: 1, fontSize: 16, fontWeight: '500', color: colors.text }}>
                {label}
            </Text>
            <Switch value={value} onValueChange={onValueChange} ios_backgroundColor="#ccc" />
        </View>
    );
};

export const SettingsToggleItemDescription = ({
    icon,
    label,
    description,
    value,
    onValueChange,
}) => {
    const { colors } = useTheme();

    return (
        <View
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 16,
                paddingHorizontal: 20,
                backgroundColor: colors.background,
            }}>
            <XStack flex={1} style={{ alignItems: 'center' }}>
                <XStack style={{ flex: 1, alignItems: 'center', marginTop: 4 }}>
                    {icon && (
                        <Ionicons name={icon} size={24} color={colors.text} style={{ marginRight: 16 }} />
                    )}
                    <YStack style={{ flex: 1 }}>
                        <Text style={{ fontSize: 16, fontWeight: '500', color: colors.text }}>
                            {label}
                        </Text>
                        <Text style={{ marginTop: 12, fontSize: 14, color: colors.textSecondary }}>
                            {description}
                        </Text>
                    </YStack>
                </XStack>
                <Switch value={value} onValueChange={onValueChange} ios_backgroundColor="#ccc" />
            </XStack>
        </View>
    );
};

export const SettingsStatusItem = ({
    icon,
    label,
    isActive,
    onPress,
    activeIcon = 'checkmark-circle',
    activeIconColor = '#10b981',
    inactiveText = 'Setup',
    showChevronWhenInactive = true,
}) => {
    const { colors } = useTheme();
    const chevronColor = colors.textMuted;

    const content = (
        <View
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 16,
                paddingHorizontal: 20,
                backgroundColor: colors.background,
            }}>
            <Ionicons name={icon} size={24} color={colors.text} style={{ marginRight: 16 }} />
            <Text style={{ flex: 1, fontSize: 16, fontWeight: '500', color: colors.text }}>
                {label}
            </Text>

            {isActive ? (
                <Ionicons name={activeIcon} size={24} color={activeIconColor} />
            ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontSize: 16, marginRight: 4, color: colors.textSecondary }}>
                        {inactiveText}
                    </Text>
                    {showChevronWhenInactive && (
                        <Ionicons name="chevron-forward" size={20} color={chevronColor} />
                    )}
                </View>
            )}
        </View>
    );

    if (!isActive && onPress) {
        return (
            <PressableHaptics
                onPress={onPress}
                style={({ pressed }) => [
                    pressed && { backgroundColor: colors.surfaceElevated },
                ]}>
                {content}
            </PressableHaptics>
        );
    }

    return content;
};
