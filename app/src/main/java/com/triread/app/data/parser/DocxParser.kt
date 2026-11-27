package com.triread.app.data.parser

import android.content.Context
import android.net.Uri
import android.util.Xml
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import org.xmlpull.v1.XmlPullParser
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.util.Locale
import java.util.zip.ZipInputStream
import kotlin.coroutines.coroutineContext

sealed interface DocBlock {
    data class Heading(val text: String, val level: Int) : DocBlock
    data class Paragraph(
        val text: String,
        val isBold: Boolean = false,
        val isBullet: Boolean = false
    ) : DocBlock

    data class TableRow(val cells: List<String>) : DocBlock
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

                val xmlBytes = extractDocumentXml(uri)
                if (xmlBytes != null) {
                    val blocks = parseWordDocumentXml(xmlBytes)
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

    private suspend fun extractDocumentXml(uri: Uri): ByteArray? {
        val stream = context.contentResolver.openInputStream(uri)
            ?: throw IOException("Unable to read document. File may have been moved or permission revoked.")

        stream.use { raw ->
            ZipInputStream(raw).use { zip ->
                var entry = zip.nextEntry
                while (entry != null) {
                    coroutineContext.ensureActive()
                    if (!entry.isDirectory && entry.name.equals("word/document.xml", ignoreCase = true)) {
                        val bytes = readBounded(zip, MAX_XML_BYTES)
                        zip.closeEntry()
                        return bytes
                    }
                    zip.closeEntry()
                    entry = zip.nextEntry
                }
            }
        }
        return null
    }

    private suspend fun parseWordDocumentXml(xmlBytes: ByteArray): List<DocBlock> {
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
                        }
                        "pStyle" -> if (inParagraph) {
                            val styleVal = parser.getAttributeValue(null, "val")
                                ?: findAttributeByLocalName(parser, "val")
                            headingLevel = detectHeadingLevel(styleVal)
                        }
                        "numPr" -> if (inParagraph) {
                            isBullet = true
                        }
                        "rPr" -> inRunProps = true
                        "b" -> if (inRunProps) {
                            val boldVal = findAttributeByLocalName(parser, "val")
                            if (boldVal != "0" && boldVal != "false") {
                                hasBoldRun = true
                            }
                        }
                        "tab" -> if (inParagraph) {
                            paragraphText.append("    ")
                        }
                        "br" -> if (inParagraph) {
                            paragraphText.append("\n")
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
                                    blocks.add(DocBlock.Heading(text = text, level = headingLevel))
                                } else {
                                    blocks.add(
                                        DocBlock.Paragraph(
                                            text = text,
                                            isBold = hasBoldRun,
                                            isBullet = isBullet
                                        )
                                    )
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
                if (isLikelyNaturalText(candidate)) {
                    paragraphs.add(candidate)
                }
                current.clear()
                if (paragraphs.size >= MAX_LEGACY_PARAGRAPHS) break
            } else {
                if (current.length >= 40) {
                    val candidate = current.toString().trim()
                    if (isLikelyNaturalText(candidate)) {
                        paragraphs.add(candidate)
                    }
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
        private const val MAX_XML_BYTES = 16 * 1024 * 1024 // 16 MB safety cap
        private const val MAX_LEGACY_SCAN_BYTES = 2 * 1024 * 1024
        private const val MAX_LEGACY_PARAGRAPHS = 300
    }
}

