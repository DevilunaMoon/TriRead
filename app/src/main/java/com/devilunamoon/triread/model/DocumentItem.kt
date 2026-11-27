package com.devilunamoon.triread.model

import java.io.File

enum class DocumentType(val label: String, val mimeType: String) {
    PDF("PDF", "application/pdf"),
    DOC("DOC", "application/msword"),
    DOCX("DOCX", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    PPT("PPT", "application/vnd.ms-powerpoint"),
    PPTX("PPTX", "application/vnd.openxmlformats-officedocument.presentationml.presentation");

    val category: DocumentCategory
        get() = when (this) {
            PDF -> DocumentCategory.PDF
            DOC, DOCX -> DocumentCategory.WORD
            PPT, PPTX -> DocumentCategory.POWERPOINT
        }

    companion object {
        fun fromExtension(ext: String): DocumentType? = when (ext.lowercase()) {
            "pdf" -> PDF
            "doc" -> DOC
            "docx" -> DOCX
            "ppt" -> PPT
            "pptx" -> PPTX
            else -> null
        }
    }
}

enum class DocumentCategory(val label: String) {
    ALL("All"),
    PDF("PDF"),
    WORD("Word"),
    POWERPOINT("PPT")
}

enum class SortOrder(val label: String) {
    NEWEST("Newest first"),
    NAME("Name (A–Z)"),
    SIZE("Largest first")
}

enum class ReaderTheme(val label: String) {
    LIGHT("Light"),
    SEPIA("Sepia"),
    DARK("Dark")
}

data class DocumentItem(
    val file: File,
    val name: String,
    val type: DocumentType,
    val sizeBytes: Long,
    val lastModified: Long,
    val folderDisplay: String
) {
    val isRecent: Boolean
        get() = (System.currentTimeMillis() - lastModified) < 24L * 60L * 60L * 1000L
}
