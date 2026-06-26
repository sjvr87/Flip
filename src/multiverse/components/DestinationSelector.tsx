import { useTheme } from '@/contexts/ThemeContext';
import type { ConnectedAccount, PostDestination } from '@/multiverse/types';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Switch, Text, TouchableOpacity, View } from 'react-native';
import tw from 'twrnc';

type Props = {
    accounts: ConnectedAccount[];
    value: PostDestination[];
    onChange: (next: PostDestination[]) => void;
};

function providerLabel(provider: string): string {
    if (provider === 'bluesky') return 'Bluesky';
    if (provider === 'activitypub') return 'ActivityPub';
    return 'Flip';
}

function providerIcon(provider: string): keyof typeof Ionicons.glyphMap {
    if (provider === 'bluesky') return 'cloud-outline';
    if (provider === 'activitypub') return 'globe-outline';
    return 'videocam-outline';
}

export default function DestinationSelector({ accounts, value, onChange }: Props) {
    const { isDark } = useTheme();
    const [destinations, setDestinations] = useState<PostDestination[]>(value);

    const defaults = useMemo<PostDestination[]>(() => {
        const flip: PostDestination = {
            provider: 'flip',
            label: 'Flip',
            enabled: true,
        };
        const linked = accounts
            .filter((a) => a.status === 'active')
            .map((a) => ({
                provider: a.provider,
                accountId: a.id,
                label: `${providerLabel(a.provider)} · @${a.handle.replace(/^@/, '')}`,
                enabled: a.provider === 'bluesky',
            }));
        return [flip, ...linked];
    }, [accounts]);

    useEffect(() => {
        if (value.length === 0) {
            setDestinations(defaults);
            onChange(defaults);
        }
    }, [defaults, onChange, value.length]);

    const toggle = (index: number) => {
        const next = destinations.map((d, i) =>
            i === index ? { ...d, enabled: !d.enabled } : d,
        );
        setDestinations(next);
        onChange(next);
    };

    const items = destinations.length ? destinations : defaults;

    return (
        <View style={tw`px-4 py-3`}>
            <Text style={tw`text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2`}>
                Post to
            </Text>
            {items.map((dest, index) => (
                <TouchableOpacity
                    key={`${dest.provider}-${dest.accountId ?? 'native'}`}
                    onPress={() => toggle(index)}
                    activeOpacity={0.7}
                    style={tw`flex-row items-center py-3 border-b border-gray-200 dark:border-gray-800`}>
                    <Ionicons
                        name={providerIcon(dest.provider)}
                        size={20}
                        color={isDark ? '#fff' : '#374151'}
                        style={tw`mr-3`}
                    />
                    <Text style={tw`flex-1 text-base text-gray-900 dark:text-white`}>
                        {dest.label}
                    </Text>
                    <Switch
                        value={dest.enabled}
                        onValueChange={() => toggle(index)}
                        ios_backgroundColor="#ccc"
                    />
                </TouchableOpacity>
            ))}
        </View>
    );
}
