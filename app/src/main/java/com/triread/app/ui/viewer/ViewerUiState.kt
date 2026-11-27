package com.triread.app.ui.viewer

import android.graphics.Bitmap
import androidx.compose.ui.graphics.Color
import com.triread.app.data.parser.DocBlock
import com.triread.app.data.parser.SlideItem
import com.triread.app.domain.model.DocumentItem

enum class ReaderTheme(
    val label: String,
    val backgroundColor: Color,
    val surfaceColor: Color,
    val textColor: Color,
    val secondaryTextColor: Color
) {
    DAY(
        label = "Day",
        backgroundColor = Color(0xFFFAFAFA),
        surfaceColor = Color(0xFFFFFFFF),
        textColor = Color(0xFF1A1D21),
        secondaryTextColor = Color(0xFF5C6470)
    ),
    SEPIA(
        label = "Sepia",
        backgroundColor = Color(0xFFF4ECD8),
        surfaceColor = Color(0xFFEBE0C5),
        textColor = Color(0xFF3E2F1C),
        secondaryTextColor = Color(0xFF6B5740)
    ),
    NIGHT(
        label = "Night",
        backgroundColor = Color(0xFF121519),
        surfaceColor = Color(0xFF1C2128),
        textColor = Color(0xFFE2E6EC),
        secondaryTextColor = Color(0xFF949EA9)
    )
}

data class ReaderTypographySettings(
    val fontSizeSp: Float = 17f,
    val lineHeightMultiplier: Float = 1.55f,
    val theme: ReaderTheme = ReaderTheme.DAY
)

sealed interface ViewerContentState {
    data object Loading : ViewerContentState

    data class PdfReady(
        val totalPages: Int,
        val initialPage: Int,
        val renderedPages: Map<Int, Bitmap>
    ) : ViewerContentState

    data class DocReady(
        val blocks: List<DocBlock>,
        val initialBlockIndex: Int,
        val noticeMessage: String? = null
    ) : ViewerContentState

    data class PptReady(
        val slides: List<SlideItem>,
        val initialSlide: Int,
        val noticeMessage: String? = null
    ) : ViewerContentState

    data class Error(
        val title: String,
        val message: String
    ) : ViewerContentState
}

data class ViewerUiState(
    val document: DocumentItem? = null,
    val contentState: ViewerContentState = ViewerContentState.Loading,
    val currentPage: Int = 0,
    val totalPages: Int = 0,
    val isImmersive: Boolean = false,
    val showSettingsSheet: Boolean = false,
    val showSpeakerNotes: Boolean = false,
    val typographySettings: ReaderTypographySettings = ReaderTypographySettings()
)

