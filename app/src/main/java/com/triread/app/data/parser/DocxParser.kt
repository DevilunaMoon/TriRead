package com.triread.app.data.parser

import android.content.Context
import android.net.Uri
import android.util.Xml
import com.triread.app.util.IoExtensions
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import org.xmlpull.v1.XmlPullParser
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.util.Locale
import java.util.zip.ZipInputStream
import kotlin.coroutines.coroutineContext

enum class DocTextAlignment {
    START, CENTER, END, JUSTIFY
}

data class DocRun(
    val text: String,
    val isBold: Boolean = false,
    val isItalic: Boolean = false,
    val isUnderline: Boolean = false,
    val fontSizePt: Float? = null,
    val colorArgb: Long? = null,
    val fontFamilyName: String? = null
)

sealed interface HeaderFooterElement {
    data class Image(
        val imagePath: String,
        val widthPt: Float? = null,
        val heightPt: Float? = null
    ) : HeaderFooterElement

    data class TextLine(
        val text: String,
        val fontFamilyName: String? = null
    ) : HeaderFooterElement
}

data class DocHeaderFooter(
    val elements: List<HeaderFooterElement> = emptyList()
) {
    val isNotEmpty: Boolean
        get() = elements.isNotEmpty()

    val hasImages: Boolean
        get() = elements.any { it is HeaderFooterElement.Image }
}

data class DocPageMetrics(
    val widthPt: Float = 612f,
    val heightPt: Float = 792f,
    val marginTopPt: Float = 72f,
    val marginBottomPt: Float = 72f,
    val marginLeftPt: Float = 72f,
    val marginRightPt: Float = 72f
) {
    val aspectRatio: Float
        get() = (widthPt / heightPt.coerceAtLeast(1f)).coerceIn(0.55f, 1.8f)
}

sealed interface DocBlock {
    data class Heading(
        val runs: List<DocRun>,
        val level: Int,
        val alignment: DocTextAlignment = DocTextAlignment.START,
        val spaceBeforePt: Float = 8f,
        val spaceAfterPt: Float = 3f
    ) : DocBlock {
        val plainText: String get() = runs.joinToString("") { it.text }
    }

    data class Paragraph(
        val runs: List<DocRun>,
        val isBullet: Boolean = false,
        val alignment: DocTextAlignment = DocTextAlignment.START,
        val indentLeftPt: Float = 0f,
        val firstLineIndentPt: Float = 0f,
        val spaceBeforePt: Float = 0f,
        val spaceAfterPt: Float = 4f
    ) : DocBlock {
        val plainText: String get() = runs.joinToString("") { it.text }
    }

    data class ImageBlock(
        val imagePath: String,
        val widthPt: Float? = null,
        val heightPt: Float? = null
    ) : DocBlock

    data class TableRow(val cells: List<String>) : DocBlock

    data class Spacer(val heightPt: Float = 9f) : DocBlock

    data object PageBreak : DocBlock
}

data class ParsedDocumentContent(
    val blocks: List<DocBlock>,
    val pageMetrics: DocPageMetrics = DocPageMetrics(),
    val header: DocHeaderFooter? = null,
    val footer: DocHeaderFooter? = null,
    val isLegacyFallback: Boolean = false,
    val noticeMessage: String? = null
)

