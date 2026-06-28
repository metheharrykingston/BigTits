package in.govcopilot.portalworkspace

import android.webkit.WebView
import org.json.JSONArray
import org.json.JSONObject

data class FillResult(
    val filled: Int,
    val failed: Int,
    val paused: Boolean,
    val stepId: String? = null,
    val message: String? = null,
)

class AutofillEngine(private val autofillScript: String) {

    fun fillCurrentPage(
        webView: WebView,
        profile: JSONObject,
        adapter: JSONObject,
        pauseKeywords: List<String>,
        callback: (FillResult) -> Unit,
    ) {
        val steps = adapter.optJSONArray("steps") ?: JSONArray()
        val step = detectStep(steps) ?: run {
            callback(
                FillResult(
                    filled = 0,
                    failed = 0,
                    paused = false,
                    message = "No matching adapter step detected on this page.",
                ),
            )
            return
        }

        val fields = step.optJSONArray("fields") ?: JSONArray()
        val js = buildInvocation(profile, fields, pauseKeywords)
        webView.evaluateJavascript(js) { raw ->
            val parsed = parseResult(raw)
            if (parsed.paused) {
                callback(
                    FillResult(
                        filled = 0,
                        failed = 0,
                        paused = true,
                        stepId = step.optString("step_id"),
                        message = StopConditionDetector.pauseMessage(),
                    ),
                )
                return@evaluateJavascript
            }
            callback(
                FillResult(
                    filled = parsed.filled,
                    failed = parsed.failed,
                    paused = false,
                    stepId = step.optString("step_id"),
                    message = step.optString("next_instruction"),
                ),
            )
        }
    }

    private fun detectStep(steps: JSONArray): JSONObject? {
        for (i in 0 until steps.length()) {
            val step = steps.getJSONObject(i)
            if (step.has("fields")) return step
        }
        return if (steps.length() > 0) steps.getJSONObject(0) else null
    }

    private fun buildInvocation(
        profile: JSONObject,
        fields: JSONArray,
        pauseKeywords: List<String>,
    ): String {
        val pauseArray = JSONArray()
        pauseKeywords.forEach { pauseArray.put(it) }
        return "($autofillScript)($profile, $fields, $pauseArray)"
    }

    private fun parseResult(raw: String?): FillResult {
        if (raw.isNullOrBlank() || raw == "null") {
            return FillResult(0, 0, false, message = "No autofill result")
        }
        return try {
            val clean = raw.trim().removePrefix("\"").removeSuffix("\"")
                .replace("\\\\", "\\")
                .replace("\\\"", "\"")
            val json = JSONObject(clean)
            FillResult(
                filled = json.optInt("filled", 0),
                failed = json.optInt("failed", 0),
                paused = json.optBoolean("paused", false),
                message = json.optString("reason", null),
            )
        } catch (_: Exception) {
            FillResult(0, 1, false, message = "Failed to parse autofill result")
        }
    }
}