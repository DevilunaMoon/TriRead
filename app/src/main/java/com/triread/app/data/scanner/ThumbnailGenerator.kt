package com.triread.app.data.scanner

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import com.triread.app.domain.model.DocumentCategory
import com.triread.app.util.IoExtensions
import com.triread.app.util.IoExtensions.safeRecycle
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.util.Locale
import java.util.zip.ZipInputStream

data class ThumbnailResult(
    val thumbnailPath: String?,
    val discoveredPageCount: Int? = null
)

class ThumbnailGenerator(
    private val context: Context,
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO
) {
    private val concurrencyLimiter = Semaphore(permits = MAX_CONCURRENT_THUMBNAILS)

    private val thumbnailDir: File by lazy {
        File(context.cacheDir, THUMBNAIL_DIR_NAME).apply {
            if (!exists()) mkdirs()
        }
    }

    suspend fun generateThumbnail(
        uriString: String,
        category: DocumentCategory
    ): Result<ThumbnailResult> = withContext(ioDispatcher) {
        concurrencyLimiter.withPermit {
            runCatching {
                val targetFile = thumbnailFileFor(uriString)
                if (targetFile.exists() && targetFile.length() > 0L) {
                    return@runCatching ThumbnailResult(thumbnailPath = targetFile.absolutePath)
                }

                val uri = Uri.parse(uriString)
                when (category) {
                    DocumentCategory.PDF -> generatePdfThumbnail(uri, targetFile)
                    DocumentCategory.DOC,
                    DocumentCategory.PPT -> generateOpenXmlThumbnail(uri, targetFile)
                }
            }
        }
    }

    fun deleteThumbnail(thumbnailPath: String?) {
        if (thumbnailPath.isNullOrBlank()) return
        runCatching {
            val file = File(thumbnailPath)
            if (file.exists()) file.delete()
        }
    }

    fun thumbnailFileFor(uriString: String): File {
        val hash = IoExtensions.sha256Hex(uriString)
        return File(thumbnailDir, "$hash.jpg")
    }

    private fun generatePdfThumbnail(uri: Uri, targetFile: File): ThumbnailResult {
        val pfd = context.contentResolver.openFileDescriptor(uri, "r")
            ?: return ThumbnailResult(thumbnailPath = null)

        return pfd.use { descriptor ->
            PdfRenderer(descriptor).use { renderer ->
                val pageCount = renderer.pageCount
                if (pageCount <= 0) {
                    return@use ThumbnailResult(thumbnailPath = null, discoveredPageCount = 0)
                }

                var bitmap: Bitmap? = null
                try {
                    renderer.openPage(0).use { page ->
                        // PdfRenderer requires ARGB_8888; render directly to target 200x280 dimensions.
                        bitmap = Bitmap.createBitmap(
                            THUMB_WIDTH,
                            THUMB_HEIGHT,
                            Bitmap.Config.ARGB_8888
                        ).also { bmp ->
                            val canvas = Canvas(bmp)
                            canvas.drawColor(Color.WHITE)

                            val scale = minOf(
                                THUMB_WIDTH.toFloat() / page.width.coerceAtLeast(1),
                                THUMB_HEIGHT.toFloat() / page.height.coerceAtLeast(1)
                            )
                            val matrix = Matrix().apply {
                                postScale(scale, scale)
                                val dx = (THUMB_WIDTH - page.width * scale) / 2f
                                val dy = (THUMB_HEIGHT - page.height * scale) / 2f
                                postTranslate(dx, dy)
                            }
                            page.render(
                                bmp,
                                null,
                                matrix,
                                PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY
                            )
                        }
                    }

                    val savedPath = bitmap?.let { writeJpeg(it, targetFile) }
                    ThumbnailResult(
                        thumbnailPath = savedPath,
                        discoveredPageCount = pageCount
                    )
                } finally {
                    bitmap.safeRecycle()
                }
            }
        }
    }

    private fun generateOpenXmlThumbnail(uri: Uri, targetFile: File): ThumbnailResult {
        val inputStream = context.contentResolver.openInputStream(uri)
            ?: return ThumbnailResult(thumbnailPath = null)

        var preferredBytes: ByteArray? = null
        var fallbackImageBytes: ByteArray? = null

        inputStream.use { rawStream ->
            ZipInputStream(rawStream).use { zip ->
                var entry = zip.nextEntry
                while (entry != null) {
                    val lowerName = entry.name.lowercase(Locale.ROOT)
                    if (!entry.isDirectory) {
                        when {
                            lowerName.startsWith("docprops/thumbnail.") && isSupportedImage(lowerName) -> {
                                preferredBytes = readBoundedEntry(zip, MAX_IMAGE_ENTRY_BYTES)
                                zip.closeEntry()
                                break
                            }
                            fallbackImageBytes == null &&
                                (lowerName.startsWith("ppt/media/") || lowerName.startsWith("word/media/")) &&
                                isSupportedImage(lowerName) -> {
                                fallbackImageBytes = readBoundedEntry(zip, MAX_IMAGE_ENTRY_BYTES)
                            }
                        }
                    }
                    zip.closeEntry()
                    entry = zip.nextEntry
                }
            }
        }

        val imageBytes = preferredBytes ?: fallbackImageBytes
            ?: return ThumbnailResult(thumbnailPath = null)

        var decoded: Bitmap? = null
        var scaled: Bitmap? = null
        return try {
            val boundsOptions = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size, boundsOptions)
            if (boundsOptions.outWidth <= 0 || boundsOptions.outHeight <= 0) {
                return ThumbnailResult(thumbnailPath = null)
            }

            val decodeOptions = BitmapFactory.Options().apply {
                inSampleSize = IoExtensions.calculateInSampleSize(
                    boundsOptions,
                    THUMB_WIDTH,
                    THUMB_HEIGHT
                )
                inPreferredConfig = Bitmap.Config.RGB_565
            }

            decoded = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size, decodeOptions)
                ?: return ThumbnailResult(thumbnailPath = null)

            scaled = scaleCenterCrop(decoded, THUMB_WIDTH, THUMB_HEIGHT)
            val savedPath = writeJpeg(scaled, targetFile)
            ThumbnailResult(thumbnailPath = savedPath)
        } finally {
            if (scaled !== decoded) {
                scaled.safeRecycle()
            }
            decoded.safeRecycle()
        }
    }

    private fun scaleCenterCrop(source: Bitmap, targetWidth: Int, targetHeight: Int): Bitmap {
        val output = Bitmap.createBitmap(targetWidth, targetHeight, Bitmap.Config.RGB_565)
        val canvas = Canvas(output)
        canvas.drawColor(Color.WHITE)

        val scale = maxOf(
            targetWidth.toFloat() / source.width.coerceAtLeast(1),
            targetHeight.toFloat() / source.height.coerceAtLeast(1)
        )
        val dx = (targetWidth - source.width * scale) / 2f
        val dy = (targetHeight - source.height * scale) / 2f
        val matrix = Matrix().apply {
            postScale(scale, scale)
            postTranslate(dx, dy)
        }
        canvas.drawBitmap(source, matrix, null)
        return output
    }

    private fun writeJpeg(bitmap: Bitmap, targetFile: File): String {
        val tempFile = File(targetFile.parentFile, "${targetFile.name}.tmp")
        FileOutputStream(tempFile).use { fos ->
            bitmap.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, fos)
            fos.flush()
        }
        if (targetFile.exists()) {
            targetFile.delete()
        }
        tempFile.renameTo(targetFile)
        return targetFile.absolutePath
    }

    private fun readBoundedEntry(zip: ZipInputStream, maxBytes: Int): ByteArray? {
        val buffer = ByteArray(8192)
        val output = ByteArrayOutputStream()
        var totalRead = 0
        while (true) {
            val read = zip.read(buffer)
            if (read <= 0) break
            totalRead += read
            if (totalRead > maxBytes) {
                return null
            }
            output.write(buffer, 0, read)
        }
        return output.toByteArray()
    }

    private fun isSupportedImage(path: String): Boolean {
        return path.endsWith(".jpg") ||
            path.endsWith(".jpeg") ||
            path.endsWith(".png") ||
            path.endsWith(".webp")
    }

    companion object {
        const val THUMB_WIDTH = 200
        const val THUMB_HEIGHT = 280
        private const val JPEG_QUALITY = 80
        private const val THUMBNAIL_DIR_NAME = "thumbnails"
        private const val MAX_CONCURRENT_THUMBNAILS = 2
        private const val MAX_IMAGE_ENTRY_BYTES = 8 * 1024 * 1024 // 8 MB zip-entry safety cap
    }
}

