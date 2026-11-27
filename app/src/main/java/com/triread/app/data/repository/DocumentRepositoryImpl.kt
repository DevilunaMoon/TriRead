package com.triread.app.data.repository

import android.net.Uri
import com.triread.app.data.local.DocumentDao
import com.triread.app.data.local.DocumentEntity
import com.triread.app.data.local.toDomain
import com.triread.app.data.scanner.MediaStoreDocumentScanner
import com.triread.app.data.scanner.ThumbnailGenerator
import com.triread.app.domain.model.DocumentCategory
import com.triread.app.domain.model.DocumentItem
import com.triread.app.domain.model.SyncResult
import com.triread.app.domain.repository.DocumentRepository
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import java.io.File

class DocumentRepositoryImpl(
    private val documentDao: DocumentDao,
    private val scanner: MediaStoreDocumentScanner,
    private val thumbnailGenerator: ThumbnailGenerator,
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO
) : DocumentRepository {

    override fun observeDocuments(category: DocumentCategory): Flow<List<DocumentItem>> {
        return documentDao.observeByCategory(category).map { entities ->
            entities.map { it.toDomain() }
        }
    }

    override fun observeAllDocuments(): Flow<List<DocumentItem>> {
        return documentDao.observeAllDocuments().map { entities ->
            entities.map { it.toDomain() }
        }
    }

    override fun observeCategoryCounts(): Flow<Map<DocumentCategory, Int>> {
        return documentDao.observeCategoryCounts().map { rows ->
            val counts = mutableMapOf(
                DocumentCategory.PDF to 0,
                DocumentCategory.DOC to 0,
                DocumentCategory.PPT to 0
            )
            rows.forEach { row -> counts[row.category] = row.count }
            counts.toMap()
        }
    }

    override fun observeMostRecentlyOpened(): Flow<DocumentItem?> {
        return documentDao.observeMostRecentlyOpened().map { it?.toDomain() }
    }

    override fun observeDocument(uriString: String): Flow<DocumentItem?> {
        return documentDao.observeDocument(uriString).map { it?.toDomain() }
    }

    override suspend fun getDocument(uriString: String): Result<DocumentItem?> =
        withContext(ioDispatcher) {
            runCatching { documentDao.getDocument(uriString)?.toDomain() }
        }

    override suspend fun syncWithMediaStore(): Result<SyncResult> = withContext(ioDispatcher) {
        val scanResult = scanner.scanDeviceDocuments()
        val scannedDocs = scanResult.getOrElse { return@withContext Result.failure(it) }

        runCatching {
            val existingByUri = documentDao.getAllSnapshot().associateBy { it.uriString }
            val scannedUris = HashSet<String>(scannedDocs.size)

            val toInsert = mutableListOf<DocumentEntity>()
            var updatedCount = 0

            for (doc in scannedDocs) {
                scannedUris.add(doc.uriString)
                val existing = existingByUri[doc.uriString]
                if (existing == null) {
                    toInsert.add(
                        DocumentEntity(
                            uriString = doc.uriString,
                            title = doc.title,
                            category = doc.category,
                            mimeType = doc.mimeType,
                            fileSize = doc.fileSize,
                            lastModified = doc.lastModified
                        )
                    )
                } else if (
                    existing.lastModified != doc.lastModified ||
                    existing.fileSize != doc.fileSize ||
                    existing.title != doc.title
                ) {
                    // File was modified on disk: invalidate cached thumbnail while keeping reading progress & favorite.
                    thumbnailGenerator.deleteThumbnail(existing.thumbnailPath)
                    documentDao.updateMetadata(
                        uriString = doc.uriString,
                        title = doc.title,
                        category = doc.category,
                        mimeType = doc.mimeType,
                        fileSize = doc.fileSize,
                        lastModified = doc.lastModified,
                        thumbnailPath = null
                    )
                    updatedCount++
                }
            }

            if (toInsert.isNotEmpty()) {
                documentDao.insertIgnore(toInsert)
            }

            // Prune deleted MediaStore documents only; preserve manually imported SAF documents.
            val staleMediaStoreDocs = existingByUri.values.filter { entity ->
                entity.uriString.startsWith(MEDIA_STORE_URI_PREFIX) &&
                    entity.uriString !in scannedUris
            }

            if (staleMediaStoreDocs.isNotEmpty()) {
                staleMediaStoreDocs.forEach { thumbnailGenerator.deleteThumbnail(it.thumbnailPath) }
                staleMediaStoreDocs.map { it.uriString }
                    .chunked(SQLITE_BATCH_LIMIT)
                    .forEach { batch -> documentDao.deleteByUris(batch) }
            }

            SyncResult(
                insertedCount = toInsert.size,
                updatedCount = updatedCount,
                prunedCount = staleMediaStoreDocs.size,
                totalScanned = scannedDocs.size
            )
        }
    }

    override suspend fun importDocument(uri: Uri): Result<DocumentItem> = withContext(ioDispatcher) {
        val inspected = scanner.inspectDocumentUri(uri)
            .getOrElse { return@withContext Result.failure(it) }

        runCatching {
            val existing = documentDao.getDocument(inspected.uriString)
            if (existing == null) {
                val entity = DocumentEntity(
                    uriString = inspected.uriString,
                    title = inspected.title,
                    category = inspected.category,
                    mimeType = inspected.mimeType,
                    fileSize = inspected.fileSize,
                    lastModified = inspected.lastModified
                )
                documentDao.insertIgnoreSingle(entity)
                entity.toDomain()
            } else {
                documentDao.updateMetadata(
                    uriString = inspected.uriString,
                    title = inspected.title,
                    category = inspected.category,
                    mimeType = inspected.mimeType,
                    fileSize = inspected.fileSize,
                    lastModified = inspected.lastModified,
                    thumbnailPath = existing.thumbnailPath
                )
                documentDao.getDocument(inspected.uriString)?.toDomain() ?: existing.toDomain()
            }
        }
    }

    override suspend fun updateReadingProgress(
        uriString: String,
        currentPage: Int,
        totalPages: Int
    ): Result<Unit> = withContext(ioDispatcher) {
        runCatching {
            documentDao.updateReadingProgress(
                uriString = uriString,
                currentPage = currentPage.coerceAtLeast(0),
                totalPages = totalPages.coerceAtLeast(0),
                lastOpenedTimestamp = System.currentTimeMillis()
            )
        }
    }

    override suspend fun toggleFavorite(uriString: String, isFavorite: Boolean): Result<Unit> =
        withContext(ioDispatcher) {
            runCatching {
                documentDao.updateFavorite(uriString = uriString, isFavorite = isFavorite)
            }
        }

    override suspend fun ensureThumbnail(document: DocumentItem): Result<String?> =
        withContext(ioDispatcher) {
            val existingPath = document.thumbnailPath
            if (!existingPath.isNullOrBlank() && File(existingPath).exists()) {
                return@withContext Result.success(existingPath)
            }

            thumbnailGenerator.generateThumbnail(document.uriString, document.category)
                .map { result ->
                    if (!result.thumbnailPath.isNullOrBlank()) {
                        documentDao.updateThumbnailPath(document.uriString, result.thumbnailPath)
                    }
                    if (
                        result.discoveredPageCount != null &&
                        result.discoveredPageCount > 0 &&
                        document.totalPages == 0
                    ) {
                        documentDao.updateReadingProgress(
                            uriString = document.uriString,
                            currentPage = document.currentPage,
                            totalPages = result.discoveredPageCount,
                            lastOpenedTimestamp = document.lastOpenedTimestamp
                        )
                    }
                    result.thumbnailPath
                }
        }

    override suspend fun removeDocument(uriString: String): Result<Unit> =
        withContext(ioDispatcher) {
            runCatching {
                val existing = documentDao.getDocument(uriString)
                thumbnailGenerator.deleteThumbnail(existing?.thumbnailPath)
                documentDao.deleteByUri(uriString)
            }
        }

    companion object {
        private const val MEDIA_STORE_URI_PREFIX = "content://media/"
        private const val SQLITE_BATCH_LIMIT = 500
    }
}

