package com.triread.app.ui.viewer

import android.content.Context
import android.graphics.Bitmap
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.triread.app.data.parser.DocxParser
import com.triread.app.data.parser.PdfDocumentSession
import com.triread.app.data.parser.PdfPasswordProtectedException
import com.triread.app.data.parser.PptxParser
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

class ViewerViewModel(
    private val uriString: String,
    private val appContext: Context,
    private val repository: DocumentRepository,
    private val docxParser: DocxParser,
    private val pptxParser: PptxParser
) : ViewModel() {

    private val _uiState = MutableStateFlow(ViewerUiState())
    val uiState: StateFlow<ViewerUiState> = _uiState.asStateFlow()

    private var pdfSession: PdfDocumentSession? = null
    private val pdfBitmapCache = LinkedHashMap<Int, Bitmap>()
    private var pdfRenderJob: Job? = null
    private var lastRenderWidthPx: Int = DEFAULT_RENDER_WIDTH_PX

    init {
        loadDocument()
    }

    fun loadDocument() {
        viewModelScope.launch {
            _uiState.update { it.copy(contentState = ViewerContentState.Loading) }

            val docResult = repository.getDocument(uriString)
            val document = docResult.getOrNull()
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
                DocumentCategory.DOC -> openDoc(document)
                DocumentCategory.PPT -> openPpt(document)
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

    private suspend fun openDoc(document: DocumentItem) {
        docxParser.parse(document.uriString, document.title).fold(
            onFailure = { error ->
                val title = if (error is SecurityException) "Permission Revoked" else "Unable to Open Document"
                _uiState.update {
                    it.copy(
                        contentState = ViewerContentState.Error(
                            title = title,
                            message = error.localizedMessage ?: "The document could not be parsed."
                        )
                    )
                }
            },
            onSuccess = { parsed ->
                val totalLogicalPages = ((parsed.blocks.size + BLOCKS_PER_PAGE - 1) / BLOCKS_PER_PAGE)
                    .coerceAtLeast(1)
                val restoredPage = document.currentPage.coerceIn(0, totalLogicalPages - 1)
                val initialBlock = (restoredPage * BLOCKS_PER_PAGE)
                    .coerceIn(0, (parsed.blocks.size - 1).coerceAtLeast(0))

                _uiState.update {
                    it.copy(
                        currentPage = restoredPage,
                        totalPages = totalLogicalPages,
                        contentState = ViewerContentState.DocReady(
                            blocks = parsed.blocks,
                            initialBlockIndex = initialBlock,
                            noticeMessage = parsed.noticeMessage
                        )
                    )
                }
                persistProgressAsync(restoredPage, totalLogicalPages)
            }
        )
    }

    private suspend fun openPpt(document: DocumentItem) {
        pptxParser.parse(document.uriString, document.title).fold(
            onFailure = { error ->
                val title = if (error is SecurityException) "Permission Revoked" else "Unable to Open Presentation"
                _uiState.update {
                    it.copy(
                        contentState = ViewerContentState.Error(
                            title = title,
                            message = error.localizedMessage ?: "The presentation could not be parsed."
                        )
                    )
                }
            },
            onSuccess = { parsed ->
                if (parsed.isLegacyUnsupported) {
                    _uiState.update {
                        it.copy(
                            contentState = ViewerContentState.Error(
                                title = "Legacy .ppt Format",
                                message = parsed.noticeMessage
                                    ?: "Please convert this file to .pptx or .pdf to view it offline."
                            )
                        )
                    }
                    return
                }

                val slideCount = parsed.slides.size
                val restoredSlide = document.currentPage.coerceIn(0, (slideCount - 1).coerceAtLeast(0))
                _uiState.update {
                    it.copy(
                        currentPage = restoredSlide,
                        totalPages = slideCount,
                        contentState = ViewerContentState.PptReady(
                            slides = parsed.slides,
                            initialSlide = restoredSlide,
                            slideAspectRatio = parsed.aspectRatio,
                            slideWidthPt = parsed.slideWidthPt,
                            noticeMessage = parsed.noticeMessage
                        )
                    )
                }
                persistProgressAsync(restoredSlide, slideCount)
            }
        )
    }

    fun onPdfViewportWidthChanged(widthPx: Int) {
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

    fun onDocVisibleBlockChanged(firstVisibleBlockIndex: Int) {
        val state = _uiState.value
        if (state.contentState !is ViewerContentState.DocReady) return
        val logicalPage = (firstVisibleBlockIndex / BLOCKS_PER_PAGE)
            .coerceIn(0, (state.totalPages - 1).coerceAtLeast(0))
        if (logicalPage != state.currentPage) {
            _uiState.update { it.copy(currentPage = logicalPage) }
            persistProgressAsync(logicalPage, state.totalPages)
        }
    }

    fun onDocPrintPageChanged(pageIndex: Int, totalPrintPages: Int) {
        val total = totalPrintPages.coerceAtLeast(1)
        val clamped = pageIndex.coerceIn(0, total - 1)
        val state = _uiState.value
        if (clamped != state.currentPage || total != state.totalPages) {
            _uiState.update { it.copy(currentPage = clamped, totalPages = total) }
            persistProgressAsync(clamped, total)
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

    fun toggleLandscape() {
        _uiState.update { it.copy(isLandscape = !it.isLandscape) }
    }

    fun toggleFullscreenHorizontal() {
        _uiState.update { state ->
            val entering = !state.isLandscape
            state.copy(
                isLandscape = entering,
                isImmersive = entering,
                showSettingsSheet = false
            )
        }
    }

    fun toggleImmersiveMode() {
        _uiState.update {
            val nextImmersive = !it.isImmersive
            it.copy(
                isImmersive = nextImmersive,
                showSettingsSheet = if (nextImmersive) false else it.showSettingsSheet
            )
        }
    }

    fun togglePrintLayout(enabled: Boolean) {
        _uiState.update { state ->
            state.copy(
                typographySettings = state.typographySettings.copy(isPrintLayout = enabled)
            )
        }
    }

    fun toggleSettingsSheet() {
        _uiState.update { it.copy(showSettingsSheet = !it.showSettingsSheet) }
    }

    fun dismissSettingsSheet() {
        _uiState.update { it.copy(showSettingsSheet = false) }
    }

    fun toggleSpeakerNotes() {
        _uiState.update { it.copy(showSpeakerNotes = !it.showSpeakerNotes) }
    }

    fun updateFontSize(sizeSp: Float) {
        _uiState.update {
            it.copy(
                typographySettings = it.typographySettings.copy(
                    fontSizeSp = sizeSp.coerceIn(13f, 26f)
                )
            )
        }
    }

    fun updateLineSpacing(multiplier: Float) {
        _uiState.update {
            it.copy(
                typographySettings = it.typographySettings.copy(
                    lineHeightMultiplier = multiplier.coerceIn(1.2f, 2.0f)
                )
            )
        }
    }

    fun selectReaderTheme(theme: ReaderTheme) {
        _uiState.update {
            it.copy(
                typographySettings = it.typographySettings.copy(theme = theme)
            )
        }
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

    override fun onCleared() {
        super.onCleared()
        closePdfSession()
    }

    companion object {
        private const val DEFAULT_RENDER_WIDTH_PX = 1080
        private const val BLOCKS_PER_PAGE = 8

        fun provideFactory(
            uriString: String,
            appContext: Context,
            repository: DocumentRepository,
            docxParser: DocxParser,
            pptxParser: PptxParser
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
                    docxParser = docxParser,
                    pptxParser = pptxParser
                ) as T
            }
        }
    }
}
