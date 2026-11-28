package com.triread.app.ui.viewer

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.pm.ActivityInfo
import android.content.res.Configuration
import android.graphics.Color
import android.graphics.Typeface
import android.net.Uri
import android.os.Bundle
import android.text.TextUtils
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.webkit.WebSettings
import android.webkit.WebView
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import org.libreoffice.androidlib.COWebViewClient
import org.libreoffice.androidlib.LOActivity
import java.io.File
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Dedicated Collabora Office viewer Activity running in its own isolated Android process
 * (`android:process=":collabora"`).
 *
 * Collabora's native C++ `COOLWSD` intentionally calls `std::_Exit(0)` (`Forced Exit with code: 0`)
 * when a document WebSocket session disconnects. Running this Activity in `:collabora` with pure
 * Android Views (no Compose recomposition) ensures:
 * 1. `COOLWSD` and the `WebView` are initialized strictly once without accidental reconnects.
 * 2. When the user exits and `COOLWSD` calls `exit(0)`, only `:collabora` terminates while
 *    `MainActivity` stays alive and smoothly returns to the TriRead Dashboard.
 */
class CollaboraViewerActivity : ComponentActivity() {

    private var bridge: LOActivity? = null
    private var webView: WebView? = null
    private var topBar: LinearLayout? = null
    private var loadingOverlay: LinearLayout? = null
    private var isLandscape = false
    private var isImmersive = false
    private val hasStartedEngine = AtomicBoolean(false)
    private val initExecutor = Executors.newSingleThreadExecutor()

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val filePath = intent.getStringExtra(EXTRA_FILE_PATH)
        val documentTitle = intent.getStringExtra(EXTRA_TITLE).orEmpty().ifBlank { "Document" }
        val isPresentation = intent.getBooleanExtra(EXTRA_IS_PRESENTATION, false)

        if (filePath.isNullOrBlank() || !File(filePath).exists()) {
            finishWithError("Temporary document file is missing or unreadable.")
            return
        }

