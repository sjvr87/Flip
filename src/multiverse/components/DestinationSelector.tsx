import { useTheme } from '@/contexts/ThemeContext';
import { providerIconName } from '@/multiverse/config';
import { buildDefaultPostDestinations } from '@/multiverse/destinations';
import type { ConnectedAccount, PostDestination } from '@/multiverse/types';
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Switch, Text, TouchableOpacity, View } from 'react-native';
import tw from 'twrnc';

type Props = {
    accounts: ConnectedAccount[];
    value: PostDestination[];
    onChange: (next: PostDestination[]) => void;
};

export default function DestinationSelector({ accounts, value, onChange }: Props) {
    const { isDark } = useTheme();
    const defaults = useMemo(() => buildDefaultPostDestinations(accounts), [accounts]);
    const [edited, setEdited] = useState<PostDestination[] | null>(null);
    const items = edited ?? (value.length > 0 ? value : defaults);

    const toggle = (index: number) => {
        const next = items.map((d, i) => (i === index ? { ...d, enabled: !d.enabled } : d));
        setEdited(next);
        onChange(next);
    };

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
                        <View
                            style={tw`mr-2 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900`}>
                            <Text
                                style={tw`text-xs font-semibold text-amber-800 dark:text-amber-200`}>
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
