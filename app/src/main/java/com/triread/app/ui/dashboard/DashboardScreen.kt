package com.triread.app.ui.dashboard

import android.Manifest
import android.content.Intent
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.FolderOpen
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.SystemUpdate
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.triread.app.domain.model.DocumentCategory
import com.triread.app.ui.dashboard.components.ContinueReadingBanner
import com.triread.app.ui.dashboard.components.DocumentCard
import com.triread.app.ui.dashboard.components.StoragePermissionBanner
import com.triread.app.util.StoragePermissionHelper

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    viewModel: DashboardViewModel,
    onOpenDocument: (String) -> Unit,
    onCheckForUpdates: () -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val snackbarHostState = remember { SnackbarHostState() }

    val legacyPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { granted ->
        viewModel.onPermissionStatusChanged(granted)
    }

    val openDocumentLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocument()
    ) { uri ->
        if (uri != null) {
            runCatching {
                context.contentResolver.takePersistableUriPermission(
                    uri,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION
                )
            }
            viewModel.onDocumentPicked(uri) { imported ->
                onOpenDocument(imported.uriString)
            }
        }
    }

    // Re-check storage access & scan for newly downloaded files whenever returning to the app.
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) {
        val granted = StoragePermissionHelper.hasFullStorageAccess(context)
        viewModel.onPermissionStatusChanged(granted)
    }

    LaunchedEffect(uiState.userMessage) {
        val message = uiState.userMessage
        if (!message.isNullOrBlank()) {
            snackbarHostState.showSnackbar(message)
            viewModel.consumeUserMessage()
        }
    }

    val requestStorageAccess: () -> Unit = {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            context.startActivity(StoragePermissionHelper.buildManageAllFilesIntent(context))
        } else {
            legacyPermissionLauncher.launch(Manifest.permission.READ_EXTERNAL_STORAGE)
        }
    }

    val launchDocumentPicker: () -> Unit = {
        openDocumentLauncher.launch(DocumentCategory.ALL_SUPPORTED_MIME_TYPES)
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        snackbarHost = { SnackbarHost(hostState = snackbarHostState) },
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "TriRead",
                        style = MaterialTheme.typography.headlineSmall
                    )
                },
                actions = {
                    IconButton(onClick = onCheckForUpdates) {
                        Icon(
                            imageVector = Icons.Rounded.SystemUpdate,
                            contentDescription = "Check for updates"
                        )
                    }
                    if (uiState.isSyncing) {
                        CircularProgressIndicator(
                            modifier = Modifier
                                .padding(end = 16.dp)
                                .size(20.dp),
                            strokeWidth = 2.dp
                        )
                    } else {
                        IconButton(onClick = viewModel::syncLibrary) {
                            Icon(
                                imageVector = Icons.Rounded.Refresh,
                                contentDescription = "Scan for new documents"
                            )
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = launchDocumentPicker,
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary
            ) {
                Icon(
                    imageVector = Icons.Rounded.Add,
                    contentDescription = "Import document"
                )
            }
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            CategoryTabs(
                selectedCategory = uiState.selectedCategory,
                counts = uiState.categoryCounts,
                onSelectCategory = viewModel::onCategorySelected
            )

            SearchAndFilterHeader(
                query = uiState.searchQuery,
                selectedFilter = uiState.selectedFilter,
                onQueryChange = viewModel::onSearchQueryChanged,
                onClearQuery = viewModel::clearSearch,
                onSelectFilter = viewModel::onFilterSelected
            )

            PullToRefreshBox(
                isRefreshing = uiState.isSyncing,
                onRefresh = viewModel::syncLibrary,
                modifier = Modifier.fillMaxSize()
            ) {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(
                        start = 16.dp,
                        end = 16.dp,
                        top = 8.dp,
                        bottom = 88.dp
                    ),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    if (!uiState.hasStoragePermission) {
                        item(key = "storage_permission_banner") {
                            StoragePermissionBanner(onGrantAccessClick = requestStorageAccess)
                        }
                    }

                    val recentDoc = uiState.continueReading
                    if (recentDoc != null && uiState.searchQuery.isBlank()) {
                        item(key = "continue_reading_banner") {
                            ContinueReadingBanner(
                                document = recentDoc,
                                onResumeClick = { onOpenDocument(recentDoc.uriString) }
                            )
                        }
                    }

                    when (val state = uiState.listState) {
                        DocumentListUiState.Loading -> {
                            item(key = "loading_state") {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 48.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    CircularProgressIndicator()
                                }
                            }
                        }

                        is DocumentListUiState.Error -> {
                            item(key = "error_state") {
                                StateFeedbackBlock(
                                    title = "Something went wrong",
                                    subtitle = state.message,
                                    actionLabel = "Retry",
                                    onAction = viewModel::syncLibrary
                                )
                            }
                        }

                        is DocumentListUiState.Empty -> {
                            item(key = "empty_state") {
                                EmptyLibraryBlock(
                                    reason = state.reason,
                                    category = uiState.selectedCategory,
                                    onOpenFilePicker = launchDocumentPicker,
                                    onClearSearch = viewModel::clearSearch
                                )
                            }
                        }

                        is DocumentListUiState.Success -> {
                            items(
                                items = state.documents,
                                key = { it.uriString }
                            ) { document ->
                                DocumentCard(
                                    document = document,
                                    onClick = { onOpenDocument(document.uriString) },
                                    onToggleFavorite = { viewModel.onToggleFavorite(document) },
                                    onRequestThumbnail = viewModel::onRequestThumbnail
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CategoryTabs(
    selectedCategory: DocumentCategory,
    counts: Map<DocumentCategory, Int>,
    onSelectCategory: (DocumentCategory) -> Unit
) {
    val categories = DocumentCategory.entries
    val selectedIndex = categories.indexOf(selectedCategory).coerceAtLeast(0)

    TabRow(
        selectedTabIndex = selectedIndex,
        containerColor = MaterialTheme.colorScheme.surface
    ) {
        categories.forEach { category ->
            val selected = category == selectedCategory
            val count = counts[category] ?: 0
            Tab(
                selected = selected,
                onClick = { onSelectCategory(category) },
                text = {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Text(
                            text = category.displayName,
                            style = MaterialTheme.typography.titleMedium
                        )
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(10.dp))
                                .background(
                                    if (selected) {
                                        MaterialTheme.colorScheme.primaryContainer
                                    } else {
                                        MaterialTheme.colorScheme.surfaceVariant
                                    }
                                )
                                .padding(horizontal = 6.dp, vertical = 2.dp)
                        ) {
                            Text(
                                text = count.toString(),
                                style = MaterialTheme.typography.labelSmall,
                                color = if (selected) {
                                    MaterialTheme.colorScheme.onPrimaryContainer
                                } else {
                                    MaterialTheme.colorScheme.onSurfaceVariant
                                }
                            )
                        }
                    }
                }
            )
        }
    }
}

@Composable
private fun SearchAndFilterHeader(
    query: String,
    selectedFilter: DocumentFilter,
    onQueryChange: (String) -> Unit,
    onClearQuery: () -> Unit,
    onSelectFilter: (DocumentFilter) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.surface)
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        OutlinedTextField(
            value = query,
            onValueChange = onQueryChange,
            modifier = Modifier.fillMaxWidth(),
            placeholder = { Text(text = "Search documents...") },
            leadingIcon = {
                Icon(
                    imageVector = Icons.Rounded.Search,
                    contentDescription = null
                )
            },
            trailingIcon = {
                if (query.isNotEmpty()) {
                    IconButton(onClick = onClearQuery) {
                        Icon(
                            imageVector = Icons.Rounded.Close,
                            contentDescription = "Clear search"
                        )
                    }
                }
            },
            singleLine = true,
            shape = RoundedCornerShape(24.dp),
            colors = OutlinedTextFieldDefaults.colors(
                unfocusedContainerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                focusedContainerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                unfocusedBorderColor = MaterialTheme.colorScheme.surfaceVariant
            )
        )

        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            DocumentFilter.entries.forEach { filter ->
                FilterChip(
                    selected = filter == selectedFilter,
                    onClick = { onSelectFilter(filter) },
                    label = { Text(text = filter.label) }
                )
            }
        }
    }
}

