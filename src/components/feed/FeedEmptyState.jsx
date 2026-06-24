import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Dimensions, Text, TouchableOpacity, View } from 'react-native';
import tw from 'twrnc';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function FeedEmptyState({ tab, onRefresh, error, itemHeight }) {
    const router = useRouter();
    const slideHeight = itemHeight ?? SCREEN_HEIGHT;

    const content = useMemo(() => {
        const sessionExpired =
            typeof error === 'string' &&
            (error.toLowerCase().includes('session expired') ||
                error.toLowerCase().includes('sign in again') ||
                error.toLowerCase().includes('token expired') ||
                error.toLowerCase().includes('expiredtoken'));

        if (error) {
            if (sessionExpired) {
                return {
                    icon: 'log-in-outline',
                    title: 'Session expired',
                    subtitle: 'Sign in again to load your feeds.',
                    primary: {
                        label: 'Sign in',
                        onPress: () => router.push('/sign-in'),
                    },
                };
            }

            return {
                icon: 'alert-circle-outline',
                title: tab === 'trending' ? 'Trending feed unavailable' : 'Feed unavailable',
                subtitle: error,
                primary: { label: 'Try again', onPress: onRefresh },
            };
        }

        switch (tab) {
            case 'following':
                return {
                    icon: 'people-outline',
                    title: 'Your following feed is empty',
                    subtitle:
                        "Follow some creators and their Flips will show up here. Browse Trending or For You to find accounts you'll love.",
                    primary: {
                        label: 'Find creators',
                        onPress: () => router.push('/explore'),
                    },
                };
            case 'following-end':
                return {
                    icon: 'checkmark-circle-outline',
                    title: "You're all caught up",
                    subtitle: 'Follow more creators for new Flips, or pull down to refresh.',
                    primary: {
                        label: 'Find creators',
                        onPress: () => router.push('/explore'),
                    },
                };
            case 'trending':
                return {
                    icon: 'trending-up-outline',
                    title: 'No trending videos yet',
                    subtitle:
                        'Pull down to refresh — we load the hottest video Flips from across the network.',
                    primary: { label: 'Refresh', onPress: onRefresh },
                };
            case 'trending-end':
                return {
                    icon: 'checkmark-circle-outline',
                    title: "You're all caught up",
                    subtitle: 'Pull down to refresh for more trending Flips.',
                    primary: { label: 'Refresh', onPress: onRefresh },
                };
            case 'forYou':
                return {
                    icon: 'sparkles-outline',
                    title: 'No Flips to show',
                    subtitle:
                        'Pull down to refresh — we load trending videos from across the network.',
                    primary: { label: 'Refresh', onPress: onRefresh },
                };
            case 'forYou-end':
            default:
                return {
                    icon: 'checkmark-circle-outline',
                    title: "You're all caught up",
                    subtitle: 'Pull down to refresh for new Flips.',
                    primary: { label: 'Refresh', onPress: onRefresh },
                };
        }
    }, [tab, onRefresh, router, error]);

    return (
        <View style={[tw`items-center justify-center px-10 bg-black`, { height: slideHeight }]}>
            <View style={tw`w-20 h-20 rounded-full items-center justify-center mb-5 bg-gray-900`}>
                <Ionicons name={content.icon} size={36} style={tw`text-gray-200`} />
            </View>
            <Text style={tw`text-2xl font-bold text-center mb-2 text-white`}>{content.title}</Text>
            <Text style={tw`text-base text-center leading-6 mb-8 text-gray-300`}>
                {content.subtitle}
            </Text>
            {content.primary && (
                <TouchableOpacity
                    onPress={content.primary.onPress}
                    accessibilityRole="button"
                    accessibilityLabel={content.primary.label}
                    style={tw`px-6 py-3 rounded-full bg-[#22D3EE]`}>
                    <Text style={tw`font-semibold text-base text-white`}>
                        {content.primary.label}
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );
}
