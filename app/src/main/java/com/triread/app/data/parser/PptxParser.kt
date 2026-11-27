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

data class SlideParagraph(
    val text: String,
    val fontSizePt: Float = 18f,
    val isBold: Boolean = false,
    val isItalic: Boolean = false,
    val textColorArgb: Long? = null,
    val alignment: DocTextAlignment = DocTextAlignment.START,
    val isBullet: Boolean = false
)

sealed interface SlideElement {
    val xFraction: Float
    val yFraction: Float
    val widthFraction: Float
    val heightFraction: Float

    data class ImageElement(
        val imagePath: String,
        override val xFraction: Float,
        override val yFraction: Float,
        override val widthFraction: Float,
        override val heightFraction: Float
    ) : SlideElement

    data class ShapeTextElement(
        val paragraphs: List<SlideParagraph>,
        val fillColorArgb: Long? = null,
        val borderColorArgb: Long? = null,
        override val xFraction: Float,
        override val yFraction: Float,
        override val widthFraction: Float,
        override val heightFraction: Float
    ) : SlideElement

    data class TableElement(
        val rows: List<List<String>>,
        override val xFraction: Float,
        override val yFraction: Float,
        override val widthFraction: Float,
        override val heightFraction: Float
    ) : SlideElement
}

data class SlideItem(
    val slideNumber: Int,
    val backgroundColorArgb: Long? = null,
    val backgroundImagePath: String? = null,
    val elements: List<SlideElement> = emptyList(),
    val fallbackTitle: String? = null,
    val fallbackBodyLines: List<String> = emptyList(),
    val fallbackImagePaths: List<String> = emptyList(),
    val speakerNotes: String? = null
)

data class ParsedPresentation(
    val slides: List<SlideItem>,
    val slideWidthPt: Float = DEFAULT_SLIDE_WIDTH_PT,
    val slideHeightPt: Float = DEFAULT_SLIDE_HEIGHT_PT,
    val isLegacyUnsupported: Boolean = false,
    val noticeMessage: String? = null
) {
    val aspectRatio: Float
        get() = (slideWidthPt / slideHeightPt.coerceAtLeast(1f)).coerceIn(0.6f, 2.5f)
}

