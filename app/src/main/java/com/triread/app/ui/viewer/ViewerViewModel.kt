package com.triread.app.ui.viewer

import android.content.Context
import android.graphics.Bitmap
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.triread.app.data.collabora.CollaboraTempFileManager
import com.triread.app.data.parser.PdfDocumentSession
import com.triread.app.data.parser.PdfPasswordProtectedException
import com.triread.app.domain.model.DocumentCategory
import com.triread.app.domain.model.DocumentItem
import com.triread.app.domain.repository.DocumentRepository
import com.triread.app.util.IoExtensions.safeRecycle
import kotlinx.coroutines.Job
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

class ViewerViewModel(
    private val uriString: String,
    private val appContext: Context,
    private val repository: DocumentRepository,
    private val tempFileManager: CollaboraTempFileManager
) : ViewModel() {

    private val _uiState = MutableStateFlow(ViewerUiState())
    val uiState: StateFlow<ViewerUiState> = _uiState.asStateFlow()

    private var pdfSession: PdfDocumentSession? = null
    private val pdfBitmapCache = LinkedHashMap<Int, Bitmap>()
    private var pdfRenderJob: Job? = null
    private var lastRenderWidthPx: Int = DEFAULT_RENDER_WIDTH_PX

    private var activeTempFile: File? = null

    init {
        loadDocument()
    }

    fun loadDocument() {
        viewModelScope.launch {
            _uiState.update { it.copy(contentState = ViewerContentState.Loading) }

            val document = repository.getDocument(uriString).getOrNull()
            if (document == null) {
                _uiState.update {
                    it.copy(
                        contentState = ViewerContentState.Error(
                            title = "Document Not Found",
                            message = "This file may have been removed or is no longer accessible."
                        )
                    )
                }
                return@launch
            }

            _uiState.update {
                it.copy(
                    document = document,
                    currentPage = document.currentPage,
                    totalPages = document.totalPages
                )
            }

            when (document.category) {
                DocumentCategory.PDF -> openPdf(document)
                DocumentCategory.DOC,
                DocumentCategory.PPT -> openWithCollabora(document)
            }
        }
    }

    private suspend fun openPdf(document: DocumentItem) {
        closePdfSession()

        PdfDocumentSession.open(appContext, document.uriString).fold(
            onFailure = { error ->
                val (title, message) = when (error) {
                    is PdfPasswordProtectedException ->
                        "Password-Protected PDF" to "Encrypted PDFs are not supported yet."
                    is SecurityException ->
                        "Permission Revoked" to "Please re-open this file using the file picker to grant access."
                    else ->
                        "Unable to Open PDF" to (error.localizedMessage ?: "The PDF file may be corrupted.")
                }
                _uiState.update {
                    it.copy(contentState = ViewerContentState.Error(title = title, message = message))
                }
            },
            onSuccess = { session ->
                pdfSession = session
                val pageCount = session.pageCount
                if (pageCount <= 0) {
                    _uiState.update {
                        it.copy(
                            contentState = ViewerContentState.Error(
                                title = "Empty PDF",
                                message = "This PDF document has no renderable pages."
                            )
                        )
                    }
                    return
                }

                val restoredPage = document.currentPage.coerceIn(0, pageCount - 1)
                _uiState.update {
                    it.copy(
                        currentPage = restoredPage,
                        totalPages = pageCount,
                        contentState = ViewerContentState.PdfReady(
                            totalPages = pageCount,
                            initialPage = restoredPage,
                            renderedPages = emptyMap()
                        )
                    )
                }
                persistProgressAsync(restoredPage, pageCount)
                updatePdfWindow(restoredPage, lastRenderWidthPx)
            }
        )
    }

    private suspend fun openWithCollabora(document: DocumentItem) {
        cleanupTempFile()

        tempFileManager.copyUriToTempFile(
            uriString = document.uriString,
            fileName = document.title,
            category = document.category
        ).fold(
            onFailure = { error ->
                val title = if (error is SecurityException) "Permission Revoked" else "Unable to Open Document"
                _uiState.update {
                    it.copy(
                        contentState = ViewerContentState.Error(
                            title = title,
                            message = error.localizedMessage ?: "The file could not be read."
                        )
                    )
                }
            },
            onSuccess = { tempFile ->
                activeTempFile = tempFile
                _uiState.update {
                    it.copy(
                        contentState = ViewerContentState.CollaboraReady(
                            tempFile = tempFile,
                            isPresentation = document.category == DocumentCategory.PPT
                        )
                    )
                }
                repository.updateReadingProgress(
                    uriString = uriString,
                    currentPage = document.currentPage,
                    totalPages = document.totalPages
                )
            }
        )
    }

    fun onCollaboraError(message: String) {
        _uiState.update {
            it.copy(
                contentState = ViewerContentState.Error(
                    title = "Unable to Open Document",
                    message = message
                )
            )
        }
    }

    fun onViewportWidthChanged(widthPx: Int) {
        if (widthPx > 0 && kotlin.math.abs(widthPx - lastRenderWidthPx) > 120) {
            lastRenderWidthPx = widthPx
            if (_uiState.value.contentState is ViewerContentState.PdfReady) {
                updatePdfWindow(_uiState.value.currentPage, widthPx)
            }
        }
    }

    fun onPageChanged(pageIndex: Int) {
        val state = _uiState.value
        val total = state.totalPages
        if (total <= 0) return

        val clamped = pageIndex.coerceIn(0, total - 1)
        if (clamped == state.currentPage) return

        _uiState.update { it.copy(currentPage = clamped) }
        persistProgressAsync(clamped, total)

        if (state.contentState is ViewerContentState.PdfReady) {
            updatePdfWindow(clamped, lastRenderWidthPx)
        }
    }

    fun persistProgressNow() {
        val state = _uiState.value
        if (state.document == null || state.totalPages <= 0) return
        viewModelScope.launch {
            withContext(NonCancellable) {
                repository.updateReadingProgress(
                    uriString = uriString,
                    currentPage = state.currentPage,
                    totalPages = state.totalPages
                )
            }
        }
    }

    fun togglePdfReadingMode() {
        _uiState.update { state ->
            val nextMode = if (state.pdfReadingMode == PdfReadingMode.VERTICAL_SCROLL) {
                PdfReadingMode.HORIZONTAL_PAGED
            } else {
                PdfReadingMode.VERTICAL_SCROLL
            }
            state.copy(pdfReadingMode = nextMode)
        }
        if (_uiState.value.contentState is ViewerContentState.PdfReady) {
            updatePdfWindow(_uiState.value.currentPage, lastRenderWidthPx)
        }
    }

    fun togglePdfPerPageFullscreen() {
        _uiState.update { state ->
            val entering = !(state.isImmersive && state.pdfReadingMode == PdfReadingMode.HORIZONTAL_PAGED)
            state.copy(
                pdfReadingMode = if (entering) PdfReadingMode.HORIZONTAL_PAGED else PdfReadingMode.VERTICAL_SCROLL,
                isImmersive = entering
            )
        }
        if (_uiState.value.contentState is ViewerContentState.PdfReady) {
            updatePdfWindow(_uiState.value.currentPage, lastRenderWidthPx)
        }
    }

    fun toggleLandscape() {
        _uiState.update { it.copy(isLandscape = !it.isLandscape) }
    }

    fun toggleFullscreenHorizontal() {
        _uiState.update { state ->
            val entering = !state.isLandscape
            state.copy(
                isLandscape = entering,
                isImmersive = entering
            )
        }
    }

    fun toggleImmersiveMode() {
        _uiState.update { it.copy(isImmersive = !it.isImmersive) }
    }

    private fun updatePdfWindow(centerPage: Int, renderWidthPx: Int) {
        val session = pdfSession ?: return
        val total = session.pageCount
        if (total <= 0) return

        val radius = if (_uiState.value.pdfReadingMode == PdfReadingMode.VERTICAL_SCROLL) 2 else 1

        pdfRenderJob?.cancel()
        pdfRenderJob = viewModelScope.launch {
            val window = ((centerPage - radius).coerceAtLeast(0)..(centerPage + radius).coerceAtMost(total - 1))
                .toSet()

            val renderOrder = buildList {
                add(centerPage)
                for (offset in 1..radius) {
                    if (centerPage + offset in window) add(centerPage + offset)
                    if (centerPage - offset in window) add(centerPage - offset)
                }
            }

            val evicted = mutableListOf<Bitmap>()
            val iterator = pdfBitmapCache.entries.iterator()
            while (iterator.hasNext()) {
                val entry = iterator.next()
                if (entry.key !in window) {
                    evicted.add(entry.value)
                    iterator.remove()
                }
            }
            if (evicted.isNotEmpty()) {
                publishPdfCache()
                delay(60L)
                evicted.forEach { it.safeRecycle() }
            }

            for (pageIndex in renderOrder) {
                if (pdfBitmapCache.containsKey(pageIndex)) continue
                session.renderPage(pageIndex, renderWidthPx).onSuccess { bitmap ->
                    if (pageIndex in window) {
                        pdfBitmapCache[pageIndex] = bitmap
                        publishPdfCache()
                    } else {
                        bitmap.safeRecycle()
                    }
                }
            }
        }
    }

    private fun publishPdfCache() {
        val snapshot = pdfBitmapCache.toMap()
        _uiState.update { state ->
            val current = state.contentState
            if (current is ViewerContentState.PdfReady) {
                state.copy(contentState = current.copy(renderedPages = snapshot))
            } else {
                state
            }
        }
    }

    private fun persistProgressAsync(currentPage: Int, totalPages: Int) {
        viewModelScope.launch {
            repository.updateReadingProgress(
                uriString = uriString,
                currentPage = currentPage,
                totalPages = totalPages
            )
        }
    }

    private fun closePdfSession() {
        pdfRenderJob?.cancel()
        pdfBitmapCache.values.forEach { it.safeRecycle() }
        pdfBitmapCache.clear()
        pdfSession?.close()
        pdfSession = null
    }

    private fun cleanupTempFile() {
        tempFileManager.deleteTempFile(activeTempFile)
        activeTempFile = null
    }

    override fun onCleared() {
        super.onCleared()
        closePdfSession()
        cleanupTempFile()
    }

    companion object {
        private const val DEFAULT_RENDER_WIDTH_PX = 1080

        fun provideFactory(
            uriString: String,
            appContext: Context,
            repository: DocumentRepository,
            tempFileManager: CollaboraTempFileManager
        ): ViewModelProvider.Factory = object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(modelClass: Class<T>): T {
                require(modelClass.isAssignableFrom(ViewerViewModel::class.java)) {
                    "Unknown ViewModel class: ${modelClass.name}"
                }
                return ViewerViewModel(
                    uriString = uriString,
                    appContext = appContext.applicationContext,
                    repository = repository,
                    tempFileManager = tempFileManager
                ) as T
            }
        }
    }
}
