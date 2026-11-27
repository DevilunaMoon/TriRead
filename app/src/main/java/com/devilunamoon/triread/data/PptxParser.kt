package com.devilunamoon.triread.data

import android.graphics.Bitmap
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.xmlpull.v1.XmlPullParser
import org.xmlpull.v1.XmlPullParserFactory
import java.io.File
import java.io.InputStream
import java.util.zip.ZipFile

data class SlideContent(
    val slideNumber: Int,
    val title: String?,
    val paragraphs: List<String>,
    val images: List<Bitmap>
)

data class ParsedPptResult(
    val slides: List<SlideContent>,
    val isLegacyFormat: Boolean = false,
    val warningMessage: String? = null
)

object PptxParser {

    private val slideRegex = Regex("^ppt/slides/slide(\\d+)\\.xml$")

    suspend fun parse(file: File): ParsedPptResult = withContext(Dispatchers.IO) {
        if (file.extension.equals("ppt", ignoreCase = true)) {
            return@withContext ParsedPptResult(
                slides = emptyList(),
                isLegacyFormat = true,
                warningMessage = "Legacy .ppt (97–2003) binary presentations are not rendered natively. Convert to .pptx or tap 'Open externally' above."
            )
        }

        try {
            ZipFile(file).use { zip ->
                val slidePaths = resolveOrderedSlidePaths(zip)
                if (slidePaths.isEmpty()) {
                    return@withContext ParsedPptResult(
                        slides = emptyList(),
                        warningMessage = "No slides found inside this .pptx file."
                    )
                }

                val slides = slidePaths.mapIndexed { index, slidePath ->
                    val slideFileName = slidePath.substringAfterLast('/')
                    val relsPath = "ppt/slides/_rels/$slideFileName.rels"
                    val rels = parseRels(zip, relsPath)

                    val entry = zip.getEntry(slidePath)
                    if (entry == null) {
                        SlideContent(index + 1, null, emptyList(), emptyList())
                    } else {
                        zip.getInputStream(entry).use { stream ->
                            parseSlideXml(index + 1, stream, zip, rels)
                        }
                    }
                }

                ParsedPptResult(slides = slides)
            }
        } catch (e: Exception) {
            ParsedPptResult(
                slides = emptyList(),
                warningMessage = "Unable to open this presentation offline: ${e.localizedMessage ?: "Unsupported format"}"
            )
        }
    }

    private fun resolveOrderedSlidePaths(zip: ZipFile): List<String> {
        val presRels = parseRels(zip, "ppt/_rels/presentation.xml.rels")
        val presEntry = zip.getEntry("ppt/presentation.xml")
        val ordered = mutableListOf<String>()

        if (presEntry != null && presRels.isNotEmpty()) {
            try {
                val parser = XmlPullParserFactory.newInstance().apply { isNamespaceAware = false }.newPullParser()
                zip.getInputStream(presEntry).use { stream ->
                    parser.setInput(stream, "UTF-8")
                    var event = parser.eventType
                    while (event != XmlPullParser.END_DOCUMENT) {
                        if (event == XmlPullParser.START_TAG && parser.name == "p:sldId") {
                            val rId = parser.getAttributeValue(null, "r:id")
                            val target = presRels[rId]
                            if (!target.isNullOrBlank()) {
                                val fullPath = normalizeZipPath("ppt/", target)
                                if (zip.getEntry(fullPath) != null) {
                                    ordered.add(fullPath)
                                }
                            }
                        }
                        event = parser.next()
                    }
                }
            } catch (_: Exception) {
                // Fall back to numeric slide sorting below
            }
        }

        if (ordered.isNotEmpty()) return ordered

        val fallback = mutableListOf<Pair<Int, String>>()
        val entries = zip.entries()
        while (entries.hasMoreElements()) {
            val name = entries.nextElement().name
            val match = slideRegex.matchEntire(name)
            if (match != null) {
                val num = match.groupValues[1].toIntOrNull() ?: continue
                fallback.add(num to name)
            }
        }
        return fallback.sortedBy { it.first }.map { it.second }
    }

