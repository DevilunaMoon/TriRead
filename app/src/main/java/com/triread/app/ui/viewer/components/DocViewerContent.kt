package com.triread.app.ui.viewer.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
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
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.triread.app.data.parser.DocBlock
import com.triread.app.data.parser.DocHeaderFooter
import com.triread.app.data.parser.DocPageMetrics
import com.triread.app.data.parser.DocRun
import com.triread.app.data.parser.DocTextAlignment
import com.triread.app.data.parser.HeaderFooterElement
import com.triread.app.ui.viewer.ReaderTheme
import com.triread.app.ui.viewer.ReaderTypographySettings
import kotlinx.coroutines.flow.distinctUntilChanged
import java.io.File
import java.util.Locale

@Composable
fun DocViewerContent(
    blocks: List<DocBlock>,
    initialBlockIndex: Int,
    pageMetrics: DocPageMetrics,
    header: DocHeaderFooter?,
    footer: DocHeaderFooter?,
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
            pageMetrics = pageMetrics,
            header = header,
            footer = footer,
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
        verticalArrangement = Arrangement.spacedBy(10.dp)
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
            ReflowableDocBlock(
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
    pageMetrics: DocPageMetrics,
    header: DocHeaderFooter?,
    footer: DocHeaderFooter?,
    noticeMessage: String?,
    isImmersive: Boolean,
    onPrintPageChanged: (Int, Int) -> Unit,
    onToggleImmersive: () -> Unit,
    modifier: Modifier = Modifier
) {
    val pages = remember(blocks, pageMetrics, header, footer) {
        paginateBlocksForLiteralPrint(blocks, pageMetrics, header, footer)
    }
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
            .background(Color(0xFFD6DAE2))
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
                    val nextScale = (zoomScale * zoom).coerceIn(1f, 4f)
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
                start = 8.dp,
                end = 8.dp,
                top = if (isImmersive) 8.dp else 92.dp,
                bottom = if (isImmersive) 14.dp else 88.dp
            ),
            verticalArrangement = Arrangement.spacedBy(12.dp)
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
                LiteralPrintPageSheet(
                    pageIndex = pageIdx,
                    pageBlocks = pageBlocks,
                    pageMetrics = pageMetrics,
                    header = header,
                    footer = footer
                )
            }
        }
    }
}

