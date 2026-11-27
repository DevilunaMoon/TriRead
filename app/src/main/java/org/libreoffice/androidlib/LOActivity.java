package org.libreoffice.androidlib;

import android.app.Activity;
import android.content.res.AssetManager;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.libreoffice.android.Bootstrap;
import org.libreoffice.kit.COKit;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;

/**
 * JNI bridge for Collabora Office Android (`libandroidapp.so` + `liblo-native-code.so`).
 * Method names and signatures match the exact exported JNI symbols and callbacks in `libandroidapp.so`.
 */
public class LOActivity {

    private static final String LOGTAG = "CollaboraBridge";
    private static final String UNPACK_MARKER = ".collabora_unpacked_v1";

    static {
        COKit.ensureLibrariesLoaded();
    }

    private final Activity activity;
    private static final Handler mainHandler = new Handler(Looper.getMainLooper());
    private static volatile WebView activeWebView;
    private static volatile boolean coolwsdStarted = false;
    private static volatile Runnable activeCloseCallback;

    public LOActivity(Activity activity) {
        this.activity = activity;
    }

    public void attachWebView(WebView webView, Runnable onDocumentClosedCallback) {
        activeWebView = webView;
        activeCloseCallback = onDocumentClosedCallback;
    }

    public void detachWebView() {
        activeWebView = null;
        activeCloseCallback = null;
    }

    public synchronized void ensureInitializedAndStart(String fileUriString, String userName) {
        unpackAssetsIfNeeded();

        String dataDir = activity.getApplicationInfo().dataDir;
        String cacheDir = activity.getApplication().getCacheDir().getAbsolutePath();
        String apkFile = activity.getApplication().getPackageResourcePath();

        COKit.putenv("SAL_LOG=-WARN-INFO");
        COKit.putenv("HOME=" + cacheDir);
        COKit.putenv("TMPDIR=" + cacheDir);

        if (!coolwsdStarted) {
            coolwsdStarted = true;
            createCOOLWSD(
                    dataDir,
                    cacheDir,
                    apkFile,
                    activity.getAssets(),
                    fileUriString,
                    userName
            );
        }
    }

    private void unpackAssetsIfNeeded() {
        File filesDir = activity.getFilesDir();
        File marker = new File(filesDir, UNPACK_MARKER);
        if (marker.exists()) {
            return;
        }
        try {
            copyAssetTree("unpack", filesDir);
            try (FileOutputStream fos = new FileOutputStream(marker)) {
                fos.write('1');
            }
        } catch (Exception e) {
            Log.e(LOGTAG, "Failed to unpack Collabora assets", e);
        }
    }

    private void copyAssetTree(String assetPath, File targetDir) throws Exception {
        String[] children = activity.getAssets().list(assetPath);
        if (children == null || children.length == 0) {
            File parent = targetDir.getParentFile();
            if (parent != null && !parent.exists()) {
                parent.mkdirs();
            }
            try (InputStream in = activity.getAssets().open(assetPath);
                 FileOutputStream out = new FileOutputStream(targetDir)) {
                byte[] buf = new byte[16 * 1024];
                int read;
                while ((read = in.read(buf)) > 0) {
                    out.write(buf, 0, read);
                }
            }
            return;
        }
        if (!targetDir.exists()) {
            targetDir.mkdirs();
        }
        for (String child : children) {
            copyAssetTree(assetPath + "/" + child, new File(targetDir, child));
        }
    }

    // Native methods exported by libandroidapp.so
    public native void createCOOLWSD(
            String dataDir,
            String cacheDir,
            String apkFile,
            AssetManager assetManager,
            String loadFileUri,
            String userName
    );

    public native void postMobileMessageNative(String message);

    public native void postUnoCommand(String command, String arguments);

    public native void saveAs(String url, String format, String options);

    public native String getClipboardContent(Object data);

    public native void setClipboardContent(Object data);

    public native void paste(String mimeType, byte[] data);

    /**
     * Called from C++ (`libandroidapp.so` send2JS) with WebSocket frames for `TheFakeWebSocket`.
     */
    @SuppressWarnings("unused")
    public void rawCallFakeWebsocketOnMessage(final byte[] message) {
        if (message == null || activeWebView == null) {
            return;
        }
        final String b64 = Base64.encodeToString(message, Base64.NO_WRAP);
        mainHandler.post(() -> {
            WebView wv = activeWebView;
            if (wv != null) {
                String js = "if (window.TheFakeWebSocket && window.TheFakeWebSocket.onmessage) { " +
                        "window.TheFakeWebSocket.onmessage({ data: Base64ToArrayBuffer('" + b64 + "') }); }";
                wv.evaluateJavascript(js, null);
            }
        });
    }

    /**
     * Exposed to JS as `window.COOLMessageHandler` in `assets/dist/global.js`.
     */
    public class COOLMessageHandler {

        @JavascriptInterface
        public boolean hasHardwareKeyboard() {
            return false;
        }

        @JavascriptInterface
        public boolean isChromeOS() {
            return false;
        }

        @JavascriptInterface
        public void postMobileDebug(String message) {
            Log.d(LOGTAG, "JS Debug: " + message);
        }

        @JavascriptInterface
        public void postMobileError(String message) {
            Log.e(LOGTAG, "JS Error: " + message);
        }

        @JavascriptInterface
        public void postMobileMessage(String message) {
            if (message == null) {
                return;
            }
            if ("BYE".equals(message)) {
                Runnable cb = activeCloseCallback;
                if (cb != null) {
                    mainHandler.post(cb);
                }
                return;
            }
            postMobileMessageNative(message);
        }
    }
}

