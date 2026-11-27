package com.triread.app.ui.viewer.components

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import java.io.File

@Composable
fun PptViewerContent(
    tempFile: File,
    isImmersive: Boolean,
    onNavigateBack: () -> Unit,
    onError: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    CollaboraWebViewContent(
        tempFile = tempFile,
        isImmersive = isImmersive,
        onNavigateBack = onNavigateBack,
        onError = onError,
        modifier = modifier
    )
}