@Composable
private fun LiteralPrintPageSheet(
    pageIndex: Int,
    pageBlocks: List<DocBlock>,
    pageMetrics: DocPageMetrics,
    header: DocHeaderFooter?,
    footer: DocHeaderFooter?
) {
    val context = LocalContext.current
    val fontScale = LocalDensity.current.fontScale.coerceAtLeast(0.5f)

    Surface(
        shape = RoundedCornerShape(2.dp),
        color = Color.White,
        shadowElevation = 4.dp,
        border = BorderStroke(0.5.dp, Color(0xFFCBD5E1)),
        modifier = Modifier
            .fillMaxWidth()
            .aspectRatio(pageMetrics.aspectRatio)
    ) {
        BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
            val ptScale = maxWidth.value / pageMetrics.widthPt.coerceAtLeast(300f)
            val usableWidthDp = ((pageMetrics.widthPt - pageMetrics.marginLeftPt - pageMetrics.marginRightPt) * ptScale)
                .coerceAtLeast(160f).dp
            val padLeft = (pageMetrics.marginLeftPt * ptScale).dp
            val padRight = (pageMetrics.marginRightPt * ptScale).dp
            val padTop = (pageMetrics.marginTopPt * ptScale).dp
            val padBottom = (pageMetrics.marginBottomPt * ptScale).dp

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(
                        start = padLeft,
                        end = padRight,
                        top = (padTop * 0.25f).coerceAtLeast(6.dp),
                        bottom = (padBottom * 0.28f).coerceAtLeast(6.dp)
                    )
            ) {
                // Header Section: layer anchored header images by z-order (relativeHeight) so front letterheads cover older logos
                if (header != null && header.isNotEmpty) {
                    val headerImages = header.elements.filterIsInstance<HeaderFooterElement.Image>()
                    val headerLines = header.elements.filterIsInstance<HeaderFooterElement.TextLine>()

                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = (6f * ptScale).dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy((2f * ptScale).dp)
                    ) {
                        if (headerImages.isNotEmpty()) {
                            val orderedImages = headerImages.sortedBy { it.relativeHeight }
                            Box(
                                modifier = Modifier.fillMaxWidth(),
                                contentAlignment = Alignment.Center
                            ) {
                                orderedImages.forEachIndexed { idx, elem ->
                                    val imgModifier = if (elem.widthPt != null && elem.heightPt != null) {
                                        val wDp = (elem.widthPt * ptScale).dp.coerceAtMost(usableWidthDp)
                                        val ratio = (elem.widthPt / elem.heightPt.coerceAtLeast(1f)).coerceIn(0.2f, 12f)
                                        Modifier
                                            .width(wDp)
                                            .aspectRatio(ratio)
                                    } else {
                                        Modifier
                                            .widthIn(max = usableWidthDp)
                                            .height((44f * ptScale).dp.coerceIn(22.dp, 56.dp))
                                    }
                                    // Top-most layered image gets a clean white backing to cover any older logo beneath it.
                                    val backingMod = if (orderedImages.size > 1 && idx == orderedImages.lastIndex) {
                                        Modifier.background(Color.White)
                                    } else {
                                        Modifier
                                    }
                                    AsyncImage(
                                        model = ImageRequest.Builder(context)
                                            .data(File(elem.imagePath))
                                            .crossfade(false)
                                            .build(),
                                        contentDescription = "Document header logo",
                                        contentScale = ContentScale.Fit,
                                        modifier = imgModifier.then(backingMod)
                                    )
                                }
                            }
                        }

                        val hdrSp = ((7.5f * ptScale) / fontScale).coerceIn(4.8f, 11f)
                        headerLines.forEach { elem ->
                            Text(
                                text = elem.text,
                                color = Color(0xFF1F2937),
                                fontSize = hdrSp.sp,
                                lineHeight = (hdrSp * 1.15f).sp,
                                fontWeight = FontWeight.SemiBold,
                                fontFamily = resolveDocFontFamily(elem.fontFamilyName),
                                textAlign = TextAlign.Center,
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                    }
                } else {
                    Spacer(modifier = Modifier.height((padTop * 0.6f).coerceAtLeast(6.dp)))
                }

                // Body Section
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth()
                ) {
                    pageBlocks.forEach { block ->
                        when (block) {
                            is DocBlock.Heading -> {
                                val defaultPt = when (block.level) {
                                    1 -> 14f
                                    2 -> 12f
                                    else -> 11f
                                }
                                val annotated = buildRunsAnnotatedString(
                                    runs = block.runs,
                                    defaultFontSizePt = defaultPt,
                                    forceBold = true,
                                    defaultColor = Color(0xFF111827),
                                    ptScale = ptScale,
                                    fontScale = fontScale
                                )
                                val lineSp = ((defaultPt * 1.2f * ptScale) / fontScale).coerceIn(6f, 24f)
                                Text(
                                    text = annotated,
                                    lineHeight = lineSp.sp,
                                    textAlign = block.alignment.toComposeTextAlign(),
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(
                                            top = (block.spaceBeforePt * ptScale).dp,
                                            bottom = (block.spaceAfterPt * ptScale).dp
                                        )
                                )
                            }

                            is DocBlock.Paragraph -> {
                                val defaultPt = 10.5f
                                val fullPlain = block.plainText
                                if (!block.isBullet && fullPlain.contains("\t")) {
                                    val (leftRuns, rightRuns) = splitRunsAtFirstTab(block.runs)
                                    if (leftRuns.isNotEmpty() && rightRuns.isNotEmpty()) {
                                        val lineSp = ((defaultPt * 1.18f * ptScale) / fontScale).coerceIn(5.5f, 20f)
                                        Row(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .padding(
                                                    top = (block.spaceBeforePt * ptScale).dp,
                                                    bottom = (block.spaceAfterPt * ptScale).dp
                                                ),
                                            horizontalArrangement = Arrangement.SpaceBetween
                                        ) {
                                            Text(
                                                text = buildRunsAnnotatedString(
                                                    runs = leftRuns,
                                                    defaultFontSizePt = defaultPt,
                                                    forceBold = false,
                                                    defaultColor = Color(0xFF111827),
                                                    ptScale = ptScale,
                                                    fontScale = fontScale
                                                ),
                                                lineHeight = lineSp.sp
                                            )
                                            Text(
                                                text = buildRunsAnnotatedString(
                                                    runs = rightRuns,
                                                    defaultFontSizePt = defaultPt,
                                                    forceBold = false,
                                                    defaultColor = Color(0xFF111827),
                                                    ptScale = ptScale,
                                                    fontScale = fontScale
                                                ),
                                                lineHeight = lineSp.sp
                                            )
                                        }
                                    } else {
                                        PrintParagraphText(block, defaultPt, ptScale, fontScale)
                                    }
                                } else {
                                    PrintParagraphText(block, defaultPt, ptScale, fontScale)
                                }
                            }

                            is DocBlock.ImageBlock -> {
                                val imgModifier = if (block.widthPt != null && block.heightPt != null) {
                                    val wDp = (block.widthPt * ptScale).dp.coerceAtMost(usableWidthDp)
                                    val ratio = (block.widthPt / block.heightPt.coerceAtLeast(1f)).coerceIn(0.2f, 8f)
                                    Modifier
                                        .width(wDp)
                                        .aspectRatio(ratio)
                                } else {
                                    Modifier
                                        .fillMaxWidth()
                                        .heightIn(max = (150f * ptScale).dp.coerceAtLeast(56.dp))
                                }
                                AsyncImage(
                                    model = ImageRequest.Builder(context)
                                        .data(File(block.imagePath))
                                        .crossfade(false)
                                        .build(),
                                    contentDescription = "Document image",
                                    contentScale = ContentScale.Fit,
                                    modifier = imgModifier.padding(vertical = (3f * ptScale).dp)
                                )
                            }

                            is DocBlock.TableRow -> {
                                val cellSp = ((9.5f * ptScale) / fontScale).coerceIn(5f, 13f)
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .background(Color(0xFFF8FAFC))
                                        .padding((2.5f * ptScale).dp),
                                    horizontalArrangement = Arrangement.spacedBy((4f * ptScale).dp)
                                ) {
                                    block.cells.forEach { cell ->
                                        Text(
                                            text = cell,
                                            color = Color(0xFF111827),
                                            fontSize = cellSp.sp,
                                            lineHeight = (cellSp * 1.15f).sp,
                                            modifier = Modifier.weight(1f)
                                        )
                                    }
                                }
                                HorizontalDivider(color = Color(0xFFCBD5E1), thickness = 0.5.dp)
                            }

                            is DocBlock.Spacer -> {
                                Spacer(modifier = Modifier.height((block.heightPt * ptScale).dp))
                            }

                            DocBlock.PageBreak -> Unit
                        }
                    }
                }

                // Footer Section (text lines + right-aligned footer logo like SOCOTEC)
                if (footer != null && footer.isNotEmpty) {
                    val footerLines = footer.elements.filterIsInstance<HeaderFooterElement.TextLine>()
                    val footerImages = footer.elements.filterIsInstance<HeaderFooterElement.Image>()
                    val ftrSp = ((7f * ptScale) / fontScale).coerceIn(4.5f, 10f)

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = (4f * ptScale).dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            footerLines.forEach { line ->
                                Text(
                                    text = line.text,
                                    color = Color(0xFF475569),
                                    fontSize = ftrSp.sp,
                                    lineHeight = (ftrSp * 1.18f).sp,
                                    fontFamily = resolveDocFontFamily(line.fontFamilyName),
                                    textAlign = TextAlign.Center,
                                    modifier = Modifier.fillMaxWidth()
                                )
                            }
                        }
                        if (footerImages.isNotEmpty()) {
                            Row(horizontalArrangement = Arrangement.spacedBy((4f * ptScale).dp)) {
                                footerImages.forEach { img ->
                                    val hDp = ((img.heightPt ?: 30f) * ptScale).dp.coerceIn(16.dp, 40.dp)
                                    AsyncImage(
                                        model = ImageRequest.Builder(context)
                                            .data(File(img.imagePath))
                                            .crossfade(false)
                                            .build(),
                                        contentDescription = "Document footer logo",
                                        contentScale = ContentScale.Fit,
                                        modifier = Modifier.height(hDp)
                                    )
                                }
                            }
                        }
                    }
                } else {
                    val numSp = ((8.5f * ptScale) / fontScale).coerceIn(5f, 11f)
                    Text(
                        text = "${pageIndex + 1}",
                        color = Color(0xFF94A3B8),
                        fontSize = numSp.sp,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        }
    }
}

