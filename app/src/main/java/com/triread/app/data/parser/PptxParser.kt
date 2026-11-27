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

data class SlideItem(
    val slideNumber: Int,
    val title: String?,
    val bodyLines: List<String>,
    val imagePaths: List<String>,
    val speakerNotes: String?
)

data class ParsedPresentation(
    val slides: List<SlideItem>,
    val isLegacyUnsupported: Boolean = false,
    val noticeMessage: String? = null
)

class PptxParser(
    private val context: Context,
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO
) {

    suspend fun parse(uriString: String, fileName: String): Result<ParsedPresentation> =
        withContext(ioDispatcher) {
            runCatching {
                val uri = Uri.parse(uriString)
                val isLegacyPpt = fileName.lowercase(Locale.ROOT).endsWith(".ppt")

                val slideXmlMap = mutableMapOf<Int, ByteArray>()
                val slideRelsMap = mutableMapOf<Int, ByteArray>()
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

                            if (!entry.isDirectory) {
                                val slideMatch = SLIDE_XML_REGEX.matchEntire(name)
                                val relsMatch = SLIDE_RELS_REGEX.matchEntire(name)
                                val notesMatch = NOTES_XML_REGEX.matchEntire(name)

                                when {
                                    slideMatch != null -> {
                                        val index = slideMatch.groupValues[1].toIntOrNull()
                                        if (index != null) {
                                            slideXmlMap[index] = readBounded(zip, MAX_XML_ENTRY_BYTES)
                                        }
                                    }
                                    relsMatch != null -> {
                                        val index = relsMatch.groupValues[1].toIntOrNull()
                                        if (index != null) {
                                            slideRelsMap[index] = readBounded(zip, MAX_XML_ENTRY_BYTES)
                                        }
                                    }
                                    notesMatch != null -> {
                                        notesXmlMap[name.lowercase(Locale.ROOT)] =
                                            readBounded(zip, MAX_XML_ENTRY_BYTES)
                                    }
                                    name.startsWith("ppt/media/", ignoreCase = true) &&
                                        isSupportedImage(name) -> {
                                        val saved = writeMediaToCache(zip, mediaCacheDir, name)
                                        if (saved != null) {
                                            cachedMediaByEntry[name.lowercase(Locale.ROOT)] = saved
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

                val orderedSlides = slideXmlMap.keys.sorted().map { slideNum ->
                    coroutineContext.ensureActive()
                    val rels = slideRelsMap[slideNum]?.let { parseSlideRels(it) }.orEmpty()
                    val parsedXml = parseSlideXml(slideXmlMap.getValue(slideNum))

                    val resolvedImages = parsedXml.embedRelIds.mapNotNull { rId ->
                        val target = rels[rId] ?: return@mapNotNull null
                        val normalized = normalizePptTarget(target)
                        cachedMediaByEntry[normalized]
                    }.distinct()

                    val notesTarget = rels.values.firstOrNull {
                        it.contains("notesSlides/", ignoreCase = true)
                    }
                    val notesText = notesTarget?.let { target ->
                        val normalized = normalizePptTarget(target)
                        notesXmlMap[normalized]?.let { extractPlainTextFromXml(it) }
                    }?.takeIf { it.isNotBlank() }

                    val title = parsedXml.paragraphs.firstOrNull()
                    val body = if (parsedXml.paragraphs.size > 1) {
                        parsedXml.paragraphs.drop(1)
                    } else {
                        emptyList()
                    }

                    SlideItem(
                        slideNumber = slideNum,
                        title = title,
                        bodyLines = body,
                        imagePaths = resolvedImages,
                        speakerNotes = notesText
                    )
                }

                ParsedPresentation(slides = orderedSlides)
            }
        }

    private data class ParsedSlideXml(
        val paragraphs: List<String>,
        val embedRelIds: List<String>
    )

    private fun parseSlideXml(xmlBytes: ByteArray): ParsedSlideXml {
        val paragraphs = mutableListOf<String>()
        val embedIds = mutableListOf<String>()
        val parser = Xml.newPullParser()
        parser.setFeature(XmlPullParser.FEATURE_PROCESS_NAMESPACES, true)

        ByteArrayInputStream(xmlBytes).use { input ->
            parser.setInput(input, "UTF-8")
            var eventType = parser.eventType
            var inParagraph = false
            val currentParagraph = StringBuilder()

            while (eventType != XmlPullParser.END_DOCUMENT) {
                val localName = parser.name.orEmpty()
                when (eventType) {
                    XmlPullParser.START_TAG -> when (localName) {
                        "p" -> {
                            inParagraph = true
                            currentParagraph.clear()
                        }
                        "t" -> if (inParagraph) {
                            currentParagraph.append(parser.nextText())
                        }
                        "br" -> if (inParagraph) {
                            currentParagraph.append("\n")
                        }
                        "blip" -> {
                            findAttributeByLocalName(parser, "embed")?.let { embedIds.add(it) }
                        }
                    }
                    XmlPullParser.END_TAG -> if (localName == "p" && inParagraph) {
                        val line = currentParagraph.toString().trim()
                        if (line.isNotEmpty()) {
                            paragraphs.add(line)
                        }
                        inParagraph = false
                    }
                }
                eventType = parser.next()
            }
        }
        return ParsedSlideXml(paragraphs = paragraphs, embedRelIds = embedIds)
    }

    private fun parseSlideRels(relsBytes: ByteArray): Map<String, String> {
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
                        map[id] = target
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
                        // Filter out bare slide number placeholders in notes slides.
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

    private fun normalizePptTarget(rawTarget: String): String {
        val cleaned = rawTarget.replace('\\', '/')
        val resolved = when {
            cleaned.startsWith("../") -> "ppt/${cleaned.removePrefix("../")}"
            cleaned.startsWith("/ppt/") -> cleaned.removePrefix("/")
            cleaned.startsWith("ppt/") -> cleaned
            else -> "ppt/slides/$cleaned"
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
        private val SLIDE_XML_REGEX = Regex("^ppt/slides/slide(\\d+)\\.xml$", RegexOption.IGNORE_CASE)
        private val SLIDE_RELS_REGEX = Regex("^ppt/slides/_rels/slide(\\d+)\\.xml\\.rels$", RegexOption.IGNORE_CASE)
        private val NOTES_XML_REGEX = Regex("^ppt/notesSlides/notesSlide(\\d+)\\.xml$", RegexOption.IGNORE_CASE)
    }
}

