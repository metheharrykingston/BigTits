package io.govcopilot.portalworkspace

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView
import androidx.activity.result.ActivityResultLauncher

class FileUploadCoordinator(
    private val activity: Activity,
    private val filePickerLauncher: ActivityResultLauncher<Intent>,
) {
    private var filePathCallback: ValueCallback<Array<Uri>>? = null

    fun createChromeClient(): WebChromeClient = object : WebChromeClient() {
        override fun onShowFileChooser(
            webView: WebView?,
            filePathCallback: ValueCallback<Array<Uri>>?,
            fileChooserParams: FileChooserParams?,
        ): Boolean {
            this@FileUploadCoordinator.filePathCallback?.onReceiveValue(null)
            this@FileUploadCoordinator.filePathCallback = filePathCallback

            val intent = fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                type = "*/*"
                addCategory(Intent.CATEGORY_OPENABLE)
            }
            filePickerLauncher.launch(intent)
            return true
        }

        override fun onCreateWindow(
            view: WebView?,
            isDialog: Boolean,
            isUserGesture: Boolean,
            resultMsg: android.os.Message?,
        ): Boolean {
            // Controlled popups — do not spawn unmanaged windows in MVP
            return false
        }
    }

    fun onPickerResult(uris: Array<Uri>?) {
        filePathCallback?.onReceiveValue(uris)
        filePathCallback = null
    }
}