import Foundation
import Capacitor

/// Capacitor bridge for Gov Copilot portal workspace (WKWebView + autofill).
@objc(PortalWorkspacePlugin)
public class PortalWorkspacePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PortalWorkspacePlugin"
    public let jsName = "PortalWorkspace"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "close", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "fillCurrentPage", returnType: CAPPluginReturnPromise),
    ]

    public static weak var shared: PortalWorkspacePlugin?
    public static var sessionId: String?
    public static var activeBundle: [String: Any]?
    public static var activeAdapter: [String: Any]?
    public static weak var workspace: PortalWorkspaceViewController?

    public override func load() {
        PortalWorkspacePlugin.shared = self
    }

    @objc func open(_ call: CAPPluginCall) {
        guard let bundle = call.getObject("bundle") else {
            call.reject("bundle is required")
            return
        }

        PortalWorkspacePlugin.activeBundle = bundle
        PortalWorkspacePlugin.sessionId = "SES_\(Int(Date().timeIntervalSince1970 * 1000))"

        DispatchQueue.main.async {
            guard let presenter = self.bridge?.viewController else {
                call.reject("No view controller")
                return
            }
            if PortalWorkspacePlugin.workspace != nil {
                call.reject("Portal workspace already open")
                return
            }

            let workspace = PortalWorkspaceViewController(plugin: self, bundle: bundle)
            workspace.modalPresentationStyle = .fullScreen
            presenter.present(workspace, animated: true)
            PortalWorkspacePlugin.workspace = workspace

            let ret = JSObject()
            ret["sessionId"] = PortalWorkspacePlugin.sessionId
            call.resolve(ret)
        }
    }

    @objc func close(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            PortalWorkspacePlugin.workspace?.dismissWorkspace()
            PortalWorkspacePlugin.workspace = nil
            PortalWorkspacePlugin.activeBundle = nil
            PortalWorkspacePlugin.activeAdapter = nil
            PortalWorkspacePlugin.sessionId = nil
            call.resolve()
        }
    }

    @objc func fillCurrentPage(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let workspace = PortalWorkspacePlugin.workspace else {
                call.reject("Portal workspace is not open")
                return
            }
            workspace.fillCurrentPage { result in
                let ret = JSObject()
                ret["filled"] = result.filled
                ret["failed"] = result.failed
                ret["paused"] = result.paused
                if let stepId = result.stepId { ret["step_id"] = stepId }
                if let message = result.message { ret["message"] = message }
                call.resolve(ret)
            }
        }
    }

    func emitEvent(type: String, caseId: String, message: String? = nil, stepId: String? = nil) {
        let payload = JSObject()
        payload["session_id"] = PortalWorkspacePlugin.sessionId ?? "unknown"
        payload["case_id"] = caseId
        payload["event_type"] = type
        payload["timestamp"] = ISO8601DateFormatter().string(from: Date())
        if let message = message { payload["message"] = message }
        if let stepId = stepId { payload["step_id"] = stepId }
        notifyListeners("portalEvent", data: payload)
    }
}