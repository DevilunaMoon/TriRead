package org.libreoffice.androidlib;

import android.util.Log;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.annotation.Nullable;

import org.libreoffice.kit.COKit;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

/**
 * Intercepts Collabora's `cool:/cool/mobilesocket...` XHR endpoints used by `ProxySocket`
 * (`global.js`) on Android so `cool.html` completes its session handshake (`/open/`) and
 * streams binary/text frames from `LOActivity` (`/write/`) without Base64 JS overhead.
 */
public class COWebViewClient extends WebViewClient {

    private static final String LOGTAG = "CollaboraBridge";

    static {
        COKit.ensureLibrariesLoaded();
    }

    public native String getEmbeddedMediaPath(String documentUri, String mediaId);

    @Nullable
    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        if (request == null || request.getUrl() == null) {
            return super.shouldInterceptRequest(view, request);
        }

        String url = request.getUrl().toString();
        if (url.startsWith("cool:/cool/mobilesocket")) {
            Map<String, String> headers = new HashMap<>();
            headers.put("Access-Control-Allow-Origin", "*");
            headers.put("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            headers.put("Access-Control-Allow-Headers", "*");
            headers.put("Cache-Control", "no-store");

            if (url.contains("/open/")) {
                byte[] sessionId = "mobile".getBytes(StandardCharsets.UTF_8);
                // Flush any early native messages shortly after JS marks readyState = 1
                LOActivity.scheduleSocketFlush(40L);
                return new WebResourceResponse(
                        "text/plain",
                        "UTF-8",
                        200,
                        "OK",
                        headers,
                        new ByteArrayInputStream(sessionId)
                );
            }

            if (url.contains("/write/")) {
                byte[] payload = LOActivity.drainPendingMessages();
                return new WebResourceResponse(
                        "application/octet-stream",
                        null,
                        200,
                        "OK",
                        headers,
                        new ByteArrayInputStream(payload)
                );
            }

            if (url.contains("/close/")) {
                return new WebResourceResponse(
                        "text/plain",
                        "UTF-8",
                        200,
                        "OK",
                        headers,
                        new ByteArrayInputStream(new byte[0])
                );
            }
        }

        return super.shouldInterceptRequest(view, request);
    }
}
