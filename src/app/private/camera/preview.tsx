import { XStack } from '@/components/ui/Stack';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useEventListener } from 'expo';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ensureAndroidMediaReadPermissions } from '@/camera/ensureAndroidMediaReadPermissions';
import { Asset } from 'expo-media-library';
import { Stack, useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useState } from 'react';

import {
    Alert,
    Dimensions,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const { width, height } = Dimensions.get('window');

function VideoPreviewContent({ mediaUri, duration }: { mediaUri: string; duration?: string }) {
    const router = useRouter();
    const isFocused = useIsFocused();
    const [selectedSound, setSelectedSound] = useState('');
    const [isPlaying, setIsPlaying] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const player = useVideoPlayer(mediaUri, (player) => {
        player.loop = true;
        player.play();
    });

    useEventListener(player, 'statusChange', ({ status, error }) => {
        console.log('Player status changed: ', status);
        console.log('Player error changed: ', error);
    });

    const handleBack = () => router.back();

    const handleNext = () => {
        player.pause();
        router.push({
            pathname: '/private/camera/caption',
            params: { videoPath: mediaUri, duration },
        });
    };

    const togglePlayPause = () => {
        if (player.playing) {
            player.pause();
            setIsPlaying(false);
        } else {
            player.play();
            setIsPlaying(true);
        }
    };

    const handleDownload = async () => {
        try {
            const granted = await ensureAndroidMediaReadPermissions();
            if (!granted) {
                Alert.alert(
                    'Permission Required',
                    'Please allow access to your camera roll to save videos.',
                );
                return;
            }

            setIsSaving(true);
            const uri = mediaUri.startsWith('file://') ? mediaUri : `file://${mediaUri}`;
            await Asset.create(uri);
            Alert.alert('Saved!', 'Video saved to your camera roll.');
        } catch (e) {
            console.log(e);
            Alert.alert('Error', 'Failed to save video.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />

            {isFocused && (
                <VideoView
                    style={styles.video}
                    player={player}
                    allowsPictureInPicture={false}
                    nativeControls={false}
                    surfaceType={Platform.OS === 'android' ? 'textureView' : 'surfaceView'}
                />
            )}

            <Pressable
                style={styles.videoTapOverlay}
                onPress={togglePlayPause}
                accessible={true}
                accessibilityLabel="Video preview"
                accessibilityHint="Tap to pause or play"
                accessibilityRole="button"
            />

            <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.5)']}
                style={styles.gradientOverlay}
                pointerEvents="none"
            />

            <View style={styles.topBar}>
                <TouchableOpacity onPress={handleBack} style={styles.topButton}>
                    <Ionicons name="chevron-back" size={28} color="#fff" />
                </TouchableOpacity>
                {selectedSound ? (
                    <View style={styles.soundChip}>
                        <Ionicons name="musical-notes" size={16} color="#fff" />
                        <Text style={styles.soundText} numberOfLines={1}>
                            {selectedSound}
                        </Text>
                        <TouchableOpacity
                            onPress={() => setSelectedSound('')}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Ionicons name="close" size={18} color="#fff" />
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View />
                )}
                <TouchableOpacity
                    onPress={() => Alert.alert('Settings', 'Sound settings coming soon')}
                    style={styles.topButton}>
                    <Ionicons name="settings-outline" size={24} color="#fff" />
                </TouchableOpacity>
            </View>

            <View style={styles.bottomContainer}>
                <XStack gap={'$3'}>
                    <TouchableOpacity onPress={togglePlayPause} style={styles.controlButton}>
                        <Feather name={isPlaying ? 'pause' : 'play'} size={24} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={handleDownload}
                        style={styles.controlButton}
                        disabled={isSaving}>
                        <Feather name={isSaving ? 'loader' : 'download'} size={28} color="#fff" />
                    </TouchableOpacity>
                </XStack>
                <TouchableOpacity
                    onPress={handleNext}
                    style={styles.nextButton}
                    activeOpacity={0.7}>
                    <Text style={styles.nextButtonText}>Next</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

function PhotoPreviewContent({ mediaUri }: { mediaUri: string }) {
    const router = useRouter();
    const isFocused = useIsFocused();
    const [isSaving, setIsSaving] = useState(false);

    const handleBack = () => router.back();

    const handleNext = () => {
        router.push({
            pathname: '/private/camera/caption',
            params: { imagePath: mediaUri, mediaType: 'photo' },
        });
    };

    const handleDownload = async () => {
        try {
            const granted = await ensureAndroidMediaReadPermissions();
            if (!granted) {
                Alert.alert(
                    'Permission Required',
                    'Please allow access to your camera roll to save photos.',
                );
                return;
            }

            setIsSaving(true);
            const uri = mediaUri.startsWith('file://') ? mediaUri : `file://${mediaUri}`;
            await Asset.create(uri);
            Alert.alert('Saved!', 'Photo saved to your camera roll.');
        } catch (e) {
            console.log(e);
            Alert.alert('Error', 'Failed to save photo.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />

            {isFocused && (
                <Image source={{ uri: mediaUri }} style={styles.video} contentFit="cover" />
            )}

            <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.5)']}
                style={styles.gradientOverlay}
                pointerEvents="none"
            />

            <View style={styles.topBar}>
                <TouchableOpacity onPress={handleBack} style={styles.topButton}>
                    <Ionicons name="chevron-back" size={28} color="#fff" />
                </TouchableOpacity>
                <View />
                <View style={styles.topButton} />
            </View>

            <View style={styles.bottomContainer}>
                <TouchableOpacity
                    onPress={handleDownload}
                    style={styles.controlButton}
                    disabled={isSaving}>
                    <Feather name={isSaving ? 'loader' : 'download'} size={28} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={handleNext}
                    style={styles.nextButton}
                    activeOpacity={0.7}>
                    <Text style={styles.nextButtonText}>Next</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

export default function PreviewScreen() {
    const params = useLocalSearchParams();
    const { videoPath, duration, imagePath, mediaType } = params;
    const isPhoto = mediaType === 'photo' || (!!imagePath && !videoPath);
    const mediaUri = isPhoto ? (imagePath as string) : (videoPath as string);

    if (isPhoto) {
        return <PhotoPreviewContent mediaUri={mediaUri} />;
    }

    return <VideoPreviewContent mediaUri={mediaUri} duration={duration as string | undefined} />;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    video: {
        width: width,
        height: height,
        position: 'absolute',
    },
    videoTapOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.001)',
    },
    topBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 60,
        paddingHorizontal: 20,
        zIndex: 10,
    },
    topButton: {
        width: 26,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    soundChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(40, 40, 40, 0.9)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 8,
        maxWidth: 200,
    },
    soundText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '500',
        flex: 1,
    },
    controlButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    bottomContainer: {
        position: 'absolute',
        bottom: 50,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        gap: 12,
    },
    nextButton: {
        backgroundColor: '#22D3EE',
        paddingHorizontal: 40,
        paddingVertical: 16,
        borderRadius: 25,
    },
    nextButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    gradientOverlay: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: '30%',
    },
});
