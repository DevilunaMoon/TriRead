package com.triread.app.ui.viewer.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.triread.app.data.parser.SlideItem
import kotlinx.coroutines.flow.distinctUntilChanged
import java.io.File

@Composable
fun PptViewerContent(
    slides: List<SlideItem>,
    initialSlide: Int,
    showSpeakerNotes: Boolean,
    onSlideChanged: (Int) -> Unit,
    onToggleImmersive: () -> Unit,
    modifier: Modifier = Modifier
) {
    val pagerState = rememberPagerState(
        initialPage = initialSlide.coerceIn(0, (slides.size - 1).coerceAtLeast(0)),
        pageCount = { slides.size }
    )

    var zoomScale by remember { mutableFloatStateOf(1f) }
    var panOffset by remember { mutableStateOf(Offset.Zero) }
    var containerSize by remember { mutableStateOf(IntSize.Zero) }

    LaunchedEffect(pagerState) {
        snapshotFlow { pagerState.currentPage }
            .distinctUntilChanged()
            .collect { page ->
                zoomScale = 1f
                panOffset = Offset.Zero
                onSlideChanged(page)
            }
    }

    val currentSlide = slides.getOrNull(pagerState.currentPage)

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFF181C22))
    ) {
        HorizontalPager(
            state = pagerState,
            userScrollEnabled = zoomScale <= 1.02f,
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .onSizeChanged { containerSize = it }
                .pointerInput(Unit) {
                    detectTapGestures(
                        onTap = { onToggleImmersive() },
                        onDoubleTap = {
                            if (zoomScale > 1.1f) {
                                zoomScale = 1f
                                panOffset = Offset.Zero
                            } else {
                                zoomScale = 2.0f
                            }
                        }
                    )
                }
                .pointerInput(Unit) {
                    detectTransformGestures { _, pan, zoom, _ ->
                        val nextScale = (zoomScale * zoom).coerceIn(1f, 3.5f)
                        zoomScale = nextScale
                        if (nextScale <= 1.02f) {
                            panOffset = Offset.Zero
                        } else {
                            val maxX = (containerSize.width * (nextScale - 1f)) / 2f
                            val maxY = (containerSize.height * (nextScale - 1f)) / 2f
                            panOffset = Offset(
                                x = (panOffset.x + pan.x).coerceIn(-maxX, maxX),
                                y = (panOffset.y + pan.y).coerceIn(-maxY, maxY)
                            )
                        }
                    }
                }
        ) { index ->
            val slide = slides[index]
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 14.dp, vertical = 68.dp),
                contentAlignment = Alignment.Center
            ) {
                SlideCard(
                    slide = slide,
                    modifier = Modifier
                        .fillMaxWidth()
                        .graphicsLayer {
                            if (index == pagerState.currentPage) {
                                scaleX = zoomScale
                                scaleY = zoomScale
                                translationX = panOffset.x
                                translationY = panOffset.y
                            }
                        }
                )
            }
        }

        AnimatedVisibility(
            visible = showSpeakerNotes && !currentSlide?.speakerNotes.isNullOrBlank()
        ) {
            Surface(
                color = MaterialTheme.colorScheme.surface,
                tonalElevation = 4.dp,
                shape = RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 200.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState())
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(
                        text = "SPEAKER NOTES",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.primary
                    )
                    Text(
                        text = currentSlide?.speakerNotes.orEmpty(),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                }
            }
        }
    }
}

@Composable
private fun SlideCard(
    slide: SlideItem,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current

    Card(
        modifier = modifier,
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Text(
                text = "SLIDE ${slide.slideNumber}",
                style = MaterialTheme.typography.labelSmall,
                color = Color(0xFFE65100)
            )

            if (!slide.title.isNullOrBlank()) {
                Text(
                    text = slide.title,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF1A1D21)
                )
                HorizontalDivider(color = Color(0xFFE5E7EB))
            }

            slide.bodyLines.forEach { line ->
                Text(
                    text = "• $line",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color(0xFF2D333B)
                )
            }

            if (slide.imagePaths.isNotEmpty()) {
                Spacer(modifier = Modifier.height(4.dp))
                slide.imagePaths.forEach { path ->
                    AsyncImage(
                        model = ImageRequest.Builder(context)
                            .data(File(path))
                            .crossfade(true)
                            .build(),
                        contentDescription = "Slide ${slide.slideNumber} image",
                        contentScale = ContentScale.Fit,
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(max = 260.dp)
                            .clip(RoundedCornerShape(8.dp))
                    )
                }
            }

            if (slide.title.isNullOrBlank() && slide.bodyLines.isEmpty() && slide.imagePaths.isEmpty()) {
                Text(
                    text = "Empty slide",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color(0xFF6B7280)
                )
            }
        }
    }
}

