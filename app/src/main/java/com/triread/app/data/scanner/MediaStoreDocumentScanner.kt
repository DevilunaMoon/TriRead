package com.triread.app.data.scanner

import android.content.ContentResolver
import android.content.ContentUris
import android.content.Context
import android.net.Uri
import android.os.Build
import android.provider.DocumentsContract
import android.provider.MediaStore
import android.provider.OpenableColumns
import com.triread.app.domain.model.DocumentCategory
import com.triread.app.util.FileFormatUtils
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import kotlin.coroutines.coroutineContext

data class ScannedDocument(
    val uriString: String,
    val title: String,
    val category: DocumentCategory,
    val mimeType: String,
    val fileSize: Long,
    val lastModified: Long
)

class MediaStoreDocumentScanner(
    private val context: Context,
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO
) {
    private val contentResolver: ContentResolver
        get() = context.contentResolver

    suspend fun scanDeviceDocuments(): Result<List<ScannedDocument>> = withContext(ioDispatcher) {
        runCatching {
            val collection: Uri = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                MediaStore.Files.getContentUri(MediaStore.VOLUME_EXTERNAL)
            } else {
                MediaStore.Files.getContentUri("external")
            }

            val projection = buildList {
                add(MediaStore.Files.FileColumns._ID)
                add(MediaStore.Files.FileColumns.DISPLAY_NAME)
                add(MediaStore.Files.FileColumns.MIME_TYPE)
                add(MediaStore.Files.FileColumns.SIZE)
                add(MediaStore.Files.FileColumns.DATE_MODIFIED)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    add(MediaStore.Files.FileColumns.IS_TRASHED)
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    add(MediaStore.Files.FileColumns.IS_PENDING)
                }
            }.toTypedArray()

            // Filter by supported MIME types OR file extensions so files with missing/generic MIME types are still discovered.
            val mimePlaceholders = DocumentCategory.ALL_SUPPORTED_MIME_TYPES.joinToString(",") { "?" }
            val extConditions = DocumentCategory.ALL_SUPPORTED_EXTENSIONS.joinToString(" OR ") {
                "LOWER(${MediaStore.Files.FileColumns.DISPLAY_NAME}) LIKE ?"
            }

            val selectionBuilder = StringBuilder().apply {
                append("${MediaStore.Files.FileColumns.SIZE} > 0 AND (")
                append("${MediaStore.Files.FileColumns.MIME_TYPE} IN ($mimePlaceholders)")
                append(" OR $extConditions)")
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    append(" AND ${MediaStore.Files.FileColumns.IS_PENDING} = 0")
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    append(" AND ${MediaStore.Files.FileColumns.IS_TRASHED} = 0")
                }
            }

            val selectionArgs = buildList {
                addAll(DocumentCategory.ALL_SUPPORTED_MIME_TYPES)
                DocumentCategory.ALL_SUPPORTED_EXTENSIONS.forEach { ext ->
                    add("%.$ext")
                }
            }.toTypedArray()

            val sortOrder = "${MediaStore.Files.FileColumns.DATE_MODIFIED} DESC"
            val results = mutableListOf<ScannedDocument>()

            contentResolver.query(
                collection,
                projection,
                selectionBuilder.toString(),
                selectionArgs,
                sortOrder
            )?.use { cursor ->
                val idCol = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns._ID)
                val nameCol = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.DISPLAY_NAME)
                val mimeCol = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.MIME_TYPE)
                val sizeCol = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.SIZE)
                val modifiedCol = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.DATE_MODIFIED)

                while (cursor.moveToNext()) {
                    coroutineContext.ensureActive()

                    val id = cursor.getLong(idCol)
                    val displayName = cursor.getString(nameCol)?.takeIf { it.isNotBlank() } ?: continue
                    val rawMime = cursor.getString(mimeCol)
                    val fileSize = cursor.getLong(sizeCol)
                    // MediaStore DATE_MODIFIED is stored in seconds since epoch.
                    val modifiedMillis = cursor.getLong(modifiedCol) * 1000L

                    val category = DocumentCategory.fromMimeOrExtension(rawMime, displayName) ?: continue
                    val resolvedMime = rawMime?.takeIf { it.isNotBlank() }
                        ?: FileFormatUtils.inferMimeTypeFromName(displayName)
                    val contentUri = ContentUris.withAppendedId(collection, id)

                    results.add(
                        ScannedDocument(
                            uriString = contentUri.toString(),
                            title = displayName,
                            category = category,
                            mimeType = resolvedMime,
                            fileSize = fileSize,
                            lastModified = modifiedMillis
                        )
                    )
                }
            }

            results
        }
    }

    suspend fun inspectDocumentUri(uri: Uri): Result<ScannedDocument> = withContext(ioDispatcher) {
        runCatching {
            var displayName: String? = null
            var fileSize = 0L
            var lastModified = System.currentTimeMillis()

            val projection = arrayOf(
                OpenableColumns.DISPLAY_NAME,
                OpenableColumns.SIZE,
                DocumentsContract.Document.COLUMN_LAST_MODIFIED
            )

            contentResolver.query(uri, projection, null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) {
                    val nameIdx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    if (nameIdx >= 0) {
                        displayName = cursor.getString(nameIdx)
                    }
                    val sizeIdx = cursor.getColumnIndex(OpenableColumns.SIZE)
                    if (sizeIdx >= 0 && !cursor.isNull(sizeIdx)) {
                        fileSize = cursor.getLong(sizeIdx)
                    }
                    val modIdx = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_LAST_MODIFIED)
                    if (modIdx >= 0 && !cursor.isNull(modIdx)) {
                        lastModified = cursor.getLong(modIdx)
                    }
                }
            }

            val resolvedName = displayName?.takeIf { it.isNotBlank() }
                ?: uri.lastPathSegment?.substringAfterLast('/')
                ?: "Untitled Document"
            val rawMime = contentResolver.getType(uri)
            val category = DocumentCategory.fromMimeOrExtension(rawMime, resolvedName)
                ?: throw IllegalArgumentException("Unsupported document format: $resolvedName")
            val resolvedMime = rawMime?.takeIf { it.isNotBlank() }
                ?: FileFormatUtils.inferMimeTypeFromName(resolvedName)

            ScannedDocument(
                uriString = uri.toString(),
                title = resolvedName,
                category = category,
                mimeType = resolvedMime,
                fileSize = fileSize,
                lastModified = lastModified
            )
        }
    }
}

