package com.triread.app.ui.dashboard

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.triread.app.domain.model.DocumentCategory
import com.triread.app.domain.model.DocumentItem
import com.triread.app.domain.repository.DocumentRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.util.concurrent.ConcurrentHashMap

class DashboardViewModel(
    private val repository: DocumentRepository
) : ViewModel() {

    private val selectedCategory = MutableStateFlow(DocumentCategory.PDF)
    private val selectedFilter = MutableStateFlow(DocumentFilter.ALL)
    private val rawSearchQuery = MutableStateFlow("")
    private val isSyncing = MutableStateFlow(false)
    private val hasStoragePermission = MutableStateFlow(false)
    private val userMessage = MutableStateFlow<String?>(null)

    private val requestedThumbnails = ConcurrentHashMap.newKeySet<String>()

    private val debouncedQuery: StateFlow<String> = rawSearchQuery
        .map { it.trim() }
        .debounce(SEARCH_DEBOUNCE_MS)
        .distinctUntilChanged()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), "")

    private val categoryDocuments = selectedCategory
        .flatMapLatest { category ->
            repository.observeDocuments(category)
                .map<List<DocumentItem>, Result<List<DocumentItem>>> { Result.success(it) }
                .catch { emit(Result.failure(it)) }
        }

    private val listStateFlow: StateFlow<DocumentListUiState> = combine(
        categoryDocuments,
        selectedFilter,
        debouncedQuery
    ) { docsResult, filter, query ->
        docsResult.fold(
            onFailure = { error ->
                DocumentListUiState.Error(
                    error.localizedMessage ?: "Failed to load documents."
                )
            },
            onSuccess = { docs ->
                val filtered = docs.filter { doc ->
                    val matchesFilter = when (filter) {
                        DocumentFilter.ALL -> true
                        DocumentFilter.FAVORITES -> doc.isFavorite
                        DocumentFilter.UNREAD -> doc.isUnread
                    }
                    val matchesQuery = query.isEmpty() ||
                        doc.title.contains(query, ignoreCase = true)
                    matchesFilter && matchesQuery
                }

                if (filtered.isEmpty()) {
                    val reason = when {
                        query.isNotEmpty() -> EmptyReason.NO_SEARCH_MATCHES
                        filter == DocumentFilter.FAVORITES -> EmptyReason.NO_FAVORITES
                        filter == DocumentFilter.UNREAD -> EmptyReason.NO_UNREAD
                        else -> EmptyReason.NO_FILES_IN_CATEGORY
                    }
                    DocumentListUiState.Empty(reason)
                } else {
                    DocumentListUiState.Success(filtered)
                }
            }
        )
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5_000),
        initialValue = DocumentListUiState.Loading
    )

    private val headerControlsFlow = combine(
        selectedCategory,
        selectedFilter,
        rawSearchQuery,
        isSyncing,
        hasStoragePermission
    ) { category, filter, query, syncing, permission ->
        HeaderControls(
            category = category,
            filter = filter,
            query = query,
            isSyncing = syncing,
            hasStoragePermission = permission
        )
    }

    val uiState: StateFlow<DashboardUiState> = combine(
        headerControlsFlow,
        repository.observeCategoryCounts().catch { emit(emptyMap()) },
        repository.observeMostRecentlyOpened().catch { emit(null) },
        listStateFlow,
        userMessage
    ) { controls, counts, recent, listState, message ->
        DashboardUiState(
            selectedCategory = controls.category,
            selectedFilter = controls.filter,
            searchQuery = controls.query,
            categoryCounts = counts,
            continueReading = recent,
            listState = listState,
            isSyncing = controls.isSyncing,
            hasStoragePermission = controls.hasStoragePermission,
            userMessage = message
        )
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5_000),
        initialValue = DashboardUiState()
    )

    fun onPermissionStatusChanged(granted: Boolean) {
        hasStoragePermission.value = granted
        syncLibrary()
    }

    fun onCategorySelected(category: DocumentCategory) {
        selectedCategory.value = category
    }

    fun onFilterSelected(filter: DocumentFilter) {
        selectedFilter.value = filter
    }

    fun onSearchQueryChanged(query: String) {
        rawSearchQuery.value = query
    }

    fun clearSearch() {
        rawSearchQuery.value = ""
    }

    fun syncLibrary() {
        if (isSyncing.value) return
        viewModelScope.launch {
            isSyncing.value = true
            repository.syncWithMediaStore()
                .onFailure { error ->
                    userMessage.value = error.localizedMessage
                        ?: "Unable to scan device storage."
                }
            isSyncing.value = false
        }
    }

    fun onToggleFavorite(document: DocumentItem) {
        viewModelScope.launch {
            repository.toggleFavorite(
                uriString = document.uriString,
                isFavorite = !document.isFavorite
            ).onFailure {
                userMessage.value = "Could not update favorite status."
            }
        }
    }

    fun onRequestThumbnail(document: DocumentItem) {
        if (!document.thumbnailPath.isNullOrBlank()) return
        if (!requestedThumbnails.add(document.uriString)) return

        viewModelScope.launch {
            repository.ensureThumbnail(document)
        }
    }

    fun onDocumentPicked(uri: Uri, onImported: (DocumentItem) -> Unit) {
        viewModelScope.launch {
            repository.importDocument(uri)
                .onSuccess { item ->
                    selectedCategory.value = item.category
                    onImported(item)
                }
                .onFailure { error ->
                    userMessage.value = error.localizedMessage
                        ?: "Unsupported or unreadable document."
                }
        }
    }

    fun consumeUserMessage() {
        userMessage.value = null
    }

    private data class HeaderControls(
        val category: DocumentCategory,
        val filter: DocumentFilter,
        val query: String,
        val isSyncing: Boolean,
        val hasStoragePermission: Boolean
    )

    companion object {
        private const val SEARCH_DEBOUNCE_MS = 250L

        fun provideFactory(repository: DocumentRepository): ViewModelProvider.Factory =
            object : ViewModelProvider.Factory {
                @Suppress("UNCHECKED_CAST")
                override fun <T : ViewModel> create(modelClass: Class<T>): T {
                    require(modelClass.isAssignableFrom(DashboardViewModel::class.java)) {
                        "Unknown ViewModel class: ${modelClass.name}"
                    }
                    return DashboardViewModel(repository) as T
                }
            }
    }
}

