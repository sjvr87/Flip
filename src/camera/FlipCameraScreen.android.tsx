import { MAX_RECORDING_SECONDS } from '@/camera/camerawesome/config'
import { launchUploadGalleryPicker } from '@/camera/launchUploadGalleryPicker'
import { ensureAndroidMediaReadPermissions } from '@/camera/ensureAndroidMediaReadPermissions'
import { useRecentGalleryThumb } from '@/camera/useRecentGalleryThumb'
import ReferenceAudioPlayer from '@/components/feed/ReferenceAudioPlayer'
import { remixReferenceBannerSuffix } from '@/utils/expoAudioAvailability'
import { PressableHaptics } from '@/components/ui/PressableHaptics'
import { prepareForCameraCapture } from '@/utils/cameraCapturePrepare'
import { usePendingAudioReuseStore } from '@/utils/pendingAudioReuseStore'
import { FlipCamerawesomeView, getCaptureProfile, type CaptureProfile } from 'flip-camerawesome'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useFocusEffect, useIsFocused, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  Linking,
  Image,
  PermissionsAndroid,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import Reanimated, { runOnJS, useSharedValue, withSpring } from 'react-native-reanimated'

type Props = {
  onClose?: () => void
}

export default function FlipCameraScreenAndroid({ onClose }: Props) {
  const router = useRouter()
  const isFocused = useIsFocused()

  const [cameraPosition, setCameraPosition] = useState<'front' | 'back'>('back')
  const [flash, setFlash] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [hasPermissions, setHasPermissions] = useState<boolean | null>(null)
  const [isCameraReady, setIsCameraReady] = useState(false)
  const [captureMode, setCaptureMode] = useState<'video' | 'photo'>('video')
  const [photoRequestId, setPhotoRequestId] = useState(0)
  const [captureBadge, setCaptureBadge] = useState<string | null>(null)

  const recordingTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const recordingRef = useRef(false)

  const zoom = useSharedValue(1)
  const zoomOffset = useSharedValue(1)
  const minZoom = 1
  const maxZoom = 10
  const [zoomLevel, setZoomLevel] = useState(1)

  const { thumbUri: galleryThumbUri, reload: reloadGalleryThumb } = useRecentGalleryThumb()
  const pendingRemix = usePendingAudioReuseStore((s) => s.pending)
  const clearPendingRemix = usePendingAudioReuseStore((s) => s.clearPending)
  const remixReferenceUrl = pendingRemix?.referenceVideoUrl

  const requestAndroidPermissions = useCallback(async () => {
    const cameraGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA)
    const micGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO)
    if (cameraGranted && micGranted) return true

    const toRequest: (typeof PermissionsAndroid.PERMISSIONS.CAMERA)[] = []
    if (!cameraGranted) toRequest.push(PermissionsAndroid.PERMISSIONS.CAMERA)
    if (!micGranted) toRequest.push(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO)

    const results = await PermissionsAndroid.requestMultiple(toRequest)
    const cameraOk =
      cameraGranted ||
      results[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED
    const micOk =
      micGranted ||
      results[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED
    return cameraOk && micOk
  }, [])

  useEffect(() => {
    requestAndroidPermissions().then(setHasPermissions)
    getCaptureProfile()
      .then((profile: CaptureProfile) => setCaptureBadge(profile.badge))
      .catch(() => undefined)
  }, [requestAndroidPermissions])

  useFocusEffect(
    useCallback(() => {
      // Release feed decoders before CameraX binds — same tick as focus so MediaCodec is free.
      prepareForCameraCapture()
      setIsCameraReady(false)
      setIsRecording(false)
      recordingRef.current = false
      requestAndroidPermissions().then(setHasPermissions)
      ensureAndroidMediaReadPermissions()
        .catch(() => undefined)
        .finally(() => reloadGalleryThumb())
      return () => {
        recordingRef.current = false
        setIsRecording(false)
        setIsCameraReady(false)
      }
    }, [requestAndroidPermissions, reloadGalleryThumb]),
  )

  useEffect(() => {
    const interval = setInterval(() => setZoomLevel(zoom.value), 50)
    return () => clearInterval(interval)
  }, [zoom])

  const navigateToPreview = (mediaPath: string, duration: number, mediaType: 'video' | 'photo' = 'video') => {
    if (mediaType === 'photo') {
      router.push({
        pathname: '/private/camera/preview',
        params: { imagePath: mediaPath, mediaType: 'photo' },
      })
      return
    }
    router.push({
      pathname: '/private/camera/preview',
      params: { videoPath: mediaPath, duration: String(duration) },
    })
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const startRecording = useCallback(() => {
    if (isRecording || !isCameraReady || captureMode !== 'video') return
    recordingRef.current = true
    setIsRecording(true)
  }, [isRecording, isCameraReady, captureMode])

  const stopRecording = useCallback(() => {
    if (!recordingRef.current) return
    recordingRef.current = false
    setIsRecording(false)
    zoom.value = withSpring(1)
  }, [zoom])

  useEffect(() => {
    if (captureMode === 'photo' && isRecording) {
      stopRecording()
    }
  }, [captureMode, isRecording, stopRecording])

  useEffect(() => {
    if (!isRecording) {
      setRecordingDuration(0)
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current)
        recordingTimer.current = null
      }
      return
    }

    const startTime = Date.now()
    recordingTimer.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000)
      setRecordingDuration(elapsed)
      if (elapsed >= MAX_RECORDING_SECONDS) {
        stopRecording()
      }
    }, 250)

    return () => {
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current)
        recordingTimer.current = null
      }
    }
  }, [isRecording, stopRecording])

  const toggleRecording = useCallback(() => {
    if (!isCameraReady || captureMode !== 'video') return
    if (recordingRef.current) {
      stopRecording()
    } else {
      startRecording()
    }
  }, [isCameraReady, captureMode, startRecording, stopRecording])

  const takePhoto = useCallback(() => {
    if (!isCameraReady || isRecording || captureMode !== 'photo') return
    setPhotoRequestId((id) => id + 1)
  }, [isCameraReady, isRecording, captureMode])

  const adjustZoom = useCallback(
    (delta: number) => {
      const next = Math.max(minZoom, Math.min(maxZoom, zoomLevel + delta))
      zoom.value = next
    },
    [zoom, zoomLevel, minZoom, maxZoom],
  )

  const handleClose = () => {
    if (isRecording) stopRecording()
    clearPendingRemix()
    if (onClose) onClose()
    else router.canGoBack() ? router.back() : router.replace('/')
  }

  const handleRemoveRemix = () => {
    clearPendingRemix()
  }

  const handleUpload = async () => {
    try {
      // Upload uses an intent-based picker (Samsung Gallery on Samsung devices).
      // It does not require READ_MEDIA_* — the returned content URI carries a read grant.
      const result = await launchUploadGalleryPicker()
      if (!result.canceled) {
        navigateToPreview(result.uri, 0, result.type === 'image' ? 'photo' : 'video')
      } else {
        reloadGalleryThumb()
      }
    } catch {
      Alert.alert('Error', 'Failed to open gallery.')
    }
  }

  const clampZoom = (value: number) => {
    'worklet'
    return Math.max(minZoom, Math.min(value, maxZoom))
  }

  const pinchGesture = Gesture.Pinch()
    .onBegin(() => {
      'worklet'
      zoomOffset.value = zoom.value
    })
    .onUpdate((event) => {
      'worklet'
      zoom.value = clampZoom(zoomOffset.value * event.scale)
    })

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      'worklet'
      zoom.value = withSpring(1)
    })

  const tapVideoGesture = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => {
      'worklet'
      runOnJS(toggleRecording)()
    })

  const tapPhotoGesture = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => {
      'worklet'
      runOnJS(takePhoto)()
    })

  const recordButtonGesture = captureMode === 'photo' ? tapPhotoGesture : tapVideoGesture
  const cameraGestures = Gesture.Race(doubleTapGesture, pinchGesture)

  if (hasPermissions === false) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContent}>
          <Ionicons name="camera-outline" size={80} color="rgba(255,255,255,0.6)" />
          <Text style={styles.permissionTitle}>Camera & Microphone Access</Text>
          <Text style={styles.permissionDescription}>
            Flip needs camera and microphone access to record video. Gallery access alone is not
            enough — enable Camera in Android settings if you only granted Photos.
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={() => requestAndroidPermissions().then(setHasPermissions)}
          >
            <Text style={styles.permissionButtonText}>Grant permissions</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Linking.openSettings()}>
            <Text style={styles.settingsButtonText}>Open Settings</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  if (hasPermissions === null) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.loadingText}>Initializing CameraX…</Text>
      </View>
    )
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      {isCameraReady && remixReferenceUrl ? (
        <ReferenceAudioPlayer
          url={remixReferenceUrl}
          active={isFocused}
        />
      ) : null}
      <GestureDetector gesture={cameraGestures}>
        <View style={StyleSheet.absoluteFill}>
          <FlipCamerawesomeView
            style={StyleSheet.absoluteFill}
            facing={cameraPosition}
            zoom={zoomLevel}
            torchEnabled={flash && cameraPosition === 'back'}
            isActive={isFocused}
            recording={isRecording}
            photoRequestId={photoRequestId}
            onCameraReady={(e) => {
              setIsCameraReady(true)
              const badge = e.nativeEvent.profile?.badge
              if (badge) setCaptureBadge(badge)
              if (__DEV__ && remixReferenceUrl) {
                console.log('[FlipCamera] ready; remix url:', remixReferenceUrl.slice(0, 80))
              }
            }}
            onRecordingFinished={(e) => {
              recordingRef.current = false
              setIsRecording(false)
              const path = e.nativeEvent.uri || e.nativeEvent.path
              navigateToPreview(path, recordingDuration, 'video')
            }}
            onPhotoCaptured={(e) => {
              const path = e.nativeEvent.uri || e.nativeEvent.path
              navigateToPreview(path, 0, 'photo')
            }}
            onPhotoCaptureError={(e) => {
              Alert.alert('Photo error', e.nativeEvent.message)
            }}
            onRecordingError={(e) => {
              Alert.alert('Recording error', e.nativeEvent.message)
              setIsRecording(false)
              recordingRef.current = false
            }}
            onCameraError={(e) => {
              Alert.alert('Camera error', e.nativeEvent.message)
            }}
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.5)']}
            style={styles.gradientOverlay}
            pointerEvents="none"
          />
        </View>
      </GestureDetector>

      <View style={styles.topBar}>
        <PressableHaptics onPress={handleClose} style={styles.topButton}>
          <Ionicons name="close" size={28} color="#fff" />
        </PressableHaptics>
        {pendingRemix ? (
          <View style={styles.remixBanner}>
            <Ionicons name="musical-notes" size={14} color="#22D3EE" />
            <Text style={styles.remixBannerText} numberOfLines={1}>
              Remix @{pendingRemix.username}
              {remixReferenceUrl
                ? remixReferenceBannerSuffix(remixReferenceUrl)
                : ' · credit attached'}
            </Text>
            <PressableHaptics
              onPress={handleRemoveRemix}
              style={styles.remixRemoveButton}
              accessibilityLabel="Remove remix audio"
              accessibilityHint="Stops reference audio and clears remix credit while keeping the camera open"
            >
              <Ionicons name="close" size={16} color="rgba(255,255,255,0.85)" />
            </PressableHaptics>
          </View>
        ) : (
          <View style={styles.topButton}>
            {captureBadge ? (
              <Text style={styles.profileBadge}>{captureBadge}</Text>
            ) : null}
          </View>
        )}
      </View>

      <View style={styles.rightControls}>
        <PressableHaptics
          onPress={() => {
            if (isRecording) stopRecording()
            setCameraPosition((p) => (p === 'back' ? 'front' : 'back'))
          }}
          style={styles.controlButton}
        >
          <Ionicons name="camera-reverse" size={28} color="#fff" />
        </PressableHaptics>
        <TouchableOpacity
          onPress={() => setFlash((f) => !f)}
          style={styles.controlButton}
          disabled={cameraPosition === 'front'}
        >
          <Ionicons name={flash ? 'flash' : 'flash-off'} size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.zoomControls}>
          <TouchableOpacity onPress={() => adjustZoom(-0.5)} style={styles.zoomButton}>
            <Ionicons name="remove" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => adjustZoom(0.5)} style={styles.zoomButton}>
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.modeBar}>
        <TouchableOpacity
          onPress={() => setCaptureMode('video')}
          style={[styles.modeChip, captureMode === 'video' && styles.modeChipActive]}
        >
          <Text style={[styles.modeChipText, captureMode === 'video' && styles.modeChipTextActive]}>
            Video
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setCaptureMode('photo')}
          style={[styles.modeChip, captureMode === 'photo' && styles.modeChipActive]}
        >
          <Text style={[styles.modeChipText, captureMode === 'photo' && styles.modeChipTextActive]}>
            Photo
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.bottomContainer}>
        {isRecording && (
          <View style={styles.recordingIndicator}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingTime}>{formatDuration(recordingDuration)}</Text>
          </View>
        )}

        <View style={styles.bottomControls}>
          <TouchableOpacity onPress={handleUpload} style={styles.uploadButton}>
            <View style={styles.uploadIconWrapper}>
              {galleryThumbUri ? (
                <Image
                  source={{ uri: galleryThumbUri }}
                  style={styles.uploadIconInner}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.uploadIconPlaceholder}>
                  <Ionicons name="images-outline" size={20} color="rgba(255,255,255,0.7)" />
                </View>
              )}
            </View>
            <Text style={styles.bottomButtonText}>Upload</Text>
          </TouchableOpacity>

          <GestureDetector gesture={recordButtonGesture}>
            <Reanimated.View style={styles.recordButtonContainer}>
              <View
                style={[styles.recordButton, isRecording && styles.recordButtonActive]}
              >
                <View
                  style={[
                    styles.recordButtonInner,
                    isRecording && styles.recordButtonInnerActive,
                  ]}
                />
              </View>
              <Text style={styles.recordHint}>
                {captureMode === 'photo'
                  ? 'Tap to capture'
                  : isRecording
                    ? 'Tap to stop'
                    : 'Tap to record'}
              </Text>
            </Reanimated.View>
          </GestureDetector>

          <View style={styles.effectsButton} />
        </View>
      </View>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#fff', fontSize: 16 },
  permissionContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  permissionTitle: { color: '#fff', fontSize: 22, fontWeight: '700', textAlign: 'center' },
  permissionDescription: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  permissionButton: {
    backgroundColor: '#0085ff',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 12,
  },
  permissionButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  settingsButtonText: { color: 'rgba(255,255,255,0.7)', marginTop: 8 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 56,
    paddingHorizontal: 16,
    zIndex: 10,
  },
  topButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  profileBadge: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  remixBanner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  remixBannerText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  remixRemoveButton: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 2,
  },
  rightControls: { position: 'absolute', right: 12, top: '35%', zIndex: 10, gap: 20 },
  controlButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  bottomContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: 40 },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  recordingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ff0000' },
  recordingTime: { color: '#fff', fontSize: 15, fontWeight: '600' },
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  uploadButton: { alignItems: 'center', width: 70 },
  uploadIconWrapper: {
    width: 46,
    height: 46,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  uploadIconInner: { width: 46, height: 46, borderRadius: 8 },
  uploadIconPlaceholder: {
    width: 46,
    height: 46,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomButtonText: { color: '#fff', fontSize: 12, fontWeight: '800', marginTop: 4 },
  effectsButton: { width: 70 },
  recordButtonContainer: { alignItems: 'center', gap: 8 },
  recordButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 4,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordButtonActive: { borderColor: '#0085ff' },
  recordButtonInner: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#fff' },
  recordButtonInnerActive: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: '#0085ff',
  },
  recordHint: { color: 'rgba(255,255,255,0.7)', fontSize: 12, textAlign: 'center' },
  zoomControls: { gap: 8, marginTop: 8 },
  zoomButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeBar: {
    position: 'absolute',
    bottom: 150,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 8,
    zIndex: 10,
  },
  modeChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  modeChipActive: { backgroundColor: 'rgba(255,255,255,0.9)' },
  modeChipText: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '700' },
  modeChipTextActive: { color: '#000' },
  gradientOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '100%' },
})
