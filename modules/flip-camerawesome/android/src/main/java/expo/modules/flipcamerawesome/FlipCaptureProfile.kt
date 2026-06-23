package expo.modules.flipcamerawesome

import android.app.ActivityManager
import android.content.Context
import android.media.MediaCodecList
import android.media.MediaFormat
import android.os.Build
import androidx.camera.core.CameraSelector
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.video.FallbackStrategy
import androidx.camera.video.Quality
import androidx.camera.video.QualitySelector
import java.util.concurrent.TimeUnit

enum class CaptureTier {
  FLAGSHIP,
  STANDARD,
}

data class ResolvedCaptureProfile(
  val tier: CaptureTier,
  val qualityLabel: String,
  val badgeLabel: String,
  val previewWidth: Int,
  val previewHeight: Int,
  val videoBitrate: Int,
  val targetFps: Int,
  val prefersHevc: Boolean,
  val qualitySelector: QualitySelector,
) {
  fun toMap(): Map<String, Any> =
    mapOf(
      "tier" to tier.name.lowercase(),
      "quality" to qualityLabel,
      "badge" to badgeLabel,
      "resolution" to "${previewWidth}x${previewHeight}",
      "targetFps" to targetFps,
      "videoBitrate" to videoBitrate,
      "videoStabilization" to true,
      "codec" to if (prefersHevc) "hevc" else "h264",
      "engine" to "CameraX",
      "platform" to "android",
    )
}

object FlipCaptureProfile {
  const val TARGET_FPS = 60
  /** 1080p60 on flagship — 4K60 encoder OOMs / stalls on Samsung stacks. */
  const val FLAGSHIP_BITRATE = 18_000_000
  const val STANDARD_BITRATE = 12_000_000
  const val STANDARD_PREVIEW_WIDTH = 1920
  const val STANDARD_PREVIEW_HEIGHT = 1080
  /** Preview + capture stay 1080p — 4K preview/encode OOMs / stalls on Samsung stacks. */
  const val FLAGSHIP_PREVIEW_WIDTH = STANDARD_PREVIEW_WIDTH
  const val FLAGSHIP_PREVIEW_HEIGHT = STANDARD_PREVIEW_HEIGHT

  @Volatile
  var active: ResolvedCaptureProfile = defaultStandardProfile()

  fun defaultStandardProfile(): ResolvedCaptureProfile = buildStandardProfile()

  fun resolve(context: Context, provider: ProcessCameraProvider): ResolvedCaptureProfile {
    val supportsUhd =
      try {
        val backInfo =
          provider.availableCameraInfos.firstOrNull { info ->
            CameraSelector.DEFAULT_BACK_CAMERA.filter(listOf(info)).isNotEmpty()
          }
        if (backInfo == null) {
          false
        } else {
          QualitySelector.getSupportedQualities(backInfo).contains(Quality.UHD)
        }
      } catch (_: Exception) {
        false
      }

    val flagshipRam = isFlagshipRam(context)
    val tier =
      if (supportsUhd && flagshipRam) CaptureTier.FLAGSHIP else CaptureTier.STANDARD

    return when (tier) {
      CaptureTier.FLAGSHIP -> buildFlagshipProfile(supportsHevcEncoder())
      CaptureTier.STANDARD -> buildStandardProfile()
    }.also { active = it }
  }

  private fun isFlagshipRam(context: Context): Boolean {
    val activityManager =
      context.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager ?: return false
    val memoryInfo = ActivityManager.MemoryInfo()
    activityManager.getMemoryInfo(memoryInfo)
    val totalGb = memoryInfo.totalMem / (1024.0 * 1024.0 * 1024.0)
    // S26 Ultra class devices ship with 12 GB+; 8 GB floor avoids mid-range false positives.
    return totalGb >= 8.0
  }

  private fun supportsHevcEncoder(): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) return false
    return try {
      val list = MediaCodecList(MediaCodecList.REGULAR_CODECS)
      list.codecInfos.any { info ->
        info.isEncoder && info.supportedTypes.any { it.equals(MediaFormat.MIMETYPE_VIDEO_HEVC, true) }
      }
    } catch (_: Exception) {
      false
    }
  }

  private fun buildFlagshipProfile(prefersHevc: Boolean): ResolvedCaptureProfile {
    val qualitySelector =
      QualitySelector.fromOrderedList(
        listOf(Quality.FHD),
        FallbackStrategy.higherQualityOrLowerThan(Quality.FHD),
      )
    return ResolvedCaptureProfile(
      tier = CaptureTier.FLAGSHIP,
      qualityLabel = "FHD",
      badgeLabel = "1080p60 · OIS",
      previewWidth = FLAGSHIP_PREVIEW_WIDTH,
      previewHeight = FLAGSHIP_PREVIEW_HEIGHT,
      videoBitrate = FLAGSHIP_BITRATE,
      targetFps = TARGET_FPS,
      prefersHevc = prefersHevc,
      qualitySelector = qualitySelector,
    )
  }

  private fun buildStandardProfile(): ResolvedCaptureProfile {
    val qualitySelector =
      QualitySelector.fromOrderedList(
        listOf(Quality.FHD),
        FallbackStrategy.higherQualityOrLowerThan(Quality.FHD),
      )
    return ResolvedCaptureProfile(
      tier = CaptureTier.STANDARD,
      qualityLabel = "FHD",
      badgeLabel = "1080p60 · OIS",
      previewWidth = STANDARD_PREVIEW_WIDTH,
      previewHeight = STANDARD_PREVIEW_HEIGHT,
      videoBitrate = STANDARD_BITRATE,
      targetFps = TARGET_FPS,
      prefersHevc = false,
      qualitySelector = qualitySelector,
    )
  }

  /** Probe CameraX provider off the main thread during first bind. */
  fun awaitProvider(context: Context): ProcessCameraProvider {
    val future = ProcessCameraProvider.getInstance(context)
    return future.get(10, TimeUnit.SECONDS)
  }
}
