package expo.modules.flipcamerawesome

import android.os.OperationCanceledException
import android.util.Log
import expo.modules.kotlin.activityresult.AppContextActivityResultLauncher
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class FlipCamerawesomeModule : Module() {
  private lateinit var galleryPickerLauncher:
    AppContextActivityResultLauncher<GalleryPickerContractInput, GalleryPickerContractResult>

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

      Prop("photoRequestId") { view: FlipCamerawesomeView, id: Int ->
        view.photoRequestId = id
      }

      Events(
        "onCameraReady",
        "onRecordingFinished",
        "onRecordingError",
        "onPhotoCaptured",
        "onPhotoCaptureError",
        "onCameraError",
      )
    }

    AsyncFunction("getCaptureProfile") {
      mapOf(
        "platform" to "android",
        "engine" to "CameraX",
        "resolution" to "${FlipCameraSession.PREVIEW_TARGET_WIDTH}x${FlipCameraSession.PREVIEW_TARGET_HEIGHT}",
        "targetFps" to FlipCameraSession.TARGET_FPS,
        "videoStabilization" to true,
        "quality" to "UHD",
      )
    }

    AsyncFunction("launchGalleryPickerAsync") Coroutine { ->
      try {
        Log.i(
          "FlipGalleryPicker",
          "launchGalleryPickerAsync: samsung=${GalleryPickerContract.isSamsungDevice()}",
        )
        when (val result = galleryPickerLauncher.launch(GalleryPickerContractInput)) {
          is GalleryPickerContractResult.Cancelled -> mapOf("canceled" to true)
          is GalleryPickerContractResult.Success ->
            withContext(Dispatchers.IO) {
              val context =
                appContext.reactContext ?: throw Exceptions.ReactContextLost()
              val (uri, type) =
                GalleryPickerHelper.materializePickedMedia(
                  context,
                  appContext.cacheDirectory,
                  result.uri,
                )
              Log.i("FlipGalleryPicker", "Picked media type=$type uri=$uri")
              mapOf(
                "canceled" to false,
                "uri" to uri,
                "type" to type,
              )
            }
        }
      } catch (error: OperationCanceledException) {
        mapOf("canceled" to true)
      } catch (error: Exception) {
        Log.e("FlipGalleryPicker", "launchGalleryPickerAsync failed", error)
        throw error
      }
    }

    RegisterActivityContracts {
      galleryPickerLauncher =
        registerForActivityResult(GalleryPickerContract()) { _, _ -> }
    }
  }
}
