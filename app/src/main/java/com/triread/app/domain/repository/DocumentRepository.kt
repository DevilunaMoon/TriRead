package com.triread.app.domain.repository

import android.net.Uri
import com.triread.app.domain.model.DocumentCategory
import com.triread.app.domain.model.DocumentItem
import com.triread.app.domain.model.SyncResult
import kotlinx.coroutines.flow.Flow

interface DocumentRepository {

    fun observeDocuments(category: DocumentCategory): Flow<List<DocumentItem>>

    fun observeAllDocuments(): Flow<List<DocumentItem>>

    fun observeCategoryCounts(): Flow<Map<DocumentCategory, Int>>

    fun observeMostRecentlyOpened(): Flow<DocumentItem?>

    fun observeDocument(uriString: String): Flow<DocumentItem?>

    suspend fun getDocument(uriString: String): Result<DocumentItem?>

    suspend fun syncWithMediaStore(): Result<SyncResult>

    suspend fun importDocument(uri: Uri): Result<DocumentItem>

    suspend fun updateReadingProgress(
        uriString: String,
        currentPage: Int,
        totalPages: Int
    ): Result<Unit>

    suspend fun toggleFavorite(uriString: String, isFavorite: Boolean): Result<Unit>

    suspend fun ensureThumbnail(document: DocumentItem): Result<String?>

    suspend fun removeDocument(uriString: String): Result<Unit>
}

