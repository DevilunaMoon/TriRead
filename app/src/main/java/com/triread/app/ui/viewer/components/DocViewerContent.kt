package com.triread.app.ui.viewer.components

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import java.io.File

@Composable
fun DocViewerContent(
    tempFile: File,
    title: String,
    isImmersive: Boolean,
    onNavigateBack: () -> Unit,
    onError: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    CollaboraWebViewContent(
        tempFile = tempFile,
        title = title,
        isPresentation = false,
        isImmersive = isImmersive,
        onNavigateBack = onNavigateBack,
        onError = onError,
        modifier = modifier
    )
}
