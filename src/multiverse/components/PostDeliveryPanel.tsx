import { useTheme } from '@/contexts/ThemeContext';
import type { PostDelivery } from '@/multiverse/types';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Text, View } from 'react-native';
import tw from 'twrnc';

type Props = {
    deliveries: PostDelivery[];
    isLoading?: boolean;
};

function statusColor(status: PostDelivery['status'], isDark: boolean): string {
    if (status === 'sent') return '#22c55e';
    if (status === 'failed') return '#ef4444';
    return isDark ? '#fbbf24' : '#d97706';
}

function statusIcon(status: PostDelivery['status']): keyof typeof Ionicons.glyphMap {
    if (status === 'sent') return 'checkmark-circle';
    if (status === 'failed') return 'close-circle';
    return 'time-outline';
}

function providerLabel(provider: string): string {
    if (provider === 'bluesky') return 'Bluesky';
    if (provider === 'activitypub') return 'ActivityPub';
    return 'Flip';
}

export default function PostDeliveryPanel({ deliveries, isLoading }: Props) {
    const { isDark } = useTheme();

    if (isLoading && !deliveries.length) {
        return (
            <View style={tw`px-4 py-3 items-center`}>
                <ActivityIndicator />
                <Text style={tw`mt-2 text-sm text-gray-500`}>Checking delivery status…</Text>
            </View>
        );
    }

    if (!deliveries.length) return null;

    return (
        <View style={tw`mx-4 my-3 p-3 rounded-xl bg-gray-100 dark:bg-gray-900`}>
            <Text style={tw`text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2`}>
                Delivery status
            </Text>
            {deliveries.map((d) => (
                <View key={d.id} style={tw`flex-row items-start py-2`}>
                    <Ionicons
                        name={statusIcon(d.status)}
                        size={18}
                        color={statusColor(d.status, isDark)}
                        style={tw`mr-2 mt-0.5`}
                    />
                    <View style={tw`flex-1`}>
                        <Text style={tw`text-sm text-gray-900 dark:text-white`}>
                            {providerLabel(d.provider)} — {d.status}
                        </Text>
                        {d.errorMessage ? (
                            <Text style={tw`text-xs text-red-500 mt-1`}>{d.errorMessage}</Text>
                        ) : null}
                    </View>
                </View>
            ))}
        </View>
    );
}
