package com.triread.app.ui.viewer.components

import android.annotation.SuppressLint
import android.app.Activity
import android.net.Uri
import android.view.ViewGroup
import android.webkit.WebSettings
import android.webkit.WebView
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.libreoffice.androidlib.COWebViewClient
import org.libreoffice.androidlib.LOActivity
import java.io.File

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun CollaboraWebViewContent(
    tempFile: File,
    isImmersive: Boolean,
    onNavigateBack: () -> Unit,
    onError: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val view = LocalView.current
    val activity = view.context as? Activity

    if (activity == null) {
        LaunchedEffect(Unit) {
            onError("Unable to initialize Collabora viewer without an active Activity.")
        }
        return
    }

    val bridge = remember(activity) { LOActivity(activity) }
    var isEngineReady by remember(tempFile.absolutePath) { mutableStateOf(false) }

    val webView = remember(activity) {
        WebView(activity).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                allowFileAccess = true
                @Suppress("DEPRECATION")
                allowFileAccessFromFileURLs = true
                @Suppress("DEPRECATION")
                allowUniversalAccessFromFileURLs = true
                builtInZoomControls = true
                displayZoomControls = false
                useWideViewPort = true
                loadWithOverviewMode = true
                mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            }
            addJavascriptInterface(bridge.COOLMessageHandler(), "COOLMessageHandler")
            webViewClient = object : COWebViewClient() {
                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    // Enforce clean Read-Only reader UX by hiding editing & menu chrome.
                    val hideReadOnlyChromeJs = """
                        (function() {
                            var style = document.createElement('style');
                            style.innerHTML = '#mobile-edit-button, #toolbar-down, #main-menu-btn, .unoSave, #closebutton { display: none !important; }';
                            document.head.appendChild(style);
                        })();
                    """.trimIndent()
                    view?.evaluateJavascript(hideReadOnlyChromeJs, null)
                }
            }
        }
    }

    DisposableEffect(bridge, webView) {
        bridge.attachWebView(webView) {
            onNavigateBack()
        }
        onDispose {
            bridge.detachWebView()
            webView.stopLoading()
            webView.removeJavascriptInterface("COOLMessageHandler")
            webView.destroy()
        }
    }

    LaunchedEffect(tempFile.absolutePath) {
        val fileUri = "file://${tempFile.absolutePath}"
        val initResult = withContext(Dispatchers.IO) {
            runCatching {
                bridge.ensureInitializedAndStart(fileUri, "TriRead")
            }
        }
        initResult.fold(
            onFailure = { error ->
                onError(error.localizedMessage ?: "Failed to initialize Collabora Office engine.")
            },
            onSuccess = {
                isEngineReady = true
                val coolUrl = "file:///android_asset/dist/cool.html" +
                    "?file_path=${Uri.encode(fileUri)}" +
                    "&permission=readonly" +
                    "&closebutton=false" +
                    "&lang=en"
                webView.loadUrl(coolUrl)
            }
        )
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(top = if (isImmersive) 0.dp else 64.dp)
    ) {
        AndroidView(
            factory = { webView },
            modifier = Modifier.fillMaxSize()
        )

        if (!isEngineReady) {
            Column(
                modifier = Modifier.align(Alignment.Center),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                CircularProgressIndicator()
                Text(
                    text = "Preparing document engine...",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

