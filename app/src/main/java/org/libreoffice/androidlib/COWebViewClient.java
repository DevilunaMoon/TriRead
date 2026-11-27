package org.libreoffice.androidlib;

import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.annotation.Nullable;

import org.libreoffice.kit.COKit;

public class COWebViewClient extends WebViewClient {

    static {
        COKit.ensureLibrariesLoaded();
    }

    public native String getEmbeddedMediaPath(String documentUri, String mediaId);

    @Nullable
    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        return super.shouldInterceptRequest(view, request);
    }
}

