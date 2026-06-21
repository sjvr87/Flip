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
import androidx.camera.video.FallbackStrategy
import androidx.camera.video.FileOutputOptions
import androidx.camera.video.Quality
import androidx.camera.video.QualitySelector
import androidx.camera.video.Recorder
import androidx.camera.video.Recording
import androidx.camera.video.VideoCapture
import androidx.camera.video.VideoRecordEvent
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import java.io.File
import java.util.concurrent.Executor
import kotlin.math.max
import kotlin.math.min

/**
 * CameraX session tuned for flagship Android devices (Samsung Galaxy Ultra class sensors):
 * - FHD 1080p recording via Quality.FHD
 * - 60 FPS target where hardware supports it
 * - Video stabilization (OIS/EIS) when available
 * - Center-weighted exposure compensation for bright outdoor scenes
 */
class FlipCameraSession(
  private val previewView: PreviewView,
  private val lifecycleOwner: LifecycleOwner,
  private val mainExecutor: Executor,
) {
  companion object {
    private const val TAG = "FlipCameraSession"
    /** Preview target — 4K with CameraX fallback to nearest supported size. */
    const val TARGET_WIDTH = 3840
    const val TARGET_HEIGHT = 2160
    const val TARGET_FPS = 60
    /** 45 Mbps for UHD60; CameraX falls back to FHD when UHD is unsupported. */
    const val VIDEO_BITRATE = 45_000_000
  }

  private var cameraProvider: ProcessCameraProvider? = null
  private var camera: Camera? = null
  private var videoCapture: VideoCapture<Recorder>? = null
  private var imageCapture: ImageCapture? = null
  private var activeRecording: Recording? = null
  private var lensFacing: Int = CameraSelector.LENS_FACING_BACK
  private var zoomRatio: Float = 1f
  private var torchEnabled: Boolean = false

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
          rebindCamera()
          onReady()
        } catch (e: Exception) {
          onError(e.message ?: "Failed to bind CameraX")
        }
      },
      mainExecutor,
    )
  }

  fun setLensFacing(facing: String) {
    lensFacing =
      if (facing == "front") CameraSelector.LENS_FACING_FRONT else CameraSelector.LENS_FACING_BACK
    rebindCamera()
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

  /** Slight negative compensation helps prevent blown highlights on Samsung HDR sensors. */
  fun applyFlagshipExposureProfile() {
    val info = camera?.cameraInfo ?: return
    val range = info.exposureState.exposureCompensationRange
    if (range.upper <= range.lower) return
    val target = (range.lower + (range.upper - range.lower) * 0.35f).toInt()
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
  ) {
    val capture = imageCapture ?: run {
      onFailed("Image capture not ready")
      return
    }

    if (activeRecording != null) {
      onFailed("Cannot take photo while recording")
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
          onFailed(exception.message ?: "Photo capture failed")
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

    if (activeRecording != null) {
      onFailed("Already recording")
      return
    }

    val context = previewView.context
    val hasMic =
      ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
        PackageManager.PERMISSION_GRANTED

    val outputOptions = FileOutputOptions.Builder(outputFile).build()
    var pending = capture.output.prepareRecording(context, outputOptions)
    if (enableAudio && hasMic) {
      pending = pending.withAudioEnabled()
    }

    activeRecording =
      pending.start(mainExecutor) { event ->
        when (event) {
          is VideoRecordEvent.Finalize -> {
            activeRecording = null
            if (event.hasError()) {
              onFailed("Recording error: ${event.error}")
            } else {
              onFinished(outputFile.absolutePath)
            }
          }
          else -> Unit
        }
      }
  }

  fun stopRecording() {
    activeRecording?.stop()
  }

  fun unbind() {
    activeRecording?.stop()
    activeRecording = null
    cameraProvider?.unbindAll()
    camera = null
    videoCapture = null
    imageCapture = null
  }

  private fun rebindCamera() {
    val provider = cameraProvider ?: return
    provider.unbindAll()

    try {
      val previewResolutionSelector =
        ResolutionSelector.Builder()
          .setResolutionStrategy(
            ResolutionStrategy(
              Size(TARGET_WIDTH, TARGET_HEIGHT),
              ResolutionStrategy.FALLBACK_RULE_CLOSEST_HIGHER_THEN_LOWER,
            ),
          )
          .build()

      val previewBuilder =
        Preview.Builder().setResolutionSelector(previewResolutionSelector)

      // Prefer 60fps but allow fallback — strict Range(60, 60) can fail to bind on some devices.
      Camera2Interop.Extender(previewBuilder)
        .setCaptureRequestOption(
          CaptureRequest.CONTROL_AE_TARGET_FPS_RANGE,
          Range(30, TARGET_FPS),
        )
        .setCaptureRequestOption(
          CaptureRequest.LENS_OPTICAL_STABILIZATION_MODE,
          CaptureRequest.LENS_OPTICAL_STABILIZATION_MODE_ON,
        )
        .setCaptureRequestOption(
          CaptureRequest.CONTROL_VIDEO_STABILIZATION_MODE,
          CaptureRequest.CONTROL_VIDEO_STABILIZATION_MODE_ON,
        )

      val preview =
        previewBuilder.build().also { it.surfaceProvider = previewView.surfaceProvider }

      // Prefer UHD (4K) on flagship devices; fall back to FHD when hardware cannot bind UHD60.
      val qualitySelector =
        QualitySelector.fromOrderedList(
          listOf(Quality.UHD, Quality.FHD),
          FallbackStrategy.lowerQualityOrHigherThan(Quality.FHD),
        )

      val recorder =
        Recorder.Builder()
          .setQualitySelector(qualitySelector)
          .setTargetVideoEncodingBitRate(VIDEO_BITRATE)
          .build()

      val videoBuilder = VideoCapture.Builder(recorder).setVideoStabilizationEnabled(true)

      Camera2Interop.Extender(videoBuilder)
        .setCaptureRequestOption(
          CaptureRequest.CONTROL_AE_TARGET_FPS_RANGE,
          Range(30, TARGET_FPS),
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
        provider.bindToLifecycle(lifecycleOwner, selector, preview, capture, photoCapture)

      camera?.cameraControl?.setZoomRatio(zoomRatio)
      applyFlagshipExposureProfile()
      Log.d(TAG, "CameraX bound lensFacing=$lensFacing preview=${previewView.width}x${previewView.height}")
    } catch (e: Exception) {
      Log.e(TAG, "rebindCamera failed", e)
      throw e
    }
  }
}
