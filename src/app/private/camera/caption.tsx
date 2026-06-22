import MentionText from '@/components/MentionText';
import Avatar from '@/components/Avatar';
import ReferenceAudioPlayer from '@/components/feed/ReferenceAudioPlayer';
import { remixReferenceBannerSuffix } from '@/utils/expoAudioAvailability';
import { XStack, YStack } from '@/components/ui/Stack';
import { useTheme } from '@/contexts/ThemeContext';
import { uploadMediaPost } from '@/atproto/upload';
import {
    composeAutocompleteMentions,
    composeAutocompleteTags,
    uploadImage,
    uploadVideo,
    usesAtprotoBackend,
} from '@/utils/requests';
import { invalidateFeedAfterPost, prependPostedMediaToProfile } from '@/utils/feedCache';
import { usePendingAudioReuseStore } from '@/utils/pendingAudioReuseStore';
import { prettyCount } from '@/utils/ui';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    prepareImageForUpload,
    prepareVideoForUpload,
} from '@/utils/uploadCompression';
import type { FlipAudioSource } from '@/atproto/types';
import tw from 'twrnc';

const MAX_CAPTION_LENGTH = 200;
const MAX_ALT_TEXT_LENGTH = 2000;

function CaptionVideoThumb({ uri }: { uri: string }) {
    const player = useVideoPlayer(uri, () => {});
    return (
        <VideoView
            style={tw`flex-1 w-full h-full bg-black`}
            player={player}
            allowsPictureInPicture={false}
            nativeControls={false}
            surfaceType={Platform.OS === 'android' ? 'textureView' : 'surfaceView'}
        />
    );
}

const LANGUAGES = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'it', name: 'Italian' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'ru', name: 'Russian' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'zh', name: 'Chinese' },
    { code: 'ar', name: 'Arabic' },
    { code: 'hi', name: 'Hindi' },
    { code: 'nl', name: 'Dutch' },
    { code: 'pl', name: 'Polish' },
    { code: 'tr', name: 'Turkish' },
    { code: 'af', name: 'Afrikaans' },
    { code: 'am', name: 'Amharic' },
    { code: 'az', name: 'Azerbaijani' },
    { code: 'be', name: 'Belarusian' },
    { code: 'bn', name: 'Bengali' },
    { code: 'bs', name: 'Bosnian' },
    { code: 'bg', name: 'Bulgarian' },
    { code: 'my', name: 'Burmese' },
    { code: 'ca', name: 'Catalan' },
    { code: 'ceb', name: 'Cebuano' },
    { code: 'cs', name: 'Czech' },
    { code: 'cy', name: 'Welsh' },
    { code: 'da', name: 'Danish' },
    { code: 'el', name: 'Greek' },
    { code: 'et', name: 'Estonian' },
    { code: 'eu', name: 'Basque' },
    { code: 'fa', name: 'Persian' },
    { code: 'fi', name: 'Finnish' },
    { code: 'fil', name: 'Filipino (Tagalog)' },
    { code: 'ga', name: 'Irish' },
    { code: 'gd', name: 'Scottish Gaelic' },
    { code: 'gl', name: 'Galician' },
    { code: 'gu', name: 'Gujarati' },
    { code: 'ha', name: 'Hausa' },
    { code: 'he', name: 'Hebrew' },
    { code: 'hr', name: 'Croatian' },
    { code: 'hu', name: 'Hungarian' },
    { code: 'hy', name: 'Armenian' },
    { code: 'id', name: 'Indonesian' },
    { code: 'is', name: 'Icelandic' },
    { code: 'ka', name: 'Georgian' },
    { code: 'kk', name: 'Kazakh' },
    { code: 'km', name: 'Khmer' },
    { code: 'kn', name: 'Kannada' },
    { code: 'lo', name: 'Lao' },
    { code: 'lt', name: 'Lithuanian' },
    { code: 'lv', name: 'Latvian' },
    { code: 'mk', name: 'Macedonian' },
    { code: 'ml', name: 'Malayalam' },
    { code: 'mn', name: 'Mongolian' },
    { code: 'mr', name: 'Marathi' },
    { code: 'ms', name: 'Malay' },
    { code: 'ne', name: 'Nepali' },
    { code: 'no', name: 'Norwegian' },
    { code: 'pa', name: 'Punjabi' },
    { code: 'ro', name: 'Romanian' },
    { code: 'si', name: 'Sinhala' },
    { code: 'sk', name: 'Slovak' },
    { code: 'sl', name: 'Slovenian' },
    { code: 'so', name: 'Somali' },
    { code: 'sq', name: 'Albanian' },
    { code: 'sr', name: 'Serbian' },
    { code: 'sv', name: 'Swedish' },
    { code: 'sw', name: 'Swahili' },
    { code: 'ta', name: 'Tamil' },
    { code: 'te', name: 'Telugu' },
    { code: 'th', name: 'Thai' },
    { code: 'uk', name: 'Ukrainian' },
    { code: 'ur', name: 'Urdu' },
    { code: 'uz', name: 'Uzbek' },
    { code: 'vi', name: 'Vietnamese' },
    { code: 'xh', name: 'Xhosa' },
    { code: 'yo', name: 'Yoruba' },
    { code: 'zu', name: 'Zulu' },
];

const VISIBILITY_STORAGE_KEY = 'flip:camera:visibility';

/** Bluesky has no followers-only / local / private posts; preference is stored and shown in UI. */
const ATPROTO_VISIBILITY_DESCRIPTIONS: Record<number, string> = {
    1: 'Public post on Bluesky',
    2: 'Preference saved; Bluesky posts are public (no server-local option)',
    3: 'Preference saved; Bluesky posts are public (no followers-only option)',
    4: 'Preference saved; Bluesky posts are public (no friends-only option)',
    5: 'Preference saved; Bluesky posts are public (no private posts)',
};

