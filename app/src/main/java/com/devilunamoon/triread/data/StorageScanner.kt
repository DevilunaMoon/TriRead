package com.devilunamoon.triread.data

import android.os.Environment
import com.devilunamoon.triread.model.DocumentItem
import com.devilunamoon.triread.model.DocumentType
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object StorageScanner {

    private val skippedDirNames = setOf(
        "Android",
        "DCIM",
        "Pictures",
        "Movies",
        "Music",
        "Ringtones",
        "Notifications",
        "Alarms",
        "Podcasts",
        "Audiobooks",
        "LOST.DIR"
    )

    suspend fun scanDeviceStorage(): List<DocumentItem> = withContext(Dispatchers.IO) {
        val rootDir = Environment.getExternalStorageDirectory()
        if (!rootDir.exists() || !rootDir.canRead()) {
            return@withContext emptyList()
        }

        val rootPath = rootDir.absolutePath
        val results = mutableListOf<DocumentItem>()
        val stack = ArrayDeque<File>()
        stack.add(rootDir)

        while (stack.isNotEmpty()) {
            val current = stack.removeLast()
            val children = current.listFiles() ?: continue

            for (child in children) {
                val childName = child.name
                if (childName.startsWith(".")) continue

                if (child.isDirectory) {
                    // Skip top-level media/system folders to keep scanning fast
                    val isTopLevel = current.absolutePath == rootPath
                    if (isTopLevel && childName in skippedDirNames) {
                        // Still allow WhatsApp/Telegram inside Android/media if needed
                        if (childName == "Android") {
                            val androidMedia = File(child, "media")
                            if (androidMedia.exists() && androidMedia.canRead()) {
                                stack.add(androidMedia)
                            }
                        }
                        continue
                    }
                    if (child.canRead()) {
                        stack.add(child)
                    }
                } else if (child.isFile && child.length() > 0L) {
                    val ext = child.extension
                    val docType = DocumentType.fromExtension(ext) ?: continue
                    val parentPath = child.parentFile?.absolutePath ?: ""
                    val relativeFolder = parentPath
                        .removePrefix(rootPath)
                        .trimStart(File.separatorChar)
                        .ifEmpty { "Internal Storage" }

                    results.add(
                        DocumentItem(
                            file = child,
                            name = child.name,
                            type = docType,
                            sizeBytes = child.length(),
                            lastModified = child.lastModified(),
                            folderDisplay = relativeFolder
                        )
                    )
                }
            }
        }

        results.sortByDescending { it.lastModified }
        results
    }

    fun formatFileSize(bytes: Long): String {
        if (bytes < 1024) return "$bytes B"
        val kb = bytes / 1024.0
        if (kb < 1024) return String.format(Locale.US, "%.1f KB", kb)
        val mb = kb / 1024.0
        if (mb < 1024) return String.format(Locale.US, "%.1f MB", mb)
        val gb = mb / 1024.0
        return String.format(Locale.US, "%.2f GB", gb)
    }

    fun formatDate(timestamp: Long): String {
        val formatter = SimpleDateFormat("MMM d, yyyy", Locale.getDefault())
        return formatter.format(Date(timestamp))
    }
}
