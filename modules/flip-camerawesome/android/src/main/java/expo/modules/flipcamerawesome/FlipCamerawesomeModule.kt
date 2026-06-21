package expo.modules.flipcamerawesome

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class FlipCamerawesomeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("FlipCamerawesome")

    View(FlipCamerawesomeView::class) {
      Prop("facing") { view: FlipCamerawesomeView, facing: String ->
        view.facing = facing
      }

      Prop("zoom") { view: FlipCamerawesomeView, zoom: Double ->
        view.zoom = zoom.toFloat()
      }

      Prop("torchEnabled") { view: FlipCamerawesomeView, enabled: Boolean ->
        view.torchEnabled = enabled
      }

      Prop("isActive") { view: FlipCamerawesomeView, active: Boolean ->
        view.isActive = active
      }

      Prop("recording") { view: FlipCamerawesomeView, recording: Boolean ->
        view.recording = recording
      }

      Events("onCameraReady", "onRecordingFinished", "onRecordingError", "onCameraError")
    }

    AsyncFunction("getCaptureProfile") {
      mapOf(
        "platform" to "android",
        "engine" to "CameraX",
        "resolution" to "1080p",
        "targetFps" to FlipCameraSession.TARGET_FPS,
        "videoStabilization" to true,
        "quality" to "FHD",
      )
    }
  }
}
