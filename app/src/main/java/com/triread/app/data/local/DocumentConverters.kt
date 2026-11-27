package com.triread.app.data.local

import androidx.room.TypeConverter
import com.triread.app.domain.model.DocumentCategory

class DocumentConverters {

    @TypeConverter
    fun fromCategory(category: DocumentCategory): String = category.name

    @TypeConverter
    fun toCategory(value: String): DocumentCategory =
        DocumentCategory.entries.firstOrNull { it.name == value } ?: DocumentCategory.PDF
}

