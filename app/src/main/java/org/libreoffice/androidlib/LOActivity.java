package org.libreoffice.androidlib;

import android.app.Activity;
import android.content.res.AssetManager;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.libreoffice.kit.COKit;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

/**
 * JNI bridge for Collabora Office Android (`libandroidapp.so` + `liblo-native-code.so`).
 *
 * Bridges:
 * - JS -> Native: `window.COOLMessageHandler.postMobileMessage(msg)` -> `postMobileMessageNative(msg)`
 * - Native -> JS: `rawCallFakeWebsocketOnMessage(byte[])` -> queues ProxySocket-framed packets
 *   and triggers `window.socket.doSend()`, which `COWebViewClient.shouldInterceptRequest` fulfills
 *   for `cool:/cool/mobilesocket.../write/...` with raw binary frames (zero Base64 overhead).
 */
public class LOActivity {

    private static final String LOGTAG = "CollaboraBridge";
    private static final String UNPACK_MARKER = ".collabora_unpacked_v3";

    static {
        COKit.ensureLibrariesLoaded();
    }

    private final Activity activity;
    private static final Handler mainHandler = new Handler(Looper.getMainLooper());
    private static volatile WebView activeWebView;
    private static volatile Runnable activeCloseCallback;
    private static volatile Runnable activeReadyCallback;
    private static volatile boolean envConfigured = false;

    // MobileSocket (ProxySocket) inbound message queue & serial counter (starts at 1 to match global.js)
    private static final ConcurrentLinkedQueue<byte[]> pendingFrames = new ConcurrentLinkedQueue<>();
    private static final AtomicLong incomingSerial = new AtomicLong(1L);
    private static final AtomicBoolean flushScheduled = new AtomicBoolean(false);
    private static final String JS_FLUSH_SOCKET =
            "if (window.socket && window.socket.sessionId !== 'open' && window.socket.doSend) { window.socket.doSend(); }";

    public LOActivity(Activity activity) {
        this.activity = activity;
    }

    public void attachWebView(WebView webView, Runnable onDocumentClosedCallback, Runnable onDocumentReadyCallback) {
        pendingFrames.clear();
        incomingSerial.set(1L);
        flushScheduled.set(false);
        activeWebView = webView;
        activeCloseCallback = onDocumentClosedCallback;
        activeReadyCallback = onDocumentReadyCallback;
    }

    public void detachWebView() {
        activeWebView = null;
        activeCloseCallback = null;
        activeReadyCallback = null;
        pendingFrames.clear();
        flushScheduled.set(false);
    }

    public synchronized void ensureInitializedAndStart(String fileUriString, String userName) {
        String dataDir = activity.getApplicationInfo().dataDir;
        String cacheDir = activity.getApplication().getCacheDir().getAbsolutePath();
        String apkFile = activity.getApplication().getPackageResourcePath();

        unpackAssetsIfNeeded(new File(dataDir));

        if (!envConfigured) {
            envConfigured = true;
            // Silence verbose LibreOfficeKit logs on hot rendering path for smooth scrolling
            COKit.putenv("SAL_LOG=-WARN-INFO");
            COKit.putenv("HOME=" + cacheDir);
            COKit.putenv("TMPDIR=" + cacheDir);
        }

        createCOOLWSD(
                dataDir,
                cacheDir,
                apkFile,
                activity.getAssets(),
                fileUriString,
                "classic",
                userName
        );
    }

    private void unpackAssetsIfNeeded(File dataDir) {
        File fontCacheDir = new File(dataDir, "fontconfig");
        if (!fontCacheDir.exists()) {
            fontCacheDir.mkdirs();
        }
        File marker = new File(dataDir, UNPACK_MARKER);
        if (marker.exists()) {
            return;
        }
        try {
            copyAssetTree("unpack", dataDir, dataDir.getAbsolutePath(), activity.getPackageName());
            try (FileOutputStream fos = new FileOutputStream(marker)) {
                fos.write('1');
            }
            Log.i(LOGTAG, "Unpacked Collabora assets into " + dataDir.getAbsolutePath()
                    + " (fonts.conf=" + new File(dataDir, "etc/fonts/fonts.conf").exists()
                    + ", sofficerc=" + new File(dataDir, "program/sofficerc").exists()
                    + ", udkapi.rdb=" + new File(dataDir, "program/udkapi.rdb").exists()
                    + ", offapi.rdb=" + new File(dataDir, "program/offapi.rdb").exists() + ")");
        } catch (Exception e) {
            Log.e(LOGTAG, "Failed to unpack Collabora assets", e);
        }
    }

