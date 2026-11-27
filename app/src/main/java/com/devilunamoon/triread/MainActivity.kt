package com.devilunamoon.triread

import android.Manifest
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.Settings
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.devilunamoon.triread.data.StorageScanner
import com.devilunamoon.triread.model.DocumentItem
import com.devilunamoon.triread.model.DocumentType
import com.devilunamoon.triread.ui.LibraryScreen
import com.devilunamoon.triread.ui.theme.TriReadTheme
import com.devilunamoon.triread.ui.viewer.DocViewerScreen
import com.devilunamoon.triread.ui.viewer.PdfViewerScreen
import com.devilunamoon.triread.ui.viewer.PptViewerScreen
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            TriReadTheme {
                TriReadApp()
            }
        }
    }
}

@Composable
private fun TriReadApp() {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val scope = rememberCoroutineScope()

    var hasPermission by remember { mutableStateOf(checkStoragePermission(context)) }
    var isScanning by remember { mutableStateOf(false) }
    var documents by remember { mutableStateOf<List<DocumentItem>>(emptyList()) }
    var lastScanMessage by remember { mutableStateOf<String?>(null) }
    var openedDocument by remember { mutableStateOf<DocumentItem?>(null) }

    fun runScan() {
        if (!hasPermission || isScanning) return
        scope.launch {
            isScanning = true
            val found = StorageScanner.scanDeviceStorage()
            val previousCount = documents.size
            documents = found
            val diff = found.size - previousCount
            lastScanMessage = when {
                previousCount > 0 && diff > 0 -> "${found.size} files (+$diff new)"
                else -> "${found.size} files offline"
            }
            isScanning = false
        }
    }

    val legacyPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { granted ->
        hasPermission = granted
        if (granted) runScan()
    }

    // Re-check MANAGE_EXTERNAL_STORAGE when returning from Android Settings
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                val nowGranted = checkStoragePermission(context)
                if (nowGranted != hasPermission) {
                    hasPermission = nowGranted
                }
                if (nowGranted && documents.isEmpty() && !isScanning) {
                    runScan()
                }
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    LaunchedEffect(hasPermission) {
        if (hasPermission) {
            runScan()
        }
    }

    val currentDoc = openedDocument
    if (currentDoc != null) {
        BackHandler { openedDocument = null }

        val openExternally = { openDocumentExternally(context, currentDoc) }
        when (currentDoc.type) {
            DocumentType.PDF -> PdfViewerScreen(
                document = currentDoc,
                onBack = { openedDocument = null },
                onOpenExternally = openExternally
            )
            DocumentType.DOC, DocumentType.DOCX -> DocViewerScreen(
                document = currentDoc,
                onBack = { openedDocument = null },
                onOpenExternally = openExternally
            )
            DocumentType.PPT, DocumentType.PPTX -> PptViewerScreen(
                document = currentDoc,
                onBack = { openedDocument = null },
                onOpenExternally = openExternally
            )
        }
    } else {
        LibraryScreen(
            hasStoragePermission = hasPermission,
            isScanning = isScanning,
            documents = documents,
            lastScanMessage = lastScanMessage,
            onRequestPermission = {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    try {
                        val intent = Intent(
                            Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION,
                            Uri.parse("package:${context.packageName}")
                        )
                        context.startActivity(intent)
                    } catch (_: Exception) {
                        val fallback = Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION)
                        context.startActivity(fallback)
                    }
                } else {
                    legacyPermissionLauncher.launch(Manifest.permission.READ_EXTERNAL_STORAGE)
                }
            },
            onScanClick = { runScan() },
            onDocumentClick = { doc -> openedDocument = doc }
        )
    }
}

private fun checkStoragePermission(context: Context): Boolean {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        Environment.isExternalStorageManager()
    } else {
        ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.READ_EXTERNAL_STORAGE
        ) == PackageManager.PERMISSION_GRANTED
    }
}

private fun openDocumentExternally(context: Context, doc: DocumentItem) {
    try {
        val uri = FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            doc.file
        )
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, doc.type.mimeType)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        context.startActivity(Intent.createChooser(intent, "Open with"))
    } catch (_: ActivityNotFoundException) {
        Toast.makeText(context, "No external app found to open ${doc.type.label}", Toast.LENGTH_SHORT).show()
    } catch (e: Exception) {
        Toast.makeText(context, "Could not open file: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
    }
}
