package com.triread.app.data.local

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import com.triread.app.domain.model.DocumentCategory
import com.triread.app.domain.model.DocumentItem

@Entity(
    tableName = "documents",
    indices = [
        Index(value = ["category"]),
        Index(value = ["last_opened_timestamp"]),
        Index(value = ["last_modified"])
    ]
)
data class DocumentEntity(
    @PrimaryKey
    @ColumnInfo(name = "uri_string")
    val uriString: String,
    @ColumnInfo(name = "title")
    val title: String,
    @ColumnInfo(name = "category")
    val category: DocumentCategory,
    @ColumnInfo(name = "mime_type")
    val mimeType: String,
    @ColumnInfo(name = "file_size")
    val fileSize: Long,
    @ColumnInfo(name = "last_modified")
    val lastModified: Long,
    @ColumnInfo(name = "thumbnail_path")
    val thumbnailPath: String? = null,
    @ColumnInfo(name = "current_page")
    val currentPage: Int = 0,
    @ColumnInfo(name = "total_pages")
    val totalPages: Int = 0,
    @ColumnInfo(name = "is_favorite")
    val isFavorite: Boolean = false,
    @ColumnInfo(name = "last_opened_timestamp")
    val lastOpenedTimestamp: Long = 0L
)

fun DocumentEntity.toDomain(): DocumentItem = DocumentItem(
    uriString = uriString,
    title = title,
    category = category,
    mimeType = mimeType,
    fileSize = fileSize,
    lastModified = lastModified,
    thumbnailPath = thumbnailPath,
    currentPage = currentPage,
    totalPages = totalPages,
    isFavorite = isFavorite,
    lastOpenedTimestamp = lastOpenedTimestamp
)

fun DocumentItem.toEntity(): DocumentEntity = DocumentEntity(
    uriString = uriString,
    title = title,
    category = category,
    mimeType = mimeType,
    fileSize = fileSize,
    lastModified = lastModified,
    thumbnailPath = thumbnailPath,
    currentPage = currentPage,
    totalPages = totalPages,
    isFavorite = isFavorite,
    lastOpenedTimestamp = lastOpenedTimestamp
)

