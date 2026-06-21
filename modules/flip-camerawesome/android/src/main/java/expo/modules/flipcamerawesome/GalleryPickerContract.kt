package expo.modules.flipcamerawesome

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import android.util.Log
import expo.modules.kotlin.activityresult.AppContextActivityResultContract
import java.io.Serializable

internal object GalleryPickerContractInput : Serializable {
  private const val serialVersionUID = 1L
}

internal sealed class GalleryPickerContractResult {
  data object Cancelled : GalleryPickerContractResult()
  data class Success(val uri: Uri) : GalleryPickerContractResult()
}

internal class GalleryPickerContract :
  AppContextActivityResultContract<GalleryPickerContractInput, GalleryPickerContractResult> {

  override fun createIntent(context: Context, input: GalleryPickerContractInput): Intent {
    val intent = createGalleryIntent(context, preferSamsung = isSamsungDevice())
    Log.i(
      TAG,
      "Launching gallery picker: action=${intent.action} " +
        "package=${intent.`package`} component=${intent.component}",
    )
    return intent
  }

  override fun parseResult(
    input: GalleryPickerContractInput,
    resultCode: Int,
    intent: Intent?,
  ): GalleryPickerContractResult {
    if (resultCode != Activity.RESULT_OK) {
      return GalleryPickerContractResult.Cancelled
    }

    val uri =
      intent?.data
        ?: intent?.clipData?.takeIf { it.itemCount > 0 }?.getItemAt(0)?.uri
        ?: readSamsungSelectedItems(intent)?.firstOrNull()

    return if (uri != null) {
      GalleryPickerContractResult.Success(uri)
    } else {
      GalleryPickerContractResult.Cancelled
    }
  }

  companion object {
    private const val TAG = "FlipGalleryPicker"

    private val SAMSUNG_GALLERY_PACKAGES =
      listOf(
        "com.sec.android.gallery3d",
        "com.samsung.android.gallery",
        "com.sec.android.app.gallery",
      )

    fun isSamsungDevice(): Boolean =
      Build.MANUFACTURER.equals("samsung", ignoreCase = true)

    fun createGalleryIntent(context: Context, preferSamsung: Boolean): Intent {
      if (!preferSamsung) {
        return createGenericGetContentIntent()
      }

      findSamsungGalleryIntent(context)?.let { return it }

      Log.w(TAG, "Could not target Samsung Gallery directly; using chooser with Samsung shortcuts")
      return createChooserPreferringSamsung(context)
    }

    private fun findSamsungGalleryIntent(context: Context): Intent? {
      val packageManager = context.packageManager

      for (packageName in SAMSUNG_GALLERY_PACKAGES) {
        if (!isPackageInstalled(packageManager, packageName)) {
          Log.d(TAG, "Package not installed or not visible: $packageName")
          continue
        }

        for (baseIntent in samsungIntentCandidates()) {
          val handlers = queryHandlers(packageManager, baseIntent)
          val samsungHandler =
            handlers.firstOrNull { it.activityInfo.packageName == packageName }

          if (samsungHandler != null) {
            val explicit =
              Intent(baseIntent).apply {
                setClassName(packageName, samsungHandler.activityInfo.name)
              }
            Log.i(
              TAG,
              "Resolved Samsung handler: $packageName/${samsungHandler.activityInfo.name} " +
                "for action=${baseIntent.action}",
            )
            return explicit
          }
        }

        // Package is installed — launch it directly. Do NOT gate on resolveActivity();
        // on API 30+ it returns null without <queries> even when the app can handle the intent.
        val direct =
          Intent(createSamsungGetContentIntent())
            .setPackage(packageName)
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        Log.i(TAG, "Using direct package intent for installed package: $packageName")
        return direct
      }

      val generic = createGenericGetContentIntent()
      val samsungLikeHandler =
        queryHandlers(packageManager, generic)
          .firstOrNull { isSamsungGalleryPackage(it.activityInfo.packageName) }

      if (samsungLikeHandler != null) {
        val pkg = samsungLikeHandler.activityInfo.packageName
        val activity = samsungLikeHandler.activityInfo.name
        Log.i(TAG, "Found Samsung-like handler from query: $pkg/$activity")
        return Intent(generic).setClassName(pkg, activity)
      }

      return null
    }

    private fun isSamsungGalleryPackage(packageName: String): Boolean {
      if (SAMSUNG_GALLERY_PACKAGES.contains(packageName)) return true
      return packageName.contains("gallery", ignoreCase = true) &&
        (
          packageName.startsWith("com.sec.android") ||
            packageName.startsWith("com.samsung.android")
          )
    }

    /** Intents for Samsung Gallery — excludes Android Photo Picker (ACTION_PICK_IMAGES). */
    private fun samsungIntentCandidates(): List<Intent> {
      val candidates = mutableListOf<Intent>()

      candidates.add(
        Intent(Intent.ACTION_PICK, MediaStore.Images.Media.EXTERNAL_CONTENT_URI).apply {
          addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        },
      )

      candidates.add(
        Intent(Intent.ACTION_PICK, MediaStore.Video.Media.EXTERNAL_CONTENT_URI).apply {
          addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        },
      )

      candidates.add(createSamsungGetContentIntent())
      candidates.add(createGenericGetContentIntent())

      return candidates
    }

    private fun createSamsungGetContentIntent(): Intent =
      Intent(Intent.ACTION_GET_CONTENT).apply {
        addCategory(Intent.CATEGORY_OPENABLE)
        type = "*/*"
        putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("image/*", "video/*"))
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }

    private fun createGenericGetContentIntent(): Intent =
      Intent(Intent.ACTION_GET_CONTENT).apply {
        addCategory(Intent.CATEGORY_OPENABLE)
        type = "*/*"
        putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("image/*", "video/*"))
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }

    private fun createChooserPreferringSamsung(context: Context): Intent {
      val base = createGenericGetContentIntent()
      val packageManager = context.packageManager
      val samsungIntents = mutableListOf<Intent>()

      for (packageName in SAMSUNG_GALLERY_PACKAGES) {
        if (!isPackageInstalled(packageManager, packageName)) continue

        samsungIntents.add(Intent(createSamsungGetContentIntent()).setPackage(packageName))
        samsungIntents.add(
          Intent(Intent.ACTION_PICK, MediaStore.Images.Media.EXTERNAL_CONTENT_URI)
            .setPackage(packageName)
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION),
        )
        samsungIntents.add(
          Intent(Intent.ACTION_PICK, MediaStore.Video.Media.EXTERNAL_CONTENT_URI)
            .setPackage(packageName)
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION),
        )
      }

      if (samsungIntents.isEmpty()) {
        Log.w(
          TAG,
          "No Samsung gallery packages visible — generic picker will open (likely Google Photos)",
        )
        return base
      }

      return Intent.createChooser(base, "Select media").apply {
        putExtra(Intent.EXTRA_INITIAL_INTENTS, samsungIntents.toTypedArray())
      }
    }

    private fun queryHandlers(
      packageManager: PackageManager,
      intent: Intent,
    ): List<android.content.pm.ResolveInfo> =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        packageManager.queryIntentActivities(
          intent,
          PackageManager.ResolveInfoFlags.of(PackageManager.MATCH_DEFAULT_ONLY.toLong()),
        )
      } else {
        @Suppress("DEPRECATION")
        packageManager.queryIntentActivities(intent, PackageManager.MATCH_DEFAULT_ONLY)
      }

    private fun readSamsungSelectedItems(intent: Intent?): List<Uri>? {
      if (intent == null) return null

      return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        intent.getParcelableArrayListExtra("selectedItems", Uri::class.java)
      } else {
        @Suppress("DEPRECATION")
        intent.getParcelableArrayListExtra("selectedItems")
      }
    }

    private fun isPackageInstalled(packageManager: PackageManager, packageName: String): Boolean =
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
          packageManager.getPackageInfo(packageName, PackageManager.PackageInfoFlags.of(0))
        } else {
          @Suppress("DEPRECATION")
          packageManager.getPackageInfo(packageName, 0)
        }
        true
      } catch (_: PackageManager.NameNotFoundException) {
        false
      }
  }
}
