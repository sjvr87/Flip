import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Dimensions, Text, TouchableOpacity, View } from 'react-native';
import tw from 'twrnc';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function FeedEmptyState({ tab, onRefresh, error }) {
    const router = useRouter();

    const content = useMemo(() => {
        if (error) {
            return {
                icon: 'alert-circle-outline',
                title: tab === 'local' ? 'Local feed unavailable' : 'Feed unavailable',
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
                        "Follow some creators and their Flips will show up here. Browse the Local or For You feed to find accounts you'll love.",
                    primary: {
                        label: 'Find creators',
                        onPress: () => router.push('/explore'),
                    },
                };
            case 'local':
                return {
                    icon: 'planet-outline',
                    title: 'Nothing local just yet',
                    subtitle:
                        'No public Flips nearby right now. Be the first to share something, or check For You for trending videos.',
                    primary: {
                        label: 'Record a Flip',
                        onPress: () => router.push('/private/camera'),
                    },
                };
            case 'forYou':
            default:
                return {
                    icon: 'sparkles-outline',
                    title: "You're all caught up",
                    subtitle: "We're curating more Flips for you. Check back soon.",
                    primary: { label: 'Refresh', onPress: onRefresh },
                };
        }
    }, [tab, onRefresh, router, error]);

    return (
        <View style={[tw`items-center justify-center px-10 bg-black`, { height: SCREEN_HEIGHT }]}>
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
                    style={tw`px-6 py-3 rounded-full bg-white`}>
                    <Text style={tw`font-semibold text-base text-black`}>
                        {content.primary.label}
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );
}
