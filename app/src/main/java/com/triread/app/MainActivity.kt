package com.triread.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.lifecycleScope
import com.triread.app.ui.navigation.TriReadNavGraph
import com.triread.app.ui.theme.TriReadTheme
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    private var pendingExternalUri by mutableStateOf<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val container = (application as TriReadApplication).container
        handleIncomingIntent(intent, container)

        setContent {
            TriReadTheme {
                TriReadNavGraph(
                    container = container,
                    initialDocumentUri = pendingExternalUri,
                    onInitialDocumentConsumed = { pendingExternalUri = null }
                )
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        val container = (application as TriReadApplication).container
        handleIncomingIntent(intent, container)
    }

    private fun handleIncomingIntent(intent: Intent?, container: AppContainer) {
        if (intent?.action != Intent.ACTION_VIEW) return
        val uri = intent.data ?: return

        runCatching {
            contentResolver.takePersistableUriPermission(
                uri,
                Intent.FLAG_GRANT_READ_URI_PERMISSION
            )
        }

        lifecycleScope.launch {
            container.documentRepository.importDocument(uri)
                .onSuccess { imported ->
                    pendingExternalUri = imported.uriString
                }
        }
    }
}
