package com.triread.app.ui.viewer

import android.app.Activity
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.Description
import androidx.compose.material.icons.rounded.ErrorOutline
import androidx.compose.material.icons.rounded.SpeakerNotes
import androidx.compose.material.icons.rounded.TextFields
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.triread.app.ui.viewer.components.DocSettingsBottomSheet
import com.triread.app.ui.viewer.components.DocViewerContent
import com.triread.app.ui.viewer.components.PdfViewerContent
import com.triread.app.ui.viewer.components.PptViewerContent

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ViewerScreen(
    viewModel: ViewerViewModel,
    onNavigateBack: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val view = LocalView.current

    // Persist reading progress automatically whenever the app pauses or screen is backgrounded.
    LifecycleEventEffect(Lifecycle.Event.ON_PAUSE) {
        viewModel.persistProgressNow()
    }

    // Sync Android system bars with distraction-free immersive mode.
    LaunchedEffect(uiState.isImmersive) {
        val window = (view.context as? Activity)?.window ?: return@LaunchedEffect
        val controller = WindowCompat.getInsetsController(window, view)
        controller.systemBarsBehavior =
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        if (uiState.isImmersive) {
            controller.hide(WindowInsetsCompat.Type.systemBars())
        } else {
            controller.show(WindowInsetsCompat.Type.systemBars())
        }
    }

    DisposableEffect(Unit) {
        onDispose {
            val window = (view.context as? Activity)?.window ?: return@onDispose
            WindowCompat.getInsetsController(window, view)
                .show(WindowInsetsCompat.Type.systemBars())
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        when (val content = uiState.contentState) {
            ViewerContentState.Loading -> {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }

            is ViewerContentState.Error -> {
                ViewerErrorState(
                    title = content.title,
                    message = content.message,
                    onRetry = viewModel::loadDocument,
                    onBack = onNavigateBack
                )
            }

            is ViewerContentState.PdfReady -> {
                PdfViewerContent(
                    totalPages = content.totalPages,
                    initialPage = content.initialPage,
                    renderedPages = content.renderedPages,
                    onPageChanged = viewModel::onPageChanged,
                    onViewportWidthChanged = viewModel::onPdfViewportWidthChanged,
                    onToggleImmersive = viewModel::toggleImmersiveMode
                )
            }

            is ViewerContentState.DocReady -> {
                DocViewerContent(
                    blocks = content.blocks,
                    initialBlockIndex = content.initialBlockIndex,
                    noticeMessage = content.noticeMessage,
                    settings = uiState.typographySettings,
                    onVisibleBlockChanged = viewModel::onDocVisibleBlockChanged,
                    onToggleImmersive = viewModel::toggleImmersiveMode
                )
            }

            is ViewerContentState.PptReady -> {
                PptViewerContent(
                    slides = content.slides,
                    initialSlide = content.initialSlide,
                    showSpeakerNotes = uiState.showSpeakerNotes,
                    onSlideChanged = viewModel::onPageChanged,
                    onToggleImmersive = viewModel::toggleImmersiveMode
                )
            }
        }

        // Overlay Top Bar (hidden in immersive mode)
        AnimatedVisibility(
            visible = !uiState.isImmersive,
            enter = fadeIn() + slideInVertically { -it },
            exit = fadeOut() + slideOutVertically { -it },
            modifier = Modifier.align(Alignment.TopCenter)
        ) {
            TopAppBar(
                modifier = Modifier.statusBarsPadding(),
                title = {
                    Text(
                        text = uiState.document?.title ?: "Document",
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        style = MaterialTheme.typography.titleMedium
                    )
                },
                navigationIcon = {
                    IconButton(onClick = {
                        viewModel.persistProgressNow()
                        onNavigateBack()
                    }) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Rounded.ArrowBack,
                            contentDescription = "Back"
                        )
                    }
                },
                actions = {
                    when (val content = uiState.contentState) {
                        is ViewerContentState.DocReady -> {
                            IconButton(onClick = viewModel::toggleSettingsSheet) {
                                Icon(
                                    imageVector = Icons.Rounded.TextFields,
                                    contentDescription = "Reading settings"
                                )
                            }
                        }

                        is ViewerContentState.PptReady -> {
                            val currentSlideNotes = content.slides
                                .getOrNull(uiState.currentPage)
                                ?.speakerNotes
                            if (!currentSlideNotes.isNullOrBlank()) {
                                IconButton(onClick = viewModel::toggleSpeakerNotes) {
                                    Icon(
                                        imageVector = Icons.Rounded.SpeakerNotes,
                                        contentDescription = "Toggle speaker notes",
                                        tint = if (uiState.showSpeakerNotes) {
                                            MaterialTheme.colorScheme.primary
                                        } else {
                                            MaterialTheme.colorScheme.onSurface
                                        }
                                    )
                                }
                            }
                        }

                        else -> Unit
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0.94f)
                )
            )
        }

        // Overlay Bottom Page / Slide Counter Pill (hidden in immersive mode)
        AnimatedVisibility(
            visible = !uiState.isImmersive && uiState.totalPages > 0 &&
                uiState.contentState !is ViewerContentState.Error,
            enter = fadeIn() + slideInVertically { it },
            exit = fadeOut() + slideOutVertically { it },
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .navigationBarsPadding()
                .padding(bottom = 16.dp)
        ) {
            val unitLabel = if (uiState.contentState is ViewerContentState.PptReady) {
                "Slide"
            } else {
                "Page"
            }
            val displayPage = (uiState.currentPage + 1).coerceIn(1, uiState.totalPages)

            Surface(
                shape = RoundedCornerShape(20.dp),
                color = MaterialTheme.colorScheme.surface.copy(alpha = 0.92f),
                tonalElevation = 4.dp,
                shadowElevation = 4.dp
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(
                        imageVector = Icons.Rounded.Description,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary
                    )
                    Text(
                        text = "$unitLabel $displayPage of ${uiState.totalPages}",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                }
            }
        }
    }

    if (uiState.showSettingsSheet && uiState.contentState is ViewerContentState.DocReady) {
        DocSettingsBottomSheet(
            settings = uiState.typographySettings,
            onSelectTheme = viewModel::selectReaderTheme,
            onFontSizeChange = viewModel::updateFontSize,
            onLineSpacingChange = viewModel::updateLineSpacing,
            onDismiss = viewModel::dismissSettingsSheet
        )
    }
}

@Composable
private fun ViewerErrorState(
    title: String,
    message: String,
    onRetry: () -> Unit,
    onBack: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            imageVector = Icons.Rounded.ErrorOutline,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.error
        )
        Text(
            text = title,
            style = MaterialTheme.typography.titleLarge,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 12.dp)
        )
        Text(
            text = message,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 8.dp, bottom = 20.dp)
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterHorizontally)
        ) {
            Button(onClick = onBack) {
                Text(text = "Go Back")
            }
            Button(onClick = onRetry) {
                Text(text = "Retry")
            }
        }
    }
}

