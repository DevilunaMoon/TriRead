package com.devilunamoon.triread.ui.viewer

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.OpenInNew
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.DarkMode
import androidx.compose.material.icons.filled.LightMode
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.devilunamoon.triread.data.ParsedPptResult
import com.devilunamoon.triread.data.PptxParser
import com.devilunamoon.triread.data.SlideContent
import com.devilunamoon.triread.model.DocumentItem
import com.devilunamoon.triread.ui.theme.PptBadgeColor
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PptViewerScreen(
    document: DocumentItem,
    onBack: () -> Unit,
    onOpenExternally: () -> Unit
) {
    var result by remember { mutableStateOf<ParsedPptResult?>(null) }
    var darkSlideMode by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(document.file.absolutePath) {
        result = PptxParser.parse(document.file)
    }

    val slides = result?.slides.orEmpty()
    val pagerState = rememberPagerState(pageCount = { slides.size.coerceAtLeast(1) })

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = document.name,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        if (slides.isNotEmpty()) {
                            Text(
                                text = "Slide ${pagerState.currentPage + 1} of ${slides.size}",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { darkSlideMode = !darkSlideMode }) {
                        Icon(
                            imageVector = if (darkSlideMode) Icons.Default.LightMode else Icons.Default.DarkMode,
                            contentDescription = "Toggle dark slide mode"
                        )
                    }
                    IconButton(onClick = onOpenExternally) {
                        Icon(Icons.AutoMirrored.Filled.OpenInNew, contentDescription = "Open externally")
                    }
                }
            )
        },
        bottomBar = {
            if (slides.size > 1) {
                Surface(tonalElevation = 3.dp) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 8.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconButton(
                            onClick = {
                                scope.launch {
                                    val target = (pagerState.currentPage - 1).coerceAtLeast(0)
                                    pagerState.animateScrollToPage(target)
                                }
                            },
                            enabled = pagerState.currentPage > 0
                        ) {
                            Icon(Icons.Default.ChevronLeft, contentDescription = "Previous slide")
                        }

                        Text(
                            text = "Slide ${pagerState.currentPage + 1} / ${slides.size}",
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = FontWeight.SemiBold
                        )

                        IconButton(
                            onClick = {
                                scope.launch {
                                    val target = (pagerState.currentPage + 1).coerceAtMost(slides.lastIndex)
                                    pagerState.animateScrollToPage(target)
                                }
                            },
                            enabled = pagerState.currentPage < slides.lastIndex
                        ) {
                            Icon(Icons.Default.ChevronRight, contentDescription = "Next slide")
                        }
                    }
                }
            }
        }
    ) { innerPadding ->
        val backdropColor = if (darkSlideMode) Color(0xFF0F172A) else Color(0xFFE2E8F0)

        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(backdropColor)
        ) {
            val parsed = result
            when {
                parsed == null -> {
                    CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                }
                slides.isEmpty() -> {
                    Column(
                        modifier = Modifier
                            .align(Alignment.Center)
                            .padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = parsed.warningMessage ?: "No slides available.",
                            textAlign = TextAlign.Center,
                            color = if (darkSlideMode) Color.White else Color(0xFF1E293B)
                        )
                    }
                }
                else -> {
                    HorizontalPager(
                        state = pagerState,
                        modifier = Modifier.fillMaxSize()
                    ) { index ->
                        SlideCard(
                            slide = slides[index],
                            darkMode = darkSlideMode
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun SlideCard(
    slide: SlideContent,
    darkMode: Boolean
) {
    val cardBg = if (darkMode) Color(0xFF1E293B) else Color.White
    val primaryText = if (darkMode) Color(0xFFF8FAFC) else Color(0xFF0F172A)
    val secondaryText = if (darkMode) Color(0xFFCBD5E1) else Color(0xFF334155)

    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        contentAlignment = Alignment.Center
    ) {
        Card(
            modifier = Modifier.fillMaxSize(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = cardBg),
            elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Slide header badge
                Surface(
                    color = PptBadgeColor.copy(alpha = 0.14f),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(
                        text = "SLIDE ${slide.slideNumber}",
                        color = PptBadgeColor,
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                    )
                }

                if (!slide.title.isNullOrBlank()) {
                    Text(
                        text = slide.title,
                        color = primaryText,
                        fontSize = 22.sp,
                        lineHeight = 28.sp,
                        fontWeight = FontWeight.Bold
                    )
                    HorizontalDivider(color = secondaryText.copy(alpha = 0.2f))
                }

                slide.paragraphs.forEach { paragraph ->
                    Text(
                        text = "•  $paragraph",
                        color = secondaryText,
                        fontSize = 16.sp,
                        lineHeight = 23.sp
                    )
                }

                slide.images.forEach { bmp ->
                    val ratio = bmp.width.toFloat() / bmp.height.toFloat().coerceAtLeast(1f)
                    Image(
                        bitmap = bmp.asImageBitmap(),
                        contentDescription = "Slide ${slide.slideNumber} image",
                        modifier = Modifier
                            .fillMaxWidth()
                            .aspectRatio(ratio)
                            .clip(RoundedCornerShape(10.dp)),
                        contentScale = ContentScale.Fit
                    )
                }

                if (slide.title.isNullOrBlank() && slide.paragraphs.isEmpty() && slide.images.isEmpty()) {
                    Spacer(modifier = Modifier.height(32.dp))
                    Text(
                        text = "(Empty or graphic-only slide)",
                        color = secondaryText,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        }
    }
}
