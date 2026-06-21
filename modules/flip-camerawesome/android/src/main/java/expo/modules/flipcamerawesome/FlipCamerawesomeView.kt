package expo.modules.flipcamerawesome

import android.content.Context
import androidx.camera.view.PreviewView
import androidx.lifecycle.findViewTreeLifecycleOwner
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import java.io.File

class FlipCamerawesomeView(context: Context, appContext: AppContext) :
  ExpoView(context, appContext) {

  private val previewView =
    PreviewView(context).also {
      it.implementationMode = PreviewView.ImplementationMode.PERFORMANCE
      it.scaleType = PreviewView.ScaleType.FILL_CENTER
      addView(it, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
    }

  private var session: FlipCameraSession? = null
  private var isRecordingProp = false
  private var pendingStartRecording = false

  val onCameraReady by EventDispatcher()
  val onRecordingFinished by EventDispatcher()
  val onRecordingError by EventDispatcher()
  val onCameraError by EventDispatcher()

  var facing: String = "back"
    set(value) {
      field = value
      session?.setLensFacing(value)
    }

  var zoom: Float = 1f
    set(value) {
      field = value
      session?.setZoom(value)
    }

  var torchEnabled: Boolean = false
    set(value) {
      field = value
      session?.setTorch(value)
    }

  var isActive: Boolean = true
    set(value) {
      field = value
      if (value) bindSession() else session?.unbind()
    }

  var recording: Boolean = false
    set(value) {
      if (field == value) return
      field = value
      if (value) {
        startRecordingInternal()
      } else {
        session?.stopRecording()
      }
    }

  init {
    post { bindSession() }
  }

  private fun bindSession() {
    if (!isActive) return
    val lifecycleOwner = findViewTreeLifecycleOwner() ?: run {
      postDelayed({ bindSession() }, 100)
      return
    }

    session?.unbind()
    session =
      FlipCameraSession(
        previewView,
        lifecycleOwner,
        context.mainExecutor,
      )

    session?.bind(
      onReady = { onCameraReady(mapOf("ready" to true)) },
      onError = { msg -> onCameraError(mapOf("message" to msg)) },
    )
    session?.setLensFacing(facing)
    session?.setZoom(zoom)
    session?.setTorch(torchEnabled)

    if (pendingStartRecording || recording) {
      pendingStartRecording = false
      startRecordingInternal()
    }
  }

  private fun startRecordingInternal() {
    val activeSession = session
    if (activeSession == null) {
      pendingStartRecording = true
      return
    }

    val cacheDir = context.cacheDir
    val outputFile = File(cacheDir, "flip_${System.currentTimeMillis()}.mp4")

    activeSession.startRecording(
      outputFile = outputFile,
      enableAudio = true,
      onFinished = { path ->
        onRecordingFinished(mapOf("path" to path, "uri" to "file://$path"))
      },
      onFailed = { msg ->
        onRecordingError(mapOf("message" to msg))
      },
    )
  }

  override fun onDetachedFromWindow() {
    session?.unbind()
    session = null
    super.onDetachedFromWindow()
  }
}
