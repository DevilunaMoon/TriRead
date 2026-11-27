package com.triread.app.domain.model

enum class DocumentCategory(
    val displayName: String,
    val badgeLabel: String,
    val extensions: Set<String>,
    val mimeTypes: Set<String>
) {
    PDF(
        displayName = "PDF",
        badgeLabel = "PDF",
        extensions = setOf("pdf"),
        mimeTypes = setOf("application/pdf")
    ),
    DOC(
        displayName = "Docs",
        badgeLabel = "DOC",
        extensions = setOf("doc", "docx"),
        mimeTypes = setOf(
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
    ),
    PPT(
        displayName = "Slides",
        badgeLabel = "PPT",
        extensions = setOf("ppt", "pptx"),
        mimeTypes = setOf(
            "application/vnd.ms-powerpoint",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        )
    );

    companion object {
        val ALL_SUPPORTED_EXTENSIONS: Set<String> = entries.flatMap { it.extensions }.toSet()
        val ALL_SUPPORTED_MIME_TYPES: Array<String> = entries.flatMap { it.mimeTypes }.toTypedArray()

        fun fromMimeOrExtension(mimeType: String?, fileName: String?): DocumentCategory? {
            val normalizedMime = mimeType?.lowercase()?.trim()
            if (!normalizedMime.isNullOrEmpty()) {
                entries.firstOrNull { normalizedMime in it.mimeTypes }?.let { return it }
            }
            val ext = fileName
                ?.substringAfterLast('.', missingDelimiterValue = "")
                ?.lowercase()
                ?.trim()
            if (!ext.isNullOrEmpty()) {
                entries.firstOrNull { ext in it.extensions }?.let { return it }
            }
            return null
        }
    }
}

