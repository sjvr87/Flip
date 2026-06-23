import { StackText } from '@/components/ui/Stack';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuthStore } from '@/utils/authStore';
import { useNotificationStore } from '@/utils/notificationStore';
import { fetchConvoMessages, fetchConvos, markConvoRead, sendChatMessage } from '@/utils/requests';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import tw from 'twrnc';

export default function ChatThreadScreen() {
    const { convoId } = useLocalSearchParams<{ convoId: string }>();
    const router = useRouter();
    const { user } = useAuthStore();
    const { isDark, colors } = useTheme();
    const insets = useSafeAreaInsets();
    const queryClient = useQueryClient();
    const { refetchBadgeCount } = useNotificationStore();
    const [draft, setDraft] = useState('');
    const listRef = useRef<FlatList>(null);
    const myDid = user?.id ?? '';

    const { data: convosData } = useQuery({
        queryKey: ['inbox-convos'],
        queryFn: () => fetchConvos(),
    });

    const convo = convosData?.convos?.find((c) => c.id === convoId);
    const other = convo?.members.find((m) => m.did !== myDid) ?? convo?.members[0];
    const title = other?.displayName || other?.handle || 'Chat';

    const {
        data: messagesData,
        isLoading,
        refetch,
    } = useQuery({
        queryKey: ['chat-messages', convoId],
        queryFn: () => fetchConvoMessages(convoId!),
        enabled: !!convoId,
        refetchInterval: 8000,
    });

    const messages = messagesData?.messages ?? [];

    useEffect(() => {
        if (!convoId) return;
        void markConvoRead(convoId).then(() => {
            void refetchBadgeCount();
            queryClient.invalidateQueries({ queryKey: ['inbox-convos'] });
        });
    }, [convoId, messages.length, queryClient, refetchBadgeCount]);

    const sendMutation = useMutation({
        mutationFn: (text: string) => sendChatMessage(convoId!, text),
        onSuccess: async () => {
            setDraft('');
            await refetch();
            listRef.current?.scrollToEnd({ animated: true });
        },
    });

    const handleSend = useCallback(() => {
        const text = draft.trim();
        if (!text || sendMutation.isPending) return;
        sendMutation.mutate(text);
    }, [draft, sendMutation]);

    return (
        <View style={tw`flex-1 bg-white dark:bg-black`}>
            <Stack.Screen
                options={{
                    headerTitle: title,
                    headerStyle: tw`bg-white dark:bg-black`,
                    headerTintColor: isDark ? '#fff' : '#000',
                    headerShadowVisible: false,
                    headerBackTitleVisible: false,
                }}
            />

            <KeyboardAvoidingView
                style={tw`flex-1`}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}>
                {isLoading ? (
                    <View style={tw`flex-1 items-center justify-center`}>
                        <ActivityIndicator size="large" color={colors.accent} />
                    </View>
                ) : (
                    <FlatList
                        ref={listRef}
                        data={messages}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={tw`px-4 py-3`}
                        onContentSizeChange={() =>
                            listRef.current?.scrollToEnd({ animated: false })
                        }
                        renderItem={({ item }) => (
                            <View
                                style={[
                                    tw`mb-2 max-w-[80%] rounded-2xl px-4 py-2.5`,
                                    item.isFromMe
                                        ? tw`self-end bg-[#F02C56]`
                                        : tw`self-start bg-gray-100 dark:bg-gray-900`,
                                ]}>
                                <StackText
                                    fontSize="$4"
                                    textColor={
                                        item.isFromMe ? 'text-white' : 'text-black dark:text-white'
                                    }>
                                    {item.text}
                                </StackText>
                            </View>
                        )}
                        ListEmptyComponent={
                            <View style={tw`py-12 items-center`}>
                                <StackText fontSize="$4" textColor="text-gray-500">
                                    Say hello!
                                </StackText>
                            </View>
                        }
                    />
                )}

                <View
                    style={[
                        tw`flex-row items-end px-3 pt-2 border-t border-gray-100 dark:border-gray-900`,
                        { paddingBottom: Math.max(insets.bottom, 8) },
                    ]}>
                    <TextInput
                        value={draft}
                        onChangeText={setDraft}
                        placeholder="Message…"
                        placeholderTextColor={isDark ? '#666' : '#999'}
                        multiline
                        style={[
                            tw`flex-1 max-h-28 rounded-2xl px-4 py-2.5 text-base`,
                            {
                                color: isDark ? '#fff' : '#000',
                                backgroundColor: isDark ? '#1a1a1a' : '#f3f4f6',
                            },
                        ]}
                    />
                    <Pressable
                        onPress={handleSend}
                        disabled={!draft.trim() || sendMutation.isPending}
                        style={({ pressed }) => [
                            tw`ml-2 w-10 h-10 rounded-full items-center justify-center`,
                            {
                                backgroundColor: draft.trim()
                                    ? colors.accent
                                    : isDark
                                      ? '#333'
                                      : '#ddd',
                                opacity: pressed ? 0.8 : 1,
                            },
                        ]}>
                        {sendMutation.isPending ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Ionicons name="send" size={18} color="#fff" />
                        )}
                    </Pressable>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
}
