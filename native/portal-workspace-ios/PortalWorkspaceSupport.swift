import Foundation

struct FillResult {
    let filled: Int
    let failed: Int
    let paused: Bool
    let stepId: String?
    let message: String?
}

enum StopConditionDetector {
    static let defaultPause = [
        "otp", "captcha", "password", "declaration", "payment", "submit",
        "aadhaar authentication", "face authentication", "biometric",
        "learner test", "e-sign", "digital signature",
    ]

    static func pauseKeywords(adapterPauseAt: [String]?) -> [String] {
        (adapterPauseAt ?? []) + defaultPause
    }

    static let pauseMessage =
        "This step must be completed by you. We cannot enter OTP, solve CAPTCHA, accept declarations, make payments, or submit finally."
}

enum NavigationGuard {
    static func isAllowed(url: URL, allowedHosts: Set<String>) -> Bool {
        guard let host = url.host?.lowercased() else { return false }
        return allowedHosts.contains { allowed in
            host == allowed.lowercased() || host.hasSuffix(".\(allowed.lowercased())")
        }
    }
}

enum AutofillRunner {
    static func loadScript() -> String? {
        if let url = Bundle.main.url(forResource: "autofill", withExtension: "js", subdirectory: "PortalWorkspace"),
           let data = try? Data(contentsOf: url) {
            return String(data: data, encoding: .utf8)
        }
        if let url = Bundle.main.url(forResource: "autofill", withExtension: "js"),
           let data = try? Data(contentsOf: url) {
            return String(data: data, encoding: .utf8)
        }
        return nil
    }

    static func loadAdapter(version: String) -> [String: Any]? {
        if let url = Bundle.main.url(forResource: version, withExtension: "json", subdirectory: "PortalWorkspace/adapters"),
           let data = try? Data(contentsOf: url),
           let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            return json
        }
        return PortalWorkspacePlugin.activeAdapter
    }

    static func buildInvocation(profile: [String: Any], fields: [[String: Any]], pauseKeywords: [String]) -> String? {
        guard let profileData = try? JSONSerialization.data(withJSONObject: profile),
              let fieldsData = try? JSONSerialization.data(withJSONObject: fields),
              let pauseData = try? JSONSerialization.data(withJSONObject: pauseKeywords),
              let profileStr = String(data: profileData, encoding: .utf8),
              let fieldsStr = String(data: fieldsData, encoding: .utf8),
              let pauseStr = String(data: pauseData, encoding: .utf8),
              let script = loadScript() else {
            return nil
        }
        return "(\(script))(\(profileStr), \(fieldsStr), \(pauseStr))"
    }

    static func parseResult(_ raw: Any?) -> FillResult {
        let json: [String: Any]?
        if let dict = raw as? [String: Any] {
            json = dict
        } else if let str = raw as? String {
            json = parseJsonString(str)
        } else if raw == nil || (raw as? NSNull) != nil {
            return FillResult(filled: 0, failed: 0, paused: false, stepId: nil, message: "No autofill result")
        } else {
            json = nil
        }

        guard let json else {
            return FillResult(filled: 0, failed: 1, paused: false, stepId: nil, message: "Failed to parse autofill result")
        }
        return FillResult(
            filled: intValue(json["filled"]),
            failed: intValue(json["failed"]),
            paused: json["paused"] as? Bool ?? false,
            stepId: nil,
            message: json["reason"] as? String
        )
    }

    private static func parseJsonString(_ raw: String) -> [String: Any]? {
        if raw.isEmpty || raw == "null" { return nil }
        var clean = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if clean.hasPrefix("\"") && clean.hasSuffix("\"") {
            clean = String(clean.dropFirst().dropLast())
                .replacingOccurrences(of: "\\\"", with: "\"")
                .replacingOccurrences(of: "\\\\", with: "\\")
        }
        guard let data = clean.data(using: .utf8) else { return nil }
        return try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    }

    private static func intValue(_ value: Any?) -> Int {
        if let n = value as? Int { return n }
        if let n = value as? NSNumber { return n.intValue }
        if let s = value as? String, let n = Int(s) { return n }
        return 0
    }

    static func detectStep(adapter: [String: Any]) -> [String: Any]? {
        guard let steps = adapter["steps"] as? [[String: Any]] else { return nil }
        for step in steps where step["fields"] != nil {
            return step
        }
        return steps.first
    }
}