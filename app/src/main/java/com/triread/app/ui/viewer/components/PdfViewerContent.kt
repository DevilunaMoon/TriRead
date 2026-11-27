package com.triread.app.ui.viewer.components

import android.graphics.Bitmap
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import com.triread.app.ui.viewer.PdfReadingMode
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.launch

@Composable
fun PdfViewerContent(
    totalPages: Int,
    currentPage: Int,
    readingMode: PdfReadingMode,
    isImmersive: Boolean,
    renderedPages: Map<Int, Bitmap>,
    onPageChanged: (Int) -> Unit,
    onViewportWidthChanged: (Int) -> Unit,
    onToggleImmersive: () -> Unit,
    modifier: Modifier = Modifier
) {
    when (readingMode) {
        PdfReadingMode.VERTICAL_SCROLL -> PdfVerticalScrollContent(
            totalPages = totalPages,
            initialPage = currentPage,
            isImmersive = isImmersive,
            renderedPages = renderedPages,
            onPageChanged = onPageChanged,
            onViewportWidthChanged = onViewportWidthChanged,
            onToggleImmersive = onToggleImmersive,
            modifier = modifier
        )

        PdfReadingMode.HORIZONTAL_PAGED -> PdfHorizontalPagedContent(
            totalPages = totalPages,
            initialPage = currentPage,
            renderedPages = renderedPages,
            onPageChanged = onPageChanged,
            onViewportWidthChanged = onViewportWidthChanged,
            onToggleImmersive = onToggleImmersive,
            modifier = modifier
        )
    }
}

@Composable
private fun PdfVerticalScrollContent(
    totalPages: Int,
    initialPage: Int,
    isImmersive: Boolean,
    renderedPages: Map<Int, Bitmap>,
    onPageChanged: (Int) -> Unit,
    onViewportWidthChanged: (Int) -> Unit,
    onToggleImmersive: () -> Unit,
    modifier: Modifier = Modifier
) {
    val listState = rememberLazyListState(
        initialFirstVisibleItemIndex = initialPage.coerceIn(0, (totalPages - 1).coerceAtLeast(0))
    )

    var zoomScale by remember { mutableFloatStateOf(1f) }
    var panOffset by remember { mutableStateOf(Offset.Zero) }
    var containerSize by remember { mutableStateOf(IntSize.Zero) }

    LaunchedEffect(listState) {
        snapshotFlow { listState.firstVisibleItemIndex }
            .distinctUntilChanged()
            .collect { page -> onPageChanged(page) }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFF181C22))
            .onSizeChanged { size ->
                containerSize = size
                if (size.width > 0) onViewportWidthChanged(size.width)
            }
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
    ) {
        LazyColumn(
            state = listState,
            userScrollEnabled = zoomScale <= 1.02f,
            modifier = Modifier
                .fillMaxSize()
                .graphicsLayer {
                    scaleX = zoomScale
                    scaleY = zoomScale
                    translationX = panOffset.x
                    translationY = panOffset.y
                },
            contentPadding = PaddingValues(
                top = if (isImmersive) 0.dp else 72.dp,
                bottom = if (isImmersive) 0.dp else 72.dp
            ),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            items(count = totalPages, key = { it }) { pageIndex ->
                val bitmap = renderedPages[pageIndex]
                val aspectRatio = if (bitmap != null && !bitmap.isRecycled && bitmap.height > 0) {
                    bitmap.width.toFloat() / bitmap.height.toFloat()
                } else {
                    0.707f // Standard A4 ratio placeholder
                }

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(aspectRatio)
                        .background(Color.White),
                    contentAlignment = Alignment.Center
                ) {
                    if (bitmap != null && !bitmap.isRecycled) {
                        val imageBitmap = remember(bitmap) { bitmap.asImageBitmap() }
                        Image(
                            bitmap = imageBitmap,
                            contentDescription = "PDF page ${pageIndex + 1}",
                            contentScale = ContentScale.FillWidth,
                            modifier = Modifier.fillMaxSize()
                        )
                    } else {
                        CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                    }
                }
            }
        }
    }
}

@Composable
private fun PdfHorizontalPagedContent(
    totalPages: Int,
    initialPage: Int,
    renderedPages: Map<Int, Bitmap>,
    onPageChanged: (Int) -> Unit,
    onViewportWidthChanged: (Int) -> Unit,
    onToggleImmersive: () -> Unit,
    modifier: Modifier = Modifier
) {
    val pagerState = rememberPagerState(
        initialPage = initialPage.coerceIn(0, (totalPages - 1).coerceAtLeast(0)),
        pageCount = { totalPages }
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
                onPageChanged(page)
            }
    }

    HorizontalPager(
        state = pagerState,
        userScrollEnabled = zoomScale <= 1.02f,
        beyondViewportPageCount = 1,
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFF181C22))
            .onSizeChanged { size ->
                containerSize = size
                if (size.width > 0) onViewportWidthChanged(size.width)
            }
            .pointerInput(totalPages) {
                detectTapGestures(
                    onTap = { tapOffset ->
                        val width = containerSize.width.toFloat().coerceAtLeast(1f)
                        when {
                            zoomScale <= 1.02f && tapOffset.x < width * 0.25f -> {
                                if (pagerState.currentPage > 0) {
                                    scope.launch {
                                        pagerState.animateScrollToPage(pagerState.currentPage - 1)
                                    }
                                }
                            }
                            zoomScale <= 1.02f && tapOffset.x > width * 0.75f -> {
                                if (pagerState.currentPage < totalPages - 1) {
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
                            zoomScale = 2.2f
                        }
                    }
                )
            }
            .pointerInput(Unit) {
                detectTransformGestures { _, pan, zoom, _ ->
                    val newScale = (zoomScale * zoom).coerceIn(1f, 4f)
                    zoomScale = newScale
                    if (newScale <= 1.02f) {
                        panOffset = Offset.Zero
                    } else {
                        val maxX = (containerSize.width * (newScale - 1f)) / 2f
                        val maxY = (containerSize.height * (newScale - 1f)) / 2f
                        panOffset = Offset(
                            x = (panOffset.x + pan.x).coerceIn(-maxX, maxX),
                            y = (panOffset.y + pan.y).coerceIn(-maxY, maxY)
                        )
                    }
                }
            }
    ) { pageIndex ->
        val bitmap = renderedPages[pageIndex]
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 4.dp, vertical = 8.dp),
            contentAlignment = Alignment.Center
        ) {
            if (bitmap != null && !bitmap.isRecycled) {
                val imageBitmap = remember(bitmap) { bitmap.asImageBitmap() }
                Image(
                    bitmap = imageBitmap,
                    contentDescription = "PDF page ${pageIndex + 1}",
                    contentScale = ContentScale.Fit,
                    modifier = Modifier
                        .fillMaxSize()
                        .graphicsLayer {
                            if (pageIndex == pagerState.currentPage) {
                                scaleX = zoomScale
                                scaleY = zoomScale
                                translationX = panOffset.x
                                translationY = panOffset.y
                            }
                        }
                )
            } else {
                CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
            }
        }
    }
}