@Composable
private fun PrintParagraphText(
    block: DocBlock.Paragraph,
    defaultPt: Float,
    ptScale: Float,
    fontScale: Float
) {
    val maxRunPt = block.runs.maxOfOrNull { it.fontSizePt ?: defaultPt } ?: defaultPt
    val lineSp = ((maxRunPt * 1.18f * ptScale) / fontScale).coerceIn(5.5f, 22f)
    val annotated = buildRunsAnnotatedString(
        runs = block.runs,
        defaultFontSizePt = defaultPt,
        forceBold = false,
        defaultColor = Color(0xFF111827),
        ptScale = ptScale,
        fontScale = fontScale
    )

    if (block.isBullet) {
        val bulletSp = ((defaultPt * ptScale) / fontScale).coerceIn(5f, 18f)
        val baseIndent = (block.indentLeftPt.coerceAtLeast(14f) * ptScale).dp
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(
                    start = baseIndent,
                    top = (block.spaceBeforePt * ptScale).dp,
                    bottom = (block.spaceAfterPt * ptScale).dp
                ),
            verticalAlignment = Alignment.Top
        ) {
            Text(
                text = "•",
                color = Color(0xFF111827),
                fontSize = bulletSp.sp,
                lineHeight = lineSp.sp,
                modifier = Modifier.width((12f * ptScale).dp.coerceAtLeast(8.dp))
            )
            Text(
                text = annotated,
                lineHeight = lineSp.sp,
                textAlign = block.alignment.toComposeTextAlign(),
                modifier = Modifier.weight(1f)
            )
        }
    } else {
        Text(
            text = annotated,
            lineHeight = lineSp.sp,
            textAlign = block.alignment.toComposeTextAlign(),
            modifier = Modifier
                .fillMaxWidth()
                .padding(
                    start = (block.indentLeftPt * ptScale).dp,
                    top = (block.spaceBeforePt * ptScale).dp,
                    bottom = (block.spaceAfterPt * ptScale).dp
                )
        )
    }
}

