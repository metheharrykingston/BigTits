package io.govcopilot.portalworkspace

import android.app.DownloadManager
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.webkit.CookieManager
import android.webkit.URLUtil
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.setPadding
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader

class PortalWorkspaceActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_BUNDLE_JSON = "bundle_json"
        var instance: PortalWorkspaceActivity? = null
    }

    private lateinit var webView: android.webkit.WebView
    private lateinit var guidanceText: TextView
    private lateinit var bundle: JSONObject
    private lateinit var uploadCoordinator: FileUploadCoordinator
    private lateinit var autofillEngine: AutofillEngine
    private var adapter: JSONObject = JSONObject()

    private val filePickerLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult(),
    ) { result ->
        val uris = WebChromeClientFileChooserResult.parse(result.resultCode, result.data)
        uploadCoordinator.onPickerResult(uris)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        instance = this

        val bundleJson = intent.getStringExtra(EXTRA_BUNDLE_JSON)
            ?: run { finish(); return }
        bundle = JSONObject(bundleJson)
        PortalWorkspacePlugin.activeBundle = bundle

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(24)
        }

        guidanceText = TextView(this).apply {
            text = "Official portal workspace — complete OTP/CAPTCHA/payment/submit yourself."
            setPadding(0, 0, 0, 16)
        }

        webView = android.webkit.WebView(this)
        SecureWebViewFactory.applySecureDefaults(webView)

        val allowedHosts = bundle.getJSONArray("allowed_hosts").let { arr ->
            (0 until arr.length()).map { arr.getString(it) }.toSet()
        }

        uploadCoordinator = FileUploadCoordinator(this, filePickerLauncher)
        webView.webChromeClient = uploadCoordinator.createChromeClient()
        webView.webViewClient = NavigationGuard(allowedHosts) { blockedUrl ->
            emit("navigation_blocked", "Blocked navigation to $blockedUrl")
        }

        webView.setDownloadListener { url, _, contentDisposition, mimeType, _ ->
            if (!url.startsWith("https://")) return@setDownloadListener
            val filename = URLUtil.guessFileName(url, contentDisposition, mimeType)
            val request = DownloadManager.Request(Uri.parse(url)).apply {
                setMimeType(mimeType)
                setTitle(filename)
                setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            }
            (getSystemService(DOWNLOAD_SERVICE) as DownloadManager).enqueue(request)
            emit("receipt_captured", "Download started: $filename")
        }

        autofillEngine = AutofillEngine(loadAutofillScript())

        val fillButton = Button(this).apply {
            text = "Fill this page"
            setOnClickListener { fillCurrentPage { showFillResult(it) } }
        }
        val closeButton = Button(this).apply {
            text = "Close workspace"
            setOnClickListener { cleanupAndFinish() }
        }

        val controls = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            addView(fillButton)
            addView(closeButton)
        }

        root.addView(guidanceText)
        root.addView(
            FrameLayout(this).apply {
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    0,
                    1f,
                )
                addView(
                    webView,
                    FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT,
                        FrameLayout.LayoutParams.MATCH_PARENT,
                    ),
                )
            },
        )
        root.addView(controls)
        setContentView(root)

        val startUrl = bundle.getString("start_url")
        webView.loadUrl(startUrl)
        emit("portal_opened", "Opened $startUrl")
        loadAdapterFromAssets(bundle.getString("adapter_version"))
    }

    private fun loadAdapterFromAssets(adapterVersion: String) {
        adapter = try {
            val raw = assets.open("adapters/$adapterVersion.json").bufferedReader().readText()
            JSONObject(raw)
        } catch (_: Exception) {
            PortalWorkspacePlugin.activeAdapter ?: JSONObject().put("steps", JSONArray())
        }
        PortalWorkspacePlugin.activeAdapter = adapter
    }

    fun setAdapter(json: JSONObject) {
        adapter = json
        PortalWorkspacePlugin.activeAdapter = json
    }

    fun fillCurrentPage(callback: (FillResult) -> Unit) {
        val pauseKeywords = StopConditionDetector.pauseKeywords(adapterList(adapter, "pause_at"))
        autofillEngine.fillCurrentPage(
            webView = webView,
            profile = bundle.getJSONObject("profile"),
            adapter = adapter,
            pauseKeywords = pauseKeywords,
        ) { result ->
            if (result.paused) {
                emit("pause_triggered", result.message, result.stepId)
            } else {
                emit("field_filled", "filled=${result.filled}, failed=${result.failed}", result.stepId)
            }
            callback(result)
        }
    }

    private fun showFillResult(result: FillResult) {
        guidanceText.text = when {
            result.paused -> result.message ?: StopConditionDetector.pauseMessage()
            !result.message.isNullOrBlank() -> result.message
            else -> "Filled ${result.filled} fields (${result.failed} failed)"
        }
    }

    private fun adapterList(adapter: JSONObject, key: String): List<String>? {
        if (!adapter.has(key)) return null
        val arr = adapter.getJSONArray(key)
        return (0 until arr.length()).map { arr.getString(it) }
    }

    private fun loadAutofillScript(): String {
        return assets.open("autofill.js").bufferedReader().use(BufferedReader::readText)
    }

    private fun emit(type: String, message: String? = null, stepId: String? = null) {
        PortalWorkspacePlugin.instance?.emitEvent(
            type,
            bundle.getString("case_id"),
            message,
            stepId,
        )
    }

    private fun cleanupAndFinish() {
        CookieManager.getInstance().removeAllCookies(null)
        webView.clearCache(true)
        webView.clearHistory()
        emit("session_ended", "Workspace closed")
        finish()
    }

    override fun onDestroy() {
        if (instance == this) instance = null
        super.onDestroy()
    }
}

/** Helper for file picker results without importing WebChromeClient at call site. */
object WebChromeClientFileChooserResult {
    fun parse(resultCode: Int, data: Intent?): Array<Uri>? {
        if (resultCode != AppCompatActivity.RESULT_OK) return null
        val uri = data?.data ?: return null
        return arrayOf(uri)
    }
}