import { useTheme } from '@/contexts/ThemeContext';
import type { ConnectedAccount, PostDestination } from '@/multiverse/types';
import { MultiverseProviderIds } from '@/multiverse/types';
import {
    isProviderEnabled,
    providerIconName,
    providerLabel,
} from '@/multiverse/config';
import { isBetaProvider, normalizeClientProvider } from '@/multiverse/types';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Switch, Text, TouchableOpacity, View } from 'react-native';
import tw from 'twrnc';

type Props = {
    accounts: ConnectedAccount[];
    value: PostDestination[];
    onChange: (next: PostDestination[]) => void;
};

function isDestinationAvailable(account: ConnectedAccount): boolean {
    const provider = normalizeClientProvider(account.provider);
    if (!provider) return false;
    if (provider === MultiverseProviderIds.ATPROTO) {
        return isProviderEnabled('ATPROTO');
    }
    if (provider === MultiverseProviderIds.NOSTR) {
        return isProviderEnabled('NOSTR');
    }
    if (provider === MultiverseProviderIds.ACTIVITYPUB) {
        return isProviderEnabled('ACTIVITYPUB');
    }
    return false;
}

export default function DestinationSelector({ accounts, value, onChange }: Props) {
    const { isDark } = useTheme();
    const [destinations, setDestinations] = useState<PostDestination[]>(value);

    const defaults = useMemo<PostDestination[]>(() => {
        const flip: PostDestination = {
            provider: MultiverseProviderIds.FLIP_LOCAL,
            label: 'Flip',
            enabled: true,
        };
        const linked = accounts
            .filter((a) => a.status === 'active' && isDestinationAvailable(a))
            .map((a) => {
                const provider = normalizeClientProvider(a.provider) ?? a.provider;
                return {
                    provider,
                    accountId: a.id,
                    label: `${providerLabel(String(provider))} · @${a.handle.replace(/^@/, '')}`,
                    enabled: provider === MultiverseProviderIds.ATPROTO,
                    beta: isBetaProvider(String(provider)),
                } satisfies PostDestination;
            });
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
                        name={providerIconName(String(dest.provider))}
                        size={20}
                        color={isDark ? '#fff' : '#374151'}
                        style={tw`mr-3`}
                    />
                    <Text style={tw`flex-1 text-base text-gray-900 dark:text-white`}>
                        {dest.label}
                    </Text>
                    {dest.beta ? (
                        <View style={tw`mr-2 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900`}>
                            <Text style={tw`text-xs font-semibold text-amber-800 dark:text-amber-200`}>
                                beta
                            </Text>
                        </View>
                    ) : null}
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
