import { FLIP_ANDROID_CAPTURE, MAX_RECORDING_SECONDS } from '@/camera/camerawesome/config'
import { PressableHaptics } from '@/components/ui/PressableHaptics'
import {
  FlipCamerawesomeView,
  getCaptureProfile,
} from 'flip-camerawesome'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { LinearGradient } from 'expo-linear-gradient'
import { requestPermissionsAsync } from 'expo-media-library'
import { useFocusEffect, useIsFocused, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  Linking,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import Reanimated, {
  Extrapolate,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

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
  const [isCameraActive, setIsCameraActive] = useState(true)

  const recordingTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const recordingRef = useRef(false)

  const zoom = useSharedValue(1)
  const zoomOffset = useSharedValue(1)
  const minZoom = 1
  const maxZoom = 10
  const [zoomLevel, setZoomLevel] = useState(1)

  const recordButtonStartY = useSharedValue(0)
  const zoomOffsetY = useSharedValue(0)
  const isHoldingRecord = useSharedValue(false)
  const isPanning = useSharedValue(false)
  const zoomIndicatorOpacity = useSharedValue(0)

  useEffect(() => {
    getCaptureProfile().catch(() => {})
  }, [])

  const requestAndroidPermissions = useCallback(async () => {
    const results = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.CAMERA,
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    ])
    const cameraOk =
      results[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED
    const micOk =
      results[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED
    return cameraOk && micOk
  }, [])

  useEffect(() => {
    requestAndroidPermissions().then(setHasPermissions)
  }, [requestAndroidPermissions])

  useFocusEffect(
    useCallback(() => {
      setIsCameraActive(true)
      return () => {
        if (recordingRef.current) {
          setIsRecording(false)
          recordingRef.current = false
        }
        setIsCameraActive(false)
      }
    }, []),
  )

  useEffect(() => {
    const interval = setInterval(() => setZoomLevel(zoom.value), 50)
    return () => clearInterval(interval)
  }, [zoom])

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
  }, [isRecording])

  const navigateToPreview = (videoPath: string, duration: number) => {
    router.push({
      pathname: '/private/camera/preview',
      params: { videoPath, duration: String(duration) },
    })
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const startRecording = useCallback(() => {
    if (isRecording || !isCameraReady) return
    recordingRef.current = true
    setIsRecording(true)
    zoomIndicatorOpacity.value = withTiming(1, { duration: 200 })
  }, [isRecording, isCameraReady, zoomIndicatorOpacity])

  const stopRecording = useCallback(() => {
    if (!recordingRef.current) return
    recordingRef.current = false
    setIsRecording(false)
    zoomIndicatorOpacity.value = withDelay(2000, withTiming(0, { duration: 200 }))
    zoom.value = withSpring(1)
  }, [zoom, zoomIndicatorOpacity])

  const handleClose = () => {
    if (isRecording) stopRecording()
    if (onClose) onClose()
    else router.canGoBack() ? router.back() : router.replace('/')
  }

  const handleUpload = async () => {
    try {
      const { granted } = await requestPermissionsAsync()
      if (!granted) {
        Alert.alert('Permission Required', 'Enable photo library access to upload videos.')
        return
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsEditing: true,
        aspect: [9, 16],
        quality: 1,
        selectionLimit: 1,
        videoMaxDuration: MAX_RECORDING_SECONDS,
      })
      if (result.assets?.[0]) {
        navigateToPreview(result.assets[0].uri, 0)
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
      zoomIndicatorOpacity.value = withTiming(1, { duration: 200 })
    })
    .onUpdate((event) => {
      'worklet'
      zoom.value = clampZoom(zoomOffset.value * event.scale)
    })
    .onEnd(() => {
      'worklet'
      zoomIndicatorOpacity.value = withDelay(2000, withTiming(0, { duration: 200 }))
    })

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      'worklet'
      zoom.value = withSpring(1)
    })

  const tapRecordGesture = Gesture.Tap()
    .maxDuration(99999999)
    .onBegin(() => {
      'worklet'
      isHoldingRecord.value = true
      runOnJS(startRecording)()
    })
    .onFinalize(() => {
      'worklet'
      if (isPanning.value) return
      isHoldingRecord.value = false
      runOnJS(stopRecording)()
    })

  const panGesture = Gesture.Pan()
    .onStart((event) => {
      'worklet'
      isPanning.value = true
      recordButtonStartY.value = event.absoluteY
      const yForFullZoom = recordButtonStartY.value * 0.7
      const offsetYForFullZoom = recordButtonStartY.value - yForFullZoom
      zoomOffsetY.value = interpolate(
        zoom.value,
        [minZoom, maxZoom],
        [0, offsetYForFullZoom],
        Extrapolate.CLAMP,
      )
    })
    .onUpdate((event) => {
      'worklet'
      if (!isHoldingRecord.value) return
      const startY = recordButtonStartY.value
      const yForFullZoom = startY * 0.7
      zoom.value = interpolate(
        event.absoluteY - zoomOffsetY.value,
        [yForFullZoom, startY],
        [maxZoom, minZoom],
        Extrapolate.CLAMP,
      )
    })
    .onEnd(() => {
      'worklet'
      isPanning.value = false
      if (isHoldingRecord.value) {
        isHoldingRecord.value = false
        runOnJS(stopRecording)()
      }
    })

  const recordButtonGesture = Gesture.Simultaneous(tapRecordGesture, panGesture)
  const cameraGestures = Gesture.Race(doubleTapGesture, pinchGesture)

  const zoomIndicatorStyle = useAnimatedStyle(() => ({
    opacity: zoomIndicatorOpacity.value,
  }))

  const zoomBarFillStyle = useAnimatedStyle(() => ({
    width: `${Math.round(((zoom.value - minZoom) / (maxZoom - minZoom)) * 100)}%`,
  }))

  if (hasPermissions === false) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContent}>
          <Ionicons name="camera-outline" size={80} color="rgba(255,255,255,0.6)" />
          <Text style={styles.permissionTitle}>Camera & Microphone Access</Text>
          <Text style={styles.permissionDescription}>
            Flip needs camera and microphone access to record video via CameraX (
            {FLIP_ANDROID_CAPTURE.resolution.width}×{FLIP_ANDROID_CAPTURE.resolution.height} @{' '}
            {FLIP_ANDROID_CAPTURE.targetFps}fps).
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
      <GestureDetector gesture={cameraGestures}>
        <View style={StyleSheet.absoluteFill}>
          {isFocused && (
            <FlipCamerawesomeView
              style={StyleSheet.absoluteFill}
              facing={cameraPosition}
              zoom={zoomLevel}
              torchEnabled={flash && cameraPosition === 'back'}
              isActive={isFocused && isCameraActive}
              recording={isRecording}
              onCameraReady={() => setIsCameraReady(true)}
              onRecordingFinished={(e) => {
                const path = e.nativeEvent.uri || e.nativeEvent.path
                navigateToPreview(path, recordingDuration)
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
          )}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.5)']}
            style={styles.gradientOverlay}
            pointerEvents="none"
          />
        </View>
      </GestureDetector>

      <Reanimated.View style={[styles.zoomIndicator, zoomIndicatorStyle]}>
        <Text style={styles.zoomText}>{zoomLevel < 1.5 ? '1x' : `${zoomLevel.toFixed(1)}x`}</Text>
        <View style={styles.zoomBarContainer}>
          <Reanimated.View style={[styles.zoomBarFill, zoomBarFillStyle]} />
        </View>
      </Reanimated.View>

      <View style={styles.topBar}>
        <PressableHaptics onPress={handleClose} style={styles.topButton}>
          <Ionicons name="close" size={28} color="#fff" />
        </PressableHaptics>
        <View style={styles.engineBadge}>
          <Text style={styles.engineBadgeText}>CameraX · 1080p60 · OIS</Text>
        </View>
        <View style={styles.topButton} />
      </View>

      <View style={styles.rightControls}>
        <PressableHaptics
          onPress={() => setCameraPosition((p) => (p === 'back' ? 'front' : 'back'))}
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
              <View style={styles.uploadIconInner} />
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
                {isRecording ? 'Slide up to zoom' : 'Hold to record'}
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
  engineBadge: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  engineBadgeText: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '600' },
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
  },
  uploadIconInner: { width: 38, height: 38, borderRadius: 6, backgroundColor: '#fff' },
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
  zoomIndicator: {
    position: 'absolute',
    top: '45%',
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    zIndex: 5,
  },
  zoomText: { color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  zoomBarContainer: {
    width: 100,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  zoomBarFill: { height: '100%', backgroundColor: '#fff' },
  gradientOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '100%' },
})