@Composable
private fun EmptyLibraryBlock(
    reason: EmptyReason,
    category: DocumentCategory,
    onOpenFilePicker: () -> Unit,
    onClearSearch: () -> Unit
) {
    when (reason) {
        EmptyReason.NO_SEARCH_MATCHES -> StateFeedbackBlock(
            title = "No matching ${category.displayName} files",
            subtitle = "Try a different filename keyword.",
            actionLabel = "Clear Search",
            onAction = onClearSearch
        )
        EmptyReason.NO_FAVORITES -> StateFeedbackBlock(
            title = "No favorites yet",
            subtitle = "Tap the star icon on any document to pin it here.",
            actionLabel = null,
            onAction = null
        )
        EmptyReason.NO_UNREAD -> StateFeedbackBlock(
            title = "All caught up",
            subtitle = "You've opened every ${category.displayName} file in this tab.",
            actionLabel = null,
            onAction = null
        )
        EmptyReason.NO_FILES_IN_CATEGORY -> StateFeedbackBlock(
            title = "No ${category.displayName} files found",
            subtitle = "Pull to refresh or tap + to pick a file from your device.",
            actionLabel = "Browse Files",
            onAction = onOpenFilePicker
        )
    }
}

@Composable
private fun StateFeedbackBlock(
    title: String,
    subtitle: String,
    actionLabel: String?,
    onAction: (() -> Unit)?
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp, vertical = 48.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Icon(
            imageVector = Icons.Rounded.FolderOpen,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f),
            modifier = Modifier.size(48.dp)
        )
        Text(
            text = title,
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurface,
            textAlign = TextAlign.Center
        )
        Text(
            text = subtitle,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )
        if (actionLabel != null && onAction != null) {
            Spacer(modifier = Modifier.height(4.dp))
            Button(onClick = onAction) {
                Text(text = actionLabel)
            }
        }
    }
}