@Composable
private fun ReflowableDocBlock(
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
            val size = (fontSizeSp * headingScale)
            val annotated = buildReflowableAnnotatedString(
                runs = block.runs,
                defaultColor = textColor,
                forceBold = true
            )
            Text(
                text = annotated,
                fontSize = size.sp,
                lineHeight = (size * 1.25f).sp,
                textAlign = block.alignment.toComposeTextAlign(),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 6.dp, bottom = 2.dp)
            )
        }

        is DocBlock.Paragraph -> {
            val annotated = buildReflowableAnnotatedString(
                runs = block.runs,
                defaultColor = textColor,
                forceBold = false
            )
            if (block.isBullet) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(start = 10.dp),
                    verticalAlignment = Alignment.Top
                ) {
                    Text(
                        text = "•",
                        color = textColor,
                        fontSize = fontSizeSp.sp,
                        lineHeight = (fontSizeSp * lineHeightMultiplier).sp,
                        modifier = Modifier.width(16.dp)
                    )
                    Text(
                        text = annotated,
                        fontSize = fontSizeSp.sp,
                        lineHeight = (fontSizeSp * lineHeightMultiplier).sp,
                        textAlign = block.alignment.toComposeTextAlign(),
                        modifier = Modifier.weight(1f)
                    )
                }
            } else {
                Text(
                    text = annotated,
                    fontSize = fontSizeSp.sp,
                    lineHeight = (fontSizeSp * lineHeightMultiplier).sp,
                    textAlign = block.alignment.toComposeTextAlign(),
                    modifier = Modifier.fillMaxWidth()
                )
            }
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

        is DocBlock.Spacer -> {
            Spacer(modifier = Modifier.height(6.dp))
        }

        DocBlock.PageBreak -> {
            HorizontalDivider(
                color = mutedColor.copy(alpha = 0.25f),
                modifier = Modifier.padding(vertical = 8.dp)
            )
        }
    }
}

private fun splitRunsAtFirstTab(runs: List<DocRun>): Pair<List<DocRun>, List<DocRun>> {
    val left = mutableListOf<DocRun>()
    val right = mutableListOf<DocRun>()
    var foundTab = false

    for (run in runs) {
        if (foundTab) {
            right.add(run.copy(text = run.text.replace("\t", " ")))
        } else {
            val idx = run.text.indexOf('\t')
            if (idx >= 0) {
                foundTab = true
                val before = run.text.substring(0, idx).trimEnd()
                val after = run.text.substring(idx + 1).replace("\t", " ").trimStart()
                if (before.isNotEmpty()) left.add(run.copy(text = before))
                if (after.isNotEmpty()) right.add(run.copy(text = after))
            } else {
                left.add(run)
            }
        }
    }
    return left to right
}

private fun buildRunsAnnotatedString(
    runs: List<DocRun>,
    defaultFontSizePt: Float,
    forceBold: Boolean,
    defaultColor: Color,
    ptScale: Float,
    fontScale: Float
): AnnotatedString = buildAnnotatedString {
    runs.forEach { run ->
        val pt = run.fontSizePt ?: defaultFontSizePt
        val sp = ((pt * ptScale) / fontScale).coerceIn(5f, 26f)
        withStyle(
            SpanStyle(
                color = run.colorArgb?.let { Color(it) } ?: defaultColor,
                fontSize = sp.sp,
                fontFamily = resolveDocFontFamily(run.fontFamilyName),
                fontWeight = if (forceBold || run.isBold) FontWeight.Bold else FontWeight.Normal,
                fontStyle = if (run.isItalic) FontStyle.Italic else FontStyle.Normal,
                textDecoration = if (run.isUnderline) TextDecoration.Underline else TextDecoration.None
            )
        ) {
            append(run.text.replace("\t", "    "))
        }
    }
}

