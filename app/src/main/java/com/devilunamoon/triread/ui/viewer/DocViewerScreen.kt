package com.devilunamoon.triread.ui.viewer

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.OpenInNew
import androidx.compose.material.icons.filled.TextDecrease
import androidx.compose.material.icons.filled.TextIncrease
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.devilunamoon.triread.data.DocBlock
import com.devilunamoon.triread.data.DocxParser
import com.devilunamoon.triread.data.ParsedDocResult
import com.devilunamoon.triread.model.DocumentItem
import com.devilunamoon.triread.model.ReaderTheme

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DocViewerScreen(
    document: DocumentItem,
    onBack: () -> Unit,
    onOpenExternally: () -> Unit
) {
    var result by remember { mutableStateOf<ParsedDocResult?>(null) }
    var readerTheme by remember { mutableStateOf(ReaderTheme.LIGHT) }
    var fontSizeSp by remember { mutableFloatStateOf(16f) }

    LaunchedEffect(document.file.absolutePath) {
        result = DocxParser.parse(document.file)
    }

    val bgColor = when (readerTheme) {
        ReaderTheme.LIGHT -> Color(0xFFFFFFFF)
        ReaderTheme.SEPIA -> Color(0xFFF6EEDB)
        ReaderTheme.DARK -> Color(0xFF121212)
    }
    val textColor = when (readerTheme) {
        ReaderTheme.LIGHT -> Color(0xFF1E293B)
        ReaderTheme.SEPIA -> Color(0xFF3E2F1C)
        ReaderTheme.DARK -> Color(0xFFE2E8F0)
    }
    val borderColor = when (readerTheme) {
        ReaderTheme.LIGHT -> Color(0xFFCBD5E1)
        ReaderTheme.SEPIA -> Color(0xFFD4C4A1)
        ReaderTheme.DARK -> Color(0xFF334155)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = document.name,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { fontSizeSp = (fontSizeSp - 2f).coerceAtLeast(12f) }) {
                        Icon(Icons.Default.TextDecrease, contentDescription = "Decrease font size")
                    }
                    IconButton(onClick = { fontSizeSp = (fontSizeSp + 2f).coerceAtMost(28f) }) {
                        Icon(Icons.Default.TextIncrease, contentDescription = "Increase font size")
                    }
                    IconButton(onClick = onOpenExternally) {
                        Icon(Icons.AutoMirrored.Filled.OpenInNew, contentDescription = "Open externally")
                    }
                }
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(bgColor)
        ) {
            // ReadEra-style theme switcher bar
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                ReaderTheme.entries.forEach { theme ->
                    FilterChip(
                        selected = readerTheme == theme,
                        onClick = { readerTheme = theme },
                        label = { Text(theme.label) }
                    )
                }
            }

            HorizontalDivider(color = borderColor)

            val parsed = result
            if (parsed == null) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(horizontal = 20.dp, vertical = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    if (!parsed.warningMessage.isNullOrBlank()) {
                        item {
                            Surface(
                                color = MaterialTheme.colorScheme.secondaryContainer,
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text(
                                    text = parsed.warningMessage,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSecondaryContainer,
                                    modifier = Modifier.padding(12.dp)
                                )
                            }
                        }
                    }

                    if (parsed.blocks.isEmpty()) {
                        item {
                            Text(
                                text = "No readable text found in this document.",
                                color = textColor
                            )
                        }
                    }

                    items(parsed.blocks) { block ->
                        when (block) {
                            is DocBlock.Paragraph -> {
                                val size = when (block.headingLevel) {
                                    1 -> (fontSizeSp + 8f).sp
                                    2 -> (fontSizeSp + 5f).sp
                                    3 -> (fontSizeSp + 2f).sp
                                    else -> fontSizeSp.sp
                                }
                                val weight = if (block.headingLevel > 0 || block.isBold) {
                                    FontWeight.Bold
                                } else {
                                    FontWeight.Normal
                                }
                                val displayText = if (block.isBullet) "•  ${block.text}" else block.text
                                Text(
                                    text = displayText,
                                    color = textColor,
                                    fontSize = size,
                                    lineHeight = (size.value * 1.45f).sp,
                                    fontWeight = weight
                                )
                            }

                            is DocBlock.Table -> {
                                Column(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .horizontalScroll(rememberScrollState())
                                        .border(1.dp, borderColor, RoundedCornerShape(6.dp))
                                ) {
                                    block.rows.forEachIndexed { rowIndex, row ->
                                        Row {
                                            row.forEach { cell ->
                                                Box(
                                                    modifier = Modifier
                                                        .widthIn(min = 100.dp, max = 220.dp)
                                                        .border(0.5.dp, borderColor)
                                                        .padding(8.dp)
                                                ) {
                                                    Text(
                                                        text = cell,
                                                        color = textColor,
                                                        fontSize = (fontSizeSp - 1f).sp,
                                                        fontWeight = if (rowIndex == 0) FontWeight.SemiBold else FontWeight.Normal
                                                    )
                                                }
                                            }
                                        }
                                    }
                                }
                            }

                            is DocBlock.Image -> {
                                val ratio = block.bitmap.width.toFloat() /
                                    block.bitmap.height.toFloat().coerceAtLeast(1f)
                                Image(
                                    bitmap = block.bitmap.asImageBitmap(),
                                    contentDescription = "Document image",
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .aspectRatio(ratio)
                                        .clip(RoundedCornerShape(8.dp)),
                                    contentScale = ContentScale.Fit
                                )
                            }
                        }
                    }

                    item { Spacer(modifier = Modifier.height(32.dp)) }
                }
            }
        }
    }
}
