package com.triread.app.data.local

import androidx.room.ColumnInfo
import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.triread.app.domain.model.DocumentCategory
import kotlinx.coroutines.flow.Flow

data class CategoryCountRow(
    @ColumnInfo(name = "category") val category: DocumentCategory,
    @ColumnInfo(name = "count") val count: Int
)

@Dao
interface DocumentDao {

    @Query("SELECT * FROM documents ORDER BY last_modified DESC")
    fun observeAllDocuments(): Flow<List<DocumentEntity>>

    @Query("SELECT * FROM documents WHERE category = :category ORDER BY last_modified DESC")
    fun observeByCategory(category: DocumentCategory): Flow<List<DocumentEntity>>

    @Query("SELECT category, COUNT(*) AS count FROM documents GROUP BY category")
    fun observeCategoryCounts(): Flow<List<CategoryCountRow>>

    @Query(
        "SELECT * FROM documents WHERE last_opened_timestamp > 0 " +
            "ORDER BY last_opened_timestamp DESC LIMIT 1"
    )
    fun observeMostRecentlyOpened(): Flow<DocumentEntity?>

    @Query("SELECT * FROM documents WHERE uri_string = :uriString LIMIT 1")
    fun observeDocument(uriString: String): Flow<DocumentEntity?>

    @Query("SELECT * FROM documents WHERE uri_string = :uriString LIMIT 1")
    suspend fun getDocument(uriString: String): DocumentEntity?

    @Query("SELECT * FROM documents")
    suspend fun getAllSnapshot(): List<DocumentEntity>

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertIgnore(documents: List<DocumentEntity>): List<Long>

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertIgnoreSingle(document: DocumentEntity): Long

    @Query(
        "UPDATE documents SET title = :title, category = :category, mime_type = :mimeType, " +
            "file_size = :fileSize, last_modified = :lastModified, thumbnail_path = :thumbnailPath " +
            "WHERE uri_string = :uriString"
    )
    suspend fun updateMetadata(
        uriString: String,
        title: String,
        category: DocumentCategory,
        mimeType: String,
        fileSize: Long,
        lastModified: Long,
        thumbnailPath: String?
    )

    @Query("UPDATE documents SET thumbnail_path = :thumbnailPath WHERE uri_string = :uriString")
    suspend fun updateThumbnailPath(uriString: String, thumbnailPath: String?)

    @Query(
        "UPDATE documents SET current_page = :currentPage, total_pages = :totalPages, " +
            "last_opened_timestamp = :lastOpenedTimestamp WHERE uri_string = :uriString"
    )
    suspend fun updateReadingProgress(
        uriString: String,
        currentPage: Int,
        totalPages: Int,
        lastOpenedTimestamp: Long
    )

    @Query("UPDATE documents SET is_favorite = :isFavorite WHERE uri_string = :uriString")
    suspend fun updateFavorite(uriString: String, isFavorite: Boolean)

    @Query("DELETE FROM documents WHERE uri_string = :uriString")
    suspend fun deleteByUri(uriString: String)

    @Query("DELETE FROM documents WHERE uri_string IN (:uris)")
    suspend fun deleteByUris(uris: List<String>)
}

