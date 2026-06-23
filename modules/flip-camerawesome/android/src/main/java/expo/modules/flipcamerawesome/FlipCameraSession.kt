package expo.modules.flipcamerawesome

import android.Manifest
import android.content.pm.PackageManager
import android.hardware.camera2.CaptureRequest
import android.util.Log
import android.util.Range
import android.util.Size
import androidx.camera.camera2.interop.Camera2Interop
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.video.FileOutputOptions
import androidx.camera.video.Quality
import androidx.camera.video.Recorder
import androidx.camera.video.Recording
import androidx.camera.video.VideoCapture
import androidx.camera.video.VideoRecordEvent
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import java.io.File
import java.util.concurrent.Executor
import java.util.concurrent.Executors
import kotlin.math.max
import kotlin.math.min

/**
 * CameraX session with flagship (FHD60 @ 18 Mbps) and standard (FHD60 @ 12 Mbps) tiers.
 */
class FlipCameraSession(
  private val previewView: PreviewView,
  private val lifecycleOwner: LifecycleOwner,
  private val mainExecutor: Executor,
  initialFacing: String = "back",
  initialZoom: Float = 1f,
  initialTorch: Boolean = false,
) {
  companion object {
    private const val TAG = "FlipCameraSession"
    private const val RECORDING_START_TIMEOUT_MS = 8_000L
    private val recordingExecutor = Executors.newSingleThreadExecutor()
  }

  private var cameraProvider: ProcessCameraProvider? = null
  private var camera: Camera? = null
  private var preview: Preview? = null
  private var videoCapture: VideoCapture<Recorder>? = null
  private var imageCapture: ImageCapture? = null
  private var activeRecording: Recording? = null
  @Volatile private var recordingStarting = false
  /** Set only while start() runs — blocks preview surface rebind during the race window. */
  @Volatile private var pausePreviewRefresh = false
  private var recordingGeneration = 0
  private var profile: ResolvedCaptureProfile = FlipCaptureProfile.defaultStandardProfile()
  private var lensFacing: Int =
    if (initialFacing == "front") CameraSelector.LENS_FACING_FRONT else CameraSelector.LENS_FACING_BACK
  private var zoomRatio: Float = initialZoom
  private var torchEnabled: Boolean = initialTorch

  fun isRecording(): Boolean = activeRecording != null || recordingStarting

  fun currentProfile(): ResolvedCaptureProfile = profile

  fun bind(onReady: () -> Unit, onError: (String) -> Unit) {
    val context = previewView.context
    if (
      ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) !=
        PackageManager.PERMISSION_GRANTED
    ) {
      onError("Camera permission not granted")
      return
    }

    val future = ProcessCameraProvider.getInstance(context)
    future.addListener(
      {
        try {
          val provider = future.get()
          cameraProvider = provider
          profile = FlipCaptureProfile.resolve(context, provider)
          if (!rebindCamera()) {
            onError("Failed to bind CameraX")
            return@addListener
          }
          onReady()
        } catch (e: Exception) {
          onError(e.message ?: "Failed to bind CameraX")
        }
      },
      mainExecutor,
    )
  }

  fun setLensFacing(facing: String) {
    val nextFacing =
      if (facing == "front") CameraSelector.LENS_FACING_FRONT else CameraSelector.LENS_FACING_BACK
    if (nextFacing == lensFacing && camera != null) return
    lensFacing = nextFacing
    if (!rebindCamera()) {
      Log.w(TAG, "setLensFacing: rebind failed after lens switch to $facing")
    }
  }

  fun setZoom(ratio: Float) {
    zoomRatio = max(1f, min(ratio, camera?.cameraInfo?.zoomState?.value?.maxZoomRatio ?: 10f))
    camera?.cameraControl?.setZoomRatio(zoomRatio)
  }

  fun setExposureCompensation(index: Int) {
    val info = camera?.cameraInfo ?: return
    val range = info.exposureState.exposureCompensationRange
    val clamped = index.coerceIn(range.lower, range.upper)
    camera?.cameraControl?.setExposureCompensationIndex(clamped)
  }

  /** Light negative EV — avoids over-darkening flagship HDR sensors. */
  fun applyFlagshipExposureProfile() {
    val info = camera?.cameraInfo ?: return
    val range = info.exposureState.exposureCompensationRange
    if (range.upper <= range.lower) return
    val target = (range.lower + (range.upper - range.lower) * 0.15f).toInt()
    setExposureCompensation(target.coerceIn(range.lower, range.upper))
  }

  fun setTorch(enabled: Boolean) {
    torchEnabled = enabled
    camera?.cameraControl?.enableTorch(enabled)
  }

  fun takePicture(
    outputFile: File,
    onFinished: (String) -> Unit,
    onFailed: (String) -> Unit,
    allowRetry: Boolean = true,
  ) {
    if (isRecording()) {
      onFailed("Cannot take photo while recording")
      return
    }

    val capture = imageCapture ?: run {
      onFailed("Image capture not ready")
      return
    }

    capture.flashMode =
      if (torchEnabled && lensFacing == CameraSelector.LENS_FACING_BACK) {
        ImageCapture.FLASH_MODE_ON
      } else {
        ImageCapture.FLASH_MODE_OFF
      }

    val outputOptions = ImageCapture.OutputFileOptions.Builder(outputFile).build()
    capture.takePicture(
      outputOptions,
      mainExecutor,
      object : ImageCapture.OnImageSavedCallback {
        override fun onImageSaved(output: ImageCapture.OutputFileResults) {
          onFinished(outputFile.absolutePath)
        }

        override fun onError(exception: ImageCaptureException) {
          val msg = exception.message ?: "Photo capture failed"
          if (
            allowRetry &&
              exception.imageCaptureError == ImageCapture.ERROR_CAMERA_CLOSED
          ) {
            Log.w(TAG, "takePicture: camera closed after recording, rebinding")
            if (rebindCamera()) {
              takePicture(outputFile, onFinished, onFailed, allowRetry = false)
            } else {
              onFailed(msg)
            }
          } else {
            onFailed(msg)
          }
        }
      },
    )
  }

  fun startRecording(
    outputFile: File,
    enableAudio: Boolean,
    onFinished: (String) -> Unit,
    onFailed: (String) -> Unit,
  ) {
    val capture = videoCapture ?: run {
      onFailed("Video capture not ready")
      return
    }

    if (isRecording()) {
      Log.w(TAG, "startRecording: stale recording state — recovering before retry")
      recoverAfterRecordingFailure()
      if (isRecording()) {
        onFailed("Already recording")
        return
      }
    }

    val generation = ++recordingGeneration
    recordingStarting = true
    // Block surface rebind for the whole start pipeline (prepareRecording + start).
    pausePreviewRefresh = true

    val context = previewView.context
    val hasMic =
      ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
        PackageManager.PERMISSION_GRANTED

    // Encoder setup (prepareRecording + start) must stay off the main thread.
    recordingExecutor.execute {
      if (generation != recordingGeneration) {
        recordingStarting = false
        return@execute
      }

      try {
        val outputOptions = FileOutputOptions.Builder(outputFile).build()
        var pending = capture.output.prepareRecording(context, outputOptions)
        if (enableAudio && hasMic) {
          pending = pending.withAudioEnabled()
        }

        if (generation != recordingGeneration) {
          recordingStarting = false
          pausePreviewRefresh = false
          return@execute
        }

        lateinit var recording: Recording
        recording =
          pending.start(mainExecutor) { event ->
            when (event) {
              is VideoRecordEvent.Start -> {
                pausePreviewRefresh = false
                if (generation != recordingGeneration) {
                  recording.stop()
                  recordingStarting = false
                  return@start
                }
                recordingStarting = false
                activeRecording = recording
                Log.d(TAG, "Recording started ${profile.badgeLabel}")
                // After encoder owns the pipeline, re-attach preview (TextureView freezes if we
                // skip this; doing it before Start races encoder init on Samsung stacks).
                schedulePostStartPreviewReconnect()
              }
              is VideoRecordEvent.Finalize -> {
                pausePreviewRefresh = false
                recordingStarting = false
                if (activeRecording === recording) {
                  activeRecording = null
                }
                if (generation != recordingGeneration) {
                  schedulePreviewRefresh()
                  return@start
                }
                schedulePreviewRefresh()
                if (event.hasError()) {
                  notifyRecordingFailed(
                    generation,
                    onFailed,
                    "Recording error: ${event.error}",
                  )
                } else {
                  mainExecutor.execute {
                    onFinished(outputFile.absolutePath)
                  }
                  schedulePostFinalizeRebind()
                }
              }
              else -> Unit
            }
          }

        mainExecutor.execute {
          previewView.postDelayed(
            {
              if (generation != recordingGeneration) return@postDelayed
              if (activeRecording == null && recordingStarting) {
                Log.e(TAG, "Recording start timed out after ${RECORDING_START_TIMEOUT_MS}ms")
                recordingStarting = false
                pausePreviewRefresh = false
                try {
                  recording.stop()
                } catch (e: Exception) {
                  Log.w(TAG, "Recording timeout: stop failed", e)
                }
                notifyRecordingFailed(
                  generation,
                  onFailed,
                  "Recording failed to start (timeout)",
                )
              }
            },
            RECORDING_START_TIMEOUT_MS,
          )
        }

        if (generation != recordingGeneration) {
          pausePreviewRefresh = false
          recordingStarting = false
          try {
            recording.stop()
          } catch (e: Exception) {
            Log.w(TAG, "startRecording: cancelled in-flight recording", e)
          }
          schedulePreviewRefresh()
        }
      } catch (e: Exception) {
        pausePreviewRefresh = false
        recordingStarting = false
        Log.e(TAG, "startRecording failed", e)
        if (generation == recordingGeneration) {
          notifyRecordingFailed(
            generation,
            onFailed,
            e.message ?: "Recording failed to start",
          )
        }
      }
    }
  }

  fun stopRecording() {
    ++recordingGeneration
    recordingStarting = false
    pausePreviewRefresh = false
    val recording = activeRecording
    activeRecording = null
    recording?.stop()
    schedulePreviewRefresh()
  }

  /**
   * Full CameraX rebind after a recording failure — surface-only refresh leaves a dead preview
   * and a stale Recorder that blocks the next start on Samsung stacks.
   */
  fun recoverAfterRecordingFailure() {
    Log.w(TAG, "recoverAfterRecordingFailure: rebinding camera")
    clearRecordingBeforeRebind()
    if (!rebindCamera()) {
      Log.e(TAG, "recoverAfterRecordingFailure: rebind failed")
    }
    schedulePreviewRefresh()
  }

  private fun notifyRecordingFailed(
    generation: Int,
    onFailed: (String) -> Unit,
    message: String,
  ) {
    mainExecutor.execute {
      if (generation != recordingGeneration) return@execute
      recoverAfterRecordingFailure()
      onFailed(message)
    }
  }

  /** Re-attach preview surface after recording ends or is cancelled (unfreezes TextureView). */
  private fun schedulePreviewRefresh() {
    mainExecutor.execute {
      previewView.post { refreshPreviewSurface() }
    }
  }

  /** Encoder teardown after a successful clip — prevents stale Recorder on the next start. */
  private fun schedulePostFinalizeRebind() {
    mainExecutor.execute {
      previewView.postDelayed(
        {
          if (isRecording() || pausePreviewRefresh || cameraProvider == null) return@postDelayed
          Log.d(TAG, "post-finalize rebind for next record")
          if (!rebindCamera()) {
            Log.w(TAG, "post-finalize rebind failed")
          }
          schedulePreviewRefresh()
        },
        300,
      )
    }
  }

  /** One-shot reconnect once VideoRecordEvent.Start confirms the encoder is live. */
  private fun schedulePostStartPreviewReconnect() {
    mainExecutor.execute {
      previewView.postDelayed(
        {
          if (activeRecording == null || pausePreviewRefresh) return@postDelayed
          val previewUseCase = preview ?: return@postDelayed
          if (previewView.width <= 0 || previewView.height <= 0) return@postDelayed
          previewUseCase.surfaceProvider = previewView.surfaceProvider
          Log.d(TAG, "post-start preview reconnect ${previewView.width}x${previewView.height}")
        },
        200,
      )
    }
  }

  fun refreshPreviewSurface() {
    if (pausePreviewRefresh) {
      Log.d(TAG, "refreshPreviewSurface skipped — recording start in flight")
      return
    }
    if (activeRecording != null) {
      Log.d(TAG, "refreshPreviewSurface skipped — recording active")
      return
    }
    val previewUseCase = preview ?: return
    if (previewView.width <= 0 || previewView.height <= 0) return
    previewUseCase.surfaceProvider = previewView.surfaceProvider
    Log.d(
      TAG,
      "refreshPreviewSurface ${profile.badgeLabel} preview=${previewView.width}x${previewView.height}",
    )
  }

  fun unbind() {
    stopRecording()
    cameraProvider?.unbindAll()
    camera = null
    preview = null
    videoCapture = null
    imageCapture = null
  }

  private fun clearRecordingBeforeRebind() {
    ++recordingGeneration
    recordingStarting = false
    pausePreviewRefresh = false
    val recording = activeRecording
    activeRecording = null
    if (recording == null) return
    try {
      recording.stop()
    } catch (e: Exception) {
      Log.w(TAG, "clearRecordingBeforeRebind: stop failed", e)
    }
  }

  /** @return true when CameraX bound successfully (possibly after 1080p fallback). */
  private fun rebindCamera(): Boolean {
    val provider = cameraProvider ?: return false
    clearRecordingBeforeRebind()
    provider.unbindAll()

    return try {
      bindWithCurrentProfile(provider)
      true
    } catch (e: Throwable) {
      Log.e(TAG, "rebindCamera failed tier=${profile.tier} badge=${profile.badgeLabel}", e)
      if (profile.tier != CaptureTier.FLAGSHIP) return false

      profile = FlipCaptureProfile.defaultStandardProfile()
      FlipCaptureProfile.active = profile
      provider.unbindAll()
      try {
        bindWithCurrentProfile(provider)
        Log.w(TAG, "rebindCamera: fell back to ${profile.badgeLabel} after flagship bind failure")
        true
      } catch (fallback: Throwable) {
        Log.e(TAG, "rebindCamera: standard fallback also failed", fallback)
        false
      }
    }
  }

  private fun bindWithCurrentProfile(provider: ProcessCameraProvider) {
    val previewResolutionSelector =
      ResolutionSelector.Builder()
        .setResolutionStrategy(
          ResolutionStrategy(
            Size(profile.previewWidth, profile.previewHeight),
            ResolutionStrategy.FALLBACK_RULE_CLOSEST_HIGHER_THEN_LOWER,
          ),
        )
        .build()

    val previewBuilder =
      Preview.Builder().setResolutionSelector(previewResolutionSelector)

    Camera2Interop.Extender(previewBuilder)
      .setCaptureRequestOption(
        CaptureRequest.CONTROL_AE_TARGET_FPS_RANGE,
        Range(30, profile.targetFps),
      )
      .setCaptureRequestOption(
        CaptureRequest.LENS_OPTICAL_STABILIZATION_MODE,
        CaptureRequest.LENS_OPTICAL_STABILIZATION_MODE_ON,
      )
      .setCaptureRequestOption(
        CaptureRequest.CONTROL_VIDEO_STABILIZATION_MODE,
        CaptureRequest.CONTROL_VIDEO_STABILIZATION_MODE_ON,
      )

    val previewUseCase =
      previewBuilder.build().also { it.surfaceProvider = previewView.surfaceProvider }
    preview = previewUseCase

    val recorder =
      Recorder.Builder()
        .setQualitySelector(profile.qualitySelector)
        .setTargetVideoEncodingBitRate(profile.videoBitrate)
        .build()

    val videoBuilder = VideoCapture.Builder(recorder).setVideoStabilizationEnabled(true)

    Camera2Interop.Extender(videoBuilder)
      .setCaptureRequestOption(
        CaptureRequest.CONTROL_AE_TARGET_FPS_RANGE,
        Range(30, profile.targetFps),
      )
      .setCaptureRequestOption(
        CaptureRequest.LENS_OPTICAL_STABILIZATION_MODE,
        CaptureRequest.LENS_OPTICAL_STABILIZATION_MODE_ON,
      )
      .setCaptureRequestOption(
        CaptureRequest.CONTROL_AE_MODE,
        CaptureRequest.CONTROL_AE_MODE_ON,
      )

    val capture = videoBuilder.build()
    videoCapture = capture

    val photoCapture =
      ImageCapture.Builder()
        .setCaptureMode(ImageCapture.CAPTURE_MODE_MAXIMIZE_QUALITY)
        .build()

    imageCapture = photoCapture

    val selector =
      CameraSelector.Builder().requireLensFacing(lensFacing).build()

    camera =
      provider.bindToLifecycle(lifecycleOwner, selector, previewUseCase, capture, photoCapture)

    camera?.cameraControl?.setZoomRatio(zoomRatio)
    camera?.cameraControl?.enableTorch(torchEnabled)
    applyFlagshipExposureProfile()
    Log.d(
      TAG,
      "CameraX bound ${profile.badgeLabel} lensFacing=$lensFacing " +
        "preview=${previewView.width}x${previewView.height} bitrate=${profile.videoBitrate}",
    )
  }
}
