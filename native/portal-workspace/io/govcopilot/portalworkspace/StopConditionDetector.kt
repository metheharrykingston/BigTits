package io.govcopilot.portalworkspace

object StopConditionDetector {
    private val defaultPause = listOf(
        "otp",
        "captcha",
        "password",
        "declaration",
        "payment",
        "submit",
        "aadhaar authentication",
        "face authentication",
        "biometric",
        "learner test",
        "e-sign",
        "digital signature",
    )

    fun pauseKeywords(adapterPauseAt: List<String>?): List<String> {
        return (adapterPauseAt ?: emptyList()) + defaultPause
    }

    fun pauseMessage(): String =
        "This step must be completed by you. We cannot enter OTP, solve CAPTCHA, accept declarations, make payments, or submit finally."
}