package com.triread.app.ui.viewer.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Slider
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
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
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.triread.app.data.parser.DocBlock
import com.triread.app.data.parser.DocTextAlignment
import com.triread.app.ui.viewer.ReaderTheme
import com.triread.app.ui.viewer.ReaderTypographySettings
import kotlinx.coroutines.flow.distinctUntilChanged
import java.io.File
import java.util.Locale

@Composable
fun DocViewerContent(
    blocks: List<DocBlock>,
    initialBlockIndex: Int,
    noticeMessage: String?,
    settings: ReaderTypographySettings,
    isImmersive: Boolean,
    onVisibleBlockChanged: (Int) -> Unit,
    onPrintPageChanged: (Int, Int) -> Unit,
    onToggleImmersive: () -> Unit,
    modifier: Modifier = Modifier
) {
    if (settings.isPrintLayout) {
        DocPrintLayoutContent(
            blocks = blocks,
            noticeMessage = noticeMessage,
            isImmersive = isImmersive,
            onPrintPageChanged = onPrintPageChanged,
            onToggleImmersive = onToggleImmersive,
            modifier = modifier
        )
    } else {
        DocReflowableContent(
            blocks = blocks,
            initialBlockIndex = initialBlockIndex,
            noticeMessage = noticeMessage,
            settings = settings,
            isImmersive = isImmersive,
            onVisibleBlockChanged = onVisibleBlockChanged,
            onToggleImmersive = onToggleImmersive,
            modifier = modifier
        )
    }
}

@Composable
private fun DocReflowableContent(
    blocks: List<DocBlock>,
    initialBlockIndex: Int,
    noticeMessage: String?,
    settings: ReaderTypographySettings,
    isImmersive: Boolean,
    onVisibleBlockChanged: (Int) -> Unit,
    onToggleImmersive: () -> Unit,
    modifier: Modifier = Modifier
) {
    val listState = rememberLazyListState(
        initialFirstVisibleItemIndex = initialBlockIndex.coerceIn(0, (blocks.size - 1).coerceAtLeast(0))
    )

    LaunchedEffect(listState) {
        snapshotFlow { listState.firstVisibleItemIndex }
            .distinctUntilChanged()
            .collect { index -> onVisibleBlockChanged(index) }
    }

    val theme = settings.theme

    LazyColumn(
        state = listState,
        modifier = modifier
            .fillMaxSize()
            .background(theme.backgroundColor)
            .pointerInput(Unit) {
                detectTapGestures(onTap = { onToggleImmersive() })
            },
        contentPadding = PaddingValues(
            start = 20.dp,
            end = 20.dp,
            top = if (isImmersive) 20.dp else 96.dp,
            bottom = if (isImmersive) 28.dp else 88.dp
        ),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        if (!noticeMessage.isNullOrBlank()) {
            item(key = "doc_notice") {
                NoticeCard(
                    message = noticeMessage,
                    surfaceColor = theme.surfaceColor,
                    textColor = theme.secondaryTextColor
                )
            }
        }

        itemsIndexed(
            items = blocks,
            key = { index, _ -> index }
        ) { _, block ->
            DocBlockItem(
                block = block,
                textColor = theme.textColor,
                surfaceColor = theme.surfaceColor,
                mutedColor = theme.secondaryTextColor,
                fontSizeSp = settings.fontSizeSp,
                lineHeightMultiplier = settings.lineHeightMultiplier
            )
        }
    }
}

