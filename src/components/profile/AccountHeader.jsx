import MentionText from '@/components/MentionText';
import Avatar from '@/components/Avatar';
import { Button } from '@/components/Button';
import { StackText, XStack, YStack } from '@/components/ui/Stack';
import { useTheme } from '@/contexts/ThemeContext';
import { copyProfileLink, getProfileUrl } from '@/utils/profileUrl';
import { openBrowser } from '@/utils/requests';
import { shareContent } from '@/utils/sharer';
import { prettyCount } from '@/utils/ui';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import tw from 'twrnc';
import ExpandableBio from './ExpandableBio';

export default function AccountHeader(props) {
    const { isDark } = useTheme();

    const isOwner = props?.is_owner || props.user?.is_owner;

    const state = props?.userState;

    const profileUrl = getProfileUrl(props.user);

    const handleShare = async () => {
        try {
            await shareContent({
                message: isOwner
                    ? 'Check out my account on Flip!'
                    : `Check out @${props.user?.username}'s account on Flip!`,
                url: profileUrl,
            });
        } catch (error) {
            console.error('Share error:', error);
        }
    };

    const handleCopyLink = async () => {
        try {
            await copyProfileLink(props.user);
        } catch (error) {
            console.error('Copy profile link error:', error);
        }
    };

    const openLink = async (path) => {
        await openBrowser(path, { presentationStyle: 'popover', showTitle: false });
    };

    return (
        <YStack paddingX="$5" paddingY="$3" alignItems="center" gap="$3">
            <Avatar url={props.user?.avatar} theme="xl" />

            <XStack gap="$2" alignItems="center">
                <MentionText
                    username={props.user?.username}
                    style={{ fontWeight: 'bold', fontSize: 24 }}
                />
            </XStack>

            <XStack justifyContent="center" alignItems="center" gap="$10">
                <Pressable>
                    <YStack justifyContent="center" alignItems="center">
                        <StackText
                            fontSize="$5"
                            fontWeight="bold"
                            textColor="text-black dark:text-white">
                            {props.videosResolved === false
                                ? '—'
                                : prettyCount(
                                      props.videoCount !== undefined
                                          ? props.videoCount
                                          : props.user?.post_count || 0,
                                  )}
                        </StackText>
                        <StackText fontSize="$2" textColor="text-gray-500 dark:text-gray-400">
                            Videos
                        </StackText>
                    </YStack>
                </Pressable>

                {props.user?.id ? (
                    <Link
                        href={`/private/profile/followers/${props.user?.id}?username=${props.user?.username}&followersCount=${props.user?.follower_count}&followingCount=${props.user?.following_count}`}
                        asChild>
                        <Pressable>
                            <YStack justifyContent="center" alignItems="center">
                                <StackText
                                    fontSize="$5"
                                    fontWeight="bold"
                                    textColor="text-black dark:text-white">
                                    {prettyCount(props.user?.follower_count, {
                                        precision: props.user?.follower_count > 1000 ? 1 : 0,
                                    })}
                                </StackText>
                                <StackText
                                    fontSize="$2"
                                    textColor="text-gray-500 dark:text-gray-400">
                                    Followers
                                </StackText>
                            </YStack>
                        </Pressable>
                    </Link>
                ) : (
                    <YStack justifyContent="center" alignItems="center">
                        <StackText
                            fontSize="$5"
                            fontWeight="bold"
                            textColor="text-black dark:text-white">
                            {prettyCount(props.user?.follower_count, {
                                precision: props.user?.follower_count > 1000 ? 1 : 0,
                            })}
                        </StackText>
                        <StackText fontSize="$2" textColor="text-gray-500 dark:text-gray-400">
                            Followers
                        </StackText>
                    </YStack>
                )}

                <View accessible={true}>
                    <YStack justifyContent="center" alignItems="center">
                        <StackText
                            fontSize="$5"
                            fontWeight="bold"
                            textColor="text-black dark:text-white">
                            {prettyCount(props.user?.likes_count, {
                                precision: props.user?.likes_count > 1000 ? 1 : 0,
                            })}
                        </StackText>
                        <StackText fontSize="$2" textColor="text-gray-500 dark:text-gray-400">
                            Likes
                        </StackText>
                    </YStack>
                </View>
            </XStack>

            <XStack gap="$2" width="100%" paddingHorizontal="$3">
                {isOwner ? (
                    props.showActions ? (
                        <>
                            <XStack flex={1} justifyContent="center" alignItems="center" gap="$3">
                                <Link href="/private/settings/account/edit" role="button" asChild>
                                    <Button title="Edit profile" theme="light" />
                                </Link>
                                <Button title="Share profile" theme="light" onPress={handleShare} />
                                <Pressable
                                    onPress={handleCopyLink}
                                    accessibilityLabel="Copy profile link"
                                    accessibilityRole="button"
                                    style={tw`px-3 py-2 rounded-full bg-gray-100 dark:bg-gray-900`}>
                                    <Ionicons
                                        name="copy-outline"
                                        size={22}
                                        color={isDark ? '#ccc' : '#333'}
                                    />
                                </Pressable>
                            </XStack>
                        </>
                    ) : null
                ) : (
                    <XStack flex={1} justifyContent="center" alignItems="center" gap="$3">
                        <View>
                            {state?.blocking && (
                                <Button
                                    title={'Unblock'}
                                    theme={'primary'}
                                    loading={!state}
                                    onPress={props.onUnblockPress}
                                    style={tw`px-10`}
                                />
                            )}
                            {!state?.blocking && (
                                <Button
                                    title={
                                        state?.following && state?.followed_by
                                            ? 'Friends'
                                            : state?.following
                                              ? 'Following'
                                              : state?.followed_by
                                                ? 'Follow back'
                                                : 'Follow'
                                    }
                                    theme={state?.following ? 'primary' : 'primary'}
                                    loading={!state}
                                    style={tw`px-10`}
                                    onPress={props.onFollowPress}
                                />
                            )}
                        </View>

                        <Pressable
                            onPress={props.onMenuPress}
                            accessibilityLabel="More options"
                            accessibilityHint="To share, block, or report this profile"
                            accessibilityRole="button"
                            style={tw`px-3 py-2 rounded-full bg-gray-100 dark:bg-gray-900`}>
                            <MaterialIcons
                                name="keyboard-arrow-down"
                                size={26}
                                color={isDark ? '#ccc' : '#333'}
                            />
                        </Pressable>
                    </XStack>
                )}
            </XStack>

            {!!props.user?.bio?.length && <ExpandableBio bio={props.user?.bio} />}

            {isOwner && props.user?.bio?.length === 0 && (
                <Button
                    theme="light"
                    size="small"
                    title="Add bio"
                    onPress={props.onEditBio}
                    style={tw`px-10 py-1 rounded-2xl`}></Button>
            )}

            {props.user?.links && props.user?.links?.length > 0 && (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: 10,
                        paddingHorizontal: 20,
                    }}>
                    {props.user?.links?.slice(0, 4).map((link, index) => (
                        <Pressable
                            key={index}
                            onPress={() => openLink(link.link)}
                            style={tw`bg-gray-100 dark:bg-gray-800 p-1 rounded-xl px-3`}>
                            <XStack gap="$1" alignItems="center">
                                <Ionicons
                                    name="link"
                                    size={14}
                                    color="#fb2c36"
                                    style={{ transform: [{ rotate: '-40deg' }] }}
                                />
                                <StackText
                                    fontSize="$2"
                                    fontWeight="semibold"
                                    textColor="text-gray-600 dark:text-gray-300"
                                    textDecorationLine="underline">
                                    {link?.url?.replace(/^https?:\/\//, '')}
                                </StackText>
                            </XStack>
                        </Pressable>
                    ))}
                </ScrollView>
            )}
        </YStack>
    );
}
