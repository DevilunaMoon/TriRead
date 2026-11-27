package com.triread.app.ui.viewer

import android.graphics.Bitmap
import com.triread.app.domain.model.DocumentItem

enum class PdfReadingMode(val label: String) {
    VERTICAL_SCROLL("Vertical Scroll"),
    HORIZONTAL_PAGED("Single Page")
}

sealed interface ViewerContentState {
    data object Loading : ViewerContentState

    data class PdfReady(
        val totalPages: Int,
        val initialPage: Int,
        val renderedPages: Map<Int, Bitmap>
    ) : ViewerContentState

    data class DocReady(
        val totalPages: Int,
        val initialPage: Int,
        val renderedPages: Map<Int, Bitmap>,
        val pageAspectRatios: Map<Int, Float>
    ) : ViewerContentState

    data class PptReady(
        val totalSlides: Int,
        val initialSlide: Int,
        val renderedSlides: Map<Int, Bitmap>,
        val slideAspectRatios: Map<Int, Float>
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
    val pdfReadingMode: PdfReadingMode = PdfReadingMode.VERTICAL_SCROLL,
    val isLandscape: Boolean = false,
    val isImmersive: Boolean = false
)
