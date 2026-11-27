package com.devilunamoon.triread.data

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.xmlpull.v1.XmlPullParser
import org.xmlpull.v1.XmlPullParserFactory
import java.io.File
import java.io.InputStream
import java.util.zip.ZipFile

sealed class DocBlock {
    data class Paragraph(
        val text: String,
        val headingLevel: Int = 0, // 0 = normal, 1 = H1, 2 = H2, 3 = H3
        val isBold: Boolean = false,
        val isBullet: Boolean = false
    ) : DocBlock()

    data class Table(val rows: List<List<String>>) : DocBlock()
    data class Image(val bitmap: Bitmap) : DocBlock()
}

data class ParsedDocResult(
    val blocks: List<DocBlock>,
    val isLegacyFormat: Boolean = false,
    val warningMessage: String? = null
)

object DocxParser {

    suspend fun parse(file: File): ParsedDocResult = withContext(Dispatchers.IO) {
        if (file.extension.equals("doc", ignoreCase = true)) {
            return@withContext parseLegacyDoc(file)
        }

        try {
            ZipFile(file).use { zip ->
                val rels = parseRelationships(zip, "word/_rels/document.xml.rels")
                val docEntry = zip.getEntry("word/document.xml")
                    ?: return@withContext ParsedDocResult(
                        blocks = emptyList(),
                        warningMessage = "Could not find document content inside this .docx file."
                    )

                val blocks = mutableListOf<DocBlock>()
                zip.getInputStream(docEntry).use { stream ->
                    parseDocumentXml(stream, zip, rels, blocks)
                }

                ParsedDocResult(blocks = blocks)
            }
        } catch (e: Exception) {
            ParsedDocResult(
                blocks = emptyList(),
                warningMessage = "Unable to open this Word file offline: ${e.localizedMessage ?: "Unsupported format"}"
            )
        }
    }