    private void copyAssetTree(String assetPath, File targetDir, String dataDirPath, String packageName) throws Exception {
        String[] children = activity.getAssets().list(assetPath);
        if (children == null || children.length == 0) {
            File parent = targetDir.getParentFile();
            if (parent != null && !parent.exists()) {
                parent.mkdirs();
            }
            String lower = assetPath.toLowerCase();
            boolean isTextConfig = lower.endsWith(".conf") || lower.endsWith("rc") || lower.endsWith(".ini");
            if (isTextConfig) {
                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                try (InputStream in = activity.getAssets().open(assetPath)) {
                    byte[] buf = new byte[8 * 1024];
                    int read;
                    while ((read = in.read(buf)) > 0) {
                        baos.write(buf, 0, read);
                    }
                }
                String content = new String(baos.toByteArray(), StandardCharsets.UTF_8)
                        .replace("/data/data/com.collabora.libreoffice", dataDirPath)
                        .replace("/data/user/0/com.collabora.libreoffice", dataDirPath)
                        .replace("com.collabora.libreoffice", packageName);
                try (FileOutputStream out = new FileOutputStream(targetDir)) {
                    out.write(content.getBytes(StandardCharsets.UTF_8));
                }
            } else {
                try (InputStream in = activity.getAssets().open(assetPath);
                     FileOutputStream out = new FileOutputStream(targetDir)) {
                    byte[] buf = new byte[16 * 1024];
                    int read;
                    while ((read = in.read(buf)) > 0) {
                        out.write(buf, 0, read);
                    }
                }
            }
            return;
        }
        if (!targetDir.exists()) {
            targetDir.mkdirs();
        }
        for (String child : children) {
            copyAssetTree(assetPath + "/" + child, new File(targetDir, child), dataDirPath, packageName);
        }
    }

    // Native methods exported by libandroidapp.so
    public native void createCOOLWSD(
            String dataDir,
            String cacheDir,
            String apkFile,
            AssetManager assetManager,
            String loadFileUri,
            String uiMode,
            String userName
    );

    public native void postMobileMessageNative(String message);

    public native void postUnoCommand(String command, String arguments);

    public native void saveAs(String url, String format, String options);

    public native String getClipboardContent(Object data);

    public native void setClipboardContent(Object data);

    public native void paste(String mimeType, byte[] data);

    /**
     * Called from C++ (`libandroidapp.so` send2JS / `[app2js]` thread) with WebSocket payloads.
     * Encodes each message into Collabora's `ProxySocket` wire format (`T`/`B` + hex serial + hex len)
     * and nudges `window.socket.doSend()` on the UI thread to pull queued bytes via `COWebViewClient`.
     */
    @SuppressWarnings("unused")
    public void rawCallFakeWebsocketOnMessage(final byte[] message) {
        if (message == null || message.length == 0 || activeWebView == null) {
            return;
        }

        boolean isBinary = isBinaryPayload(message);
        long serial = incomingSerial.getAndIncrement();
        char typePrefix = isBinary ? 'B' : 'T';

        String header = typePrefix + "0x" + Long.toHexString(serial) + "\n"
                + "0x" + Integer.toHexString(message.length) + "\n";
        byte[] headerBytes = header.getBytes(StandardCharsets.US_ASCII);

        byte[] framed = new byte[headerBytes.length + message.length + 1];
        System.arraycopy(headerBytes, 0, framed, 0, headerBytes.length);
        System.arraycopy(message, 0, framed, headerBytes.length, message.length);
        framed[framed.length - 1] = '\n';

        pendingFrames.add(framed);
        // Coalesce burst tile frames within 8ms into a single XHR pull
        scheduleSocketFlush(8L);
    }

    /**
     * Drains all queued ProxySocket-framed bytes for `COWebViewClient.shouldInterceptRequest`.
     */
    public static byte[] drainPendingMessages() {
        ByteArrayOutputStream out = new ByteArrayOutputStream(32 * 1024);
        byte[] frame;
        while ((frame = pendingFrames.poll()) != null) {
            out.write(frame, 0, frame.length);
        }
        return out.toByteArray();
    }

