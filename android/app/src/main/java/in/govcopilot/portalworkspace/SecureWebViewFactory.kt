package in.govcopilot.portalworkspace

import android.annotation.SuppressLint
import android.webkit.WebSettings
import android.webkit.WebView

object SecureWebViewFactory {

    @SuppressLint("SetJavaScriptEnabled")
    fun applySecureDefaults(webView: WebView) {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            @Suppress("DEPRECATION")
            databaseEnabled = true
            loadsImagesAutomatically = true
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            allowFileAccess = false
            allowContentAccess = true
            javaScriptCanOpenWindowsAutomatically = false
            setSupportMultipleWindows(true)
        }
    }
}