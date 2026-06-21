package expo.modules.flipcamerawesome

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.util.Log
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.findViewTreeLifecycleOwner
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import java.io.File

class FlipCamerawesomeView(context: Context, appContext: AppContext) :
  ExpoView(context, appContext) {

  override val shouldUseAndroidLayout: Boolean = true

  private val previewView =
    PreviewView(context).also {
      // COMPATIBLE (TextureView) avoids black preview with RN view hierarchies on Samsung devices.
      it.implementationMode = PreviewView.ImplementationMode.COMPATIBLE
      it.scaleType = PreviewView.ScaleType.FILL_CENTER
      addView(it, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
    }

  private var session: FlipCameraSession? = null
  private var pendingStartRecording = false
  private var bindRetryCount = 0

  val onCameraReady by EventDispatcher()
  val onRecordingFinished by EventDispatcher()
  val onRecordingError by EventDispatcher()
  val onPhotoCaptured by EventDispatcher()
  val onPhotoCaptureError by EventDispatcher()
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

  var photoRequestId: Int = 0
    set(value) {
      if (value <= 0 || value == field) return
      field = value
      takePhotoInternal()
    }

  init {
    installHierarchyFitter()
    post { bindSession() }
  }

  private fun resolveLifecycleOwner(): LifecycleOwner? {
    findViewTreeLifecycleOwner()?.let { return it }
    return appContext.currentActivity as? LifecycleOwner
  }

  private fun hasCameraPermission(): Boolean =
    ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
      PackageManager.PERMISSION_GRANTED

  private fun bindSession() {
    if (!isActive) return

    if (!hasCameraPermission()) {
      Log.w(TAG, "bindSession: CAMERA permission not granted")
      onCameraError(mapOf("message" to "Camera permission not granted"))
      return
    }

    val lifecycleOwner = resolveLifecycleOwner() ?: run {
      if (bindRetryCount++ < MAX_BIND_RETRIES) {
        postDelayed({ bindSession() }, 100)
      } else {
        Log.e(TAG, "bindSession: no LifecycleOwner after $MAX_BIND_RETRIES retries")
        onCameraError(mapOf("message" to "Camera lifecycle not available"))
      }
      return
    }

    bindRetryCount = 0
    Log.d(TAG, "bindSession: preview=${previewView.width}x${previewView.height} facing=$facing")

    session?.unbind()
    session =
      FlipCameraSession(
        previewView,
        lifecycleOwner,
        context.mainExecutor,
      )

    session?.bind(
      onReady = {
        Log.d(TAG, "CameraX bound; preview=${previewView.width}x${previewView.height}")
        onCameraReady(mapOf("ready" to true))
      },
      onError = { msg ->
        Log.e(TAG, "CameraX bind failed: $msg")
        onCameraError(mapOf("message" to msg))
      },
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

  private fun takePhotoInternal() {
    val activeSession = session ?: run {
      onPhotoCaptureError(mapOf("message" to "Camera not ready"))
      return
    }

    val outputFile = File(context.cacheDir, "flip_${System.currentTimeMillis()}.jpg")
    activeSession.takePicture(
      outputFile = outputFile,
      onFinished = { path ->
        onPhotoCaptured(mapOf("path" to path, "uri" to "file://$path"))
      },
      onFailed = { msg ->
        onPhotoCaptureError(mapOf("message" to msg))
      },
    )
  }

  override fun onDetachedFromWindow() {
    session?.unbind()
    session = null
    super.onDetachedFromWindow()
  }

  companion object {
    private const val TAG = "FlipCamerawesome"
    private const val MAX_BIND_RETRIES = 50
  }
}
