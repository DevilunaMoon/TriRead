package com.triread.app.data.lokit

import android.app.Activity
import android.content.Context
import android.content.res.AssetManager
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.asCoroutineDispatcher
import kotlinx.coroutines.withContext
import org.libreoffice.kit.LibreOfficeKit
import org.libreoffice.kit.Office
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.util.concurrent.Executors

/**
 * Single-threaded LibreOfficeKit engine host.
 * LOKit C++ internals are not thread-safe, so all initialization, document loading,
 * tile painting, and destruction must run on [lokDispatcher].
 */
class LOKitEngine(context: Context) {

    private val appContext: Context = context.applicationContext

    private val lokExecutor = Executors.newSingleThreadExecutor { runnable ->
        Thread(runnable, "LOKit-Engine-Thread").apply { isDaemon = true }
    }

    val lokDispatcher: CoroutineDispatcher = lokExecutor.asCoroutineDispatcher()

    @Volatile
    private var office: Office? = null

    suspend fun ensureInitialized(activity: Activity): Result<Office> = withContext(lokDispatcher) {
        runCatching {
            office?.let { return@runCatching it }

            unpackAssetsIfNeeded()

            LibreOfficeKit.putenv("SAL_LOG=-WARN-INFO")
            LibreOfficeKit.putenv("HOME=${appContext.cacheDir.absolutePath}")
            LibreOfficeKit.putenv("TMPDIR=${appContext.cacheDir.absolutePath}")

            LibreOfficeKit.init(activity)

            val handle = LibreOfficeKit.getLibreOfficeKitHandle()
                ?: throw IOException("LibreOfficeKit native handle initialization failed.")

            Office(handle).also { office = it }
        }
    }

    private fun unpackAssetsIfNeeded() {
        val marker = File(appContext.filesDir, UNPACK_MARKER)
        if (marker.exists()) return

        copyAssetTree(appContext.assets, UNPACK_ASSET_DIR, appContext.filesDir)
        marker.writeText("ok")
    }

    private fun copyAssetTree(
        assets: AssetManager,
        assetPath: String,
        targetDir: File
    ) {
        val children = assets.list(assetPath) ?: return
        if (children.isEmpty()) {
            // Leaf file inside assets
            targetDir.parentFile?.let { if (!it.exists()) it.mkdirs() }
            assets.open(assetPath).use { input ->
                FileOutputStream(targetDir).use { output ->
                    input.copyTo(output, bufferSize = 16 * 1024)
                }
            }
            return
        }

        if (!targetDir.exists()) {
            targetDir.mkdirs()
        }
        for (child in children) {
            val childAssetPath = "$assetPath/$child"
            val childTarget = File(targetDir, child)
            copyAssetTree(assets, childAssetPath, childTarget)
        }
    }

    companion object {
        private const val UNPACK_ASSET_DIR = "unpack"
        private const val UNPACK_MARKER = ".lokit_unpacked_v1"
    }
}

