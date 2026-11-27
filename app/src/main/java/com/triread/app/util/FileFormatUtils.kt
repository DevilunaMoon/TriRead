package com.triread.app.util

import java.text.DecimalFormat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.log10
import kotlin.math.pow

object FileFormatUtils {

    private val sizeUnits = arrayOf("B", "KB", "MB", "GB", "TB")

    fun formatFileSize(bytes: Long): String {
        if (bytes <= 0L) return "0 B"
        val digitGroups = (log10(bytes.toDouble()) / log10(1024.0))
            .toInt()
            .coerceIn(0, sizeUnits.lastIndex)
        val value = bytes / 1024.0.pow(digitGroups.toDouble())
        val pattern = if (digitGroups == 0) "#,##0" else "#,##0.#"
        return "${DecimalFormat(pattern).format(value)} ${sizeUnits[digitGroups]}"
    }

    fun formatModifiedDate(epochMillis: Long): String {
        if (epochMillis <= 0L) return ""
        val formatter = SimpleDateFormat("MMM d, yyyy", Locale.getDefault())
        return formatter.format(Date(epochMillis))
    }

    fun inferMimeTypeFromName(fileName: String): String {
        return when (fileName.substringAfterLast('.', "").lowercase(Locale.ROOT)) {
            "pdf" -> "application/pdf"
            "doc" -> "application/msword"
            "docx" -> "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            "ppt" -> "application/vnd.ms-powerpoint"
            "pptx" -> "application/vnd.openxmlformats-officedocument.presentationml.presentation"
            else -> "application/octet-stream"
        }
    }
}

