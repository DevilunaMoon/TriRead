package com.triread.app.ui.dashboard.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Description
import androidx.compose.material.icons.rounded.PictureAsPdf
import androidx.compose.material.icons.rounded.Slideshow
import androidx.compose.material.icons.rounded.Star
import androidx.compose.material.icons.rounded.StarOutline
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.triread.app.domain.model.DocumentCategory
import com.triread.app.domain.model.DocumentItem
import com.triread.app.ui.theme.DocBadgeBlue
import com.triread.app.ui.theme.FavoriteGold
import com.triread.app.ui.theme.PdfBadgeRed
import com.triread.app.ui.theme.PptBadgeOrange
import com.triread.app.util.FileFormatUtils
import java.io.File

@Composable
fun DocumentCard(
    document: DocumentItem,
    onClick: () -> Unit,
    onToggleFavorite: () -> Unit,
    onRequestThumbnail: (DocumentItem) -> Unit,
    modifier: Modifier = Modifier
) {
    LaunchedEffect(document.uriString, document.thumbnailPath) {
        if (document.thumbnailPath.isNullOrBlank()) {
            onRequestThumbnail(document)
        }
    }

    Card(
        modifier = modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            DocumentThumbnail(
                thumbnailPath = document.thumbnailPath,
                category = document.category,
                width = 60.dp,
                height = 84.dp
            )

            Spacer(modifier = Modifier.width(12.dp))

            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(
                    text = document.title,
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )

                val sizeText = FileFormatUtils.formatFileSize(document.fileSize)
                val dateText = FileFormatUtils.formatModifiedDate(document.lastModified)
                val metadata = if (dateText.isNotEmpty()) "$sizeText · $dateText" else sizeText
                Text(
                    text = metadata,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )

                Spacer(modifier = Modifier.height(2.dp))

                val progressText = when {
                    document.totalPages > 0 -> {
                        val displayPage = (document.currentPage + 1).coerceIn(1, document.totalPages)
                        "Page $displayPage of ${document.totalPages}"
                    }
                    document.isUnread -> "Unread"
                    else -> "Opened"
                }

                Text(
                    text = progressText,
                    style = MaterialTheme.typography.labelMedium,
                    color = if (document.isUnread) {
                        MaterialTheme.colorScheme.primary
                    } else {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    }
                )

                if (document.totalPages > 0 && !document.isUnread) {
                    LinearProgressIndicator(
                        progress = { document.progressFraction },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(4.dp)
                            .clip(RoundedCornerShape(2.dp)),
                        color = categoryBadgeColor(document.category),
                        trackColor = MaterialTheme.colorScheme.surfaceVariant
                    )
                }
            }

            IconButton(onClick = onToggleFavorite) {
                Icon(
                    imageVector = if (document.isFavorite) {
                        Icons.Rounded.Star
                    } else {
                        Icons.Rounded.StarOutline
                    },
                    contentDescription = if (document.isFavorite) {
                        "Remove from favorites"
                    } else {
                        "Add to favorites"
                    },
                    tint = if (document.isFavorite) {
                        FavoriteGold
                    } else {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    }
                )
            }
        }
    }
}

@Composable
fun DocumentThumbnail(
    thumbnailPath: String?,
    category: DocumentCategory,
    width: Dp,
    height: Dp,
    modifier: Modifier = Modifier
) {
    val badgeColor = categoryBadgeColor(category)
    val context = LocalContext.current

    Box(
        modifier = modifier
            .size(width = width, height = height)
            .clip(RoundedCornerShape(8.dp))
            .background(badgeColor.copy(alpha = 0.12f)),
        contentAlignment = Alignment.Center
    ) {
        if (!thumbnailPath.isNullOrBlank()) {
            AsyncImage(
                model = ImageRequest.Builder(context)
                    .data(File(thumbnailPath))
                    .crossfade(true)
                    .build(),
                contentDescription = "${category.displayName} thumbnail",
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize()
            )
        } else {
            Icon(
                imageVector = categoryPlaceholderIcon(category),
                contentDescription = null,
                tint = badgeColor.copy(alpha = 0.75f),
                modifier = Modifier.size(28.dp)
            )
        }

        Box(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .padding(4.dp)
                .clip(RoundedCornerShape(4.dp))
                .background(badgeColor)
                .padding(horizontal = 5.dp, vertical = 2.dp)
        ) {
            Text(
                text = category.badgeLabel,
                style = MaterialTheme.typography.labelSmall,
                color = Color.White
            )
        }
    }
}

fun categoryBadgeColor(category: DocumentCategory): Color = when (category) {
    DocumentCategory.PDF -> PdfBadgeRed
    DocumentCategory.DOC -> DocBadgeBlue
    DocumentCategory.PPT -> PptBadgeOrange
}

private fun categoryPlaceholderIcon(category: DocumentCategory): ImageVector = when (category) {
    DocumentCategory.PDF -> Icons.Rounded.PictureAsPdf
    DocumentCategory.DOC -> Icons.Rounded.Description
    DocumentCategory.PPT -> Icons.Rounded.Slideshow
}

