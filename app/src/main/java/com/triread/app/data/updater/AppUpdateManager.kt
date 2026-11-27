package com.triread.app.data.updater

import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import com.triread.app.BuildConfig
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import kotlin.coroutines.coroutineContext

data class AppUpdateInfo(
    val currentVersionName: String,
    val currentVersionCode: Int,
    val latestVersionName: String,
    val latestVersionCode: Int,
    val releaseNotes: String,
    val apkDownloadUrl: String,
    val apkSizeBytes: Long,
    val isUpdateAvailable: Boolean
)

class AppUpdateManager(
    private val context: Context,
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO
) {

    suspend fun checkForUpdate(): Result<AppUpdateInfo> = withContext(ioDispatcher) {
        runCatching {
            val connection = (URL(LATEST_RELEASE_API).openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 10_000
                readTimeout = 10_000
                setRequestProperty("Accept", "application/vnd.github+json")
                setRequestProperty("User-Agent", "TriRead-Android/${BuildConfig.VERSION_NAME}")
            }

            val jsonBody = try {
                val code = connection.responseCode
                if (code !in 200..299) {
                    throw IOException("GitHub API returned HTTP $code.")
                }
                connection.inputStream.bufferedReader().use { it.readText() }
            } finally {
                connection.disconnect()
            }

            val root = JSONObject(jsonBody)
            val releaseName = root.optString("name", "Latest Build").ifBlank { "Latest Build" }
            val releaseBody = root.optString("body", "").ifBlank {
                "Includes the latest improvements and bug fixes for TriRead."
            }

            val assets = root.optJSONArray("assets")
            var apkUrl = ""
            var apkSize = 0L
            if (assets != null) {
                for (i in 0 until assets.length()) {
                    val asset = assets.getJSONObject(i)
                    val assetName = asset.optString("name", "")
                    if (assetName.endsWith(".apk", ignoreCase = true)) {
                        apkUrl = asset.optString("browser_download_url", "")
                        apkSize = asset.optLong("size", 0L)
                        break
                    }
                }
            }
            if (apkUrl.isBlank()) {
                throw IOException("No APK asset found in the latest GitHub release.")
            }

            val parsedBuildNumber = parseBuildNumber(releaseName)
                ?: parseBuildNumber(releaseBody)
                ?: (BuildConfig.VERSION_CODE + 1)

            val displayLatestVersion = if (releaseName.contains("v1.", ignoreCase = true)) {
                releaseName.removePrefix("TriRead ").trim()
            } else {
                "v1.0.$parsedBuildNumber"
            }

            AppUpdateInfo(
                currentVersionName = "v${BuildConfig.VERSION_NAME}",
                currentVersionCode = BuildConfig.VERSION_CODE,
                latestVersionName = displayLatestVersion,
                latestVersionCode = parsedBuildNumber,
                releaseNotes = releaseBody.trim(),
                apkDownloadUrl = apkUrl,
                apkSizeBytes = apkSize,
                isUpdateAvailable = parsedBuildNumber > BuildConfig.VERSION_CODE
            )
        }
    }

    suspend fun downloadApk(
        downloadUrl: String,
        onProgress: (Float) -> Unit
    ): Result<File> = withContext(ioDispatcher) {
        runCatching {
            val updatesDir = File(context.cacheDir, "updates").apply { if (!exists()) mkdirs() }
            val targetFile = File(updatesDir, "TriRead.apk")
            val tempFile = File(updatesDir, "TriRead.apk.tmp")

            val connection = (URL(downloadUrl).openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                instanceFollowRedirects = true
                connectTimeout = 15_000
                readTimeout = 30_000
                setRequestProperty("User-Agent", "TriRead-Android/${BuildConfig.VERSION_NAME}")
            }

            try {
                val code = connection.responseCode
                if (code !in 200..299) {
                    throw IOException("Download failed with HTTP $code.")
                }

                val totalBytes = connection.contentLengthLong
                var downloadedBytes = 0L

                connection.inputStream.use { input ->
                    FileOutputStream(tempFile).use { output ->
                        val buffer = ByteArray(16 * 1024)
                        while (true) {
                            coroutineContext.ensureActive()
                            val read = input.read(buffer)
                            if (read <= 0) break
                            output.write(buffer, 0, read)
                            downloadedBytes += read
                            if (totalBytes > 0L) {
                                onProgress((downloadedBytes.toFloat() / totalBytes.toFloat()).coerceIn(0f, 1f))
                            }
                        }
                        output.flush()
                    }
                }

                if (targetFile.exists()) targetFile.delete()
                if (!tempFile.renameTo(targetFile)) {
                    throw IOException("Failed to finalize downloaded APK.")
                }
                onProgress(1f)
                targetFile
            } catch (t: Throwable) {
                if (tempFile.exists()) tempFile.delete()
                throw t
            } finally {
                connection.disconnect()
            }
        }
    }

    fun buildInstallIntent(apkFile: File): Intent {
        val contentUri = FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            apkFile
        )
        return Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(contentUri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
    }

    private fun parseBuildNumber(text: String): Int? {
        VERSION_REGEX.find(text)?.groupValues?.getOrNull(1)?.toIntOrNull()?.let { return it }
        BUILD_REGEX.find(text)?.groupValues?.getOrNull(1)?.toIntOrNull()?.let { return it }
        return null
    }

    companion object {
        private const val LATEST_RELEASE_API =
            "https://api.github.com/repos/DevilunaMoon/TriRead/releases/latest"
        private val VERSION_REGEX = Regex("""v\d+\.\d+\.(\d+)""", RegexOption.IGNORE_CASE)
        private val BUILD_REGEX = Regex("""Build\s*#(\d+)""", RegexOption.IGNORE_CASE)
    }
}