    private fun parseRels(zip: ZipFile, relsPath: String): Map<String, String> {
        val entry = zip.getEntry(relsPath) ?: return emptyMap()
        val map = mutableMapOf<String, String>()
        try {
            val parser = XmlPullParserFactory.newInstance().apply { isNamespaceAware = false }.newPullParser()
            zip.getInputStream(entry).use { stream ->
                parser.setInput(stream, "UTF-8")
                var event = parser.eventType
                while (event != XmlPullParser.END_DOCUMENT) {
                    if (event == XmlPullParser.START_TAG && parser.name.endsWith("Relationship")) {
                        val id = parser.getAttributeValue(null, "Id")
                        val target = parser.getAttributeValue(null, "Target")
                        if (!id.isNullOrBlank() && !target.isNullOrBlank()) {
                            map[id] = target
                        }
                    }
                    event = parser.next()
                }
            }
        } catch (_: Exception) {
            // Ignore
        }
        return map
    }

    private fun parseSlideXml(
        slideNumber: Int,
        stream: InputStream,
        zip: ZipFile,
        rels: Map<String, String>
    ): SlideContent {
        val parser = XmlPullParserFactory.newInstance().apply { isNamespaceAware = false }.newPullParser()
        parser.setInput(stream, "UTF-8")

        var inParagraph = false
        var inText = false
        var isTitleShape = false
        val paragraphBuilder = StringBuilder()

        var title: String? = null
        val paragraphs = mutableListOf<String>()
        val images = mutableListOf<Bitmap>()
        val seenImageTargets = mutableSetOf<String>()

        var event = parser.eventType
        while (event != XmlPullParser.END_DOCUMENT) {
            when (event) {
                XmlPullParser.START_TAG -> {
                    when (parser.name) {
                        "p:sp" -> isTitleShape = false
                        "p:ph" -> {
                            val type = parser.getAttributeValue(null, "type") ?: ""
                            if (type == "title" || type == "ctrTitle") {
                                isTitleShape = true
                            }
                        }
                        "a:p" -> {
                            inParagraph = true
                            paragraphBuilder.clear()
                        }
                        "a:t" -> inText = true
                        "a:br" -> if (inParagraph) paragraphBuilder.append("\n")
                        "a:blip" -> {
                            val embedId = parser.getAttributeValue(null, "r:embed")
                            val target = if (!embedId.isNullOrBlank()) rels[embedId] else null
                            if (!target.isNullOrBlank() && seenImageTargets.add(target)) {
                                val fullPath = normalizeZipPath("ppt/slides/", target)
                                DocxParser.decodeZipBitmap(zip, fullPath)?.let { bmp ->
                                    images.add(bmp)
                                }
                            }
                        }
                    }
                }

                XmlPullParser.TEXT -> {
                    if (inText && inParagraph) {
                        paragraphBuilder.append(parser.text ?: "")
                    }
                }

                XmlPullParser.END_TAG -> {
                    when (parser.name) {
                        "a:t" -> inText = false
                        "a:p" -> {
                            val text = paragraphBuilder.toString().trim()
                            if (text.isNotEmpty()) {
                                if (isTitleShape && title == null) {
                                    title = text
                                } else {
                                    paragraphs.add(text)
                                }
                            }
                            inParagraph = false
                        }
                    }
                }
            }
            event = parser.next()
        }

        // If no explicit title placeholder was found, promote the first short line as title
        if (title == null && paragraphs.isNotEmpty() && paragraphs.first().length <= 100) {
            title = paragraphs.removeAt(0)
        }

        return SlideContent(
            slideNumber = slideNumber,
            title = title,
            paragraphs = paragraphs,
            images = images
        )
    }

    private fun normalizeZipPath(baseDir: String, target: String): String {
        if (target.startsWith("/")) return target.trimStart('/')
        val combined = "$baseDir$target"
        val parts = ArrayDeque<String>()
        for (segment in combined.split('/')) {
            when (segment) {
                "", "." -> Unit
                ".." -> if (parts.isNotEmpty()) parts.removeLast()
                else -> parts.addLast(segment)
            }
        }
        return parts.joinToString("/")
    }
}
