package com.triread.app.data.lokit

import android.app.Activity
import android.content.Context
import android.graphics.Bitmap
import android.net.Uri
import com.triread.app.domain.model.DocumentCategory
import kotlinx.coroutines.withContext
import org.libreoffice.kit.DirectBufferAllocator
import org.libreoffice.kit.Document
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.util.UUID
import kotlin.math.roundToInt

class LOKitPasswordProtectedException : IOException("This document is password-protected.")

data class LOKitPageRect(
    val x: Int,
    val y: Int,
    val width: Int,
    val height: Int
) {
    val aspectRatio: Float
        get() = (width.toFloat() / height.coerceAtLeast(1).toFloat()).coerceIn(0.45f, 2.5f)
}

class LOKitDocumentSession private constructor(
    private val document: Document,
    private val tempFile: File,
    private val isPresentation: Boolean,
    private val pageRects: List<LOKitPageRect>,
    private val engine: LOKitEngine
) : AutoCloseable {

    @Volatile
    private var isClosed = false

    val pageCount: Int
        get() = if (isClosed) 0 else pageRects.size

    fun pageAspectRatio(pageIndex: Int): Float {
        return pageRects.getOrNull(pageIndex)?.aspectRatio ?: if (isPresentation) 1.777f else 0.707f
    }

    suspend fun renderPage(
        pageIndex: Int,
        targetWidthPx: Int
    ): Result<Bitmap> = withContext(engine.lokDispatcher) {
        runCatching {
            check(!isClosed) { "LOKitDocumentSession is already closed." }
            require(pageIndex in pageRects.indices) {
                "Page index $pageIndex out of bounds (0..${pageRects.lastIndex})"
            }

            if (isPresentation) {
                document.setPart(pageIndex)
                val slideW = document.documentWidth.toInt().coerceAtLeast(1)
                val slideH = document.documentHeight.toInt().coerceAtLeast(1)
                paintTileToBitmap(
                    tileX = 0,
                    tileY = 0,
                    tileWidthTwips = slideW,
                    tileHeightTwips = slideH,
                    targetWidthPx = targetWidthPx
                )
            } else {
                val rect = pageRects[pageIndex]
                paintTileToBitmap(
                    tileX = rect.x,
                    tileY = rect.y,
                    tileWidthTwips = rect.width,
                    tileHeightTwips = rect.height,
                    targetWidthPx = targetWidthPx
                )
            }
        }
    }

    private fun paintTileToBitmap(
        tileX: Int,
        tileY: Int,
        tileWidthTwips: Int,
        tileHeightTwips: Int,
        targetWidthPx: Int
    ): Bitmap {
        val clampedWidth = targetWidthPx.coerceIn(MIN_RENDER_WIDTH, MAX_RENDER_WIDTH)
        val aspect = tileHeightTwips.toDouble() / tileWidthTwips.coerceAtLeast(1).toDouble()
        val targetHeight = (clampedWidth * aspect)
            .roundToInt()
            .coerceIn(MIN_RENDER_HEIGHT, MAX_RENDER_HEIGHT)

        val byteCount = clampedWidth * targetHeight * 4
        val buffer = DirectBufferAllocator.guardedAllocate(byteCount)
            ?: throw OutOfMemoryError("Unable to allocate $byteCount bytes for LOKit tile buffer.")

        val bitmap = Bitmap.createBitmap(clampedWidth, targetHeight, Bitmap.Config.ARGB_8888)
        return try {
            buffer.rewind()
            document.paintTile(
                buffer,
                clampedWidth,
                targetHeight,
                tileX,
                tileY,
                tileWidthTwips,
                tileHeightTwips
            )
            buffer.rewind()
            bitmap.copyPixelsFromBuffer(buffer)
            bitmap
        } catch (t: Throwable) {
            if (!bitmap.isRecycled) bitmap.recycle()
            throw t
        } finally {
            DirectBufferAllocator.free(buffer)
        }
    }

    override fun close() {
        if (isClosed) return
        isClosed = true
        runCatching { document.destroy() }
        runCatching { if (tempFile.exists()) tempFile.delete() }
    }

    companion object {
        private const val MIN_RENDER_WIDTH = 360
        private const val MAX_RENDER_WIDTH = 1600
        private const val MIN_RENDER_HEIGHT = 240
        private const val MAX_RENDER_HEIGHT = 2600
        private const val TEMP_DIR_NAME = "lokit_tmp"

        suspend fun open(
            activity: Activity,
            context: Context,
            engine: LOKitEngine,
            uriString: String,
            fileName: String,
            category: DocumentCategory
        ): Result<LOKitDocumentSession> {
            val tempFile = copyUriToTempFile(context, uriString, fileName, category)
                .getOrElse { return Result.failure(it) }

            val office = engine.ensureInitialized(activity).getOrElse { error ->
                runCatching { tempFile.delete() }
                return Result.failure(error)
            }

            return withContext(engine.lokDispatcher) {
                runCatching {
                    val doc = office.documentLoad(tempFile.absolutePath)
                    if (doc == null) {
                        val lokError = runCatching { office.error }.getOrNull().orEmpty()
                        if (lokError.contains("password", ignoreCase = true)) {
                            throw LOKitPasswordProtectedException()
                        }
                        throw IOException(
                            lokError.ifBlank { "LibreOfficeKit could not open this document." }
                        )
                    }

                    try {
                        doc.initializeForRendering()
                        val isPpt = category == DocumentCategory.PPT ||
                            doc.documentType == Document.DOCTYPE_PRESENTATION

                        val rects = if (isPpt) {
                            doc.setPartMode(Document.PART_MODE_SLIDE)
                            val slideCount = doc.parts.coerceAtLeast(1)
                            (0 until slideCount).map { idx ->
                                doc.setPart(idx)
                                val w = doc.documentWidth.toInt().coerceAtLeast(1)
                                val h = doc.documentHeight.toInt().coerceAtLeast(1)
                                LOKitPageRect(x = 0, y = 0, width = w, height = h)
                            }
                        } else {
                            extractWriterPageRects(doc)
                        }

                        LOKitDocumentSession(
                            document = doc,
                            tempFile = tempFile,
                            isPresentation = isPpt,
                            pageRects = rects,
                            engine = engine
                        )
                    } catch (t: Throwable) {
                        runCatching { doc.destroy() }
                        throw t
                    }
                }.onFailure {
                    runCatching { tempFile.delete() }
                }
            }
        }

        private fun extractWriterPageRects(doc: Document): List<LOKitPageRect> {
            val rawRects = runCatching { doc.partPageRectangles }.getOrNull().orEmpty()
            val parsed = rawRects.split(";")
                .mapNotNull { token ->
                    val parts = token.trim().split(",").mapNotNull { it.trim().toIntOrNull() }
                    if (parts.size == 4 && parts[2] > 0 && parts[3] > 0) {
                        LOKitPageRect(x = parts[0], y = parts[1], width = parts[2], height = parts[3])
                    } else {
                        null
                    }
                }
            if (parsed.isNotEmpty()) return parsed

            // Proportional A4 fallback if getPartPageRectangles returns empty
            val docW = doc.documentWidth.toInt().coerceAtLeast(11906)
            val docH = doc.documentHeight.toInt().coerceAtLeast(16838)
            val estPageH = (docW * 1.414f).roundToInt().coerceAtLeast(1)
            val totalPages = ((docH + estPageH - 1) / estPageH).coerceAtLeast(1)
            return (0 until totalPages).map { idx ->
                val y = idx * estPageH
                val h = minOf(estPageH, (docH - y).coerceAtLeast(estPageH))
                LOKitPageRect(x = 0, y = y, width = docW, height = h)
            }
        }

        private fun copyUriToTempFile(
            context: Context,
            uriString: String,
            fileName: String,
            category: DocumentCategory
        ): Result<File> = runCatching {
            val uri = Uri.parse(uriString)
            val ext = fileName.substringAfterLast('.', "").lowercase().ifBlank {
                when (category) {
                    DocumentCategory.DOC -> "docx"
                    DocumentCategory.PPT -> "pptx"
                    DocumentCategory.PDF -> "pdf"
                }
            }
            val tmpDir = File(context.cacheDir, TEMP_DIR_NAME).apply { if (!exists()) mkdirs() }
            val tempFile = File(tmpDir, "lok_${UUID.randomUUID()}.$ext")

            val inputStream = context.contentResolver.openInputStream(uri)
                ?: throw IOException("Unable to open document URI. Permission may have been revoked.")

            inputStream.use { input ->
                FileOutputStream(tempFile).use { output ->
                    input.copyTo(output, bufferSize = 16 * 1024)
                    output.flush()
                }
            }
            tempFile
        }
    }
}

