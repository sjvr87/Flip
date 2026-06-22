import { FollowerNotificationRow } from '@/components/notifications/FollowerNotificationRow';
import { SuggestedAccountsSection } from '@/components/notifications/SuggestedAccountsSection';
import { PressableHaptics } from '@/components/ui/PressableHaptics';
import { StackText, YStack } from '@/components/ui/Stack';
import { LOOP_ACCENT } from '@/constants/loopsPalette';
import { ActivityIndicator, FlatList, View } from 'react-native';
import tw from 'twrnc';
import type { ReactElement } from 'react';

const FOLLOWERS_COLLAPSED_COUNT = 5;

export type FollowersNotificationsPanelProps = {
    notifications: any[];
    totalFollowerCount: number;
    isLoading: boolean;
    isRefetching: boolean;
    isFetchingNextPage: boolean;
    hasNextPage: boolean | undefined;
    followersExpanded: boolean;
    showExpand: boolean;
    onExpand: () => void;
    onCollapse: () => void;
    onFetchNextPage: () => void;
    onRefresh: () => void;
    onPress: (item: any) => void;
    onProfilePress: (item: any) => void;
    onAccept: (item: any) => void;
    acceptingId: string | null;
    acceptedIds: Set<string>;
    renderEmpty: ReactElement;
};

export function FollowersNotificationsPanel({
    notifications,
    totalFollowerCount,
    isLoading,
    isRefetching,
    isFetchingNextPage,
    hasNextPage,
    followersExpanded,
    showExpand,
    onExpand,
    onCollapse,
    onFetchNextPage,
    onRefresh,
    onPress,
    onProfilePress,
    onAccept,
    acceptingId,
    acceptedIds,
    renderEmpty,
}: FollowersNotificationsPanelProps) {
    const listHeader =
        totalFollowerCount > 0 ? (
            <View style={tw`px-4 pb-2`}>
                <StackText fontSize="$3" textColor="text-gray-500 dark:text-gray-500">
                    {totalFollowerCount} new follower
                    {totalFollowerCount === 1 ? '' : 's'}
                </StackText>
            </View>
        ) : null;

    const listFooter = (
        <View>
            {showExpand ? (
                <PressableHaptics onPress={onExpand} style={tw`py-4 items-center`}>
                    <StackText fontSize="$4" fontWeight="semibold" style={{ color: LOOP_ACCENT }}>
                        View all {totalFollowerCount} followers
                    </StackText>
                </PressableHaptics>
            ) : null}
            {followersExpanded && totalFollowerCount > FOLLOWERS_COLLAPSED_COUNT ? (
                <PressableHaptics onPress={onCollapse} style={tw`py-3 items-center`}>
                    <StackText fontSize="$3" fontWeight="semibold" style={{ color: LOOP_ACCENT }}>
                        Show less
                    </StackText>
                </PressableHaptics>
            ) : null}
            {followersExpanded && hasNextPage && !isFetchingNextPage ? (
                <PressableHaptics onPress={onFetchNextPage} style={tw`py-4 items-center`}>
                    <StackText fontSize="$4" fontWeight="semibold" style={{ color: LOOP_ACCENT }}>
                        View more
                    </StackText>
                </PressableHaptics>
            ) : null}
            {isFetchingNextPage ? (
                <YStack paddingVertical="$6" alignItems="center">
                    <ActivityIndicator color={LOOP_ACCENT} />
                </YStack>
            ) : null}
            <SuggestedAccountsSection />
        </View>
    );

    return (
        <FlatList
            key="followers-notifications"
            style={tw`flex-1`}
            data={notifications}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
                <FollowerNotificationRow
                    item={item}
                    onPress={() => onPress(item)}
                    onProfilePress={() => onProfilePress(item)}
                    onAccept={() => onAccept(item)}
                    isAccepting={acceptingId === item.actor.id}
                    isAccepted={acceptedIds.has(item.actor.id)}
                />
            )}
            ListHeaderComponent={listHeader}
            ListFooterComponent={listFooter}
            ListEmptyComponent={renderEmpty}
            onEndReachedThreshold={0.4}
            onEndReached={() => {
                if (followersExpanded && hasNextPage && !isFetchingNextPage && !isRefetching) {
                    onFetchNextPage();
                }
            }}
            refreshing={isRefetching && !isFetchingNextPage}
            onRefresh={onRefresh}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ flexGrow: 1 }}
        />
    );
}