    /**
     * Nudges `window.socket.doSend()` on the UI thread so `ProxySocket` pulls queued frames.
     */
    public static void scheduleSocketFlush(long delayMs) {
        if (flushScheduled.compareAndSet(false, true)) {
            Runnable task = () -> {
                flushScheduled.set(false);
                WebView wv = activeWebView;
                if (wv != null && !pendingFrames.isEmpty()) {
                    wv.evaluateJavascript(JS_FLUSH_SOCKET, null);
                }
            };
            if (delayMs > 0L) {
                mainHandler.postDelayed(task, delayMs);
            } else {
                mainHandler.post(task);
            }
        }
    }

    private static int indexOfNewline(byte[] data) {
        for (int i = 0; i < data.length; i++) {
            if (data[i] == '\n') {
                return i;
            }
        }
        return -1;
    }

    private static boolean isBinaryPayload(byte[] data) {
        // Check known binary COOL message prefixes first
        if (startsWithAscii(data, "tile:")
                || startsWithAscii(data, "tilecombine:")
                || startsWithAscii(data, "windowpaint:")
                || startsWithAscii(data, "dialogpaint:")
                || startsWithAscii(data, "renderfont:")
                || startsWithAscii(data, "slidelayer:")
                || startsWithAscii(data, "deltawindow:")
                || startsWithAscii(data, "downloadas:")) {
            return true;
        }
        // Fallback: check for NUL or control bytes (excluding \t, \n, \r)
        int limit = Math.min(data.length, 4096);
        for (int i = 0; i < limit; i++) {
            int b = data[i] & 0xFF;
            if (b == 0 || (b < 0x20 && b != '\t' && b != '\n' && b != '\r')) {
                return true;
            }
        }
        return false;
    }

    private static boolean startsWithAscii(byte[] data, String prefix) {
        if (data.length < prefix.length()) {
            return false;
        }
        for (int i = 0; i < prefix.length(); i++) {
            if ((data[i] & 0xFF) != prefix.charAt(i)) {
                return false;
            }
        }
        return true;
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
            // No-op in production for smooth scrolling
        }

        @JavascriptInterface
        public void postMobileError(String message) {
            Log.e(LOGTAG, "JS Error: " + message);
        }

        @JavascriptInterface
        public void postMobileMessage(String message) {
            if (message == null || message.isEmpty()) {
                return;
            }

            if ("BYE".equals(message) || "CLOSE_WINDOW".equals(message)) {
                Runnable cb = activeCloseCallback;
                if (cb != null) {
                    mainHandler.post(cb);
                }
                return;
            }

            if ("hideProgressbar".equals(message)) {
                Runnable cb = activeReadyCallback;
                if (cb != null) {
                    mainHandler.post(cb);
                }
                return;
            }

            // Intercept Collabora Android UI-only messages that are NOT COOLWSD protocol commands.
            // Forwarding these to COOLWSD triggers `error: cmd=... kind=unknown` modals in cool.html.
            if (isAndroidUiOnlyMessage(message)) {
                return;
            }

            postMobileMessageNative(message);
        }

        private boolean isAndroidUiOnlyMessage(String message) {
            int spaceIdx = message.indexOf(' ');
            String cmd = spaceIdx > 0 ? message.substring(0, spaceIdx) : message;
            switch (cmd) {
                case "LIGHT_SCREEN":
                case "DARK_SCREEN":
                case "DIM_SCREEN":
                case "hideProgressbar":
                case "EDITMODE":
                case "MOBILEWIZARD":
                case "FOCUSIFHWKBD":
                case "PRINT":
                case "FONTPICKER":
                case "LICENSE":
                case "EXCHANGEMONITORS":
                case "SYNCSETTINGS":
                case "REQUESTFILECOPY":
                case "FILEDRAGENTER":
                case "SAVESTARTED":
                case "SAVECOMPLETED":
                case "SAVEFAILED":
                case "SLIDESHOW":
                case "HYPERLINK":
                case "SETDARKMODE":
                case "SETTEMPLATEDROPTARGET":
                case "COMMANDRESULT":
                case "COMMANDSTATECHANGED":
                case "TABTHUMBNAIL":
                case "TEXTCLIPBOARD":
                case "REMOTEBOOTSTRAPFAILED":
                case "exportfile":
                case "extensionsavefile":
                case "insertfile":
                case "newdoc":
                case "opendoc":
                case "openremote":
                case "removecloudaccount":
                case "switchToServerMode":
                    return true;
                default:
                    return false;
            }
        }
    }
}
