package expo.modules.flipcamerawesome

import android.content.Context
import android.net.Uri
import android.webkit.MimeTypeMap
import java.io.File
import java.io.IOException

internal object GalleryPickerHelper {
  fun materializePickedMedia(
    context: Context,
    cacheDirectory: File,
    sourceUri: Uri,
  ): Pair<String, String> {
    val contentResolver = context.contentResolver
    val mimeType = contentResolver.getType(sourceUri) ?: "application/octet-stream"
    val mediaType = if (mimeType.startsWith("video/")) "video" else "image"
    val extension =
      when {
        mimeType.startsWith("video/") -> ".mp4"
        mimeType.startsWith("image/") ->
          MimeTypeMap.getSingleton().getExtensionFromMimeType(mimeType)?.let { ".$it" } ?: ".jpg"
        else -> ""
      }

    val outputFile = File.createTempFile("flip_gallery_pick_", extension, cacheDirectory)
    contentResolver.openInputStream(sourceUri)?.use { input ->
      outputFile.outputStream().use { output -> input.copyTo(output) }
    } ?: throw IOException("Could not read picked media")

    return Uri.fromFile(outputFile).toString() to mediaType
  }
}
