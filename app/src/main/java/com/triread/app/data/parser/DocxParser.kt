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

sealed interface DocBlock {
    data class Heading(
        val text: String,
        val level: Int,
        val alignment: DocTextAlignment = DocTextAlignment.START
    ) : DocBlock

    data class Paragraph(
        val text: String,
        val isBold: Boolean = false,
        val isItalic: Boolean = false,
        val isBullet: Boolean = false,
        val alignment: DocTextAlignment = DocTextAlignment.START
    ) : DocBlock

    data class ImageBlock(
        val imagePath: String
    ) : DocBlock

    data class TableRow(val cells: List<String>) : DocBlock

    data object PageBreak : DocBlock
}

data class ParsedDocumentContent(
    val blocks: List<DocBlock>,
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
                val cachedMedia = mutableMapOf<String, String>()

                val stream = context.contentResolver.openInputStream(uri)
                    ?: throw IOException("Unable to read document. File may have been moved or permission revoked.")

                stream.use { raw ->
                    ZipInputStream(raw).use { zip ->
                        var entry = zip.nextEntry
                        while (entry != null) {
                            coroutineContext.ensureActive()
                            val name = entry.name
                            if (!entry.isDirectory) {
                                when {
                                    name.equals("word/document.xml", ignoreCase = true) -> {
                                        documentXml = readBounded(zip, MAX_XML_BYTES)
                                    }
                                    name.equals("word/_rels/document.xml.rels", ignoreCase = true) -> {
                                        documentRelsXml = readBounded(zip, MAX_RELS_BYTES)
                                    }
                                    name.startsWith("word/media/", ignoreCase = true) &&
                                        isSupportedImage(name) -> {
                                        writeMediaToCache(zip, mediaDir, name)?.let { path ->
                                            cachedMedia[name.lowercase(Locale.ROOT)] = path
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
                    val rels = documentRelsXml?.let { parseRels(it) }.orEmpty()
                    val blocks = parseWordDocumentXml(xmlBytes, rels, cachedMedia)
                    if (blocks.isEmpty()) {
                        ParsedDocumentContent(
                            blocks = emptyList(),
                            noticeMessage = "This document contains no readable text."
                        )
                    } else {
                        ParsedDocumentContent(blocks = blocks)
                    }
                } else if (isLegacyDoc) {
                    parseLegacyBinaryDoc(uri)
                } else {
                    throw IOException("Invalid or corrupted DOCX archive (missing word/document.xml).")
                }
            }
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
                        val normalized = target.replace('\\', '/')
                            .removePrefix("/")
                            .let { if (it.startsWith("word/")) it else "word/$it" }
                            .lowercase(Locale.ROOT)
                        map[id] = normalized
                    }
                }
                eventType = parser.next()
            }
        }
        return map
    }

    private suspend fun parseWordDocumentXml(
        xmlBytes: ByteArray,
        rels: Map<String, String>,
        cachedMedia: Map<String, String>
    ): List<DocBlock> {
        val blocks = mutableListOf<DocBlock>()
        val parser = Xml.newPullParser()
        parser.setFeature(XmlPullParser.FEATURE_PROCESS_NAMESPACES, true)
        ByteArrayInputStream(xmlBytes).use { input ->
            parser.setInput(input, "UTF-8")

            var eventType = parser.eventType
            var inParagraph = false
            var inTableRow = false
            var inTableCell = false
            var inRunProps = false

            val paragraphText = StringBuilder()
            var headingLevel = 0
            var isBullet = false
            var hasBoldRun = false
            var hasItalicRun = false
            var alignment = DocTextAlignment.START
            val paragraphImagePaths = mutableListOf<String>()
            var hasPageBreak = false

            var currentCellText = StringBuilder()
            val currentRowCells = mutableListOf<String>()

            while (eventType != XmlPullParser.END_DOCUMENT) {
                coroutineContext.ensureActive()
                val localName = parser.name.orEmpty()

                when (eventType) {
                    XmlPullParser.START_TAG -> when (localName) {
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
                            paragraphText.clear()
                            headingLevel = 0
                            isBullet = false
                            hasBoldRun = false
                            hasItalicRun = false
                            alignment = DocTextAlignment.START
                            paragraphImagePaths.clear()
                            hasPageBreak = false
                        }
                        "pStyle" -> if (inParagraph) {
                            val styleVal = findAttributeByLocalName(parser, "val")
                            headingLevel = detectHeadingLevel(styleVal)
                        }
                        "jc" -> if (inParagraph) {
                            alignment = parseAlignment(findAttributeByLocalName(parser, "val"))
                        }
                        "numPr" -> if (inParagraph) {
                            isBullet = true
                        }
                        "rPr" -> inRunProps = true
                        "b" -> if (inRunProps) {
                            val boldVal = findAttributeByLocalName(parser, "val")
                            if (boldVal != "0" && boldVal != "false") hasBoldRun = true
                        }
                        "i" -> if (inRunProps) {
                            val italicVal = findAttributeByLocalName(parser, "val")
                            if (italicVal != "0" && italicVal != "false") hasItalicRun = true
                        }
                        "tab" -> if (inParagraph) {
                            paragraphText.append("    ")
                        }
                        "br" -> if (inParagraph) {
                            val brType = findAttributeByLocalName(parser, "type")
                            if (brType.equals("page", ignoreCase = true)) {
                                hasPageBreak = true
                            } else {
                                paragraphText.append("\n")
                            }
                        }
                        "blip" -> if (inParagraph) {
                            val rId = findAttributeByLocalName(parser, "embed")
                            val target = rId?.let { rels[it] }
                            val path = target?.let { cachedMedia[it] }
                            if (!path.isNullOrBlank()) {
                                paragraphImagePaths.add(path)
                            }
                        }
                        "t" -> if (inParagraph) {
                            val text = parser.nextText()
                            if (text.isNotEmpty()) {
                                paragraphText.append(text)
                            }
                        }
                    }

                    XmlPullParser.END_TAG -> when (localName) {
                        "rPr" -> inRunProps = false
                        "p" -> if (inParagraph) {
                            val text = paragraphText.toString().trim()
                            if (text.isNotEmpty()) {
                                if (inTableCell) {
                                    if (currentCellText.isNotEmpty()) currentCellText.append("\n")
                                    currentCellText.append(text)
                                } else if (headingLevel > 0) {
                                    blocks.add(
                                        DocBlock.Heading(
                                            text = text,
                                            level = headingLevel,
                                            alignment = alignment
                                        )
                                    )
                                } else {
                                    blocks.add(
                                        DocBlock.Paragraph(
                                            text = text,
                                            isBold = hasBoldRun,
                                            isItalic = hasItalicRun,
                                            isBullet = isBullet,
                                            alignment = alignment
                                        )
                                    )
                                }
                            }
                            if (!inTableCell) {
                                paragraphImagePaths.forEach { imgPath ->
                                    blocks.add(DocBlock.ImageBlock(imgPath))
                                }
                                if (hasPageBreak) {
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
                                blocks.add(DocBlock.TableRow(currentRowCells.toList()))
                            }
                            inTableRow = false
                        }
                    }
                }
                eventType = parser.next()
            }
        }
        return blocks
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
                blocks = extracted.map { DocBlock.Paragraph(text = it) },
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
        private const val MAX_XML_BYTES = 16 * 1024 * 1024
        private const val MAX_RELS_BYTES = 2 * 1024 * 1024
        private const val MAX_MEDIA_ENTRY_BYTES = 8 * 1024 * 1024
        private const val MAX_LEGACY_SCAN_BYTES = 2 * 1024 * 1024
        private const val MAX_LEGACY_PARAGRAPHS = 300
    }
}