@Composable
private fun DocPrintLayoutContent(
    blocks: List<DocBlock>,
    noticeMessage: String?,
    isImmersive: Boolean,
    onPrintPageChanged: (Int, Int) -> Unit,
    onToggleImmersive: () -> Unit,
    modifier: Modifier = Modifier
) {
    val pages = remember(blocks) { paginateBlocksForPrint(blocks) }
    val listState = rememberLazyListState()

    var zoomScale by remember { mutableFloatStateOf(1f) }
    var panOffset by remember { mutableStateOf(Offset.Zero) }
    var containerSize by remember { mutableStateOf(IntSize.Zero) }

    LaunchedEffect(listState, pages.size) {
        snapshotFlow { listState.firstVisibleItemIndex }
            .distinctUntilChanged()
            .collect { index ->
                onPrintPageChanged(index, pages.size)
            }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFFDDE1E7))
            .onSizeChanged { containerSize = it }
            .pointerInput(Unit) {
                detectTapGestures(
                    onTap = { onToggleImmersive() },
                    onDoubleTap = {
                        if (zoomScale > 1.1f) {
                            zoomScale = 1f
                            panOffset = Offset.Zero
                        } else {
                            zoomScale = 1.8f
                        }
                    }
                )
            }
            .pointerInput(Unit) {
                detectTransformGestures { _, pan, zoom, _ ->
                    val nextScale = (zoomScale * zoom).coerceIn(1f, 3f)
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
                start = 12.dp,
                end = 12.dp,
                top = if (isImmersive) 14.dp else 96.dp,
                bottom = if (isImmersive) 20.dp else 88.dp
            ),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            if (!noticeMessage.isNullOrBlank()) {
                item(key = "print_notice") {
                    NoticeCard(
                        message = noticeMessage,
                        surfaceColor = Color.White,
                        textColor = Color(0xFF4B5563)
                    )
                }
            }

            itemsIndexed(items = pages, key = { idx, _ -> "print_page_$idx" }) { pageIdx, pageBlocks ->
                Surface(
                    shape = RoundedCornerShape(4.dp),
                    color = Color.White,
                    shadowElevation = 4.dp,
                    border = BorderStroke(0.5.dp, Color(0xFFCBD5E1)),
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(min = 480.dp)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 24.dp, vertical = 26.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        pageBlocks.forEach { block ->
                            DocBlockItem(
                                block = block,
                                textColor = Color(0xFF111827),
                                surfaceColor = Color(0xFFF8FAFC),
                                mutedColor = Color(0xFF64748B),
                                fontSizeSp = 12.5f,
                                lineHeightMultiplier = 1.45f
                            )
                        }
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = "${pageIdx + 1}",
                            fontSize = 10.sp,
                            color = Color(0xFF94A3B8),
                            textAlign = TextAlign.Center,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun DocBlockItem(
    block: DocBlock,
    textColor: Color,
    surfaceColor: Color,
    mutedColor: Color,
    fontSizeSp: Float,
    lineHeightMultiplier: Float
) {
    val context = LocalContext.current

    when (block) {
        is DocBlock.Heading -> {
            val headingScale = when (block.level) {
                1 -> 1.42f
                2 -> 1.24f
                else -> 1.12f
            }
            val size = (fontSizeSp * headingScale).sp
            Text(
                text = block.text,
                color = textColor,
                fontSize = size,
                lineHeight = size * 1.25f,
                fontWeight = FontWeight.Bold,
                textAlign = block.alignment.toComposeTextAlign(),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 6.dp, bottom = 2.dp)
            )
        }

        is DocBlock.Paragraph -> {
            val prefix = if (block.isBullet) "•  " else ""
            Text(
                text = "$prefix${block.text}",
                color = textColor,
                fontSize = fontSizeSp.sp,
                lineHeight = (fontSizeSp * lineHeightMultiplier).sp,
                fontWeight = if (block.isBold) FontWeight.SemiBold else FontWeight.Normal,
                fontStyle = if (block.isItalic) FontStyle.Italic else FontStyle.Normal,
                textAlign = block.alignment.toComposeTextAlign(),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(start = if (block.isBullet) 10.dp else 0.dp)
            )
        }

        is DocBlock.ImageBlock -> {
            AsyncImage(
                model = ImageRequest.Builder(context)
                    .data(File(block.imagePath))
                    .crossfade(true)
                    .build(),
                contentDescription = "Document image",
                contentScale = ContentScale.Fit,
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 280.dp)
                    .clip(RoundedCornerShape(6.dp))
            )
        }

        is DocBlock.TableRow -> {
            Card(
                colors = CardDefaults.cardColors(containerColor = surfaceColor),
                shape = RoundedCornerShape(6.dp),
                border = BorderStroke(1.dp, mutedColor.copy(alpha = 0.25f)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(8.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    block.cells.forEach { cell ->
                        Text(
                            text = cell,
                            color = textColor,
                            fontSize = (fontSizeSp * 0.9f).sp,
                            lineHeight = (fontSizeSp * 0.9f * lineHeightMultiplier).sp,
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            }
        }

        DocBlock.PageBreak -> {
            HorizontalDivider(
                color = mutedColor.copy(alpha = 0.25f),
                modifier = Modifier.padding(vertical = 8.dp)
            )
        }
    }
}

@Composable
private fun NoticeCard(
    message: String,
    surfaceColor: Color,
    textColor: Color
) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = surfaceColor,
        border = BorderStroke(1.dp, textColor.copy(alpha = 0.25f)),
        modifier = Modifier.fillMaxWidth()
    ) {
        Text(
            text = message,
            color = textColor,
            fontSize = 13.sp,
            lineHeight = 19.sp,
            modifier = Modifier.padding(14.dp)
        )
    }
}

private fun paginateBlocksForPrint(blocks: List<DocBlock>): List<List<DocBlock>> {
    if (blocks.isEmpty()) return listOf(emptyList())
    val pages = mutableListOf<List<DocBlock>>()
    val current = mutableListOf<DocBlock>()
    var weight = 0

    for (block in blocks) {
        if (block is DocBlock.PageBreak) {
            if (current.isNotEmpty()) {
                pages.add(current.toList())
                current.clear()
                weight = 0
            }
            continue
        }
        val blockWeight = when (block) {
            is DocBlock.ImageBlock -> 6
            is DocBlock.TableRow -> 2
            is DocBlock.Heading -> 2
            is DocBlock.Paragraph -> (block.text.length / 110).coerceIn(1, 5)
            DocBlock.PageBreak -> 0
        }
        if (current.isNotEmpty() && weight + blockWeight > 18) {
            pages.add(current.toList())
            current.clear()
            weight = 0
        }
        current.add(block)
        weight += blockWeight
    }
    if (current.isNotEmpty()) {
        pages.add(current.toList())
    }
    return pages.ifEmpty { listOf(emptyList()) }
}

private fun DocTextAlignment.toComposeTextAlign(): TextAlign = when (this) {
    DocTextAlignment.START -> TextAlign.Start
    DocTextAlignment.CENTER -> TextAlign.Center
    DocTextAlignment.END -> TextAlign.End
    DocTextAlignment.JUSTIFY -> TextAlign.Justify
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DocSettingsBottomSheet(
    settings: ReaderTypographySettings,
    onTogglePrintLayout: (Boolean) -> Unit,
    onSelectTheme: (ReaderTheme) -> Unit,
    onFontSizeChange: (Float) -> Unit,
    onLineSpacingChange: (Float) -> Unit,
    onDismiss: () -> Unit
) {
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Text(
                text = "Reading Settings",
                style = MaterialTheme.typography.titleLarge
            )

            // Print Layout Switch (Slider Button)
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Print Layout",
                        style = MaterialTheme.typography.titleMedium
                    )
                    Text(
                        text = if (settings.isPrintLayout) {
                            "Showing A4 paper sheets in full vertical view"
                        } else {
                            "Showing mobile reflowable vertical view"
                        },
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Switch(
                    checked = settings.isPrintLayout,
                    onCheckedChange = onTogglePrintLayout
                )
            }

            if (!settings.isPrintLayout) {
                HorizontalDivider()

                Text(
                    text = "Theme",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    ReaderTheme.entries.forEach { theme ->
                        FilterChip(
                            selected = settings.theme == theme,
                            onClick = { onSelectTheme(theme) },
                            label = { Text(text = theme.label) }
                        )
                    }
                }

                HorizontalDivider()

                Column {
                    Text(
                        text = "Font Size (${settings.fontSizeSp.toInt()} sp)",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Slider(
                        value = settings.fontSizeSp,
                        onValueChange = onFontSizeChange,
                        valueRange = 13f..26f,
                        steps = 12
                    )
                }

                Column {
                    Text(
                        text = "Line Spacing (${String.format(Locale.US, "%.2fx", settings.lineHeightMultiplier)})",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Slider(
                        value = settings.lineHeightMultiplier,
                        onValueChange = onLineSpacingChange,
                        valueRange = 1.2f..2.0f,
                        steps = 7
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}
