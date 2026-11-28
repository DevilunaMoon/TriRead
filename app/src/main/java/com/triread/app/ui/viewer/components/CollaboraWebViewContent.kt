package com.triread.app.ui.viewer.components

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.triread.app.ui.viewer.CollaboraViewerActivity
import java.io.File

/**
 * Launches [CollaboraViewerActivity] in its isolated `:collabora` process once per document.
 * When the user closes the document (and Collabora's native COOLWSD exits its isolated process),
 * control returns cleanly to [MainActivity] and pops back to the Dashboard.
 */
@Composable
fun CollaboraWebViewContent(
    tempFile: File,
    title: String,
    isPresentation: Boolean,
    isImmersive: Boolean,
    onNavigateBack: () -> Unit,
    onError: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    var hasLaunched by rememberSaveable(tempFile.absolutePath) { mutableStateOf(false) }

    val launcher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val errorMessage = result.data?.getStringExtra(CollaboraViewerActivity.EXTRA_ERROR_MESSAGE)
        if (!errorMessage.isNullOrBlank()) {
            onError(errorMessage)
        } else {
            onNavigateBack()
        }
    }

    LaunchedEffect(tempFile.absolutePath) {
        if (!hasLaunched) {
            hasLaunched = true
            val intent = CollaboraViewerActivity.createIntent(
                context = context,
                filePath = tempFile.absolutePath,
                title = title,
                isPresentation = isPresentation
            )
            launcher.launch(intent)
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            CircularProgressIndicator()
            Text(
                text = "Opening document...",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
