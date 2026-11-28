package com.triread.app

import android.app.Application
import android.os.Build
import android.webkit.WebView

class TriReadApplication : Application() {

    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val processName = getProcessName()
            if (processName != null && processName.endsWith(":collabora")) {
                runCatching { WebView.setDataDirectorySuffix("collabora") }
            }
        }
        container = AppContainer(this)
    }
}

