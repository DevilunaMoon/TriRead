package com.triread.app.data.collabora

import android.content.Context
import android.net.Uri
import com.triread.app.domain.model.DocumentCategory
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.util.UUID

class CollaboraTempFileManager(
    private val context: Context,
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO
) {

    suspend fun copyUriToTempFile(
        uriString: String,
        fileName: String,
        category: DocumentCategory
    ): Result<File> = withContext(ioDispatcher) {
        runCatching {
            val uri = Uri.parse(uriString)
            val ext = fileName.substringAfterLast('.', "").lowercase().ifBlank {
                when (category) {
                    DocumentCategory.DOC -> "docx"
                    DocumentCategory.PPT -> "pptx"
                    DocumentCategory.PDF -> "pdf"
                }
            }
            val tmpDir = File(context.cacheDir, TEMP_DIR_NAME).apply {
                if (!exists()) mkdirs()
            }
            val tempFile = File(tmpDir, "doc_${UUID.randomUUID()}.$ext")

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

    fun deleteTempFile(file: File?) {
        if (file == null) return
        runCatching {
            if (file.exists()) {
                file.delete()
            }
        }
    }

    companion object {
        private const val TEMP_DIR_NAME = "collabora_tmp"
    }
}

