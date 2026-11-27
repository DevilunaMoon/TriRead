package com.triread.app.ui.viewer.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
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
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.triread.app.data.parser.DocTextAlignment
import com.triread.app.data.parser.SlideElement
import com.triread.app.data.parser.SlideItem
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.launch
import java.io.File

@Composable
fun PptViewerContent(
    slides: List<SlideItem>,
    initialSlide: Int,
    slideAspectRatio: Float,
    slideWidthPt: Float,
    showSpeakerNotes: Boolean,
    isLandscape: Boolean,
    onSlideChanged: (Int) -> Unit,
    onToggleImmersive: () -> Unit,
    modifier: Modifier = Modifier
) {
    val pagerState = rememberPagerState(
        initialPage = initialSlide.coerceIn(0, (slides.size - 1).coerceAtLeast(0)),
        pageCount = { slides.size }
    )
    val scope = rememberCoroutineScope()

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
            .background(Color(0xFF111418))
    ) {
        HorizontalPager(
            state = pagerState,
            userScrollEnabled = zoomScale <= 1.02f,
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .onSizeChanged { containerSize = it }
                .pointerInput(slides.size) {
                    detectTapGestures(
                        onTap = { tapOffset ->
                            val width = containerSize.width.toFloat().coerceAtLeast(1f)
                            when {
                                zoomScale <= 1.02f && tapOffset.x < width * 0.20f -> {
                                    if (pagerState.currentPage > 0) {
                                        scope.launch {
                                            pagerState.animateScrollToPage(pagerState.currentPage - 1)
                                        }
                                    }
                                }
                                zoomScale <= 1.02f && tapOffset.x > width * 0.80f -> {
                                    if (pagerState.currentPage < slides.size - 1) {
                                        scope.launch {
                                            pagerState.animateScrollToPage(pagerState.currentPage + 1)
                                        }
                                    }
                                }
                                else -> onToggleImmersive()
                            }
                        },
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
                    .padding(horizontal = if (isLandscape) 4.dp else 8.dp, vertical = 4.dp),
                contentAlignment = Alignment.Center
            ) {
                val transformModifier = Modifier.graphicsLayer {
                    if (index == pagerState.currentPage) {
                        scaleX = zoomScale
                        scaleY = zoomScale
                        translationX = panOffset.x
                        translationY = panOffset.y
                    }
                }

                if (slide.elements.isNotEmpty() || slide.backgroundImagePath != null) {
                    SlideLayoutCanvas(
                        slide = slide,
                        aspectRatio = slideAspectRatio,
                        slideWidthPt = slideWidthPt,
                        modifier = transformModifier
                    )
                } else {
                    FallbackSlideCard(
                        slide = slide,
                        modifier = transformModifier.fillMaxWidth()
                    )
                }
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
                    .heightIn(max = 180.dp)
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
private fun SlideLayoutCanvas(
    slide: SlideItem,
    aspectRatio: Float,
    slideWidthPt: Float,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val bgColor = slide.backgroundColorArgb?.let { Color(it) } ?: Color.White

    Surface(
        modifier = modifier
            .fillMaxWidth()
            .aspectRatio(aspectRatio),
        shape = RoundedCornerShape(4.dp),
        color = bgColor,
        shadowElevation = 6.dp
    ) {
        BoxWithConstraints(
            modifier = Modifier
                .fillMaxSize()
                .clipToBounds()
        ) {
            val canvasWidth = maxWidth
            val canvasHeight = maxHeight
            // Scale PowerPoint point sizes proportionally to the actual rendered slide width.
            val ptScale = canvasWidth.value / slideWidthPt.coerceAtLeast(320f)

            if (!slide.backgroundImagePath.isNullOrBlank()) {
                AsyncImage(
                    model = ImageRequest.Builder(context)
                        .data(File(slide.backgroundImagePath))
                        .crossfade(false)
                        .build(),
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize()
                )
            }

            slide.elements.forEach { element ->
                val xDp = canvasWidth * element.xFraction
                val yDp = canvasHeight * element.yFraction
                val wDp = canvasWidth * element.widthFraction
                val hDp = canvasHeight * element.heightFraction

                when (element) {
                    is SlideElement.ImageElement -> {
                        AsyncImage(
                            model = ImageRequest.Builder(context)
                                .data(File(element.imagePath))
                                .crossfade(false)
                                .build(),
                            contentDescription = "Slide image",
                            contentScale = ContentScale.FillBounds,
                            modifier = Modifier
                                .offset(x = xDp, y = yDp)
                                .size(width = wDp, height = hDp)
                        )
                    }

                    is SlideElement.ShapeTextElement -> {
                        val fill = element.fillColorArgb?.let { Color(it) } ?: Color.Transparent
                        val borderMod = element.borderColorArgb?.let { argb ->
                            Modifier.border(0.75.dp, Color(argb))
                        } ?: Modifier

                        Box(
                            modifier = Modifier
                                .offset(x = xDp, y = yDp)
                                .size(width = wDp, height = hDp)
                                .background(fill)
                                .then(borderMod)
                                .padding(horizontal = 3.dp, vertical = 2.dp)
                        ) {
                            Column(
                                modifier = Modifier.fillMaxSize(),
                                verticalArrangement = Arrangement.spacedBy(2.dp)
                            ) {
                                element.paragraphs.forEach { para ->
                                    val scaledSp = (para.fontSizePt * ptScale * 1.05f)
                                        .coerceIn(6.5f, 34f)
                                    val defaultTextColor = if (isDarkColor(bgColor) && fill == Color.Transparent) {
                                        Color.White
                                    } else if (fill != Color.Transparent && isDarkColor(fill)) {
                                        Color.White
                                    } else {
                                        Color(0xFF1A1D21)
                                    }
                                    val prefix = if (para.isBullet) "• " else ""

                                    Text(
                                        text = "$prefix${para.text}",
                                        color = para.textColorArgb?.let { Color(it) } ?: defaultTextColor,
                                        fontSize = scaledSp.sp,
                                        lineHeight = (scaledSp * 1.2f).sp,
                                        fontWeight = if (para.isBold) FontWeight.Bold else FontWeight.Normal,
                                        fontStyle = if (para.isItalic) FontStyle.Italic else FontStyle.Normal,
                                        textAlign = para.alignment.toSlideTextAlign(),
                                        overflow = TextOverflow.Ellipsis,
                                        modifier = Modifier.fillMaxWidth()
                                    )
                                }
                            }
                        }
                    }

                    is SlideElement.TableElement -> {
                        val tableFontSp = (12f * ptScale).coerceIn(6.5f, 16f)
                        Surface(
                            color = Color.White.copy(alpha = 0.94f),
                            border = BorderStroke(0.5.dp, Color(0xFFCBD5E1)),
                            modifier = Modifier
                                .offset(x = xDp, y = yDp)
                                .size(width = wDp, height = hDp)
                        ) {
                            Column(modifier = Modifier.fillMaxSize()) {
                                element.rows.forEachIndexed { rowIdx, row ->
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .background(
                                                if (rowIdx == 0) Color(0xFFEEF2F7) else Color.Transparent
                                            )
                                            .padding(horizontal = 3.dp, vertical = 2.dp),
                                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                                    ) {
                                        row.forEach { cell ->
                                            Text(
                                                text = cell,
                                                color = Color(0xFF1A1D21),
                                                fontSize = tableFontSp.sp,
                                                lineHeight = (tableFontSp * 1.15f).sp,
                                                fontWeight = if (rowIdx == 0) FontWeight.Bold else FontWeight.Normal,
                                                maxLines = 3,
                                                overflow = TextOverflow.Ellipsis,
                                                modifier = Modifier.weight(1f)
                                            )
                                        }
                                    }
                                    HorizontalDivider(color = Color(0xFFE2E8F0), thickness = 0.5.dp)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun FallbackSlideCard(
    slide: SlideItem,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current

    Card(
        modifier = modifier.padding(horizontal = 8.dp),
        shape = RoundedCornerShape(12.dp),
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
            if (!slide.fallbackTitle.isNullOrBlank()) {
                Text(
                    text = slide.fallbackTitle,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF1A1D21)
                )
                HorizontalDivider(color = Color(0xFFE5E7EB))
            }
            slide.fallbackBodyLines.forEach { line ->
                Text(
                    text = "• $line",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color(0xFF2D333B)
                )
            }
            if (slide.fallbackImagePaths.isNotEmpty()) {
                Spacer(modifier = Modifier.height(4.dp))
                slide.fallbackImagePaths.forEach { path ->
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
        }
    }
}

private fun DocTextAlignment.toSlideTextAlign(): TextAlign = when (this) {
    DocTextAlignment.START -> TextAlign.Start
    DocTextAlignment.CENTER -> TextAlign.Center
    DocTextAlignment.END -> TextAlign.End
    DocTextAlignment.JUSTIFY -> TextAlign.Justify
}

private fun isDarkColor(color: Color): Boolean {
    val luminance = (0.299f * color.red) + (0.587f * color.green) + (0.114f * color.blue)
    return luminance < 0.45f
}
