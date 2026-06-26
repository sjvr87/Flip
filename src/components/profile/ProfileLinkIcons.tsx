import { XStack } from '@/components/ui/Stack';
import { detectProfileLinkPlatform } from '@/utils/profileLinkPlatforms';
import { openBrowser } from '@/utils/requests';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView } from 'react-native';
import tw from 'twrnc';

type ProfileLink = {
    id?: string;
    url?: string;
    link?: string;
};

type ProfileLinkIconsProps = {
    links: ProfileLink[];
    accentColor?: string;
};

export default function ProfileLinkIcons({ links, accentColor }: ProfileLinkIconsProps) {
    const validLinks = (links ?? []).filter((l) => l.url || l.link);
    if (validLinks.length === 0) return null;

    const openLink = async (href: string) => {
        await openBrowser(href, { presentationStyle: 'popover', showTitle: false });
    };

    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
                justifyContent: 'center',
                alignItems: 'center',
                gap: 12,
                paddingHorizontal: 20,
            }}>
            {validLinks.map((link, index) => {
                const href = link.url || link.link;
                if (!href) return null;

                const platform = detectProfileLinkPlatform(href);
                const bg =
                    platform.id === 'website' && accentColor ? accentColor : platform.brandColor;

                return (
                    <Pressable
                        key={link.id ? `${link.id}-${index}` : `${href}-${index}`}
                        onPress={() => openLink(href)}
                        accessibilityRole="link"
                        accessibilityLabel={platform.label}
                        style={({ pressed }) => [
                            tw`w-11 h-11 rounded-full items-center justify-center`,
                            { backgroundColor: bg, opacity: pressed ? 0.85 : 1 },
                        ]}>
                        <Ionicons name={platform.icon} size={22} color={platform.iconColor} />
                    </Pressable>
                );
            })}
        </ScrollView>
    );
}