class DocxParser(
    private val context: Context,
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO
) {

    suspend fun parse(uriString: String, fileName: String): Result<ParsedDocumentContent> =
        withContext(ioDispatcher) {
            runCatching {
                val uri = Uri.parse(uriString)
                val isLegacyDoc = fileName.lowercase(Locale.ROOT).endsWith(".doc")

                val mediaDir = File(
                    File(context.cacheDir, DOC_MEDIA_DIR),
                    IoExtensions.sha256Hex(uriString)
                ).apply { if (!exists()) mkdirs() }

                var documentXml: ByteArray? = null
                var documentRelsXml: ByteArray? = null
                var stylesXml: ByteArray? = null
                val headerXmls = mutableMapOf<String, ByteArray>()
                val headerRels = mutableMapOf<String, ByteArray>()
                val footerXmls = mutableMapOf<String, ByteArray>()
                val footerRels = mutableMapOf<String, ByteArray>()
                val cachedMedia = mutableMapOf<String, String>()

                val stream = context.contentResolver.openInputStream(uri)
                    ?: throw IOException("Unable to read document. File may have been moved or permission revoked.")

                stream.use { raw ->
                    ZipInputStream(raw).use { zip ->
                        var entry = zip.nextEntry
                        while (entry != null) {
                            coroutineContext.ensureActive()
                            val name = entry.name
                            val lower = name.lowercase(Locale.ROOT)
                            if (!entry.isDirectory) {
                                when {
                                    lower == "word/document.xml" -> {
                                        documentXml = readBounded(zip, MAX_XML_BYTES)
                                    }
                                    lower == "word/_rels/document.xml.rels" -> {
                                        documentRelsXml = readBounded(zip, MAX_RELS_BYTES)
                                    }
                                    lower == "word/styles.xml" -> {
                                        stylesXml = readBounded(zip, MAX_RELS_BYTES)
                                    }
                                    lower.startsWith("word/header") && lower.endsWith(".xml") -> {
                                        headerXmls[lower] = readBounded(zip, MAX_RELS_BYTES)
                                    }
                                    lower.startsWith("word/_rels/header") && lower.endsWith(".rels") -> {
                                        val key = lower.replace("/_rels/", "/").removeSuffix(".rels")
                                        headerRels[key] = readBounded(zip, MAX_RELS_BYTES)
                                    }
                                    lower.startsWith("word/footer") && lower.endsWith(".xml") -> {
                                        footerXmls[lower] = readBounded(zip, MAX_RELS_BYTES)
                                    }
                                    lower.startsWith("word/_rels/footer") && lower.endsWith(".rels") -> {
                                        val key = lower.replace("/_rels/", "/").removeSuffix(".rels")
                                        footerRels[key] = readBounded(zip, MAX_RELS_BYTES)
                                    }
                                    lower.startsWith("word/media/") && isSupportedImage(lower) -> {
                                        writeMediaToCache(zip, mediaDir, name)?.let { path ->
                                            cachedMedia[lower] = path
                                        }
                                    }
                                }
                            }
                            zip.closeEntry()
                            entry = zip.nextEntry
                        }
                    }
                }

                val xmlBytes = documentXml
                if (xmlBytes != null) {
                    val defaultFontFamily = stylesXml?.let { parseDefaultFontFromStyles(it) }
                    val docRels = documentRelsXml?.let { parseRels(it) }.orEmpty()
                    val bodyResult = parseWordDocumentXml(
                        xmlBytes = xmlBytes,
                        rels = docRels,
                        cachedMedia = cachedMedia,
                        defaultFontFamily = defaultFontFamily
                    )

                    val header = resolveHeaderFooter(
                        preferredTarget = bodyResult.defaultHeaderTarget,
                        xmlMap = headerXmls,
                        relsMap = headerRels,
                        cachedMedia = cachedMedia,
                        defaultFontFamily = defaultFontFamily
                    )
                    val footer = resolveHeaderFooter(
                        preferredTarget = bodyResult.defaultFooterTarget,
                        xmlMap = footerXmls,
                        relsMap = footerRels,
                        cachedMedia = cachedMedia,
                        defaultFontFamily = defaultFontFamily
                    )

                    if (bodyResult.blocks.isEmpty()) {
                        ParsedDocumentContent(
                            blocks = emptyList(),
                            pageMetrics = bodyResult.pageMetrics,
                            header = header,
                            footer = footer,
                            noticeMessage = "This document contains no readable text."
                        )
                    } else {
                        ParsedDocumentContent(
                            blocks = bodyResult.blocks,
                            pageMetrics = bodyResult.pageMetrics,
                            header = header,
                            footer = footer
                        )
                    }
                } else if (isLegacyDoc) {
                    parseLegacyBinaryDoc(uri)
                } else {
                    throw IOException("Invalid or corrupted DOCX archive (missing word/document.xml).")
                }
            }
        }

    private fun parseDefaultFontFromStyles(stylesXml: ByteArray): String? {
        val parser = Xml.newPullParser()
        parser.setFeature(XmlPullParser.FEATURE_PROCESS_NAMESPACES, true)
        ByteArrayInputStream(stylesXml).use { input ->
            parser.setInput(input, "UTF-8")
            var eventType = parser.eventType
            var inDocDefaults = false
            while (eventType != XmlPullParser.END_DOCUMENT) {
                val localName = parser.name.orEmpty()
                when (eventType) {
                    XmlPullParser.START_TAG -> when (localName) {
                        "docDefaults" -> inDocDefaults = true
                        "rFonts" -> if (inDocDefaults) {
                            val font = findAttributeByLocalName(parser, "ascii")
                                ?: findAttributeByLocalName(parser, "hAnsi")
                                ?: findAttributeByLocalName(parser, "cs")
                            if (!font.isNullOrBlank()) return font
                        }
                    }
                    XmlPullParser.END_TAG -> if (localName == "docDefaults") {
                        inDocDefaults = false
                    }
                }
                eventType = parser.next()
            }
        }
        return null
    }

    private fun resolveHeaderFooter(
        preferredTarget: String?,
        xmlMap: Map<String, ByteArray>,
        relsMap: Map<String, ByteArray>,
        cachedMedia: Map<String, String>,
        defaultFontFamily: String?
    ): DocHeaderFooter? {
        if (xmlMap.isEmpty()) return null
        if (!preferredTarget.isNullOrBlank()) {
            val targetBytes = xmlMap[preferredTarget]
            if (targetBytes != null) {
                val rels = relsMap[preferredTarget]?.let { parseRels(it) }.orEmpty()
                val parsed = parseHeaderFooterXml(targetBytes, rels, cachedMedia, defaultFontFamily)
                if (parsed.isNotEmpty) return parsed
            }
        }
        val sortedKeys = xmlMap.keys.sorted()
        val parsedList = sortedKeys.map { key ->
            val rels = relsMap[key]?.let { parseRels(it) }.orEmpty()
            parseHeaderFooterXml(xmlMap.getValue(key), rels, cachedMedia, defaultFontFamily)
        }
        return parsedList.firstOrNull { it.hasImages }
            ?: parsedList.firstOrNull { it.isNotEmpty }
    }

    private data class RawHeaderElement(
        val element: HeaderFooterElement,
        val isBehindDoc: Boolean = false
    )

    private fun parseHeaderFooterXml(
        xmlBytes: ByteArray,
        rels: Map<String, String>,
        cachedMedia: Map<String, String>,
        defaultFontFamily: String?
    ): DocHeaderFooter {
        val rawElements = mutableListOf<RawHeaderElement>()
        val seenTextLines = HashSet<String>()
        val seenImages = HashSet<String>()

        val parser = Xml.newPullParser()
        parser.setFeature(XmlPullParser.FEATURE_PROCESS_NAMESPACES, true)

        ByteArrayInputStream(xmlBytes).use { input ->
            parser.setInput(input, "UTF-8")
            var eventType = parser.eventType
            var fallbackDepth = 0
            var inParagraph = false
            var inDrawing = false
            var drawingHidden = false
            var drawingBehindDoc = false
            val currentLine = StringBuilder()
            var currentFont: String? = null
            var pendingExtentWidthPt: Float? = null
            var pendingExtentHeightPt: Float? = null

            while (eventType != XmlPullParser.END_DOCUMENT) {
                val localName = parser.name.orEmpty()

                when (eventType) {
                    XmlPullParser.START_TAG -> {
                        if (localName == "Fallback") {
                            fallbackDepth++
                        } else if (fallbackDepth == 0) {
                            when (localName) {
                                "p" -> {
                                    inParagraph = true
                                    currentLine.clear()
                                    currentFont = defaultFontFamily
                                }
                                "drawing", "pict" -> {
                                    inDrawing = true
                                    drawingHidden = false
                                    drawingBehindDoc = false
                                    pendingExtentWidthPt = null
                                    pendingExtentHeightPt = null
                                }
                                "anchor" -> if (inDrawing) {
                                    val behind = findAttributeByLocalName(parser, "behindDoc")
                                    if (behind == "1" || behind.equals("true", ignoreCase = true)) {
                                        drawingBehindDoc = true
                                    }
                                }
                                "docPr" -> if (inDrawing) {
                                    val hidden = findAttributeByLocalName(parser, "hidden")
                                    if (hidden == "1" || hidden.equals("true", ignoreCase = true)) {
                                        drawingHidden = true
                                    }
                                }
                                "rFonts" -> if (inParagraph) {
                                    val font = findAttributeByLocalName(parser, "ascii")
                                        ?: findAttributeByLocalName(parser, "hAnsi")
                                    if (!font.isNullOrBlank()) currentFont = font
                                }
                                "extent" -> if (inDrawing) {
                                    val cx = findAttributeByLocalName(parser, "cx")?.toFloatOrNull()
                                    val cy = findAttributeByLocalName(parser, "cy")?.toFloatOrNull()
                                    if (cx != null && cy != null && cx > 0f && cy > 0f) {
                                        pendingExtentWidthPt = cx / EMU_PER_PT
                                        pendingExtentHeightPt = cy / EMU_PER_PT
                                    }
                                }
                                "t" -> if (inParagraph && !drawingHidden) {
                                    currentLine.append(parser.nextText())
                                }
                                "tab" -> if (inParagraph && !drawingHidden) {
                                    currentLine.append("  ")
                                }
                                "blip" -> if (!drawingHidden) {
                                    val rId = findAttributeByLocalName(parser, "embed")
                                    val path = rId?.let { rels[it] }?.let { cachedMedia[it] }
                                    if (!path.isNullOrBlank() && seenImages.add(path)) {
                                        rawElements.add(
                                            RawHeaderElement(
                                                element = HeaderFooterElement.Image(
                                                    imagePath = path,
                                                    widthPt = pendingExtentWidthPt,
                                                    heightPt = pendingExtentHeightPt
                                                ),
                                                isBehindDoc = drawingBehindDoc
                                            )
                                        )
                                        pendingExtentWidthPt = null
                                        pendingExtentHeightPt = null
                                    }
                                }
                                "imagedata" -> if (!drawingHidden) {
                                    val rId = findAttributeByLocalName(parser, "id")
                                    val path = rId?.let { rels[it] }?.let { cachedMedia[it] }
                                    if (!path.isNullOrBlank() && seenImages.add(path)) {
                                        rawElements.add(
                                            RawHeaderElement(
                                                element = HeaderFooterElement.Image(
                                                    imagePath = path,
                                                    widthPt = pendingExtentWidthPt,
                                                    heightPt = pendingExtentHeightPt
                                                ),
                                                isBehindDoc = drawingBehindDoc
                                            )
                                        )
                                        pendingExtentWidthPt = null
                                        pendingExtentHeightPt = null
                                    }
                                }
                            }
                        }
                    }

                    XmlPullParser.END_TAG -> {
                        if (localName == "Fallback" && fallbackDepth > 0) {
                            fallbackDepth--
                        } else if (fallbackDepth == 0) {
                            when (localName) {
                                "drawing", "pict" -> {
                                    inDrawing = false
                                    drawingHidden = false
                                    drawingBehindDoc = false
                                }
                                "p" -> if (inParagraph) {
                                    val trimmed = currentLine.toString().trim()
                                    if (trimmed.isNotEmpty() && seenTextLines.add(trimmed)) {
                                        rawElements.add(
                                            RawHeaderElement(
                                                element = HeaderFooterElement.TextLine(
                                                    text = trimmed,
                                                    fontFamilyName = currentFont
                                                )
                                            )
                                        )
                                    }
                                    inParagraph = false
                                }
                            }
                        }
                    }
                }
                eventType = parser.next()
            }
        }

        // If foreground header images exist, filter out covered behindDoc="1" template leftovers.
        val hasForegroundImage = rawElements.any { it.element is HeaderFooterElement.Image && !it.isBehindDoc }
        val filtered = rawElements.filter { raw ->
            !(raw.element is HeaderFooterElement.Image && raw.isBehindDoc && hasForegroundImage)
        }.map { it.element }

        return DocHeaderFooter(elements = filtered)
    }

    private fun parseRels(relsBytes: ByteArray): Map<String, String> {
        val map = mutableMapOf<String, String>()
        val parser = Xml.newPullParser()
        parser.setFeature(XmlPullParser.FEATURE_PROCESS_NAMESPACES, false)
        ByteArrayInputStream(relsBytes).use { input ->
            parser.setInput(input, "UTF-8")
            var eventType = parser.eventType
            while (eventType != XmlPullParser.END_DOCUMENT) {
                if (eventType == XmlPullParser.START_TAG && parser.name == "Relationship") {
                    val id = parser.getAttributeValue(null, "Id")
                    val target = parser.getAttributeValue(null, "Target")
                    if (!id.isNullOrBlank() && !target.isNullOrBlank()) {
                        val cleaned = target.replace('\\', '/')
                            .removePrefix("../")
                            .removePrefix("/")
                        val normalized = (if (cleaned.startsWith("word/")) cleaned else "word/$cleaned")
                            .lowercase(Locale.ROOT)
                        map[id] = normalized
                    }
                }
                eventType = parser.next()
            }
        }
        return map
    }

    private data class ParsedBodyResult(
        val blocks: List<DocBlock>,
        val pageMetrics: DocPageMetrics,
        val defaultHeaderTarget: String?,
        val defaultFooterTarget: String?
    )

    private suspend fun parseWordDocumentXml(
        xmlBytes: ByteArray,
        rels: Map<String, String>,
        cachedMedia: Map<String, String>,
        defaultFontFamily: String?
    ): ParsedBodyResult {
        val blocks = mutableListOf<DocBlock>()
        var pageMetrics = DocPageMetrics()
        var defaultHeaderTarget: String? = null
        var defaultFooterTarget: String? = null

        val parser = Xml.newPullParser()
        parser.setFeature(XmlPullParser.FEATURE_PROCESS_NAMESPACES, true)
        ByteArrayInputStream(xmlBytes).use { input ->
            parser.setInput(input, "UTF-8")

            var eventType = parser.eventType
            var fallbackDepth = 0
            var inParagraph = false
            var inDrawing = false
            var drawingHidden = false
            var inRun = false
            var inRunProps = false
            var inTableRow = false
            var inTableCell = false
            var inSectPr = false

            val paragraphRuns = mutableListOf<DocRun>()
            var headingLevel = 0
            var isBullet = false
            var alignment = DocTextAlignment.START
            var indentLeftPt = 0f
            var firstLineIndentPt = 0f
            var spaceBeforePt = 0f
            var spaceAfterPt = 4f
            val paragraphImages = mutableListOf<DocBlock.ImageBlock>()
            var pendingExtentW: Float? = null
            var pendingExtentH: Float? = null
            var hasPageBreak = false
            var consecutiveSpacers = 0

            val runText = StringBuilder()
            var runBold = false
            var runItalic = false
            var runUnderline = false
            var runFontSizePt: Float? = null
            var runColorArgb: Long? = null
            var runFontFamily: String? = defaultFontFamily

            var currentCellText = StringBuilder()
            val currentRowCells = mutableListOf<String>()

            while (eventType != XmlPullParser.END_DOCUMENT) {
                coroutineContext.ensureActive()
                val localName = parser.name.orEmpty()

                when (eventType) {
                    XmlPullParser.START_TAG -> {
                        if (localName == "Fallback") {
                            fallbackDepth++
                        } else if (fallbackDepth == 0) {
                            when (localName) {
                                "sectPr" -> inSectPr = true
                                "headerReference" -> if (inSectPr) {
                                    val type = findAttributeByLocalName(parser, "type")
                                    val rId = findAttributeByLocalName(parser, "id")
                                    val target = rId?.let { rels[it] }
                                    if (!target.isNullOrBlank() && (defaultHeaderTarget == null || type == "default")) {
                                        defaultHeaderTarget = target
                                    }
                                }
                                "footerReference" -> if (inSectPr) {
                                    val type = findAttributeByLocalName(parser, "type")
                                    val rId = findAttributeByLocalName(parser, "id")
                                    val target = rId?.let { rels[it] }
                                    if (!target.isNullOrBlank() && (defaultFooterTarget == null || type == "default")) {
                                        defaultFooterTarget = target
                                    }
                                }
                                "drawing", "pict" -> if (inParagraph) {
                                    inDrawing = true
                                    drawingHidden = false
                                }
                                "docPr" -> if (inDrawing) {
                                    val hidden = findAttributeByLocalName(parser, "hidden")
                                    if (hidden == "1" || hidden.equals("true", ignoreCase = true)) {
                                        drawingHidden = true
                                    }
                                }
                                "pgSz" -> if (inSectPr) {
                                    val wTwips = findAttributeByLocalName(parser, "w")?.toFloatOrNull()
                                    val hTwips = findAttributeByLocalName(parser, "h")?.toFloatOrNull()
                                    if (wTwips != null && hTwips != null && wTwips > 0f && hTwips > 0f) {
                                        pageMetrics = pageMetrics.copy(
                                            widthPt = (wTwips / TWIPS_PER_PT).coerceIn(300f, 1200f),
                                            heightPt = (hTwips / TWIPS_PER_PT).coerceIn(300f, 1600f)
                                        )
                                    }
                                }
                                "pgMar" -> if (inSectPr) {
                                    val top = findAttributeByLocalName(parser, "top")?.toFloatOrNull()?.div(TWIPS_PER_PT)
                                    val bottom = findAttributeByLocalName(parser, "bottom")?.toFloatOrNull()?.div(TWIPS_PER_PT)
                                    val left = findAttributeByLocalName(parser, "left")?.toFloatOrNull()?.div(TWIPS_PER_PT)
                                    val right = findAttributeByLocalName(parser, "right")?.toFloatOrNull()?.div(TWIPS_PER_PT)
                                    pageMetrics = pageMetrics.copy(
                                        marginTopPt = (top ?: pageMetrics.marginTopPt).coerceIn(18f, 144f),
                                        marginBottomPt = (bottom ?: pageMetrics.marginBottomPt).coerceIn(18f, 144f),
                                        marginLeftPt = (left ?: pageMetrics.marginLeftPt).coerceIn(18f, 144f),
                                        marginRightPt = (right ?: pageMetrics.marginRightPt).coerceIn(18f, 144f)
                                    )
                                }
                                "tr" -> {
                                    inTableRow = true
                                    currentRowCells.clear()
                                }
                                "tc" -> {
                                    inTableCell = true
                                    currentCellText = StringBuilder()
                                }
                                "p" -> {
                                    inParagraph = true
                                    paragraphRuns.clear()
                                    headingLevel = 0
                                    isBullet = false
                                    alignment = DocTextAlignment.START
                                    indentLeftPt = 0f
                                    firstLineIndentPt = 0f
                                    spaceBeforePt = 0f
                                    spaceAfterPt = 4f
                                    paragraphImages.clear()
                                    pendingExtentW = null
                                    pendingExtentH = null
                                    hasPageBreak = false
                                }
                                "pStyle" -> if (inParagraph) {
                                    val styleVal = findAttributeByLocalName(parser, "val")
                                    headingLevel = detectHeadingLevel(styleVal)
                                }
                                "jc" -> if (inParagraph) {
                                    alignment = parseAlignment(findAttributeByLocalName(parser, "val"))
                                }
                                "ind" -> if (inParagraph) {
                                    findAttributeByLocalName(parser, "left")?.toFloatOrNull()?.let {
                                        indentLeftPt = (it / TWIPS_PER_PT).coerceIn(0f, 180f)
                                    }
                                    findAttributeByLocalName(parser, "firstLine")?.toFloatOrNull()?.let {
                                        firstLineIndentPt = (it / TWIPS_PER_PT).coerceIn(0f, 72f)
                                    }
                                }
                                "spacing" -> if (inParagraph) {
                                    findAttributeByLocalName(parser, "before")?.toFloatOrNull()?.let {
                                        spaceBeforePt = (it / TWIPS_PER_PT).coerceIn(0f, 36f)
                                    }
                                    findAttributeByLocalName(parser, "after")?.toFloatOrNull()?.let {
                                        spaceAfterPt = (it / TWIPS_PER_PT).coerceIn(0f, 36f)
                                    }
                                }
                                "numPr" -> if (inParagraph) isBullet = true
                                "r" -> if (inParagraph) {
                                    inRun = true
                                    runText.clear()
                                    runBold = false
                                    runItalic = false
                                    runUnderline = false
                                    runFontSizePt = null
                                    runColorArgb = null
                                    runFontFamily = defaultFontFamily
                                }
                                "rPr" -> if (inRun) inRunProps = true
                                "rFonts" -> if (inRunProps) {
                                    val font = findAttributeByLocalName(parser, "ascii")
                                        ?: findAttributeByLocalName(parser, "hAnsi")
                                        ?: findAttributeByLocalName(parser, "cs")
                                    if (!font.isNullOrBlank()) runFontFamily = font
                                }
                                "b" -> if (inRunProps) {
                                    val boldVal = findAttributeByLocalName(parser, "val")
                                    if (boldVal != "0" && boldVal != "false") runBold = true
                                }
                                "i" -> if (inRunProps) {
                                    val italicVal = findAttributeByLocalName(parser, "val")
                                    if (italicVal != "0" && italicVal != "false") runItalic = true
                                }
                                "u" -> if (inRunProps) {
                                    val uVal = findAttributeByLocalName(parser, "val")
                                    if (uVal != "none") runUnderline = true
                                }
                                "sz" -> if (inRunProps) {
                                    findAttributeByLocalName(parser, "val")?.toFloatOrNull()?.let { halfPts ->
                                        if (halfPts > 0f) runFontSizePt = (halfPts / 2f).coerceIn(7f, 48f)
                                    }
                                }
                                "color" -> if (inRunProps) {
                                    val hex = findAttributeByLocalName(parser, "val")
                                    if (!hex.isNullOrBlank() && hex.length == 6 && !hex.equals("auto", ignoreCase = true)) {
                                        hex.toLongOrNull(16)?.let { rgb -> runColorArgb = 0xFF000000L or rgb }
                                    }
                                }
                                "extent" -> if (inParagraph) {
                                    val cx = findAttributeByLocalName(parser, "cx")?.toFloatOrNull()
                                    val cy = findAttributeByLocalName(parser, "cy")?.toFloatOrNull()
                                    if (cx != null && cy != null && cx > 0f && cy > 0f) {
                                        pendingExtentW = cx / EMU_PER_PT
                                        pendingExtentH = cy / EMU_PER_PT
                                    }
                                }
                                "tab" -> if (inRun) runText.append("\t")
                                "br" -> if (inParagraph) {
                                    val brType = findAttributeByLocalName(parser, "type")
                                    if (brType.equals("page", ignoreCase = true)) {
                                        hasPageBreak = true
                                    } else if (inRun) {
                                        runText.append("\n")
                                    }
                                }
                                "blip" -> if (inParagraph && !drawingHidden) {
                                    val rId = findAttributeByLocalName(parser, "embed")
                                    val path = rId?.let { rels[it] }?.let { cachedMedia[it] }
                                    if (!path.isNullOrBlank()) {
                                        paragraphImages.add(
                                            DocBlock.ImageBlock(
                                                imagePath = path,
                                                widthPt = pendingExtentW,
                                                heightPt = pendingExtentH
                                            )
                                        )
                                        pendingExtentW = null
                                        pendingExtentH = null
                                    }
                                }
                                "t" -> if (inRun) {
                                    val text = parser.nextText()
                                    if (text.isNotEmpty()) runText.append(text)
                                }
                            }
                        }
                    }

                    XmlPullParser.END_TAG -> {
                        if (localName == "Fallback" && fallbackDepth > 0) {
                            fallbackDepth--
                        } else if (fallbackDepth == 0) {
                            when (localName) {
                                "sectPr" -> inSectPr = false
                                "drawing", "pict" -> {
                                    inDrawing = false
                                    drawingHidden = false
                                }
                                "rPr" -> inRunProps = false
                                "r" -> if (inRun) {
                                    val text = runText.toString()
                                    if (text.isNotEmpty()) {
                                        paragraphRuns.add(
                                            DocRun(
                                                text = text,
                                                isBold = runBold,
                                                isItalic = runItalic,
                                                isUnderline = runUnderline,
                                                fontSizePt = runFontSizePt,
                                                colorArgb = runColorArgb,
                                                fontFamilyName = runFontFamily
                                            )
                                        )
                                    }
                                    inRun = false
                                }
                                "p" -> if (inParagraph) {
                                    val combined = paragraphRuns.joinToString("") { it.text }.trim()
                                    if (combined.isNotEmpty()) {
                                        consecutiveSpacers = 0
                                        if (inTableCell) {
                                            if (currentCellText.isNotEmpty()) currentCellText.append("\n")
                                            currentCellText.append(combined)
                                        } else if (headingLevel > 0) {
                                            blocks.add(
                                                DocBlock.Heading(
                                                    runs = paragraphRuns.toList(),
                                                    level = headingLevel,
                                                    alignment = alignment,
                                                    spaceBeforePt = spaceBeforePt.coerceAtLeast(6f),
                                                    spaceAfterPt = spaceAfterPt
                                                )
                                            )
                                        } else {
                                            blocks.add(
                                                DocBlock.Paragraph(
                                                    runs = paragraphRuns.toList(),
                                                    isBullet = isBullet,
                                                    alignment = alignment,
                                                    indentLeftPt = indentLeftPt,
                                                    firstLineIndentPt = firstLineIndentPt,
                                                    spaceBeforePt = spaceBeforePt,
                                                    spaceAfterPt = spaceAfterPt
                                                )
                                            )
                                        }
                                    } else if (!inTableCell && paragraphImages.isEmpty() && !hasPageBreak) {
                                        // Preserve empty <w:p/> spacer lines between sections (cap at 2 in a row)
                                        if (blocks.isNotEmpty() && consecutiveSpacers < 2) {
                                            blocks.add(DocBlock.Spacer(heightPt = 9f))
                                            consecutiveSpacers++
                                        }
                                    }
                                    if (!inTableCell) {
                                        if (paragraphImages.isNotEmpty()) {
                                            consecutiveSpacers = 0
                                            blocks.addAll(paragraphImages)
                                        }
                                        if (hasPageBreak) {
                                            consecutiveSpacers = 0
                                            blocks.add(DocBlock.PageBreak)
                                        }
                                    }
                                    inParagraph = false
                                }
                                "tc" -> if (inTableCell) {
                                    currentRowCells.add(currentCellText.toString().trim())
                                    inTableCell = false
                                }
                                "tr" -> if (inTableRow) {
                                    if (currentRowCells.any { it.isNotEmpty() }) {
                                        consecutiveSpacers = 0
                                        blocks.add(DocBlock.TableRow(currentRowCells.toList()))
                                    }
                                    inTableRow = false
                                }
                            }
                        }
                    }
                }
                eventType = parser.next()
            }
        }
        return ParsedBodyResult(
            blocks = blocks,
            pageMetrics = pageMetrics,
            defaultHeaderTarget = defaultHeaderTarget,
            defaultFooterTarget = defaultFooterTarget
        )
    }

    private fun parseAlignment(value: String?): DocTextAlignment = when (value?.lowercase(Locale.ROOT)) {
        "center" -> DocTextAlignment.CENTER
        "right", "end" -> DocTextAlignment.END
        "both", "distribute" -> DocTextAlignment.JUSTIFY
        else -> DocTextAlignment.START
    }

    private fun parseLegacyBinaryDoc(uri: Uri): ParsedDocumentContent {
        val stream = context.contentResolver.openInputStream(uri)
            ?: throw IOException("Unable to read legacy .doc file.")

        val bytes = stream.use { readBounded(it, MAX_LEGACY_SCAN_BYTES) }
        val extracted = extractReadableAsciiRuns(bytes)

        return if (extracted.isEmpty()) {
            ParsedDocumentContent(
                blocks = emptyList(),
                isLegacyFallback = true,
                noticeMessage = "Legacy binary .doc format is not fully supported offline. " +
                    "Convert this file to .docx or .pdf for full formatting."
            )
        } else {
            ParsedDocumentContent(
                blocks = extracted.map { DocBlock.Paragraph(runs = listOf(DocRun(text = it))) },
                isLegacyFallback = true,
                noticeMessage = "Showing plain-text preview for legacy .doc format. " +
                    "Convert to .docx for full layout fidelity."
            )
        }
    }

    private fun extractReadableAsciiRuns(bytes: ByteArray): List<String> {
        val paragraphs = mutableListOf<String>()
        val current = StringBuilder()

        for (b in bytes) {
            val ch = b.toInt() and 0xFF
            if (ch in 32..126 || ch == 9) {
                current.append(ch.toChar())
            } else if ((ch == 10 || ch == 13) && current.length >= 24) {
                val candidate = current.toString().trim()
                if (isLikelyNaturalText(candidate)) paragraphs.add(candidate)
                current.clear()
                if (paragraphs.size >= MAX_LEGACY_PARAGRAPHS) break
            } else {
                if (current.length >= 40) {
                    val candidate = current.toString().trim()
                    if (isLikelyNaturalText(candidate)) paragraphs.add(candidate)
                }
                current.clear()
                if (paragraphs.size >= MAX_LEGACY_PARAGRAPHS) break
            }
        }
        return paragraphs
    }

    private fun isLikelyNaturalText(text: String): Boolean {
        val letters = text.count { it.isLetter() }
        val spaces = text.count { it == ' ' }
        return letters > text.length * 0.55 && spaces >= 2
    }

    private fun detectHeadingLevel(styleVal: String?): Int {
        if (styleVal.isNullOrBlank()) return 0
        val normalized = styleVal.lowercase(Locale.ROOT)
        return when {
            normalized == "title" || normalized == "heading1" || normalized == "1" -> 1
            normalized == "subtitle" || normalized == "heading2" || normalized == "2" -> 2
            normalized.startsWith("heading") -> 3
            else -> 0
        }
    }

    private fun findAttributeByLocalName(parser: XmlPullParser, name: String): String? {
        for (i in 0 until parser.attributeCount) {
            if (parser.getAttributeName(i) == name) {
                return parser.getAttributeValue(i)
            }
        }
        return null
    }

    private fun writeMediaToCache(zip: ZipInputStream, dir: File, entryName: String): String? {
        val safeFileName = entryName.substringAfterLast('/')
            .replace(Regex("[^A-Za-z0-9._-]"), "_")
        if (safeFileName.isBlank()) return null

        val outFile = File(dir, safeFileName)
        if (outFile.exists() && outFile.length() > 0L) {
            return outFile.absolutePath
        }

        val buffer = ByteArray(8192)
        var total = 0
        FileOutputStream(outFile).use { fos ->
            while (true) {
                val read = zip.read(buffer)
                if (read <= 0) break
                total += read
                if (total > MAX_MEDIA_ENTRY_BYTES) {
                    fos.close()
                    outFile.delete()
                    return null
                }
                fos.write(buffer, 0, read)
            }
        }
        return outFile.absolutePath
    }

    private fun isSupportedImage(path: String): Boolean {
        val lower = path.lowercase(Locale.ROOT)
        return lower.endsWith(".png") ||
            lower.endsWith(".jpg") ||
            lower.endsWith(".jpeg") ||
            lower.endsWith(".webp") ||
            lower.endsWith(".gif")
    }

    private fun readBounded(input: java.io.InputStream, maxBytes: Int): ByteArray {
        val buffer = ByteArray(8192)
        val out = ByteArrayOutputStream()
        var total = 0
        while (true) {
            val read = input.read(buffer)
            if (read <= 0) break
            total += read
            if (total > maxBytes) {
                throw IOException("Document XML exceeds safe memory limit.")
            }
            out.write(buffer, 0, read)
        }
        return out.toByteArray()
    }

    companion object {
        private const val DOC_MEDIA_DIR = "doc_media"
        private const val TWIPS_PER_PT = 20f
        private const val EMU_PER_PT = 12700f
        private const val MAX_XML_BYTES = 16 * 1024 * 1024
        private const val MAX_RELS_BYTES = 2 * 1024 * 1024
        private const val MAX_MEDIA_ENTRY_BYTES = 8 * 1024 * 1024
        private const val MAX_LEGACY_SCAN_BYTES = 2 * 1024 * 1024
        private const val MAX_LEGACY_PARAGRAPHS = 300
    }
}
