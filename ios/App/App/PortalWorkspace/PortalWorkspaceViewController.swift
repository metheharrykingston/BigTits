import UIKit
import WebKit
import Capacitor
import UniformTypeIdentifiers

/// Full-screen official portal workspace with WKWebView.
final class PortalWorkspaceViewController: UIViewController, WKScriptMessageHandler {
    private weak var plugin: PortalWorkspacePlugin?
    private let bundle: [String: Any]
    private var adapter: [String: Any] = [:]
    private let webConfig: WKWebViewConfiguration
    private lazy var webView = WKWebView(frame: .zero, configuration: webConfig)
    private let guidanceLabel = UILabel()
    private var filePickerCompletion: (([URL]?) -> Void)?
    private var legacyFileInputId: String?

    init(plugin: PortalWorkspacePlugin, bundle: [String: Any]) {
        self.plugin = plugin
        self.bundle = bundle
        let config = WKWebViewConfiguration()
        config.userContentController.addUserScript(Self.legacyFilePickerScript())
        self.webConfig = config
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground

        guidanceLabel.text = "Official portal — complete OTP, CAPTCHA, payment, and submit yourself."
        guidanceLabel.numberOfLines = 0
        guidanceLabel.font = .preferredFont(forTextStyle: .footnote)
        guidanceLabel.textColor = .secondaryLabel

        webConfig.userContentController.add(self, name: "portalFilePicker")
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true

        let fillButton = UIButton(type: .system)
        fillButton.setTitle("Fill this page", for: .normal)
        fillButton.addTarget(self, action: #selector(onFill), for: .touchUpInside)

        let closeButton = UIButton(type: .system)
        closeButton.setTitle("Close workspace", for: .normal)
        closeButton.addTarget(self, action: #selector(onClose), for: .touchUpInside)

        let buttonRow = UIStackView(arrangedSubviews: [fillButton, closeButton])
        buttonRow.axis = .horizontal
        buttonRow.spacing = 16
        buttonRow.distribution = .fillEqually

        let stack = UIStackView(arrangedSubviews: [guidanceLabel, webView, buttonRow])
        stack.axis = .vertical
        stack.spacing = 12
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)

        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 16),
            stack.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -16),
            stack.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 8),
            stack.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -8),
            buttonRow.heightAnchor.constraint(equalToConstant: 44),
        ])

        if let version = bundle["adapter_version"] as? String,
           let loaded = AutofillRunner.loadAdapter(version: version) {
            adapter = loaded
            PortalWorkspacePlugin.activeAdapter = loaded
        }

        if let startUrl = bundle["start_url"] as? String, let url = URL(string: startUrl) {
            webView.load(URLRequest(url: url))
            emit("portal_opened", message: "Opened \(startUrl)")
        }
    }

    @objc private func onFill() {
        fillCurrentPage { [weak self] result in
            DispatchQueue.main.async {
                self?.guidanceLabel.text = {
                    if result.paused { return result.message ?? StopConditionDetector.pauseMessage }
                    if let msg = result.message, !msg.isEmpty { return msg }
                    return "Filled \(result.filled) fields (\(result.failed) failed)"
                }()
            }
        }
    }

    @objc private func onClose() {
        dismissWorkspace()
    }

    func dismissWorkspace() {
        webConfig.userContentController.removeScriptMessageHandler(forName: "portalFilePicker")
        WKWebsiteDataStore.default().removeData(
            ofTypes: WKWebsiteDataStore.allWebsiteDataTypes(),
            modifiedSince: Date(timeIntervalSince1970: 0)
        ) { }
        emit("session_ended", message: "Workspace closed")
        dismiss(animated: true)
        PortalWorkspacePlugin.workspace = nil
    }

    func fillCurrentPage(completion: @escaping (FillResult) -> Void) {
        guard let step = AutofillRunner.detectStep(adapter: adapter),
              let fields = step["fields"] as? [[String: Any]],
              let profile = bundle["profile"] as? [String: Any] else {
            completion(FillResult(filled: 0, failed: 0, paused: false, stepId: nil, message: "No matching adapter step on this page."))
            return
        }

        var pauseList = StopConditionDetector.defaultPause
        if let pauseAt = adapter["pause_at"] as? [String] {
            pauseList = StopConditionDetector.pauseKeywords(adapterPauseAt: pauseAt)
        }

        guard let js = AutofillRunner.buildInvocation(profile: profile, fields: fields, pauseKeywords: pauseList) else {
            completion(FillResult(filled: 0, failed: 1, paused: false, stepId: nil, message: "Autofill script missing"))
            return
        }

        webView.evaluateJavaScript(js) { [weak self] raw, _ in
            var result = AutofillRunner.parseResult(raw)
            let stepId = step["step_id"] as? String
            if result.paused {
                result = FillResult(
                    filled: 0, failed: 0, paused: true, stepId: stepId,
                    message: StopConditionDetector.pauseMessage
                )
                self?.emit("pause_triggered", message: result.message, stepId: stepId)
            } else {
                result = FillResult(
                    filled: result.filled, failed: result.failed, paused: false, stepId: stepId,
                    message: step["next_instruction"] as? String
                )
                self?.emit("field_filled", message: "filled=\(result.filled), failed=\(result.failed)", stepId: stepId)
            }
            completion(result)
        }
    }

    private func emit(_ type: String, message: String? = nil, stepId: String? = nil) {
        let caseId = bundle["case_id"] as? String ?? "unknown"
        plugin?.emitEvent(type: type, caseId: caseId, message: message, stepId: stepId)
    }

    private func allowedHosts() -> Set<String> {
        guard let hosts = bundle["allowed_hosts"] as? [String] else { return [] }
        return Set(hosts)
    }

    private static func legacyFilePickerScript() -> WKUserScript {
        let source = """
        (function () {
          if (window.__portalFilePickerInstalled) return;
          window.__portalFilePickerInstalled = true;
          document.addEventListener('click', function (e) {
            var t = e.target;
            if (!t || t.tagName !== 'INPUT' || t.type !== 'file') return;
            if (!window.webkit || !window.webkit.messageHandlers || !window.webkit.messageHandlers.portalFilePicker) return;
            e.preventDefault();
            e.stopPropagation();
            window.__portalFileInput = t;
            window.webkit.messageHandlers.portalFilePicker.postMessage({
              accept: t.accept || '',
              multiple: !!t.multiple,
              id: t.id || ''
            });
          }, true);
        })();
        """
        return WKUserScript(source: source, injectionTime: .atDocumentEnd, forMainFrameOnly: false)
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "portalFilePicker" else { return }
        if #available(iOS 18.4, *) { return }

        let body = message.body as? [String: Any]
        legacyFileInputId = body?["id"] as? String
        filePickerCompletion = nil
        let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.image, .pdf, .data], asCopy: true)
        picker.delegate = self
        picker.allowsMultipleSelection = body?["multiple"] as? Bool ?? false
        present(picker, animated: true)
    }

    private func assignPickedFilesToWebView(urls: [URL]) {
        guard !urls.isEmpty else { return }
        let entries = urls.compactMap { url -> String? in
            let accessed = url.startAccessingSecurityScopedResource()
            defer { if accessed { url.stopAccessingSecurityScopedResource() } }
            guard let data = try? Data(contentsOf: url) else { return nil }
            let name = url.lastPathComponent.replacingOccurrences(of: "'", with: "\\'")
            let mime = UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
            let b64 = data.base64EncodedString()
            return "{name:'\(name)',type:'\(mime)',data:'\(b64)'}"
        }
        guard !entries.isEmpty else { return }

        let inputSelector: String
        if let id = legacyFileInputId, !id.isEmpty {
            inputSelector = "document.getElementById('\(id.replacingOccurrences(of: "'", with: "\\'"))')"
        } else {
            inputSelector = "window.__portalFileInput"
        }

        let js = """
        (function () {
          var input = \(inputSelector);
          if (!input) return;
          var files = [\(entries.joined(separator: ","))].map(function (f) {
            var bin = atob(f.data);
            var bytes = new Uint8Array(bin.length);
            for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            return new File([bytes], f.name, { type: f.type });
          });
          var dt = new DataTransfer();
          files.forEach(function (file) { dt.items.add(file); });
          input.files = dt.files;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        })();
        """
        webView.evaluateJavaScript(js, completionHandler: nil)
        legacyFileInputId = nil
    }
}

extension PortalWorkspaceViewController: WKNavigationDelegate {
    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }
        if NavigationGuard.isAllowed(url: url, allowedHosts: allowedHosts()) {
            decisionHandler(.allow)
        } else {
            emit("navigation_blocked", message: "Blocked navigation to \(url.absoluteString)")
            decisionHandler(.cancel)
        }
    }
}

extension PortalWorkspaceViewController: WKUIDelegate {
    @available(iOS 18.4, *)
    func webView(
        _ webView: WKWebView,
        runOpenPanelWith parameters: WKOpenPanelParameters,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping ([URL]?) -> Void
    ) {
        filePickerCompletion = completionHandler
        let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.image, .pdf, .data], asCopy: true)
        picker.delegate = self
        picker.allowsMultipleSelection = parameters.allowsMultipleSelection
        present(picker, animated: true)
    }
}

extension PortalWorkspaceViewController: UIDocumentPickerDelegate {
    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        if let completion = filePickerCompletion {
            completion(urls)
            filePickerCompletion = nil
        } else {
            assignPickedFilesToWebView(urls: urls)
        }
    }

    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        if let completion = filePickerCompletion {
            completion(nil)
            filePickerCompletion = nil
        }
        legacyFileInputId = nil
    }
}