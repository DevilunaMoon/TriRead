package com.triread.app.ui.dashboard

import com.triread.app.domain.model.DocumentCategory
import com.triread.app.domain.model.DocumentItem

enum class DocumentFilter(val label: String) {
    ALL("All"),
    FAVORITES("Favorites"),
    UNREAD("Unread")
}

sealed interface DocumentListUiState {
    data object Loading : DocumentListUiState
    data class Success(val documents: List<DocumentItem>) : DocumentListUiState
    data class Empty(val reason: EmptyReason) : DocumentListUiState
    data class Error(val message: String) : DocumentListUiState
}

enum class EmptyReason {
    NO_FILES_IN_CATEGORY,
    NO_SEARCH_MATCHES,
    NO_FAVORITES,
    NO_UNREAD
}

data class DashboardUiState(
    val selectedCategory: DocumentCategory = DocumentCategory.PDF,
    val selectedFilter: DocumentFilter = DocumentFilter.ALL,
    val searchQuery: String = "",
    val categoryCounts: Map<DocumentCategory, Int> = mapOf(
        DocumentCategory.PDF to 0,
        DocumentCategory.DOC to 0,
        DocumentCategory.PPT to 0
    ),
    val continueReading: DocumentItem? = null,
    val listState: DocumentListUiState = DocumentListUiState.Loading,
    val isSyncing: Boolean = false,
    val hasStoragePermission: Boolean = false,
    val userMessage: String? = null
)

