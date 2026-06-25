package expo.modules.flipcamerawesome

import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMuxer
import android.util.Log
import java.io.File
import java.nio.ByteBuffer

/** Concatenates same-codec CameraX MP4 segments (e.g. after lens flip while recording). */
object FlipVideoMerger {
  private const val TAG = "FlipVideoMerger"
  private const val FRAME_GAP_US = 33_333L

  fun mergeMp4Segments(sources: List<File>, output: File): Boolean {
    if (sources.isEmpty()) return false
    if (sources.size == 1) {
      return try {
        sources[0].copyTo(output, overwrite = true)
        output.exists() && output.length() > 0L
      } catch (e: Exception) {
        Log.e(TAG, "single-segment copy failed", e)
        false
      }
    }

    var muxer: MediaMuxer? = null
    try {
      muxer = MediaMuxer(output.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
      var videoMuxerTrack = -1
      var audioMuxerTrack = -1
      var muxerStarted = false
      var videoTimeOffset = 0L
      var audioTimeOffset = 0L

      for (source in sources) {
        val extractor = MediaExtractor()
        extractor.setDataSource(source.absolutePath)

        var videoExtractorTrack = -1
        var audioExtractorTrack = -1
        for (i in 0 until extractor.trackCount) {
          val format = extractor.getTrackFormat(i)
          val mime = format.getString(MediaFormat.KEY_MIME) ?: continue
          when {
            mime.startsWith("video/") && videoExtractorTrack < 0 -> {
              videoExtractorTrack = i
              if (!muxerStarted) videoMuxerTrack = muxer.addTrack(format)
            }
            mime.startsWith("audio/") && audioExtractorTrack < 0 -> {
              audioExtractorTrack = i
              if (!muxerStarted) audioMuxerTrack = muxer.addTrack(format)
            }
          }
        }

        if (!muxerStarted && (videoMuxerTrack >= 0 || audioMuxerTrack >= 0)) {
          muxer.start()
          muxerStarted = true
        }

        val buffer = ByteBuffer.allocate(512 * 1024)
        val info = MediaCodec.BufferInfo()
        var maxVideoPts = videoTimeOffset
        var maxAudioPts = audioTimeOffset

        if (videoExtractorTrack >= 0 && videoMuxerTrack >= 0) {
          extractor.selectTrack(videoExtractorTrack)
          maxVideoPts =
            copyTrack(extractor, muxer, videoMuxerTrack, buffer, info, videoTimeOffset)
          extractor.unselectTrack(videoExtractorTrack)
        }

        if (audioExtractorTrack >= 0 && audioMuxerTrack >= 0) {
          extractor.selectTrack(audioExtractorTrack)
          maxAudioPts =
            copyTrack(extractor, muxer, audioMuxerTrack, buffer, info, audioTimeOffset)
          extractor.unselectTrack(audioExtractorTrack)
        }

        extractor.release()

        if (maxVideoPts > videoTimeOffset) {
          videoTimeOffset = maxVideoPts + FRAME_GAP_US
        }
        if (maxAudioPts > audioTimeOffset) {
          audioTimeOffset = maxAudioPts + 10_000L
        }
      }

      if (!muxerStarted) return false
      muxer.stop()
      return output.exists() && output.length() > 0L
    } catch (e: Exception) {
      Log.e(TAG, "mergeMp4Segments failed", e)
      output.delete()
      return false
    } finally {
      try {
        muxer?.release()
      } catch (_: Exception) {
      }
    }
  }

  private fun copyTrack(
    extractor: MediaExtractor,
    muxer: MediaMuxer,
    muxerTrack: Int,
    buffer: ByteBuffer,
    info: MediaCodec.BufferInfo,
    timeOffset: Long,
  ): Long {
    var maxPts = timeOffset
    while (true) {
      buffer.clear()
      val size = extractor.readSampleData(buffer, 0)
      if (size < 0) break
      info.offset = 0
      info.size = size
      val pts = extractor.sampleTime + timeOffset
      info.presentationTimeUs = pts
      info.flags = extractor.sampleFlags
      muxer.writeSampleData(muxerTrack, buffer, info)
      if (pts > maxPts) maxPts = pts
      extractor.advance()
    }
    return maxPts
  }
}