    private fun parseRelationships(zip: ZipFile, relsPath: String): Map<String, String> {
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
            // Ignore malformed rels
        }
        return map
    }

    private fun parseDocumentXml(
        stream: InputStream,
        zip: ZipFile,
        rels: Map<String, String>,
        blocks: MutableList<DocBlock>
    ) {
        val parser = XmlPullParserFactory.newInstance().apply { isNamespaceAware = false }.newPullParser()
        parser.setInput(stream, "UTF-8")

        var inParagraph = false
        var inTable = false
        var inTableRow = false
        var inTableCell = false
        var inText = false
        var headingLevel = 0
        var isBullet = false
        var boldCount = 0
        var runCount = 0
        var currentRunBold = false

        val paragraphBuilder = StringBuilder()
        val currentTableRows = mutableListOf<List<String>>()
        val currentRowCells = mutableListOf<String>()
        val cellBuilder = StringBuilder()

        var event = parser.eventType
        while (event != XmlPullParser.END_DOCUMENT) {
            when (event) {
                XmlPullParser.START_TAG -> {
                    when (parser.name) {
                        "w:tbl" -> {
                            inTable = true
                            currentTableRows.clear()
                        }
                        "w:tr" -> if (inTable) {
                            inTableRow = true
                            currentRowCells.clear()
                        }
                        "w:tc" -> if (inTableRow) {
                            inTableCell = true
                            cellBuilder.clear()
                        }
                        "w:p" -> {
                            inParagraph = true
                            headingLevel = 0
                            isBullet = false
                            boldCount = 0
                            runCount = 0
                            paragraphBuilder.clear()
                        }
                        "w:pStyle" -> if (inParagraph) {
                            val style = parser.getAttributeValue(null, "w:val") ?: ""
                            headingLevel = when {
                                style.contains("Title", ignoreCase = true) -> 1
                                style.contains("Heading1", ignoreCase = true) || style == "1" -> 1
                                style.contains("Heading2", ignoreCase = true) || style == "2" -> 2
                                style.contains("Heading", ignoreCase = true) -> 3
                                else -> 0
                            }
                        }
                        "w:numPr" -> if (inParagraph) {
                            isBullet = true
                        }
                        "w:r" -> if (inParagraph) {
                            currentRunBold = false
                            runCount++
                        }
                        "w:b" -> if (inParagraph) {
                            val valAttr = parser.getAttributeValue(null, "w:val")
                            if (valAttr != "0" && valAttr != "false") {
                                currentRunBold = true
                                boldCount++
                            }
                        }
                        "w:t" -> {
                            inText = true
                        }
                        "w:tab" -> {
                            if (inTableCell) cellBuilder.append("  ")
                            else if (inParagraph) paragraphBuilder.append("    ")
                        }
                        "w:br" -> {
                            if (inTableCell) cellBuilder.append("\n")
                            else if (inParagraph) paragraphBuilder.append("\n")
                        }
                        "a:blip" -> {
                            val embedId = parser.getAttributeValue(null, "r:embed")
                            if (!embedId.isNullOrBlank()) {
                                val target = rels[embedId]
                                if (!target.isNullOrBlank()) {
                                    val mediaPath = if (target.startsWith("/")) {
                                        target.trimStart('/')
                                    } else {
                                        "word/${target.removePrefix("./")}"
                                    }
                                    decodeZipBitmap(zip, mediaPath)?.let { bmp ->
                                        blocks.add(DocBlock.Image(bmp))
                                    }
                                }
                            }
                        }
                    }
                }

                XmlPullParser.TEXT -> {
                    if (inText) {
                        val text = parser.text ?: ""
                        if (inTableCell) {
                            cellBuilder.append(text)
                        } else if (inParagraph) {
                            paragraphBuilder.append(text)
                        }
                    }
                }

                XmlPullParser.END_TAG -> {
                    when (parser.name) {
                        "w:t" -> inText = false
                        "w:p" -> {
                            if (inTableCell) {
                                if (cellBuilder.isNotEmpty() && !cellBuilder.endsWith("\n")) {
                                    cellBuilder.append("\n")
                                }
                            } else {
                                val text = paragraphBuilder.toString().trim()
                                if (text.isNotEmpty()) {
                                    val mostlyBold = runCount > 0 && boldCount >= runCount
                                    blocks.add(
                                        DocBlock.Paragraph(
                                            text = text,
                                            headingLevel = headingLevel,
                                            isBold = mostlyBold,
                                            isBullet = isBullet
                                        )
                                    )
                                }
                            }
                            inParagraph = false
                        }
                        "w:tc" -> if (inTableCell) {
                            currentRowCells.add(cellBuilder.toString().trim())
                            inTableCell = false
                        }
                        "w:tr" -> if (inTableRow) {
                            if (currentRowCells.any { it.isNotBlank() }) {
                                currentTableRows.add(currentRowCells.toList())
                            }
                            inTableRow = false
                        }
                        "w:tbl" -> if (inTable) {
                            if (currentTableRows.isNotEmpty()) {
                                blocks.add(DocBlock.Table(currentTableRows.toList()))
                            }
                            inTable = false
                        }
                    }
                }
            }
            event = parser.next()
        }
    }

    private fun parseLegacyDoc(file: File): ParsedDocResult {
        return try {
            val bytes = file.readBytes()
            val extracted = extractReadableAsciiRuns(bytes)
            val blocks = extracted.map { DocBlock.Paragraph(it) }
            ParsedDocResult(
                blocks = blocks,
                isLegacyFormat = true,
                warningMessage = "Legacy .doc (97–2003) file: showing extracted text. Tap 'Open externally' for full layout."
            )
        } catch (e: Exception) {
            ParsedDocResult(
                blocks = emptyList(),
                isLegacyFormat = true,
                warningMessage = "Legacy .doc format could not be parsed offline. Tap 'Open externally' to view it."
            )
        }
    }

    private fun extractReadableAsciiRuns(bytes: ByteArray): List<String> {
        val result = mutableListOf<String>()
        val current = StringBuilder()
        for (b in bytes) {
            val c = b.toInt() and 0xFF
            if (c in 32..126 || c == 9) {
                current.append(c.toChar())
            } else {
                if (current.length >= 25) {
                    val text = current.toString().trim()
                    if (text.count { it.isLetter() } > text.length / 2) {
                        result.add(text)
                    }
                }
                current.clear()
            }
        }
        return result.take(150)
    }

    internal fun decodeZipBitmap(zip: ZipFile, path: String, maxDimension: Int = 1280): Bitmap? {
        val entry = zip.getEntry(path) ?: return null
        return try {
            val bytes = zip.getInputStream(entry).use { it.readBytes() }
            val boundsOpts = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size, boundsOpts)
            var sampleSize = 1
            while (boundsOpts.outWidth / sampleSize > maxDimension ||
                boundsOpts.outHeight / sampleSize > maxDimension
            ) {
                sampleSize *= 2
            }
            val decodeOpts = BitmapFactory.Options().apply { inSampleSize = sampleSize }
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size, decodeOpts)
        } catch (_: Exception) {
            null
        }
    }
}