const VISIBILITY = [
    {
        name: 'Everyone',
        title: 'Everyone can view this post',
        icon: 'earth-outline',
        id: 1,
        apiValue: 1,
        disabled: false,
        description: 'Anyone can see this post',
    },
    {
        name: 'Local',
        title: 'Only people on your server can view',
        icon: 'map-outline',
        id: 2,
        apiValue: 2,
        disabled: false,
        description: 'Visible only to people on your server',
    },
    {
        name: 'Followers',
        title: 'Only followers can view this post',
        icon: 'people-outline',
        id: 3,
        apiValue: 4,
        disabled: false,
        description: 'Visible only to your followers',
    },
    {
        name: 'Friends',
        title: 'Only friends can view this post',
        icon: 'people-circle-outline',
        id: 4,
        apiValue: 5,
        disabled: false,
        description: 'Followers you follow back',
    },
    {
        name: 'Only you',
        title: 'Only you can view this post',
        icon: 'lock-closed-outline',
        id: 5,
        apiValue: 3,
        disabled: false,
        description: 'Visible only to you',
    },
];

export default function CaptionScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const params = useLocalSearchParams();
    const { videoPath, duration, selectedSound, imagePath, mediaType } = params;
    const isPhoto = mediaType === 'photo' || (!!imagePath && !videoPath);
    const mediaSourcePath = isPhoto ? String(imagePath) : String(videoPath);
    const [caption, setCaption] = useState('');
    const [altText, setAltText] = useState('');
    const [selectedLanguage, setSelectedLanguage] = useState(LANGUAGES[0]);
    const [selectedVisibility, setSelectedVisibility] = useState(VISIBILITY[0]);
    const [saveToDevice, setSaveToDevice] = useState(false);
    const [allowComments, setAllowComments] = useState(true);
    const [allowDownloads, setAllowDownloads] = useState(true);
    const [allowDuets, setAllowDuets] = useState(true);
    const [allowStitches, setAllowStitches] = useState(true);
    const [allowUseAudio, setAllowUseAudio] = useState(true);
    const [reusedAudioSource, setReusedAudioSource] = useState<FlipAudioSource | null>(null);
    const [isSensitive, setIsSensitive] = useState(false);
    const [isAd, setIsAd] = useState(false);
    const [isAi, setIsAi] = useState(false);
    const { isDark, colors } = useTheme();

    const [cursorPosition, setCursorPosition] = useState(0);
    const [autocompleteType, setAutocompleteType] = useState<'hashtag' | 'mention' | null>(null);
    const [autocompleteQuery, setAutocompleteQuery] = useState('');
    const [autocompleteStart, setAutocompleteStart] = useState(0);

    const [showMoreOptionsModal, setShowMoreOptionsModal] = useState(false);
    const [showAltTextModal, setShowAltTextModal] = useState(false);
    const [showLanguageModal, setShowLanguageModal] = useState(false);
    const [showVisibilityModal, setShowVisibilityModal] = useState(false);

    const [overlayVisible, setOverlayVisible] = useState(false);
    const [overlayMessage, setOverlayMessage] = useState<string>('Preparing…');
    const [progressPct, setProgressPct] = useState<number>(0);

    const inputRef = useRef<TextInput>(null);
    const altTextInputRef = useRef<TextInput>(null);
    const isFocused = useIsFocused();
    const queryClient = useQueryClient();
    const atprotoUpload = usesAtprotoBackend();
    const takePendingAudioReuse = usePendingAudioReuseStore((s) => s.takePending);
    const visibilityOptions = VISIBILITY.map((item) => ({
        ...item,
        description: atprotoUpload
            ? (ATPROTO_VISIBILITY_DESCRIPTIONS[item.id] ?? item.description)
            : item.description,
    }));

    useEffect(() => {
        AsyncStorage.getItem(VISIBILITY_STORAGE_KEY).then((stored) => {
            if (!stored) return;
            const id = Number(stored);
            const match = VISIBILITY.find((item) => item.id === id);
            if (match) setSelectedVisibility(match);
        });
    }, []);

    useEffect(() => {
        const pending = takePendingAudioReuse();
        if (pending) {
            setReusedAudioSource(pending);
        }
    }, [takePendingAudioReuse]);

    const videoUri = mediaSourcePath?.startsWith('file://')
        ? mediaSourcePath
        : `file://${mediaSourcePath}`;

    const { data: hashtagSuggestions = [] } = useQuery({
        queryKey: ['autoComplete_hashtags', autocompleteQuery],
        queryFn: async () => {
            const res = await composeAutocompleteTags(autocompleteQuery);
            return res.data;
        },
        enabled: autocompleteType === 'hashtag' && autocompleteQuery.length > 0,
    });

    const { data: mentionSuggestions = [] } = useQuery({
        queryKey: ['autoComplete_mentions', autocompleteQuery],
        queryFn: async () => {
            const res = await composeAutocompleteMentions(autocompleteQuery);
            return res.data;
        },
        enabled: autocompleteType === 'mention' && autocompleteQuery.length > 0,
    });

    const uploadLoop = async ({
        originalPath,
        caption,
        altText,
        language,
        visibility,
        allowComments,
        allowDownloads,
        allowDuets,
        allowStitches,
        allowUseAudio,
        isSensitive,
        isAd,
        isAi,
        selectedSound,
        isPhotoPost,
        reusedAudioSource,
    }: any) => {
        setOverlayVisible(true);
        setOverlayMessage('Compressing… 0%');
        setProgressPct(0);

        let uploadUri: string;
        let filename: string;
        let fileField: Record<string, { uri: string; name: string; type: string }>;

        if (isPhotoPost) {
            uploadUri = await prepareImageForUpload(originalPath);
            filename = `upload_${Date.now()}.jpg`;
            fileField = {
                image: {
                    uri: uploadUri,
                    name: filename,
                    type: 'image/jpeg',
                },
            };
        } else {
            uploadUri = await prepareVideoForUpload(originalPath, (pct) => {
                setProgressPct(pct);
                setOverlayMessage(`Compressing… ${pct}%`);
            });
            filename = `upload_${Date.now()}.mp4`;
            fileField = {
                video: {
                    uri: uploadUri,
                    name: filename,
                    type: 'video/mp4',
                },
            };
        }

        setOverlayMessage('Uploading…');

        if (usesAtprotoBackend()) {
            const result = await uploadMediaPost({
                fileUri: uploadUri,
                caption: caption ?? '',
                altText: altText ?? '',
                lang: language?.code ?? 'en',
                isSensitive,
                isPhoto: isPhotoPost,
                visibility: visibility
                    ? { id: visibility.id, apiValue: visibility.apiValue, name: visibility.name }
                    : undefined,
                onProgress: setOverlayMessage,
                permissions: {
                    can_comment: allowComments,
                    can_download: allowDownloads,
                    can_duet: allowDuets,
                    can_stitch: allowStitches,
                    can_use_audio: allowUseAudio,
                },
                audioSource: reusedAudioSource
                    ? {
                          username: reusedAudioSource.username,
                          profileId: reusedAudioSource.profileId,
                          postUri: reusedAudioSource.postUri,
                          isOriginal: false,
                      }
                    : undefined,
            });
            return { json: result, uploadUri };
        }

        const uploadParams = {
            ...fileField,
            description: caption ?? null,
            alt_text: altText ?? null,
            lang: language?.code ?? 'en',
            visibility: String(visibility?.apiValue ?? visibility?.id ?? 1),
            comment_state: allowComments ? '4' : '0',
            can_download: allowDownloads ? '1' : '0',
            can_duet: allowDuets ? '1' : '0',
            can_stitch: allowStitches ? '1' : '0',
            can_use_audio: allowUseAudio ? '1' : '0',
            is_sensitive: isSensitive ? '1' : '0',
            contains_ad: isAd ? '1' : '0',
            contains_ai: isAi ? '1' : '0',
            ...(reusedAudioSource?.postUri
                ? {
                      audio_source_post_uri: reusedAudioSource.postUri,
                      audio_source_username: reusedAudioSource.username,
                  }
                : {}),
        };

        const res = isPhotoPost ? await uploadImage(uploadParams) : await uploadVideo(uploadParams);

        if (!res.ok) {
            const text = await res.text();
            throw new Error(text || 'Upload failed');
        }

        const json = await res.json();
        return { json, uploadUri };
    };

    const postMutation = useMutation({
        mutationFn: uploadLoop,
        onSuccess: async (result, variables) => {
            setOverlayMessage('Done!');
            const postUri = result?.json?.uri;
            const postCid = result?.json?.cid;
            if (postUri && postCid) {
                await prependPostedMediaToProfile(queryClient, {
                    uri: postUri,
                    cid: postCid,
                    isPhoto: !!variables?.isPhotoPost,
                    localMediaUri: result.uploadUri,
                    caption: variables?.caption ?? '',
                });
            }
            await invalidateFeedAfterPost(queryClient);
            setOverlayVisible(false);
            if (variables?.isPhotoPost) {
                router.replace({ pathname: '/(tabs)/profile', params: { tab: 'photos' } });
            } else {
                router.replace('/(tabs)/profile');
            }
        },
        onError: (err: any) => {
            setOverlayVisible(false);
            const message = String(err?.message || err);
            Alert.alert('Upload failed', message || 'Something went wrong. Please try again.');
        },
    });

    const handlePost = () => {
        postMutation.mutate({
            originalPath: mediaSourcePath,
            caption,
            altText,
            language: selectedLanguage,
            visibility: selectedVisibility,
            allowComments,
            allowDownloads,
            allowDuets,
            allowStitches,
            allowUseAudio,
            isSensitive,
            isAd,
            isAi,
            selectedSound,
            isPhotoPost: isPhoto,
            reusedAudioSource,
        });
    };

    const detectAutocomplete = (text: string, position: number) => {
        const textBeforeCursor = text.substring(0, position);

        const lastHashtagIndex = textBeforeCursor.lastIndexOf('#');
        const lastMentionIndex = textBeforeCursor.lastIndexOf('@');

        const lastTriggerIndex = Math.max(lastHashtagIndex, lastMentionIndex);

        if (lastTriggerIndex === -1) {
            setAutocompleteType(null);
            return;
        }

        const textAfterTrigger = textBeforeCursor.substring(lastTriggerIndex + 1);
        if (textAfterTrigger.includes(' ') || textAfterTrigger.includes('\n')) {
            setAutocompleteType(null);
            return;
        }

        const type = lastHashtagIndex > lastMentionIndex ? 'hashtag' : 'mention';
        setAutocompleteType(type);
        setAutocompleteQuery(textAfterTrigger);
        setAutocompleteStart(lastTriggerIndex);
    };

    const handleCaptionChange = (text: string) => {
        if (text.length <= MAX_CAPTION_LENGTH) {
            setCaption(text);
            detectAutocomplete(text, cursorPosition);
        }
    };

    const handleSelectionChange = (event: any) => {
        const position = event.nativeEvent.selection.start;
        setCursorPosition(position);
        detectAutocomplete(caption, position);
    };

    const handleSelectSuggestion = (suggestion: any) => {
        let newText = '';
        const beforeTrigger = caption.substring(0, autocompleteStart);
        const afterCursor = caption.substring(cursorPosition);

        if (autocompleteType === 'hashtag') {
            newText = `${beforeTrigger}#${suggestion.name} ${afterCursor}`;
        } else if (autocompleteType === 'mention') {
            newText = `${beforeTrigger}@${suggestion.username} ${afterCursor}`;
        }

        setCaption(newText);
        setAutocompleteType(null);
        setAutocompleteQuery('');

        const newCursorPosition =
            beforeTrigger.length +
            (autocompleteType === 'hashtag' ? suggestion.name.length : suggestion.username.length) +
            2;

        setTimeout(() => {
            inputRef.current?.setNativeProps({
                selection: { start: newCursorPosition, end: newCursorPosition },
            });
        }, 0);
    };

    const showAutocomplete =
        autocompleteType &&
        (autocompleteType === 'hashtag'
            ? hashtagSuggestions.length > 0
            : mentionSuggestions.length > 0);

    const handleBack = () => {
        router.back();
    };

    const handleRemoveRemix = () => {
        setReusedAudioSource(null);
    };

    const charsRemaining = MAX_CAPTION_LENGTH - caption.length;
    const isNearLimit = charsRemaining <= 20;

    const altTextCharsRemaining = MAX_ALT_TEXT_LENGTH - altText.length;
    const isAltTextNearLimit = altTextCharsRemaining <= 100;

    return (
        <KeyboardAvoidingView
            style={tw`flex-1 bg-white dark:bg-black`}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <Stack.Screen options={{ headerShown: false }} />

            <View
                style={[
                    tw`flex-row justify-between items-center px-5 pb-2.5 border-b border-gray-200 dark:border-gray-800`,
                    { paddingTop: insets.top + 10 },
                ]}>
                <TouchableOpacity onPress={handleBack} style={tw`w-11 h-11 justify-center`}>
                    <Ionicons
                        name="chevron-back"
                        size={32}
                        color={isDark ? '#fff' : '#000'}
                    />
                </TouchableOpacity>
                <Text style={tw`text-lg font-bold text-black dark:text-white`}>
                    {isPhoto ? 'Upload Photo' : 'Upload Loop'}
                </Text>
                <TouchableOpacity style={tw`w-11 h-11 justify-center`}>
                    <Ionicons name="chevron-back" size={32} color="transparent" />
                </TouchableOpacity>
            </View>

            {reusedAudioSource ? (
                <>
                    {reusedAudioSource.referenceVideoUrl ? (
                        <ReferenceAudioPlayer
                            url={reusedAudioSource.referenceVideoUrl}
                            active={isFocused}
                        />
                    ) : null}
                    <View
                        style={tw`mx-5 mt-3 flex-row items-center gap-2 self-start rounded-full bg-cyan-500/10 px-3 py-2`}>
                        <Ionicons name="musical-notes" size={16} color="#22D3EE" />
                        <Text style={tw`text-sm text-cyan-700 dark:text-cyan-300 flex-shrink`}>
                            Remix · audio credit @{reusedAudioSource.username}
                            {remixReferenceBannerSuffix(reusedAudioSource.referenceVideoUrl)}
                        </Text>
                        <TouchableOpacity
                            onPress={handleRemoveRemix}
                            hitSlop={8}
                            accessibilityLabel="Remove remix audio"
                            accessibilityHint="Stops reference audio and clears remix credit from this post">
                            <Ionicons
                                name="close"
                                size={18}
                                color={isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.55)'}
                            />
                        </TouchableOpacity>
                    </View>
                </>
            ) : null}

            <View>
                <View style={tw`flex-row p-5 gap-3`}>
                    <View style={tw`flex-1 relative`}>
                        <TextInput
                            ref={inputRef}
                            style={tw`flex-1 text-[15px] text-black dark:text-white leading-5 min-h-[100px] border border-gray-300 dark:border-gray-700 p-2.5 pb-7 rounded-[10px] bg-white dark:bg-gray-900`}
                            value={caption}
                            onChangeText={handleCaptionChange}
                            onSelectionChange={handleSelectionChange}
                            placeholder="Add an optional caption..."
                            placeholderTextColor={isDark ? '#666' : '#999'}
                            multiline
                            maxLength={MAX_CAPTION_LENGTH}
                        />
                        <View
                            style={tw`absolute bottom-2 right-2.5 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-xl`}>
                            <Text
                                style={tw`text-xs font-semibold ${isNearLimit ? 'text-[#ff0050]' : 'text-gray-600 dark:text-gray-400'}`}>
                                {charsRemaining}
                            </Text>
                        </View>
                    </View>

                    <View style={tw`w-20 h-[150px] bg-black rounded-lg overflow-hidden relative`}>
                        {isFocused &&
                            (isPhoto ? (
                                <Image
                                    source={{ uri: videoUri }}
                                    style={tw`flex-1 w-full h-full bg-black`}
                                    contentFit="cover"
                                />
                            ) : isFocused ? (
                                <CaptionVideoThumb uri={videoUri} />
                            ) : null)}
                    </View>
                </View>

                {showAutocomplete && (
                    <View
                        style={tw`mx-5 mb-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 max-h-[200px] shadow-lg`}>
                        <FlatList
                            data={
                                autocompleteType === 'hashtag'
                                    ? hashtagSuggestions
                                    : mentionSuggestions
                            }
                            keyExtractor={(item) => item.id}
                            scrollEnabled={true}
                            keyboardShouldPersistTaps="handled"
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={tw`flex-row items-center p-3 gap-3 border-b border-gray-200 dark:border-gray-800`}
                                    onPress={() => handleSelectSuggestion(item)}>
                                    {autocompleteType === 'hashtag' ? (
                                        <>
                                            <View
                                                style={tw`w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 justify-center items-center`}>
                                                <Text
                                                    style={tw`text-lg font-bold text-gray-800 dark:text-gray-200`}>
                                                    #
                                                </Text>
                                            </View>
                                            <View style={tw`flex-1`}>
                                                <Text
                                                    style={tw`text-[15px] font-semibold text-black dark:text-white`}>
                                                    {item.name}
                                                </Text>
                                                <Text
                                                    style={tw`text-[13px] text-gray-600 dark:text-gray-400`}>
                                                    {item.count.toLocaleString()} posts
                                                </Text>
                                            </View>
                                        </>
                                    ) : (
                                        <>
                                            <Avatar url={item?.avatar} />
                                            <YStack style={tw`flex-1`} justifyContent="center">
                                                <XStack flex={1} gap="$1" alignItems="center">
                                                    <MentionText
                                                        username={item.username}
                                                        style={tw`text-[15px] font-semibold`}
                                                    />
                                                    <Text
                                                        style={tw`text-gray-600 dark:text-gray-400`}>
                                                        ·
                                                    </Text>
                                                    <Text
                                                        style={tw`text-xs text-gray-600 dark:text-gray-400`}>
                                                        {prettyCount(item.follower_count)} Followers
                                                    </Text>
                                                </XStack>
                                                {item.bio && item.bio.length && (
                                                    <XStack gap="$1">
                                                        <Text
                                                            style={tw`text-xs text-gray-600 dark:text-gray-400`}
                                                            numberOfLines={1}>
                                                            {item.bio}
                                                        </Text>
                                                    </XStack>
                                                )}
                                            </YStack>
                                        </>
                                    )}
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                )}
            </View>

            <ScrollView onScroll={() => Keyboard.dismiss()}>
                <View style={tw`flex-1`}>
                    <TouchableOpacity
                        style={tw`flex-row items-center justify-between px-5 py-4`}
                        onPress={() => setShowVisibilityModal(true)}>
                        <View style={tw`flex-row items-center max-w-[80%] gap-3 flex-1`}>
                            <View style={tw`pr-2.5`}>
                                <Ionicons
                                    name={selectedVisibility.icon}
                                    size={20}
                                    color={isDark ? '#999' : '#999'}
                                />
                            </View>
                            <YStack style={tw`flex-1`}>
                                <Text
                                    style={tw`text-[15px] font-semibold text-gray-900 dark:text-gray-100`}>
                                    {selectedVisibility.title}
                                </Text>
                            </YStack>
                        </View>
                        <Ionicons
                            name="chevron-forward-outline"
                            size={20}
                            color={isDark ? '#999' : '#999'}
                        />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={tw`flex-row items-center justify-between px-5 py-4`}
                        onPress={() => setShowAltTextModal(true)}>
                        <View style={tw`flex-row items-center max-w-[80%] gap-3 flex-1`}>
                            <View style={tw`pr-2.5`}>
                                <Ionicons
                                    name="accessibility-outline"
                                    size={20}
                                    color={isDark ? '#999' : '#999'}
                                />
                            </View>
                            <YStack style={tw`flex-1`}>
                                <Text
                                    style={tw`text-[15px] font-semibold text-gray-900 dark:text-gray-100`}>
                                    Add alternative text
                                </Text>
                                {altText.length > 0 && (
                                    <Text
                                        style={tw`text-[13px] text-gray-600 dark:text-gray-400 mt-0.5`}
                                        numberOfLines={1}>
                                        {altText}
                                    </Text>
                                )}

                                {altText.length == 0 && (
                                    <Text
                                        style={tw`text-[13px] text-gray-600 dark:text-gray-400 mt-0.5`}>
                                        Provide a brief description for viewers using screen readers
                                    </Text>
                                )}
                            </YStack>
                        </View>
                        <Ionicons
                            name="chevron-forward-outline"
                            size={20}
                            color={isDark ? '#999' : '#999'}
                        />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={tw`flex-row items-center justify-between px-5 py-4`}
                        onPress={() => setShowLanguageModal(true)}>
                        <View style={tw`flex-row items-center max-w-[70%] gap-3 flex-1`}>
                            <View style={tw`pr-2.5`}>
                                <Ionicons
                                    name="language-outline"
                                    size={20}
                                    color={isDark ? '#999' : '#999'}
                                />
                            </View>
                            <YStack>
                                <Text
                                    style={tw`text-[15px] font-semibold text-gray-900 dark:text-gray-100`}>
                                    {isPhoto ? 'Photo Language' : 'Video Language'}
                                </Text>
                                <Text
                                    style={tw`text-[13px] text-gray-600 dark:text-gray-400 mt-0.5`}>
                                    {selectedLanguage.name}
                                </Text>
                            </YStack>
                        </View>
                        <Ionicons
                            name="chevron-forward-outline"
                            size={20}
                            color={isDark ? '#999' : '#999'}
                        />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={tw`flex-row items-center justify-between px-5 py-4`}
                        onPress={() => setShowMoreOptionsModal(true)}>
                        <View style={tw`flex-row items-center max-w-[70%] gap-3 flex-1`}>
                            <View style={tw`pr-2.5`}>
                                <Ionicons
                                    name="ellipsis-horizontal"
                                    size={20}
                                    color={isDark ? '#666' : '#666'}
                                />
                            </View>
                            <YStack>
                                <Text
                                    style={tw`text-[15px] font-semibold text-gray-900 dark:text-gray-100`}>
                                    More options
                                </Text>
                                <Text style={tw`text-[13px] text-gray-600 dark:text-gray-400`}>
                                    Permission and content settings
                                </Text>
                            </YStack>
                        </View>
                        <Ionicons
                            name="chevron-forward-outline"
                            size={20}
                            color={isDark ? '#999' : '#999'}
                        />
                    </TouchableOpacity>
                </View>
            </ScrollView>

            <View
                style={tw`flex-row px-5 py-4 pb-10 mb-3 gap-3 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-black`}>
                <TouchableOpacity
                    onPress={handlePost}
                    disabled={postMutation.isPending}
                    style={tw`flex-1 flex-row items-center justify-center bg-[#22D3EE] py-4 rounded-full gap-2 ${postMutation.isPending ? 'opacity-60' : ''}`}
                    activeOpacity={0.7}>
                    <Feather name="upload" size={20} color="#fff" />
                    <Text style={tw`text-[22px] font-bold text-white`}>Post</Text>
                </TouchableOpacity>
            </View>

            <Modal
                visible={showMoreOptionsModal}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setShowMoreOptionsModal(false)}>
                <SafeAreaView style={tw`flex-1 bg-white dark:bg-black`}>
                    <View
                        style={tw`flex-row justify-between items-center px-5 py-4 border-b border-gray-200 dark:border-gray-800`}>
                        <TouchableOpacity onPress={() => setShowMoreOptionsModal(false)}>
                            <Ionicons
                                name="close"
                                size={28}
                                color={isDark ? '#fff' : '#000'}
                            />
                        </TouchableOpacity>
                        <Text style={tw`text-lg font-bold text-black dark:text-white`}>
                            More Options
                        </Text>
                        <View style={tw`w-7`} />
                    </View>

                    <ScrollView style={tw`flex-1`} showsVerticalScrollIndicator={false}>
                        <XStack>
                            <Text
                                style={tw`px-5 pt-5 pb-2.5 text-gray-600 dark:text-gray-400 text-base font-semibold`}>
                                Privacy Settings
                            </Text>
                        </XStack>

                        <View style={tw`flex-row items-center justify-between px-5 py-4`}>
                            <View style={tw`flex-row items-center max-w-[70%] gap-3 flex-1`}>
                                <View style={tw`pr-2.5`}>
                                    <Ionicons
                                        name="chatbubble-outline"
                                        size={20}
                                        color={isDark ? '#999' : '#999'}
                                    />
                                </View>
                                <YStack>
                                    <Text
                                        style={tw`text-[15px] font-semibold text-gray-900 dark:text-gray-100`}>
                                        Allow Comments
                                    </Text>
                                </YStack>
                            </View>
                            <Switch value={allowComments} onValueChange={setAllowComments} />
                        </View>

                        <View style={tw`flex-row items-center justify-between px-5 py-4`}>
                            <View style={tw`flex-row items-center max-w-[70%] gap-3 flex-1`}>
                                <View style={tw`pr-2.5`}>
                                    <Ionicons
                                        name="download-outline"
                                        size={20}
                                        color={isDark ? '#999' : '#999'}
                                    />
                                </View>
                                <YStack>
                                    <Text
                                        style={tw`text-[15px] font-semibold text-gray-900 dark:text-gray-100`}>
                                        Allow Downloads
                                    </Text>
                                </YStack>
                            </View>
                            <Switch value={allowDownloads} onValueChange={setAllowDownloads} />
                        </View>

                        <View style={tw`flex-row items-center justify-between px-5 py-4`}>
                            <View style={tw`flex-row items-center max-w-[70%] gap-3 flex-1`}>
                                <View style={tw`pr-2.5`}>
                                    <Ionicons
                                        name="people-outline"
                                        size={20}
                                        color={isDark ? '#999' : '#999'}
                                    />
                                </View>
                                <YStack>
                                    <Text
                                        style={tw`text-[15px] font-semibold text-gray-900 dark:text-gray-100`}>
                                        Allow Duets
                                    </Text>
                                </YStack>
                            </View>
                            <Switch value={allowDuets} onValueChange={setAllowDuets} />
                        </View>

                        <View style={tw`flex-row items-center justify-between px-5 py-4`}>
                            <View style={tw`flex-row items-center max-w-[70%] gap-3 flex-1`}>
                                <View style={tw`pr-2.5`}>
                                    <Ionicons
                                        name="cut-outline"
                                        size={20}
                                        color={isDark ? '#999' : '#999'}
                                    />
                                </View>
                                <YStack>
                                    <Text
                                        style={tw`text-[15px] font-semibold text-gray-900 dark:text-gray-100`}>
                                        Allow Stitches
                                    </Text>
                                </YStack>
                            </View>
                            <Switch value={allowStitches} onValueChange={setAllowStitches} />
                        </View>

                        <View style={tw`flex-row items-center justify-between px-5 py-4`}>
                            <View style={tw`flex-row items-center max-w-[70%] gap-3 flex-1`}>
                                <View style={tw`pr-2.5`}>
                                    <Ionicons
                                        name="musical-notes-outline"
                                        size={20}
                                        color={isDark ? '#999' : '#999'}
                                    />
                                </View>
                                <YStack>
                                    <Text
                                        style={tw`text-[15px] font-semibold text-gray-900 dark:text-gray-100`}>
                                        Allow audio reuse
                                    </Text>
                                    <Text style={tw`text-[13px] text-gray-600 dark:text-gray-400`}>
                                        Others can create videos using your audio
                                    </Text>
                                </YStack>
                            </View>
                            <Switch value={allowUseAudio} onValueChange={setAllowUseAudio} />
                        </View>

                        <View style={tw`bg-gray-50 dark:bg-black h-2.5`} />

                        <XStack>
                            <Text
                                style={tw`px-5 pt-5 pb-2.5 text-gray-600 dark:text-gray-400 text-base font-semibold`}>
                                Advanced Settings
                            </Text>
                        </XStack>

                        <View style={tw`flex-row items-center justify-between px-5 py-4`}>
                            <View style={tw`flex-row items-center max-w-[70%] gap-3 flex-1`}>
                                <View style={tw`pr-2.5`}>
                                    <Ionicons
                                        name="eye-off-outline"
                                        size={20}
                                        color={isDark ? '#999' : '#999'}
                                    />
                                </View>
                                <YStack>
                                    <Text
                                        style={tw`text-[15px] font-semibold text-gray-900 dark:text-gray-100`}>
                                        Sensitive content
                                    </Text>
                                    <Text style={tw`text-[13px] text-gray-600 dark:text-gray-400`}>
                                        Mark this post as sensitive to show a warning and limit to
                                        those aged 18 years and older
                                    </Text>
                                </YStack>
                            </View>
                            <Switch value={isSensitive} onValueChange={setIsSensitive} />
                        </View>

                        <View style={tw`flex-row items-center justify-between px-5 py-4`}>
                            <View style={tw`flex-row items-center max-w-[70%] gap-3 flex-1`}>
                                <View style={tw`pr-2.5`}>
                                    <Ionicons
                                        name="bag-outline"
                                        size={20}
                                        color={isDark ? '#999' : '#999'}
                                    />
                                </View>
                                <YStack>
                                    <Text
                                        style={tw`text-[15px] font-semibold text-gray-900 dark:text-gray-100`}>
                                        Content disclosure and ads
                                    </Text>
                                    <Text style={tw`text-[13px] text-gray-600 dark:text-gray-400`}>
                                        Let others know this post promotes a brand, product or
                                        service
                                    </Text>
                                </YStack>
                            </View>
                            <Switch value={isAd} onValueChange={setIsAd} />
                        </View>

                        <View style={tw`flex-row items-center justify-between px-5 py-4`}>
                            <View style={tw`flex-row items-center max-w-[70%] gap-3 flex-1`}>
                                <View style={tw`pr-2.5`}>
                                    <Ionicons
                                        name="information-circle-outline"
                                        size={20}
                                        color={isDark ? '#999' : '#999'}
                                    />
                                </View>
                                <YStack>
                                    <Text
                                        style={tw`text-[15px] font-semibold text-gray-900 dark:text-gray-100`}>
                                        AI-Generated Content
                                    </Text>
                                    <Text style={tw`text-[13px] text-gray-600 dark:text-gray-400`}>
                                        Add this label to tell viewers your content was generated or
                                        edited with AI
                                    </Text>
                                </YStack>
                            </View>
                            <Switch value={isAi} onValueChange={setIsAi} />
                        </View>
                        <View style={tw`flex-row items-center justify-between px-5 py-4`}>
                            <View style={tw`flex-row items-center max-w-[70%] gap-3 flex-1`}>
                                <View style={tw`pr-2.5`}>
                                    <Ionicons
                                        name="download-outline"
                                        size={20}
                                        color={isDark ? '#999' : '#999'}
                                    />
                                </View>
                                <YStack>
                                    <Text
                                        style={tw`text-[15px] font-semibold text-gray-900 dark:text-gray-100`}>
                                        Save to device
                                    </Text>
                                    <Text style={tw`text-[13px] text-gray-600 dark:text-gray-400`}>
                                        Save a copy to your device
                                    </Text>
                                </YStack>
                            </View>
                            <Switch value={saveToDevice} onValueChange={setSaveToDevice} />
                        </View>
                    </ScrollView>
                </SafeAreaView>
            </Modal>

            <Modal
                visible={showAltTextModal}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setShowAltTextModal(false)}>
                <SafeAreaView style={tw`flex-1 bg-white dark:bg-black`}>
                    <KeyboardAvoidingView
                        style={tw`flex-1`}
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        keyboardVerticalOffset={0}>
                        <View
                            style={tw`flex-row justify-between items-center px-5 py-4 border-b border-gray-200 dark:border-gray-800`}>
                            <TouchableOpacity onPress={() => setShowAltTextModal(false)}>
                                <Ionicons
                                    name="close"
                                    size={28}
                                    color={isDark ? '#fff' : '#000'}
                                />
                            </TouchableOpacity>
                            <Text style={tw`text-lg font-bold text-black dark:text-white`}>
                                Alt Text
                            </Text>
                            <TouchableOpacity onPress={() => setShowAltTextModal(false)}>
                                <Text style={tw`text-base font-semibold text-[#22D3EE]`}>Done</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            style={tw`flex-1 px-5`}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}>
                            <Text
                                style={tw`text-sm text-gray-600 dark:text-gray-400 leading-5 py-4`}>
                                Describe your video content to make it accessible for visually
                                impaired viewers using screen readers. Include important visual
                                details, actions, and context.
                            </Text>

                            <View
                                style={tw`border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 min-h-[200px]`}>
                                <TextInput
                                    ref={altTextInputRef}
                                    style={tw`text-[15px] text-black dark:text-white leading-[22px] p-4 min-h-[200px]`}
                                    value={altText}
                                    onChangeText={(text) => {
                                        if (text.length <= MAX_ALT_TEXT_LENGTH) {
                                            setAltText(text);
                                        }
                                    }}
                                    placeholder="Describe what's happening in your video..."
                                    placeholderTextColor={isDark ? '#666' : '#999'}
                                    multiline
                                    maxLength={MAX_ALT_TEXT_LENGTH}
                                    autoFocus
                                    textAlignVertical="top"
                                />
                            </View>

                            <View style={tw`py-3 items-end`}>
                                <Text
                                    style={tw`text-[13px] ${isAltTextNearLimit ? 'text-[#ff0050]' : 'text-gray-600 dark:text-gray-400'}`}>
                                    {altTextCharsRemaining} characters remaining
                                </Text>
                            </View>
                        </ScrollView>
                    </KeyboardAvoidingView>
                </SafeAreaView>
            </Modal>

            <Modal
                visible={showLanguageModal}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setShowLanguageModal(false)}>
                <SafeAreaView style={tw`flex-1 bg-white dark:bg-black`}>
                    <View
                        style={tw`flex-row justify-between items-center px-5 py-4 border-b border-gray-200 dark:border-gray-800`}>
                        <TouchableOpacity onPress={() => setShowLanguageModal(false)}>
                            <Ionicons
                                name="close"
                                size={28}
                                color={isDark ? '#fff' : '#000'}
                            />
                        </TouchableOpacity>
                        <Text style={tw`text-lg font-bold text-black dark:text-white`}>
                            Select Language
                        </Text>
                        <View style={tw`w-7`} />
                    </View>

                    <Text style={tw`text-sm text-gray-600 dark:text-gray-400 px-5 py-3`}>
                        Select the primary language for this {isPhoto ? 'photo' : 'video'}
                    </Text>

                    <FlatList
                        data={LANGUAGES}
                        keyExtractor={(item) => item.code}
                        showsVerticalScrollIndicator={false}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={tw`flex-row justify-between items-center px-5 py-4 border-b border-gray-200 dark:border-gray-800`}
                                onPress={() => {
                                    setSelectedLanguage(item);
                                    setShowLanguageModal(false);
                                }}>
                                <Text style={tw`text-base text-black dark:text-white`}>
                                    {item.name}
                                </Text>
                                {selectedLanguage.code === item.code && (
                                    <Ionicons name="checkmark" size={24} color="#22D3EE" />
                                )}
                            </TouchableOpacity>
                        )}
                        contentInsetAdjustmentBehavior={
                            Platform.OS === 'ios' ? 'automatic' : 'never'
                        }
                        contentContainerStyle={{ paddingBottom: insets.bottom + 8 }}
                    />
                </SafeAreaView>
            </Modal>

            <Modal
                visible={showVisibilityModal}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setShowVisibilityModal(false)}>
                <SafeAreaView style={tw`flex-1 bg-white dark:bg-black`}>
                    <View
                        style={tw`flex-row justify-between items-center px-5 py-4 border-b border-gray-200 dark:border-gray-800`}>
                        <TouchableOpacity onPress={() => setShowVisibilityModal(false)}>
                            <Ionicons
                                name="close"
                                size={28}
                                color={isDark ? '#fff' : '#000'}
                            />
                        </TouchableOpacity>
                        <Text style={tw`text-lg font-bold text-black dark:text-white`}>
                            Select Visibility
                        </Text>
                        <View style={tw`w-7`} />
                    </View>

                    <Text style={tw`text-lg text-black dark:text-white font-bold px-5 py-5`}>
                        Who can view this post
                    </Text>

                    <FlatList
                        data={visibilityOptions}
                        keyExtractor={(item) => item.id.toString()}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={tw`flex-row justify-between items-center px-5 py-4 ${item.disabled ? 'opacity-50' : 'opacity-100'}`}
                                disabled={item.disabled}
                                onPress={() => {
                                    setSelectedVisibility(item);
                                    AsyncStorage.setItem(VISIBILITY_STORAGE_KEY, String(item.id));
                                    setShowVisibilityModal(false);
                                }}>
                                <YStack gap={1}>
                                    <Text
                                        style={tw`text-base font-bold text-black dark:text-white`}>
                                        {item.name}
                                    </Text>
                                    <Text style={tw`text-sm text-gray-600 dark:text-gray-400`}>
                                        {item.description}
                                    </Text>
                                </YStack>

                                {selectedVisibility.id === item.id ? (
                                    <View
                                        style={tw`w-7.5 h-7.5 rounded-full bg-[#22D3EE] justify-center items-center`}>
                                        <View style={tw`w-3.5 h-3.5 rounded-full bg-white`} />
                                    </View>
                                ) : (
                                    <View
                                        style={tw`w-7.5 h-7.5 rounded-full border-2 border-gray-200 dark:border-gray-700`}
                                    />
                                )}
                            </TouchableOpacity>
                        )}
                    />
                </SafeAreaView>
            </Modal>

            {overlayVisible && (
                <View
                    style={tw`absolute top-0 left-0 right-0 bottom-0 bg-black/35 items-center justify-center`}
                    pointerEvents="auto">
                    <View
                        style={tw`w-[72%] rounded-2xl py-5.5 px-4.5 bg-white dark:bg-gray-900 items-center gap-2`}>
                        <ActivityIndicator
                            size="large"
                            color={isDark ? '#fff' : '#000'}
                        />
                        <Text
                            style={tw`mt-1.5 text-base font-bold text-gray-900 dark:text-gray-100 text-center`}>
                            {overlayMessage}
                        </Text>
                    </View>
                </View>
            )}
        </KeyboardAvoidingView>
    );
}