class PptxParser(
    private val context: Context,
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO
) {

    suspend fun parse(uriString: String, fileName: String): Result<ParsedPresentation> =
        withContext(ioDispatcher) {
            runCatching {
                val uri = Uri.parse(uriString)
                val isLegacyPpt = fileName.lowercase(Locale.ROOT).endsWith(".ppt")

                var presentationXml: ByteArray? = null
                val slideXmlMap = mutableMapOf<Int, ByteArray>()
                val slideRelsMap = mutableMapOf<Int, ByteArray>()
                val layoutXmlMap = mutableMapOf<String, ByteArray>()
                val layoutRelsMap = mutableMapOf<String, ByteArray>()
                val masterXmlMap = mutableMapOf<String, ByteArray>()
                val masterRelsMap = mutableMapOf<String, ByteArray>()
                val notesXmlMap = mutableMapOf<String, ByteArray>()

                val mediaCacheDir = File(
                    File(context.cacheDir, SLIDE_MEDIA_DIR),
                    IoExtensions.sha256Hex(uriString)
                ).apply { if (!exists()) mkdirs() }
                val cachedMediaByEntry = mutableMapOf<String, String>()

                val stream = context.contentResolver.openInputStream(uri)
                    ?: throw IOException("Unable to open presentation. File may have been moved or permission revoked.")

                var foundAnyZipEntry = false

                stream.use { raw ->
                    ZipInputStream(raw).use { zip ->
                        var entry = zip.nextEntry
                        while (entry != null) {
                            coroutineContext.ensureActive()
                            foundAnyZipEntry = true
                            val name = entry.name
                            val lower = name.lowercase(Locale.ROOT)

                            if (!entry.isDirectory) {
                                val slideMatch = SLIDE_XML_REGEX.matchEntire(name)
                                val slideRelsMatch = SLIDE_RELS_REGEX.matchEntire(name)
                                val notesMatch = NOTES_XML_REGEX.matchEntire(name)

                                when {
                                    lower == "ppt/presentation.xml" -> {
                                        presentationXml = readBounded(zip, MAX_XML_ENTRY_BYTES)
                                    }
                                    slideMatch != null -> {
                                        slideMatch.groupValues[1].toIntOrNull()?.let { idx ->
                                            slideXmlMap[idx] = readBounded(zip, MAX_XML_ENTRY_BYTES)
                                        }
                                    }
                                    slideRelsMatch != null -> {
                                        slideRelsMatch.groupValues[1].toIntOrNull()?.let { idx ->
                                            slideRelsMap[idx] = readBounded(zip, MAX_XML_ENTRY_BYTES)
                                        }
                                    }
                                    lower.startsWith("ppt/slidelayouts/") && lower.endsWith(".xml") -> {
                                        layoutXmlMap[lower] = readBounded(zip, MAX_XML_ENTRY_BYTES)
                                    }
                                    lower.startsWith("ppt/slidelayouts/_rels/") && lower.endsWith(".rels") -> {
                                        val xmlPath = lower
                                            .replace("/_rels/", "/")
                                            .removeSuffix(".rels")
                                        layoutRelsMap[xmlPath] = readBounded(zip, MAX_XML_ENTRY_BYTES)
                                    }
                                    lower.startsWith("ppt/slidemasters/") && lower.endsWith(".xml") -> {
                                        masterXmlMap[lower] = readBounded(zip, MAX_XML_ENTRY_BYTES)
                                    }
                                    lower.startsWith("ppt/slidemasters/_rels/") && lower.endsWith(".rels") -> {
                                        val xmlPath = lower
                                            .replace("/_rels/", "/")
                                            .removeSuffix(".rels")
                                        masterRelsMap[xmlPath] = readBounded(zip, MAX_XML_ENTRY_BYTES)
                                    }
                                    notesMatch != null -> {
                                        notesXmlMap[lower] = readBounded(zip, MAX_XML_ENTRY_BYTES)
                                    }
                                    lower.startsWith("ppt/media/") && isSupportedImage(lower) -> {
                                        writeMediaToCache(zip, mediaCacheDir, name)?.let { saved ->
                                            cachedMediaByEntry[lower] = saved
                                        }
                                    }
                                }
                            }
                            zip.closeEntry()
                            entry = zip.nextEntry
                        }
                    }
                }

                if (!foundAnyZipEntry && isLegacyPpt) {
                    return@runCatching ParsedPresentation(
                        slides = emptyList(),
                        isLegacyUnsupported = true,
                        noticeMessage = "Legacy binary .ppt format is not supported offline. " +
                            "Please save or export this presentation as .pptx or .pdf."
                    )
                }

                if (slideXmlMap.isEmpty()) {
                    throw IOException("No slides found in this presentation file.")
                }

                val (slideWidthEmu, slideHeightEmu) = presentationXml
                    ?.let { parseSlideSizeEmu(it) }
                    ?: (DEFAULT_SLIDE_WIDTH_EMU to DEFAULT_SLIDE_HEIGHT_EMU)

                val slideWidthPt = slideWidthEmu / EMU_PER_POINT
                val slideHeightPt = slideHeightEmu / EMU_PER_POINT

                // Pre-parse master/layout backgrounds & decorative pictures.
                val layoutLayers = layoutXmlMap.mapValues { (xmlPath, bytes) ->
                    val rels = layoutRelsMap[xmlPath]?.let { parseRels(it, "ppt/slideLayouts") }.orEmpty()
                    val parsed = parseSlideLayer(bytes, rels, cachedMediaByEntry, slideWidthEmu, slideHeightEmu, includeText = false)
                    val masterPath = rels.values.firstOrNull { it.contains("slidemasters/", ignoreCase = true) }
                    LayerInfo(parsed, masterPath)
                }

                val masterLayers = masterXmlMap.mapValues { (xmlPath, bytes) ->
                    val rels = masterRelsMap[xmlPath]?.let { parseRels(it, "ppt/slideMasters") }.orEmpty()
                    parseSlideLayer(bytes, rels, cachedMediaByEntry, slideWidthEmu, slideHeightEmu, includeText = false)
                }

                val orderedSlides = slideXmlMap.keys.sorted().map { slideNum ->
                    coroutineContext.ensureActive()
                    val rels = slideRelsMap[slideNum]?.let { parseRels(it, "ppt/slides") }.orEmpty()
                    val slideParsed = parseSlideLayer(
                        xmlBytes = slideXmlMap.getValue(slideNum),
                        rels = rels,
                        cachedMedia = cachedMediaByEntry,
                        slideWidthEmu = slideWidthEmu,
                        slideHeightEmu = slideHeightEmu,
                        includeText = true
                    )

                    // Resolve inherited background/decorative shapes from slideLayout -> slideMaster
                    val layoutPath = rels.values.firstOrNull { it.contains("slidelayouts/", ignoreCase = true) }
                    val layoutInfo = layoutPath?.let { layoutLayers[it] }
                    val masterLayer = layoutInfo?.masterPath?.let { masterLayers[it] }

                    val bgColor = slideParsed.backgroundColorArgb
                        ?: layoutInfo?.layer?.backgroundColorArgb
                        ?: masterLayer?.backgroundColorArgb
                    val bgImage = slideParsed.backgroundImagePath
                        ?: layoutInfo?.layer?.backgroundImagePath
                        ?: masterLayer?.backgroundImagePath

                    val combinedElements = buildList {
                        // Decorative master/layout images & filled shapes behind slide content
                        masterLayer?.elements?.let { addAll(it) }
                        layoutInfo?.layer?.elements?.let { addAll(it) }
                        addAll(slideParsed.elements)
                    }

                    val notesTarget = rels.values.firstOrNull {
                        it.contains("notesslides/", ignoreCase = true)
                    }
                    val notesText = notesTarget?.let { target ->
                        notesXmlMap[target]?.let { extractPlainTextFromXml(it) }
                    }?.takeIf { it.isNotBlank() }

                    val fallbackTitle = slideParsed.fallbackParagraphs.firstOrNull()
                    val fallbackBody = if (slideParsed.fallbackParagraphs.size > 1) {
                        slideParsed.fallbackParagraphs.drop(1)
                    } else {
                        emptyList()
                    }

                    SlideItem(
                        slideNumber = slideNum,
                        backgroundColorArgb = bgColor,
                        backgroundImagePath = bgImage,
                        elements = combinedElements,
                        fallbackTitle = fallbackTitle,
                        fallbackBodyLines = fallbackBody,
                        fallbackImagePaths = slideParsed.fallbackImages,
                        speakerNotes = notesText
                    )
                }

                ParsedPresentation(
                    slides = orderedSlides,
                    slideWidthPt = slideWidthPt,
                    slideHeightPt = slideHeightPt
                )
            }
        }

    private data class LayerInfo(
        val layer: ParsedSlideLayer,
        val masterPath: String?
    )

    private data class ParsedSlideLayer(
        val backgroundColorArgb: Long?,
        val backgroundImagePath: String?,
        val elements: List<SlideElement>,
        val fallbackParagraphs: List<String>,
        val fallbackImages: List<String>
    )

    private fun parseSlideSizeEmu(presentationXml: ByteArray): Pair<Long, Long> {
        val parser = Xml.newPullParser()
        parser.setFeature(XmlPullParser.FEATURE_PROCESS_NAMESPACES, true)
        ByteArrayInputStream(presentationXml).use { input ->
            parser.setInput(input, "UTF-8")
            var eventType = parser.eventType
            while (eventType != XmlPullParser.END_DOCUMENT) {
                if (eventType == XmlPullParser.START_TAG && parser.name == "sldSz") {
                    val cx = findAttributeByLocalName(parser, "cx")?.toLongOrNull()
                    val cy = findAttributeByLocalName(parser, "cy")?.toLongOrNull()
                    if (cx != null && cy != null && cx > 0L && cy > 0L) {
                        return cx to cy
                    }
                }
                eventType = parser.next()
            }
        }
        return DEFAULT_SLIDE_WIDTH_EMU to DEFAULT_SLIDE_HEIGHT_EMU
    }

    private fun parseSlideLayer(
        xmlBytes: ByteArray,
        rels: Map<String, String>,
        cachedMedia: Map<String, String>,
        slideWidthEmu: Long,
        slideHeightEmu: Long,
        includeText: Boolean
    ): ParsedSlideLayer {
        val elements = mutableListOf<SlideElement>()
        val fallbackParagraphs = mutableListOf<String>()
        val fallbackImages = mutableListOf<String>()

        var bgColorArgb: Long? = null
        var bgImagePath: String? = null

        val parser = Xml.newPullParser()
        parser.setFeature(XmlPullParser.FEATURE_PROCESS_NAMESPACES, true)

        ByteArrayInputStream(xmlBytes).use { input ->
            parser.setInput(input, "UTF-8")

            var eventType = parser.eventType
            var inBg = false
            var inShape = false
            var inPic = false
            var inGraphicFrame = false
            var inSpPr = false
            var inLn = false
            var inTxBody = false
            var inParagraph = false
            var inRunProps = false
            var inTable = false
            var inTableRow = false
            var inTableCell = false

            var xEmu = 0L
            var yEmu = 0L
            var cxEmu = 0L
            var cyEmu = 0L
            var hasTransform = false
            var placeholderType: String? = null

            var shapeFillArgb: Long? = null
            var shapeBorderArgb: Long? = null
            var picEmbedId: String? = null

            val shapeParagraphs = mutableListOf<SlideParagraph>()
            val currentText = StringBuilder()
            var pAlign = DocTextAlignment.START
            var pIsBullet = false
            var runFontSizePt = 18f
            var runBold = false
            var runItalic = false
            var runColorArgb: Long? = null

            val tableRows = mutableListOf<List<String>>()
            val currentRowCells = mutableListOf<String>()
            val currentCellText = StringBuilder()

            while (eventType != XmlPullParser.END_DOCUMENT) {
                val localName = parser.name.orEmpty()

                when (eventType) {
                    XmlPullParser.START_TAG -> when (localName) {
                        "bg" -> inBg = true
                        "sp" -> {
                            inShape = true
                            xEmu = 0L; yEmu = 0L; cxEmu = 0L; cyEmu = 0L
                            hasTransform = false
                            placeholderType = null
                            shapeFillArgb = null
                            shapeBorderArgb = null
                            shapeParagraphs.clear()
                        }
                        "pic" -> {
                            inPic = true
                            xEmu = 0L; yEmu = 0L; cxEmu = 0L; cyEmu = 0L
                            hasTransform = false
                            picEmbedId = null
                        }
                        "graphicFrame" -> {
                            inGraphicFrame = true
                            xEmu = 0L; yEmu = 0L; cxEmu = 0L; cyEmu = 0L
                            hasTransform = false
                            tableRows.clear()
                        }
                        "ph" -> if (inShape) {
                            placeholderType = findAttributeByLocalName(parser, "type")
                        }
                        "spPr" -> inSpPr = true
                        "ln" -> if (inSpPr) inLn = true
                        "txBody" -> inTxBody = true
                        "tbl" -> if (inGraphicFrame) inTable = true
                        "tr" -> if (inTable) {
                            inTableRow = true
                            currentRowCells.clear()
                        }
                        "tc" -> if (inTableRow) {
                            inTableCell = true
                            currentCellText.clear()
                        }
                        "off" -> if (inShape || inPic || inGraphicFrame) {
                            val x = findAttributeByLocalName(parser, "x")?.toLongOrNull()
                            val y = findAttributeByLocalName(parser, "y")?.toLongOrNull()
                            if (x != null && y != null) {
                                xEmu = x; yEmu = y; hasTransform = true
                            }
                        }
                        "ext" -> if (inShape || inPic || inGraphicFrame) {
                            val cx = findAttributeByLocalName(parser, "cx")?.toLongOrNull()
                            val cy = findAttributeByLocalName(parser, "cy")?.toLongOrNull()
                            if (cx != null && cy != null && cx > 0L && cy > 0L) {
                                cxEmu = cx; cyEmu = cy
                            }
                        }
                        "srgbClr" -> {
                            val hex = findAttributeByLocalName(parser, "val")
                            val parsedColor = parseRgbHex(hex)
                            if (parsedColor != null) {
                                when {
                                    inBg && bgColorArgb == null -> bgColorArgb = parsedColor
                                    inRunProps && runColorArgb == null -> runColorArgb = parsedColor
                                    inSpPr && inLn && shapeBorderArgb == null -> shapeBorderArgb = parsedColor
                                    inSpPr && !inLn && shapeFillArgb == null -> shapeFillArgb = parsedColor
                                }
                            }
                        }
                        "blip" -> {
                            val rId = findAttributeByLocalName(parser, "embed")
                            if (inBg && rId != null) {
                                bgImagePath = rels[rId]?.let { cachedMedia[it] }
                            } else if (inPic && rId != null) {
                                picEmbedId = rId
                            }
                        }
                        "p" -> if (inTxBody || inTableCell) {
                            inParagraph = true
                            currentText.clear()
                            pAlign = DocTextAlignment.START
                            pIsBullet = false
                            runFontSizePt = defaultFontSizeForPlaceholder(placeholderType)
                            runBold = placeholderType == "title" || placeholderType == "ctrTitle"
                            runItalic = false
                            runColorArgb = null
                        }
                        "pPr" -> if (inParagraph) {
                            pAlign = parsePptAlignment(findAttributeByLocalName(parser, "algn"))
                        }
                        "buChar", "buAutoNum" -> if (inParagraph) {
                            pIsBullet = true
                        }
                        "buNone" -> if (inParagraph) {
                            pIsBullet = false
                        }
                        "rPr", "defRPr" -> if (inParagraph) {
                            inRunProps = true
                            findAttributeByLocalName(parser, "sz")?.toIntOrNull()?.let { sz ->
                                if (sz > 0) runFontSizePt = (sz / 100f).coerceIn(8f, 72f)
                            }
                            findAttributeByLocalName(parser, "b")?.let { b ->
                                if (b == "1" || b == "true") runBold = true
                            }
                            findAttributeByLocalName(parser, "i")?.let { i ->
                                if (i == "1" || i == "true") runItalic = true
                            }
                        }
                        "br" -> if (inParagraph) currentText.append("\n")
                        "t" -> if (inParagraph) {
                            currentText.append(parser.nextText())
                        }
                    }

                    XmlPullParser.END_TAG -> when (localName) {
                        "bg" -> inBg = false
                        "spPr" -> inSpPr = false
                        "ln" -> inLn = false
                        "txBody" -> inTxBody = false
                        "rPr", "defRPr" -> inRunProps = false
                        "p" -> if (inParagraph) {
                            val line = currentText.toString().trim()
                            if (line.isNotEmpty()) {
                                if (inTableCell) {
                                    if (currentCellText.isNotEmpty()) currentCellText.append("\n")
                                    currentCellText.append(line)
                                } else if (includeText) {
                                    shapeParagraphs.add(
                                        SlideParagraph(
                                            text = line,
                                            fontSizePt = runFontSizePt,
                                            isBold = runBold,
                                            isItalic = runItalic,
                                            textColorArgb = runColorArgb,
                                            alignment = pAlign,
                                            isBullet = pIsBullet
                                        )
                                    )
                                    fallbackParagraphs.add(line)
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
                                tableRows.add(currentRowCells.toList())
                            }
                            inTableRow = false
                        }
                        "tbl" -> inTable = false
                        "pic" -> {
                            val imgPath = picEmbedId?.let { rels[it] }?.let { cachedMedia[it] }
                            if (!imgPath.isNullOrBlank()) {
                                fallbackImages.add(imgPath)
                                if (hasTransform && cxEmu > 0L && cyEmu > 0L) {
                                    elements.add(
                                        SlideElement.ImageElement(
                                            imagePath = imgPath,
                                            xFraction = (xEmu.toFloat() / slideWidthEmu).coerceIn(-0.2f, 1.1f),
                                            yFraction = (yEmu.toFloat() / slideHeightEmu).coerceIn(-0.2f, 1.1f),
                                            widthFraction = (cxEmu.toFloat() / slideWidthEmu).coerceIn(0.02f, 1.4f),
                                            heightFraction = (cyEmu.toFloat() / slideHeightEmu).coerceIn(0.02f, 1.4f)
                                        )
                                    )
                                }
                            }
                            inPic = false
                        }
                        "sp" -> {
                            val resolvedBounds = resolveShapeBounds(
                                hasTransform = hasTransform,
                                xEmu = xEmu,
                                yEmu = yEmu,
                                cxEmu = cxEmu,
                                cyEmu = cyEmu,
                                placeholderType = placeholderType,
                                slideWidthEmu = slideWidthEmu,
                                slideHeightEmu = slideHeightEmu
                            )
                            val shouldAdd = (includeText && shapeParagraphs.isNotEmpty()) ||
                                (shapeFillArgb != null && resolvedBounds != null)

                            if (shouldAdd && resolvedBounds != null) {
                                elements.add(
                                    SlideElement.ShapeTextElement(
                                        paragraphs = if (includeText) shapeParagraphs.toList() else emptyList(),
                                        fillColorArgb = shapeFillArgb,
                                        borderColorArgb = shapeBorderArgb,
                                        xFraction = resolvedBounds.x,
                                        yFraction = resolvedBounds.y,
                                        widthFraction = resolvedBounds.w,
                                        heightFraction = resolvedBounds.h
                                    )
                                )
                            }
                            inShape = false
                        }
                        "graphicFrame" -> {
                            if (includeText && tableRows.isNotEmpty() && hasTransform && cxEmu > 0L && cyEmu > 0L) {
                                elements.add(
                                    SlideElement.TableElement(
                                        rows = tableRows.toList(),
                                        xFraction = (xEmu.toFloat() / slideWidthEmu).coerceIn(0f, 0.95f),
                                        yFraction = (yEmu.toFloat() / slideHeightEmu).coerceIn(0f, 0.95f),
                                        widthFraction = (cxEmu.toFloat() / slideWidthEmu).coerceIn(0.1f, 1f),
                                        heightFraction = (cyEmu.toFloat() / slideHeightEmu).coerceIn(0.08f, 1f)
                                    )
                                )
                            }
                            inGraphicFrame = false
                        }
                    }
                }
                eventType = parser.next()
            }
        }

        return ParsedSlideLayer(
            backgroundColorArgb = bgColorArgb,
            backgroundImagePath = bgImagePath,
            elements = elements,
            fallbackParagraphs = fallbackParagraphs,
            fallbackImages = fallbackImages
        )
    }

    private data class NormalizedBounds(val x: Float, val y: Float, val w: Float, val h: Float)

    private fun resolveShapeBounds(
        hasTransform: Boolean,
        xEmu: Long,
        yEmu: Long,
        cxEmu: Long,
        cyEmu: Long,
        placeholderType: String?,
        slideWidthEmu: Long,
        slideHeightEmu: Long
    ): NormalizedBounds? {
        if (hasTransform && cxEmu > 0L && cyEmu > 0L) {
            return NormalizedBounds(
                x = (xEmu.toFloat() / slideWidthEmu).coerceIn(-0.1f, 0.98f),
                y = (yEmu.toFloat() / slideHeightEmu).coerceIn(-0.1f, 0.98f),
                w = (cxEmu.toFloat() / slideWidthEmu).coerceIn(0.04f, 1.2f),
                h = (cyEmu.toFloat() / slideHeightEmu).coerceIn(0.03f, 1.2f)
            )
        }
        // Standard PowerPoint placeholder defaults when a slide inherits geometry from its layout.
        return when (placeholderType) {
            "ctrTitle" -> NormalizedBounds(0.08f, 0.22f, 0.84f, 0.24f)
            "subTitle" -> NormalizedBounds(0.12f, 0.48f, 0.76f, 0.28f)
            "title" -> NormalizedBounds(0.06f, 0.05f, 0.88f, 0.14f)
            "body", "obj" -> NormalizedBounds(0.06f, 0.22f, 0.88f, 0.68f)
            "ftr", "dt", "sldNum" -> NormalizedBounds(0.05f, 0.91f, 0.90f, 0.07f)
            else -> null
        }
    }

    private fun defaultFontSizeForPlaceholder(placeholderType: String?): Float = when (placeholderType) {
        "ctrTitle" -> 34f
        "title" -> 28f
        "subTitle" -> 20f
        "ftr", "dt", "sldNum" -> 11f
        else -> 18f
    }

    private fun parsePptAlignment(algn: String?): DocTextAlignment = when (algn?.lowercase(Locale.ROOT)) {
        "ctr" -> DocTextAlignment.CENTER
        "r" -> DocTextAlignment.END
        "just", "dist" -> DocTextAlignment.JUSTIFY
        else -> DocTextAlignment.START
    }

    private fun parseRgbHex(hex: String?): Long? {
        if (hex.isNullOrBlank() || hex.length != 6) return null
        val rgb = hex.toLongOrNull(16) ?: return null
        return 0xFF000000L or rgb
    }

    private fun parseRels(relsBytes: ByteArray, baseFolder: String): Map<String, String> {
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
                        map[id] = normalizePptTarget(target, baseFolder)
                    }
                }
                eventType = parser.next()
            }
        }
        return map
    }

    private fun extractPlainTextFromXml(xmlBytes: ByteArray): String {
        val lines = mutableListOf<String>()
        val parser = Xml.newPullParser()
        parser.setFeature(XmlPullParser.FEATURE_PROCESS_NAMESPACES, true)
        ByteArrayInputStream(xmlBytes).use { input ->
            parser.setInput(input, "UTF-8")
            var eventType = parser.eventType
            var inParagraph = false
            val sb = StringBuilder()

            while (eventType != XmlPullParser.END_DOCUMENT) {
                val localName = parser.name.orEmpty()
                when (eventType) {
                    XmlPullParser.START_TAG -> when (localName) {
                        "p" -> {
                            inParagraph = true
                            sb.clear()
                        }
                        "t" -> if (inParagraph) sb.append(parser.nextText())
                    }
                    XmlPullParser.END_TAG -> if (localName == "p" && inParagraph) {
                        val text = sb.toString().trim()
                        if (text.isNotEmpty() && text.toIntOrNull() == null) {
                            lines.add(text)
                        }
                        inParagraph = false
                    }
                }
                eventType = parser.next()
            }
        }
        return lines.joinToString("\n\n")
    }

    private fun normalizePptTarget(rawTarget: String, baseFolder: String): String {
        val cleaned = rawTarget.replace('\\', '/')
        val resolved = when {
            cleaned.startsWith("../") -> "ppt/${cleaned.removePrefix("../")}"
            cleaned.startsWith("/ppt/") -> cleaned.removePrefix("/")
            cleaned.startsWith("ppt/") -> cleaned
            else -> "$baseFolder/$cleaned"
        }
        return resolved.lowercase(Locale.ROOT)
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

    private fun readBounded(zip: ZipInputStream, maxBytes: Int): ByteArray {
        val buffer = ByteArray(8192)
        val out = ByteArrayOutputStream()
        var total = 0
        while (true) {
            val read = zip.read(buffer)
            if (read <= 0) break
            total += read
            if (total > maxBytes) {
                throw IOException("Presentation XML entry exceeds safe memory limit.")
            }
            out.write(buffer, 0, read)
        }
        return out.toByteArray()
    }

    private fun findAttributeByLocalName(parser: XmlPullParser, name: String): String? {
        for (i in 0 until parser.attributeCount) {
            if (parser.getAttributeName(i) == name) {
                return parser.getAttributeValue(i)
            }
        }
        return null
    }

    private fun isSupportedImage(path: String): Boolean {
        val lower = path.lowercase(Locale.ROOT)
        return lower.endsWith(".png") ||
            lower.endsWith(".jpg") ||
            lower.endsWith(".jpeg") ||
            lower.endsWith(".webp") ||
            lower.endsWith(".gif")
    }

    companion object {
        private const val SLIDE_MEDIA_DIR = "slide_media"
        private const val MAX_XML_ENTRY_BYTES = 4 * 1024 * 1024
        private const val MAX_MEDIA_ENTRY_BYTES = 10 * 1024 * 1024
        private const val EMU_PER_POINT = 12700f
        private const val DEFAULT_SLIDE_WIDTH_EMU = 12192000L // 16:9 widescreen (960pt)
        private const val DEFAULT_SLIDE_HEIGHT_EMU = 6858000L // 16:9 widescreen (540pt)
        private const val DEFAULT_SLIDE_WIDTH_PT = 960f
        private const val DEFAULT_SLIDE_HEIGHT_PT = 540f

        private val SLIDE_XML_REGEX = Regex("^ppt/slides/slide(\\d+)\\.xml$", RegexOption.IGNORE_CASE)
        private val SLIDE_RELS_REGEX = Regex("^ppt/slides/_rels/slide(\\d+)\\.xml\\.rels$", RegexOption.IGNORE_CASE)
        private val NOTES_XML_REGEX = Regex("^ppt/notesSlides/notesSlide(\\d+)\\.xml$", RegexOption.IGNORE_CASE)
    }
}
