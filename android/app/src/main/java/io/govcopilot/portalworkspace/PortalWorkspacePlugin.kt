package io.govcopilot.portalworkspace

import android.content.Intent
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONObject

@CapacitorPlugin(name = "PortalWorkspace")
class PortalWorkspacePlugin : Plugin() {

    companion object {
        var instance: PortalWorkspacePlugin? = null
        var activeCall: PluginCall? = null
        var activeBundle: JSONObject? = null
        var activeAdapter: JSONObject? = null
        var sessionId: String? = null
    }

    override fun load() {
        super.load()
        instance = this
    }

    @PluginMethod
    fun open(call: PluginCall) {
        val bundleObj = call.getObject("bundle") ?: run {
            call.reject("bundle is required")
            return
        }

        activeCall = call
        activeBundle = JSONObject(bundleObj.toString())
        sessionId = "SES_${System.currentTimeMillis()}"

        val intent = Intent(context, PortalWorkspaceActivity::class.java).apply {
            putExtra(PortalWorkspaceActivity.EXTRA_BUNDLE_JSON, bundleObj.toString())
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)

        val ret = JSObject()
        ret.put("sessionId", sessionId)
        call.resolve(ret)
    }

    @PluginMethod
    fun close(call: PluginCall) {
        PortalWorkspaceActivity.instance?.finish()
        activeCall = null
        activeBundle = null
        activeAdapter = null
        sessionId = null
        call.resolve()
    }

    @PluginMethod
    fun fillCurrentPage(call: PluginCall) {
        val activity = PortalWorkspaceActivity.instance
        if (activity == null) {
            call.reject("Portal workspace is not open")
            return
        }
        activity.fillCurrentPage { result ->
            val ret = JSObject()
            ret.put("filled", result.filled)
            ret.put("failed", result.failed)
            ret.put("paused", result.paused)
            ret.put("step_id", result.stepId)
            ret.put("message", result.message)
            call.resolve(ret)
        }
    }

    fun emitEvent(type: String, caseId: String, message: String? = null, stepId: String? = null) {
        val payload = JSObject()
        payload.put("session_id", sessionId ?: "unknown")
        payload.put("case_id", caseId)
        payload.put("event_type", type)
        payload.put("timestamp", java.time.Instant.now().toString())
        if (message != null) payload.put("message", message)
        if (stepId != null) payload.put("step_id", stepId)
        notifyListeners("portalEvent", payload)
    }
}