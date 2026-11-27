package com.triread.app.domain.model

data class DocumentItem(
    val uriString: String,
    val title: String,
    val category: DocumentCategory,
    val mimeType: String,
    val fileSize: Long,
    val lastModified: Long,
    val thumbnailPath: String?,
    val currentPage: Int,
    val totalPages: Int,
    val isFavorite: Boolean,
    val lastOpenedTimestamp: Long
) {
    val isUnread: Boolean
        get() = lastOpenedTimestamp == 0L

    val progressFraction: Float
        get() = if (totalPages > 0) {
            ((currentPage + 1).coerceIn(1, totalPages)).toFloat() / totalPages.toFloat()
        } else {
            0f
        }
}

