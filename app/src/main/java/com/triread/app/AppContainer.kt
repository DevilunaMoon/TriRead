package com.triread.app

import android.content.Context
import com.triread.app.data.local.AppDatabase
import com.triread.app.data.lokit.LOKitEngine
import com.triread.app.data.repository.DocumentRepositoryImpl
import com.triread.app.data.scanner.MediaStoreDocumentScanner
import com.triread.app.data.scanner.ThumbnailGenerator
import com.triread.app.data.updater.AppUpdateManager
import com.triread.app.domain.repository.DocumentRepository

class AppContainer(context: Context) {

    val appContext: Context = context.applicationContext

    val database: AppDatabase by lazy {
        AppDatabase.getInstance(appContext)
    }

    val documentScanner: MediaStoreDocumentScanner by lazy {
        MediaStoreDocumentScanner(appContext)
    }

    val thumbnailGenerator: ThumbnailGenerator by lazy {
        ThumbnailGenerator(appContext)
    }

    val loKitEngine: LOKitEngine by lazy {
        LOKitEngine(appContext)
    }

    val appUpdateManager: AppUpdateManager by lazy {
        AppUpdateManager(appContext)
    }

    val documentRepository: DocumentRepository by lazy {
        DocumentRepositoryImpl(
            documentDao = database.documentDao(),
            scanner = documentScanner,
            thumbnailGenerator = thumbnailGenerator
        )
    }
}
