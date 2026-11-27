package com.triread.app.data.parser

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.io.IOException

class PdfPasswordProtectedException : IOException("This PDF is password-protected.")

class PdfDocumentSession private constructor(
    private val fileDescriptor: ParcelFileDescriptor,
    private val renderer: PdfRenderer,
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO
) : AutoCloseable {

    private val renderMutex = Mutex()
    @Volatile
    private var isClosed = false

    val pageCount: Int
        get() = if (isClosed) 0 else renderer.pageCount

    suspend fun renderPage(
        pageIndex: Int,
        targetWidthPx: Int
    ): Result<Bitmap> = withContext(ioDispatcher) {
        renderMutex.withLock {
            runCatching {
                check(!isClosed) { "PdfDocumentSession is already closed." }
                require(pageIndex in 0 until renderer.pageCount) {
                    "Page index $pageIndex out of bounds (0..${renderer.pageCount - 1})"
                }

                renderer.openPage(pageIndex).use { page ->
                    val clampedWidth = targetWidthPx.coerceIn(MIN_RENDER_WIDTH, MAX_RENDER_WIDTH)
                    val aspectRatio = page.height.toFloat() / page.width.coerceAtLeast(1).toFloat()
                    val targetHeight = (clampedWidth * aspectRatio)
                        .toInt()
                        .coerceIn(MIN_RENDER_HEIGHT, MAX_RENDER_HEIGHT)

                    // PdfRenderer requires ARGB_8888. Fill white background since PDF pages are transparent.
                    val bitmap = Bitmap.createBitmap(
                        clampedWidth,
                        targetHeight,
                        Bitmap.Config.ARGB_8888
                    )
                    try {
                        Canvas(bitmap).drawColor(Color.WHITE)
                        page.render(
                            bitmap,
                            null,
                            null,
                            PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY
                        )
                        bitmap
                    } catch (t: Throwable) {
                        if (!bitmap.isRecycled) bitmap.recycle()
                        throw t
                    }
                }
            }
        }
    }

    override fun close() {
        if (isClosed) return
        isClosed = true
        runCatching { renderer.close() }
        runCatching { fileDescriptor.close() }
    }

    companion object {
        private const val MIN_RENDER_WIDTH = 360
        private const val MAX_RENDER_WIDTH = 1600
        private const val MIN_RENDER_HEIGHT = 360
        private const val MAX_RENDER_HEIGHT = 2400

        suspend fun open(
            context: Context,
            uriString: String,
            ioDispatcher: CoroutineDispatcher = Dispatchers.IO
        ): Result<PdfDocumentSession> = withContext(ioDispatcher) {
            runCatching {
                val uri = Uri.parse(uriString)
                val pfd = context.contentResolver.openFileDescriptor(uri, "r")
                    ?: throw IOException("Unable to open PDF file. Permission may have been revoked.")
                try {
                    val renderer = PdfRenderer(pfd)
                    PdfDocumentSession(pfd, renderer, ioDispatcher)
                } catch (se: SecurityException) {
                    runCatching { pfd.close() }
                    throw PdfPasswordProtectedException()
                } catch (t: Throwable) {
                    runCatching { pfd.close() }
                    throw t
                }
            }
        }
    }
}

