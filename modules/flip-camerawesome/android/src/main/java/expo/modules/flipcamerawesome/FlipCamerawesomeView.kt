package expo.modules.flipcamerawesome

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.util.Log
import android.view.View
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
      // TextureView composites correctly over RN; PERFORMANCE can black-screen on some stacks.
      it.implementationMode = PreviewView.ImplementationMode.COMPATIBLE
      it.scaleType = PreviewView.ScaleType.FILL_CENTER
      it.setBackgroundColor(android.graphics.Color.BLACK)
      addView(it, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
    }

  private var session: FlipCameraSession? = null
  private var pendingStartRecording = false
  private var bindRetryCount = 0
  private var bindGeneration = 0
  private var isBinding = false
  private var isSyncingLayout = false
  private var lastSyncedWidth = 0
  private var lastSyncedHeight = 0

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

  var isActive: Boolean = false
    set(value) {
      if (field == value) return
      field = value
      if (value) {
        post { maybeBindAfterLayout() }
      } else {
        ++bindGeneration
        isBinding = false
        pendingStartRecording = false
        if (recording) {
          recording = false
        }
        session?.unbind()
        session = null
      }
    }

  var recording: Boolean = false
    set(value) {
      if (field == value) return
      field = value
      if (value) {
        startRecordingInternal()
      } else {
        pendingStartRecording = false
        session?.stopRecording()
      }
    }

  /** JS capture mode — stops any in-flight recording when leaving video. */
  var captureMode: String = "video"
    set(value) {
      if (field == value) return
      field = value
      if (value != "video") {
        pendingStartRecording = false
        if (recording) {
          recording = false
        } else if (session?.isRecording() == true) {
          // In-flight native start (JS recording flag may still be false).
          session?.stopRecording()
        }
        // Preview refresh runs from stopRecording/Finalize — do not race finalize here.
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
    previewView.addOnLayoutChangeListener { _, _, _, _, _, _, _, _, _ ->
      maybeBindAfterLayout()
    }
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    if (isActive) {
      post { maybeBindAfterLayout() }
    }
  }

  override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
    super.onSizeChanged(w, h, oldw, oldh)
    // RN lays out the ExpoView root; PreviewView often stays 0x0 until we sync it.
    if (w > 0 && h > 0) {
      maybeBindAfterLayout()
    }
  }

  /** RN sizes the root view; child PreviewView may not receive a layout pass on its own. */
  private fun hasUsableLayout(): Boolean =
    (width > 0 && height > 0) || (previewView.width > 0 && previewView.height > 0)

  private fun syncPreviewLayout() {
    if (width <= 0 || height <= 0) return
    if (previewView.width == width && previewView.height == height) {
      lastSyncedWidth = width
      lastSyncedHeight = height
      return
    }
    if (isSyncingLayout) return
    isSyncingLayout = true
    try {
      previewView.measure(
        View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY),
        View.MeasureSpec.makeMeasureSpec(height, View.MeasureSpec.EXACTLY),
      )
      previewView.layout(0, 0, width, height)
      lastSyncedWidth = width
      lastSyncedHeight = height
    } finally {
      isSyncingLayout = false
    }
  }

  private fun maybeBindAfterLayout() {
    if (!isActive) return
    val rootChanged = width != lastSyncedWidth || height != lastSyncedHeight
    if (session != null && !rootChanged) return

    syncPreviewLayout()
    if (!hasUsableLayout()) return

    val activeSession = session
    if (activeSession != null) {
      if (rootChanged && !activeSession.isRecording() && !recording) {
        previewView.post { activeSession.refreshPreviewSurface() }
      }
      return
    }

    if (!isBinding) {
      post { bindSession() }
    }
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

    syncPreviewLayout()
    if (!hasUsableLayout()) {
      Log.d(
        TAG,
        "bindSession: defer until layout (root=${width}x${height} preview=${previewView.width}x${previewView.height})",
      )
      return
    }

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

    if (isBinding) {
      // A stale bind can block retries if the async callback never fires.
      if (session == null) isBinding = false else return
    }

    bindRetryCount = 0
    val generation = ++bindGeneration
    isBinding = true
    Log.d(
      TAG,
      "bindSession: root=${width}x${height} preview=${previewView.width}x${previewView.height} facing=$facing gen=$generation",
    )

    session?.unbind()
    val newSession =
      FlipCameraSession(
        previewView,
        lifecycleOwner,
        context.mainExecutor,
        facing,
        zoom,
        torchEnabled,
      )
    session = newSession

    newSession.bind(
      onReady = {
        if (!isActive || generation != bindGeneration || session !== newSession) return@bind
        isBinding = false
        Log.d(TAG, "CameraX bound; preview=${previewView.width}x${previewView.height}")
        previewView.post {
          val willRecord = pendingStartRecording || recording
          if (!willRecord) {
            newSession.refreshPreviewSurface()
          }
          val profileMap = newSession.currentProfile().toMap()
          onCameraReady(mapOf("ready" to true, "profile" to profileMap))
          if (willRecord) {
            pendingStartRecording = false
            startRecordingInternal()
          }
        }
      },
      onError = { msg ->
        if (generation != bindGeneration) return@bind
        isBinding = false
        Log.e(TAG, "CameraX bind failed: $msg")
        onCameraError(mapOf("message" to msg))
      },
    )
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
        if (recording) {
          recording = false
        }
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
    ++bindGeneration
    isBinding = false
    session?.unbind()
    session = null
    super.onDetachedFromWindow()
  }

  companion object {
    private const val TAG = "FlipCamerawesome"
    private const val MAX_BIND_RETRIES = 50
  }
}
