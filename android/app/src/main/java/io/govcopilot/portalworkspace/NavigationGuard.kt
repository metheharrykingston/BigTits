package io.govcopilot.portalworkspace

import android.net.Uri
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient

class NavigationGuard(
    private val allowedHosts: Set<String>,
    private val onBlocked: (String) -> Unit,
) : WebViewClient() {

    override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
        val url = request?.url?.toString() ?: return false
        return !isAllowed(url)
    }

    @Deprecated("Deprecated in Java")
    override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
        if (url == null) return false
        return !isAllowed(url)
    }

    private fun isAllowed(url: String): Boolean {
        return try {
            val host = Uri.parse(url).host ?: return false
            val ok = allowedHosts.any { host == it || host.endsWith(".$it") }
            if (!ok) onBlocked(url)
            ok
        } catch (_: Exception) {
            onBlocked(url)
            false
        }
    }
}