private fun buildReflowableAnnotatedString(
    runs: List<DocRun>,
    defaultColor: Color,
    forceBold: Boolean
): AnnotatedString = buildAnnotatedString {
    runs.forEach { run ->
        withStyle(
            SpanStyle(
                color = defaultColor,
                fontFamily = resolveDocFontFamily(run.fontFamilyName),
                fontWeight = if (forceBold || run.isBold) FontWeight.Bold else FontWeight.Normal,
                fontStyle = if (run.isItalic) FontStyle.Italic else FontStyle.Normal,
                textDecoration = if (run.isUnderline) TextDecoration.Underline else TextDecoration.None
            )
        ) {
            append(run.text.replace("\t", "    "))
        }
    }
}

private fun resolveDocFontFamily(fontName: String?): FontFamily {
    if (fontName.isNullOrBlank()) return FontFamily.SansSerif
    val lower = fontName.lowercase(Locale.ROOT)
    return when {
        lower.contains("courier") ||
            lower.contains("consolas") ||
            lower.contains("mono") ||
            lower.contains("menlo") ||
            lower.contains("monaco") ||
            lower.contains("fira code") ||
            lower.contains("jetbrains") -> FontFamily.Monospace

        lower.contains("times") ||
            lower.contains("georgia") ||
            lower.contains("cambria") ||
            lower.contains("garamond") ||
            lower.contains("palatino") ||
            lower.contains("book antiqua") ||
            lower.contains("century") ||
            lower.contains("baskerville") ||
            (lower.contains("serif") && !lower.contains("sans")) -> FontFamily.Serif

        lower.contains("brush") ||
            lower.contains("comic") ||
            lower.contains("pacifico") ||
            lower.contains("script") ||
            lower.contains("cursive") -> FontFamily.Cursive

        else -> FontFamily.SansSerif
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

private fun paginateBlocksForLiteralPrint(
    blocks: List<DocBlock>,
    metrics: DocPageMetrics,
    header: DocHeaderFooter?,
    footer: DocHeaderFooter?
): List<List<DocBlock>> {
    if (blocks.isEmpty()) return listOf(emptyList())
    val headerReservePt = if (header != null && header.isNotEmpty) 82f else metrics.marginTopPt * 0.6f
    val footerReservePt = if (footer != null && footer.isNotEmpty) 46f else metrics.marginBottomPt * 0.6f
    val usableHeightPt = (metrics.heightPt - headerReservePt - footerReservePt).coerceAtLeast(420f)
    val usableWidthPt = (metrics.widthPt - metrics.marginLeftPt - metrics.marginRightPt).coerceAtLeast(260f)
    val charsPerLine = (usableWidthPt / 4.7f).coerceAtLeast(52f)

    val pages = mutableListOf<List<DocBlock>>()
    val current = mutableListOf<DocBlock>()
    var usedPt = 0f

    for (block in blocks) {
        if (block is DocBlock.PageBreak) {
            if (current.isNotEmpty()) {
                pages.add(current.toList())
                current.clear()
                usedPt = 0f
            }
            continue
        }
        val estimatedPt = when (block) {
            is DocBlock.Heading -> {
                val lines = ((block.plainText.length / (charsPerLine * 0.8f)).toInt() + 1).coerceAtLeast(1)
                block.spaceBeforePt + block.spaceAfterPt + lines * 15.5f
            }
            is DocBlock.Paragraph -> {
                val effectiveChars = (charsPerLine - if (block.isBullet) 5f else 0f).coerceAtLeast(40f)
                val lines = ((block.plainText.length / effectiveChars).toInt() + 1).coerceAtLeast(1)
                block.spaceBeforePt + block.spaceAfterPt + lines * 12f
            }
            is DocBlock.ImageBlock -> (block.heightPt ?: 140f).coerceAtMost(220f)
            is DocBlock.TableRow -> 22f
            is DocBlock.Spacer -> block.heightPt
            DocBlock.PageBreak -> 0f
        }
        if (current.isNotEmpty() && usedPt + estimatedPt > usableHeightPt) {
            pages.add(current.toList())
            current.clear()
            usedPt = 0f
        }
        current.add(block)
        usedPt += estimatedPt
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
                            "Showing original document page layout"
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