        val isNight = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
            Configuration.UI_MODE_NIGHT_YES
        val bgColor = if (isNight) Color.parseColor("#121212") else Color.parseColor("#FAFAFA")
        val barColor = if (isNight) Color.parseColor("#1E1E1E") else Color.parseColor("#FFFFFF")
        val textColor = if (isNight) Color.parseColor("#F5F5F5") else Color.parseColor("#1A1A1A")
        val subTextColor = if (isNight) Color.parseColor("#B0B0B0") else Color.parseColor("#666666")
        val dividerColor = if (isNight) Color.parseColor("#2E2E2E") else Color.parseColor("#E0E0E0")

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(bgColor)
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }

        // Top App Bar
        val bar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setBackgroundColor(barColor)
            elevation = dp(4).toFloat()
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
            setPadding(dp(8), dp(8), dp(8), dp(8))
        }
        topBar = bar

        val backButton = createBarButton("←", textColor, "Back") {
            finish()
        }
        val titleView = TextView(this).apply {
            text = documentTitle
            setTextColor(textColor)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
            typeface = Typeface.DEFAULT_BOLD
            maxLines = 1
            ellipsize = TextUtils.TruncateAt.END
            layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply {
                marginStart = dp(4)
                marginEnd = dp(4)
            }
        }
        val rotateButton = createBarButton("↻", textColor, "Rotate screen") {
            toggleLandscape()
        }
        val fullscreenButton = createBarButton("⛶", textColor, "Toggle fullscreen") {
            if (isPresentation) {
                toggleLandscape()
            }
            toggleImmersive()
        }

        bar.addView(backButton)
        bar.addView(titleView)
        bar.addView(rotateButton)
        bar.addView(fullscreenButton)

        val divider = View(this).apply {
            setBackgroundColor(dividerColor)
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(1))
        }

        // Respect system status bar inset on the top bar
        ViewCompat.setOnApplyWindowInsetsListener(bar) { v, insets ->
            val topInset = insets.getInsets(WindowInsetsCompat.Type.statusBars()).top
            v.setPadding(dp(8), topInset + dp(8), dp(8), dp(8))
            insets
        }

        // Content frame holding WebView + Loading Overlay
        val contentFrame = FrameLayout(this).apply {
            setBackgroundColor(bgColor)
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                0,
                1f
            )
        }

        val loBridge = LOActivity(this)
        bridge = loBridge

        val overlay = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(bgColor)
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
            addView(ProgressBar(this@CollaboraViewerActivity))
            addView(
                TextView(this@CollaboraViewerActivity).apply {
                    text = "Opening document..."
                    setTextColor(subTextColor)
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
                    setPadding(0, dp(12), 0, 0)
                }
            )
        }
        loadingOverlay = overlay

        val wv = WebView(this).apply {
            setBackgroundColor(bgColor)
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
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
            addJavascriptInterface(loBridge.COOLMessageHandler(), "COOLMessageHandler")
            webViewClient = object : COWebViewClient() {
                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    val hideReadOnlyChromeJs = """
                        (function() {
                            var style = document.createElement('style');
                            style.innerHTML = '#mobile-edit-button, #toolbar-down, #main-menu-btn, .unoSave, #closebutton { display: none !important; }';
                            document.head.appendChild(style);
                        })();
                    """.trimIndent()
                    view?.evaluateJavascript(hideReadOnlyChromeJs, null)
                    loadingOverlay?.visibility = View.GONE
                }
            }
        }
        webView = wv

        loBridge.attachWebView(wv) {
            if (!isFinishing && !isDestroyed) {
                finish()
            }
        }

        contentFrame.addView(wv)
        contentFrame.addView(overlay)

        root.addView(bar)
        root.addView(divider)
        root.addView(contentFrame)
        setContentView(root)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (isImmersive) {
                    toggleImmersive()
                } else {
                    finish()
                }
            }
        })

        // Start COOLWSD strictly once on a background thread
        if (hasStartedEngine.compareAndSet(false, true)) {
            val fileUri = "file://$filePath"
            initExecutor.execute {
                val error = try {
                    loBridge.ensureInitializedAndStart(fileUri, "TriRead")
                    null
                } catch (t: Throwable) {
                    t.localizedMessage ?: "Failed to initialize Collabora Office engine."
                }

                runOnUiThread {
                    if (isFinishing || isDestroyed) return@runOnUiThread
                    if (error != null) {
                        finishWithError(error)
                    } else {
                        val coolUrl = "file:///android_asset/dist/cool.html" +
                            "?file_path=${Uri.encode(fileUri)}" +
                            "&permission=readonly" +
                            "&closebutton=false" +
                            "&lang=en"
                        wv.loadUrl(coolUrl)
                    }
                }
            }
        }
    }

    private fun createBarButton(
        symbol: String,
        textColor: Int,
        description: String,
        onClick: () -> Unit
    ): TextView {
        val outValue = TypedValue()
        theme.resolveAttribute(android.R.attr.selectableItemBackgroundBorderless, outValue, true)
        return TextView(this).apply {
            text = symbol
            contentDescription = description
            setTextColor(textColor)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 20f)
            gravity = Gravity.CENTER
            setBackgroundResource(outValue.resourceId)
            layoutParams = LinearLayout.LayoutParams(dp(44), dp(44))
            setOnClickListener { onClick() }
        }
    }

    private fun toggleLandscape() {
        isLandscape = !isLandscape
        requestedOrientation = if (isLandscape) {
            ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
        } else {
            ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        }
    }

    private fun toggleImmersive() {
        isImmersive = !isImmersive
        topBar?.visibility = if (isImmersive) View.GONE else View.VISIBLE
        val controller = WindowCompat.getInsetsController(window, window.decorView)
        controller.systemBarsBehavior =
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        if (isImmersive) {
            controller.hide(WindowInsetsCompat.Type.systemBars())
        } else {
            controller.show(WindowInsetsCompat.Type.systemBars())
        }
    }

    private fun finishWithError(message: String) {
        setResult(RESULT_CANCELED, Intent().putExtra(EXTRA_ERROR_MESSAGE, message))
        finish()
    }

    override fun onDestroy() {
        initExecutor.shutdownNow()
        bridge?.detachWebView()
        webView?.let { wv ->
            wv.stopLoading()
            wv.removeJavascriptInterface("COOLMessageHandler")
            wv.destroy()
        }
        webView = null
        bridge = null
        super.onDestroy()
    }

    private fun dp(value: Int): Int =
        TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            value.toFloat(),
            resources.displayMetrics
        ).toInt()

    companion object {
        const val EXTRA_FILE_PATH = "extra_file_path"
        const val EXTRA_TITLE = "extra_title"
        const val EXTRA_IS_PRESENTATION = "extra_is_presentation"
        const val EXTRA_ERROR_MESSAGE = "extra_error_message"

        fun createIntent(
            context: Context,
            filePath: String,
            title: String,
            isPresentation: Boolean
        ): Intent = Intent(context, CollaboraViewerActivity::class.java).apply {
            putExtra(EXTRA_FILE_PATH, filePath)
            putExtra(EXTRA_TITLE, title)
            putExtra(EXTRA_IS_PRESENTATION, isPresentation)
        }
    }
}

