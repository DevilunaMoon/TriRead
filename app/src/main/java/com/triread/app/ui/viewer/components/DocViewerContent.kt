package com.triread.app.ui.viewer.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
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
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.triread.app.data.parser.DocBlock
import com.triread.app.ui.viewer.ReaderTheme
import com.triread.app.ui.viewer.ReaderTypographySettings
import kotlinx.coroutines.flow.distinctUntilChanged

@Composable
fun DocViewerContent(
    blocks: List<DocBlock>,
    initialBlockIndex: Int,
    noticeMessage: String?,
    settings: ReaderTypographySettings,
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
            .collect { index ->
                onVisibleBlockChanged(index)
            }
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
            top = 72.dp,
            bottom = 72.dp
        ),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        if (!noticeMessage.isNullOrBlank()) {
            item(key = "doc_notice") {
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = theme.surfaceColor,
                    border = BorderStroke(1.dp, theme.secondaryTextColor.copy(alpha = 0.25f)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = noticeMessage,
                        color = theme.secondaryTextColor,
                        fontSize = 13.sp,
                        lineHeight = 19.sp,
                        modifier = Modifier.padding(14.dp)
                    )
                }
            }
        }

        itemsIndexed(
            items = blocks,
            key = { index, _ -> index }
        ) { _, block ->
            when (block) {
                is DocBlock.Heading -> {
                    val headingScale = when (block.level) {
                        1 -> 1.45f
                        2 -> 1.25f
                        else -> 1.12f
                    }
                    val fontSize = (settings.fontSizeSp * headingScale).sp
                    Text(
                        text = block.text,
                        color = theme.textColor,
                        fontSize = fontSize,
                        lineHeight = fontSize * 1.25f,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(top = 8.dp, bottom = 2.dp)
                    )
                }

                is DocBlock.Paragraph -> {
                    val prefix = if (block.isBullet) "•  " else ""
                    Text(
                        text = "$prefix${block.text}",
                        color = theme.textColor,
                        fontSize = settings.fontSizeSp.sp,
                        lineHeight = (settings.fontSizeSp * settings.lineHeightMultiplier).sp,
                        fontWeight = if (block.isBold) FontWeight.SemiBold else FontWeight.Normal,
                        modifier = Modifier.padding(start = if (block.isBullet) 10.dp else 0.dp)
                    )
                }

                is DocBlock.TableRow -> {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = theme.surfaceColor),
                        shape = RoundedCornerShape(8.dp),
                        border = BorderStroke(1.dp, theme.secondaryTextColor.copy(alpha = 0.2f)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(10.dp),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            block.cells.forEach { cell ->
                                Text(
                                    text = cell,
                                    color = theme.textColor,
                                    fontSize = (settings.fontSizeSp * 0.9f).sp,
                                    lineHeight = (settings.fontSizeSp * 0.9f * settings.lineHeightMultiplier).sp,
                                    modifier = Modifier.weight(1f)
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DocSettingsBottomSheet(
    settings: ReaderTypographySettings,
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
                    text = "Line Spacing (${String.format("%.2fx", settings.lineHeightMultiplier)})",
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

            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}

