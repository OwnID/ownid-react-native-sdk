import Combine
import Foundation
import LocalAuthentication
import OwnIDCoreSDK
import SwiftUI
import UIKit

private func ownerScopedEventBody(_ body: [String: Any], ownerToken: String) -> [String: Any] {
    var scopedBody = body
    scopedBody["ownerToken"] = ownerToken
    return scopedBody
}

private func normalizedMetadata(_ metadata: Any?) -> String {
    guard let metadata else { return "" }
    if let metadata = metadata as? String { return metadata }

    guard let data = try? JSONSerialization.data(
        withJSONObject: metadata,
        options: [.fragmentsAllowed]
    ) else { return "" }
    return String(data: data, encoding: .utf8) ?? ""
}

open class OwnIDButtonViewController: UIViewController {
    private enum Constants {
        static let buttonHeightOffset = 14.0
    }

    private static var nextInstanceId: Int = 0
    private let instanceId: Int

    private let resultPublisher = PassthroughSubject<Void, Never>()
    private var bag = Set<AnyCancellable>()

    private var ownIdRegisterButton: SafeAreaIgnoringAutoSizingHostingController<OwnID.FlowsSDK.RegisterView>?
    private var ownIdLoginButton: SafeAreaIgnoringAutoSizingHostingController<OwnID.FlowsSDK.LoginView>?

    public var ownIDLoginViewModel: OwnID.FlowsSDK.LoginView.ViewModel?
    public var ownIDRegisterModel: OwnID.FlowsSDK.RegisterView.ViewModel?

    var authIntegration: AuthIntegration!
    var onContentReady: (() -> Void)? {
        didSet {
            deliverPendingContentReadyIfNeeded()
        }
    }

    @Published public var loginId = ""
    var type: ViewDisplayType = .login
    var widgetType: OwnID.UISDK.WidgetType = .iconButton
    var widgetPosition: OwnID.UISDK.WidgetPosition = .leading
    var showOr = true
    var iconColor: UIColor?
    var buttonBorderColor: UIColor?
    var buttonBackgroundColor: UIColor?
    var buttonTextColor: UIColor?
    var shouldShowTooltip = false
    var tooltipPosition: OwnID.UISDK.TooltipPositionType = .bottom
    var tooltipBackgroundColor: UIColor?
    var tooltipBorderColor: UIColor?
    var tooltipTextColor: UIColor?
    var showSpinner = true
    var spinnerColor: UIColor?
    var spinnerBackgroundColor: UIColor?
    var height = CGFloat.zero
    //    private var pendingContentReadyReason: String?
    private var lastForwardedLayout: (size: CGSize, ignoreParent: Bool)?
    private var hasCreatedContent = false
    private var forceNextForward = false
    private var lastConfiguredType: ViewDisplayType?
    private var lastConfiguredWidgetType: OwnID.UISDK.WidgetType?
    private var tapGestureRecognizer: UITapGestureRecognizer?
    private var ownerToken = ""
    weak var paperOwner: OwnIDButtonViewControllerWrapperView?

    @objc public var onNativeFlow: (([String: Any]) -> Void)?
    @objc public var onNativeIntegration: (([String: Any]) -> Void)?
    @objc public var onNativeReset: (() -> Void)?
    @objc public var onNativeContentSize: ((CGSize, Bool) -> Void)?

    public override init(nibName nibNameOrNil: String?, bundle nibBundleOrNil: Bundle?) {
        self.instanceId = OwnIDButtonViewController.nextInstanceId
        OwnIDButtonViewController.nextInstanceId += 1
        super.init(nibName: nibNameOrNil, bundle: nibBundleOrNil)
    }

    public required init?(coder: NSCoder) {
        self.instanceId = OwnIDButtonViewController.nextInstanceId
        OwnIDButtonViewController.nextInstanceId += 1
        super.init(coder: coder)
    }

    deinit {
        teardownContent()
    }

    lazy var overlayTouchButton: UIButton = {
        let button = UIButton()
        button.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        button.backgroundColor = .clear
        button.addTarget(
            self,
            action: #selector(overlayTouchButtonAction),
            for: .touchUpInside
        )
        return button
    }()

    private lazy var window: UIWindow = {
        if #available(iOS 15.0, *) {
            let scene = UIApplication.shared.connectedScenes.first
            return (scene as? UIWindowScene)?.keyWindow ?? UIWindow()
        } else {
            return UIApplication.shared.windows.first { $0.isKeyWindow } ?? UIWindow()
        }
    }()

    func viewSize() -> CGSize {
        measureContent(constrainedWidth: nil, constrainedHeight: nil)
    }

    func measureContent(constrainedWidth: CGFloat?, constrainedHeight: CGFloat?) -> CGSize {
        let fittedSize: CGSize
        switch type {
        case .register:
            guard let ownIdRegisterButton else { return .zero }
            fittedSize = ownIdRegisterButton.contentSizeThatFits(
                constrainedWidth: constrainedWidth,
                constrainedHeight: constrainedHeight
            )
        case .login:
            guard let ownIdLoginButton else { return .zero }
            fittedSize = ownIdLoginButton.contentSizeThatFits(
                constrainedWidth: constrainedWidth,
                constrainedHeight: constrainedHeight
            )
        }

        var measured = fittedSize
        if height.isFinite, height > 0 {
            measured.height = max(height, measured.height)
        }
        if widgetType == .iconButton { measured.width = max(measured.width, measured.height) }
        return measured
    }

    @objc public func bridge_measure(constrainedWidth: NSNumber?, constrainedHeight: NSNumber?) -> CGSize {
        let w = constrainedWidth?.doubleValue
        let h = constrainedHeight?.doubleValue
        return measureContent(constrainedWidth: w != nil ? CGFloat(w!) : nil, constrainedHeight: h != nil ? CGFloat(h!) : nil)
    }

    @objc public func bridge_configure(
        type: NSString,
        widgetType: NSString,
        widgetPosition: NSString,
        login: NSString,
        ownerToken: NSString,
        showOr: NSNumber,
        showSpinner: NSNumber,
        iconColor: NSString,
        buttonBorderColor: NSString,
        buttonBackgroundColor: NSString,
        buttonTextColor: NSString,
        tooltipPositionStr: NSString,
        tooltipTextColor: NSString,
        tooltipBackgroundColor: NSString,
        tooltipBorderColor: NSString,
        spinnerColor: NSString,
        spinnerBackgroundColor: NSString,
        preferredHeight: NSNumber?
    ) {
        ensureIntegration()

        let typeStr = (type as String).lowercased()
        let newType: ViewDisplayType = (typeStr == "register") ? .register : .login
        let newWidgetType: OwnID.UISDK.WidgetType = ((widgetType as String) == "OwnIdAuthButton") ? .authButton : .iconButton
        let newOwnerToken = ownerToken as String
        let typeChanged = newType != self.type
        let widgetChanged = newWidgetType != self.widgetType
        let ownerChanged = newOwnerToken != self.ownerToken
        let rebuildNeeded = hasCreatedContent && (
            typeChanged ||
                widgetChanged ||
                ownerChanged
        )
        if rebuildNeeded {
            // Cancel the old owner's pipelines before changing identity. Any
            // already queued callback still retains its immutable old token.
            teardownContent()
        }
        self.type = newType
        self.widgetType = newWidgetType
        self.ownerToken = newOwnerToken
        switch widgetPosition as String {
        case "end": self.widgetPosition = .trailing
        default: self.widgetPosition = .leading
        }
        let newLoginId = login as String
        if newLoginId != self.loginId {
            self.loginId = newLoginId
        }
        self.showOr = showOr.boolValue
        self.showSpinner = showSpinner.boolValue

        // Empty bridge values reset to the native VisualLookConfig defaults.
        self.iconColor = Self.color(from: iconColor)
        self.buttonBorderColor = Self.color(from: buttonBorderColor)
        self.buttonBackgroundColor = Self.color(from: buttonBackgroundColor)
        self.buttonTextColor = Self.color(from: buttonTextColor)

        // Tooltip
        switch tooltipPositionStr as String {
        case "start":
            self.tooltipPosition = .leading
            self.shouldShowTooltip = true
        case "end":
            self.tooltipPosition = .trailing
            self.shouldShowTooltip = true
        case "top":
            self.tooltipPosition = .top
            self.shouldShowTooltip = true
        case "bottom":
            self.tooltipPosition = .bottom
            self.shouldShowTooltip = true
        case "none": fallthrough
        default:
            self.tooltipPosition = .bottom
            self.shouldShowTooltip = false
        }
        self.tooltipTextColor = Self.color(from: tooltipTextColor)
        self.tooltipBackgroundColor = Self.color(from: tooltipBackgroundColor)
        self.tooltipBorderColor = Self.color(from: tooltipBorderColor)
        // Spinner
        self.spinnerColor = Self.color(from: spinnerColor)
        self.spinnerBackgroundColor = Self.color(from: spinnerBackgroundColor)

        if let ph = preferredHeight?.doubleValue, ph > 0 {
            self.height = max(Self.Constants.buttonHeightOffset, CGFloat(ph))
        } else {
            self.height = 0
        }

        createContentIfNeeded()
        let visualConfigurationChanged = applyVisualConfiguration()
        if rebuildNeeded || visualConfigurationChanged {
            forceNextForward = true
            forwardLayoutInfo()
        }
    }

    open override func viewDidLoad() {
        super.viewDidLoad()

        if authIntegration != nil {
            createContentIfNeeded()
        }
        forwardLayoutInfo()
    }

    open override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)

        addTapGestureRecognizer()
        if authIntegration != nil { createContentIfNeeded() }
    }

    open override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        if let tgr = tapGestureRecognizer {
            view.removeGestureRecognizer(tgr)
            tapGestureRecognizer = nil
        }
    }

    private func addTapGestureRecognizer() {
        guard tapGestureRecognizer == nil else { return }
        let tgr = UITapGestureRecognizer(target: self, action: #selector(handleTap(_:)))
        tgr.cancelsTouchesInView = false
        tgr.delegate = self
        view.addGestureRecognizer(tgr)
        tapGestureRecognizer = tgr
    }

    @objc private func handleTap(_ sender: UITapGestureRecognizer?) {}

    private func ensureIntegration() {
        if authIntegration == nil {
            authIntegration = CreationInformation.shared.authIntegration ?? CoreAuthIntegration()
        }
    }

    private static func color(from value: NSString) -> UIColor? {
        guard value.length > 0 else { return nil }
        return (value as String).hexToUIColor
    }

    private func teardownContent() {
        bag.removeAll()

        ownIDRegisterModel?.resetDataAndState()
        ownIDLoginViewModel?.resetDataAndState()
        ownIDRegisterModel = nil
        ownIDLoginViewModel = nil

        detachHostedController(ownIdRegisterButton)
        detachHostedController(ownIdLoginButton)
        ownIdRegisterButton = nil
        ownIdLoginButton = nil

        lastForwardedLayout = nil
        forceNextForward = false
        hasCreatedContent = false
    }

    private func detachHostedController(_ hostedController: UIViewController?) {
        guard let hostedController else { return }
        if hostedController.parent != nil {
            hostedController.willMove(toParent: nil)
        }
        hostedController.view.removeFromSuperview()
        if hostedController.parent != nil {
            hostedController.removeFromParent()
        }
    }

    private func createButtonViewForButton(type: ViewDisplayType) {
        let la = LAContext()
        var laError: NSError?
        let canBio = la.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &laError)
        let resultingController: UIViewController
        switch type {
        case .register:
            ensureIntegration()
            let vm = authIntegration.createRegisterViewModel(loginIdPublisher: $loginId.eraseToAnyPublisher())
            ownIDRegisterModel = vm
            CreationInformation.shared.registerViewModel = vm

            let createdButton = authIntegration.createOwnIDRegisterButton(for: vm)
            let ownIdRegisterButton = SafeAreaIgnoringAutoSizingHostingController(
                wrapping: createdButton
            )
            ownIdRegisterButton.resizingMode = (widgetType == .authButton) ? .fillParentWidth : .intrinsicWidth
            ownIdRegisterButton.onIntrinsicSizeChange = { [weak self] size in
                self?.forwardLayoutInfo(size: size)
            }
            self.ownIdRegisterButton = ownIdRegisterButton
            resultingController = ownIdRegisterButton

            subscribeRegister(to: vm.integrationEventPublisher)
            subscribeRegister(to: vm.flowEventPublisher)
            vm.subscribe(to: resultPublisher.eraseToAnyPublisher())

        case .login:
            ensureIntegration()
            let vm = authIntegration.createLoginViewModel(loginIdPublisher: $loginId.eraseToAnyPublisher())
            ownIDLoginViewModel = vm

            let createdButton = authIntegration.createOwnIDLoginButton(for: vm)
            let ownIdLoginButton = SafeAreaIgnoringAutoSizingHostingController(
                wrapping: createdButton
            )
            ownIdLoginButton.resizingMode = (widgetType == .authButton) ? .fillParentWidth : .intrinsicWidth
            ownIdLoginButton.onIntrinsicSizeChange = { [weak self] size in
                self?.forwardLayoutInfo(size: size)
            }
            self.ownIdLoginButton = ownIdLoginButton
            resultingController = ownIdLoginButton

            subscribeLogin(to: vm.integrationEventPublisher)
            subscribeLogin(to: vm.flowEventPublisher)
            vm.subscribe(to: resultPublisher.eraseToAnyPublisher())
        }

        applyVisualConfiguration()

        addChild(resultingController)
        resultingController.view.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(resultingController.view)
        NSLayoutConstraint.activate([
            resultingController.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            resultingController.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            resultingController.view.topAnchor.constraint(equalTo: view.topAnchor),
            resultingController.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
        resultingController.didMove(toParent: self)

        if #unavailable(iOS 15) {
            view.addSubview(overlayTouchButton)
        }

        forwardLayoutInfo()
        notifyContentReady()
    }

    @objc
    private func overlayTouchButtonAction() {
        resultPublisher.send(())
    }

    func subscribeRegister(to eventsPublisher: OwnID.RegistrationPublisher) {
        let subscriptionOwnerToken = ownerToken
        eventsPublisher
            .sink { [weak self] event in
                guard let self else { return }
                var eventDictionary = [String: Any]()
                var isBusy = false
                switch event {
                case .success(let event):
                    switch event {
                    case .readyToRegister(let loginId, let authType):
                        isBusy = false
                        eventDictionary["loginId"] = loginId ?? ""
                        if let authType {
                            eventDictionary["authType"] = authType.rawValue
                        }
                        eventDictionary["eventType"] = "OwnIdRegisterEvent.ReadyToRegister"

                    case .userRegisteredAndLoggedIn(_, let authType, let authToken):
                        isBusy = false
                        eventDictionary = ["eventType": "OwnIdRegisterEvent.LoggedIn"]
                        if let authType {
                            eventDictionary["authType"] = authType.rawValue
                        }
                        if let authToken {
                            eventDictionary["authToken"] = authToken
                        }

                    case .loading:
                        isBusy = true

                    case .resetTapped:
                        eventDictionary = ["eventType": "OwnIdRegisterEvent.Undo"]
                    }

                case .failure(let error):
                    isBusy = false
                    eventDictionary = ["eventType": "OwnIdRegisterEvent.Error", "error": self.authIntegration.errorDictionary(error)]
                }

                ButtonEventsEventEmitter.shared?.sendEvent(
                    withName: ButtonEventsEventEmitter.EventType.ownIdIntegrationEvent.rawValue,
                    body: ownerScopedEventBody(
                        ["eventType": "OwnIdRegisterEvent.Busy", "isBusy": isBusy],
                        ownerToken: subscriptionOwnerToken
                    )
                )

                ButtonEventsEventEmitter.shared?.sendEvent(
                    withName: ButtonEventsEventEmitter.EventType.ownIdIntegrationEvent.rawValue,
                    body: ownerScopedEventBody(eventDictionary, ownerToken: subscriptionOwnerToken)
                )
            }
            .store(in: &bag)
    }

    func subscribeRegister(to flowsPublisher: OwnID.RegistrationFlowPublisher) {
        let subscriptionOwnerToken = ownerToken
        flowsPublisher
            .sink { [weak self] event in
                guard let self else { return }
                var eventDictionary = [String: Any]()
                var isBusy = false
                switch event {
                case .success(let flow):
                    switch flow {
                    case .response(let loginId, let payload, let authType, let authToken):
                        isBusy = false
                        eventDictionary = ["eventType": "OwnIdRegisterFlow.Response"]
                        eventDictionary["loginId"] = loginId
                        if let authType {
                            eventDictionary["authType"] = authType.rawValue
                        }
                        if let authToken {
                            eventDictionary["authToken"] = authToken
                        }

                        let type: String
                        switch payload.responseType {
                        case .registrationInfo:
                            type = "Registration"
                        case .session:
                            type = "Login"
                        }

                        eventDictionary["payload"] = [
                            "type": type,
                            "data": payload.data ?? "",
                            "metadata": normalizedMetadata(payload.metadata),
                        ]
                    case .loading:
                        isBusy = true
                    case .resetTapped:
                        eventDictionary = ["eventType": "OwnIdRegisterFlow.Undo"]
                    }

                case .failure(let error):
                    isBusy = false
                    eventDictionary = ["eventType": "OwnIdRegisterFlow.Error", "error": self.authIntegration.errorDictionary(error)]
                }

                ButtonEventsEventEmitter.shared?.sendEvent(
                    withName: ButtonEventsEventEmitter.EventType.ownIdFlowEvent.rawValue,
                    body: ownerScopedEventBody(
                        ["eventType": "OwnIdRegisterFlow.Busy", "isBusy": isBusy],
                        ownerToken: subscriptionOwnerToken
                    )
                )

                ButtonEventsEventEmitter.shared?.sendEvent(
                    withName: ButtonEventsEventEmitter.EventType.ownIdFlowEvent.rawValue,
                    body: ownerScopedEventBody(eventDictionary, ownerToken: subscriptionOwnerToken)
                )
            }
            .store(in: &bag)
    }

    func subscribeLogin(to eventsPublisher: OwnID.LoginPublisher) {
        let subscriptionOwnerToken = ownerToken
        eventsPublisher
            .eraseToAnyPublisher()
            .sink { [weak self] event in
                guard let self else { return }
                var eventDictionary = [String: Any]()
                var isBusy = false
                switch event {
                case .success(let event):
                    switch event {
                    case .loggedIn(_, let authType, let authToken):
                        isBusy = false
                        eventDictionary = ["eventType": "OwnIdLoginEvent.LoggedIn"]
                        if let authType {
                            eventDictionary["authType"] = authType.rawValue
                        }
                        if let authToken {
                            eventDictionary["authToken"] = authToken
                        }

                    case .loading:
                        isBusy = true
                    }

                case .failure(let error):
                    isBusy = false
                    eventDictionary = ["eventType": "OwnIdLoginEvent.Error", "error": self.authIntegration.errorDictionary(error)]
                }

                ButtonEventsEventEmitter.shared?.sendEvent(
                    withName: ButtonEventsEventEmitter.EventType.ownIdIntegrationEvent.rawValue,
                    body: ownerScopedEventBody(
                        ["eventType": "OwnIdLoginEvent.Busy", "isBusy": isBusy],
                        ownerToken: subscriptionOwnerToken
                    )
                )

                ButtonEventsEventEmitter.shared?.sendEvent(
                    withName: ButtonEventsEventEmitter.EventType.ownIdIntegrationEvent.rawValue,
                    body: ownerScopedEventBody(eventDictionary, ownerToken: subscriptionOwnerToken)
                )
            }
            .store(in: &bag)
    }

    func subscribeLogin(to flowsPublisher: OwnID.LoginFlowPublisher) {
        let subscriptionOwnerToken = ownerToken
        flowsPublisher
            .eraseToAnyPublisher()
            .sink { [weak self] event in
                guard let self else { return }
                var eventDictionary = [String: Any]()
                var isBusy = false
                switch event {
                case .success(let flow):
                    switch flow {
                    case .loading:
                        isBusy = true
                    case .response(let loginId, let payload, let authType, let authToken):
                        isBusy = false
                        eventDictionary = ["eventType": "OwnIdLoginFlow.Response"]
                        eventDictionary["loginId"] = loginId
                        if let authType {
                            eventDictionary["authType"] = authType.rawValue
                        }
                        if let authToken {
                            eventDictionary["authToken"] = authToken
                        }

                        let type: String
                        switch payload.responseType {
                        case .registrationInfo:
                            type = "Registration"
                        case .session:
                            type = "Login"
                        }

                        eventDictionary["payload"] = [
                            "type": type,
                            "data": payload.data ?? "",
                            "metadata": normalizedMetadata(payload.metadata),
                        ]
                    }

                case .failure(let error):
                    isBusy = false
                    eventDictionary = ["eventType": "OwnIdLoginFlow.Error", "error": self.authIntegration.errorDictionary(error)]
                }

                ButtonEventsEventEmitter.shared?.sendEvent(
                    withName: ButtonEventsEventEmitter.EventType.ownIdFlowEvent.rawValue,
                    body: ownerScopedEventBody(
                        ["eventType": "OwnIdLoginFlow.Busy", "isBusy": isBusy],
                        ownerToken: subscriptionOwnerToken
                    )
                )

                ButtonEventsEventEmitter.shared?.sendEvent(
                    withName: ButtonEventsEventEmitter.EventType.ownIdFlowEvent.rawValue,
                    body: ownerScopedEventBody(eventDictionary, ownerToken: subscriptionOwnerToken)
                )
            }
            .store(in: &bag)
    }
}

extension OwnIDButtonViewController {
    @objc public func bridge_applyResolvedHeight(_ rawHeight: NSNumber) {
        let resolvedHeight = CGFloat(rawHeight.doubleValue)
        guard resolvedHeight.isFinite, resolvedHeight > 0 else { return }
        let newHeight = max(Self.Constants.buttonHeightOffset, resolvedHeight)
        guard abs(height - newHeight) >= 0.5 else { return }
        height = newHeight
        if applyVisualConfiguration() {
            forceNextForward = true
            forwardLayoutInfo()
        }
    }

    private func makeVisualConfiguration() -> OwnID.UISDK.VisualLookConfig {
        var visualConfiguration = OwnID.UISDK.VisualLookConfig()
        visualConfiguration.widgetType = widgetType
        visualConfiguration.iconButtonConfig.widgetPosition = widgetPosition
        visualConfiguration.iconButtonConfig.orViewConfig.isEnabled = showOr
        visualConfiguration.iconButtonConfig.loaderViewConfig.isEnabled = showSpinner
        visualConfiguration.authButtonConfig.loaderViewConfig.isEnabled = showSpinner

        if height.isFinite, height > 0 {
            visualConfiguration.iconButtonConfig.height = height
            visualConfiguration.authButtonConfig.height = height
        }
        if let iconColor {
            visualConfiguration.iconButtonConfig.iconColor = Color(iconColor)
        }
        if let buttonBorderColor {
            visualConfiguration.iconButtonConfig.borderColor = Color(buttonBorderColor)
        }
        if let buttonBackgroundColor {
            visualConfiguration.iconButtonConfig.backgroundColor = Color(buttonBackgroundColor)
            visualConfiguration.authButtonConfig.backgroundColor = Color(buttonBackgroundColor)
        }
        if let buttonTextColor {
            visualConfiguration.iconButtonConfig.orViewConfig.textColor = Color(buttonTextColor)
            visualConfiguration.authButtonConfig.textColor = Color(buttonTextColor)
        }
        if let spinnerColor {
            visualConfiguration.iconButtonConfig.loaderViewConfig.spinnerColor = Color(spinnerColor)
            visualConfiguration.authButtonConfig.loaderViewConfig.spinnerColor = Color(spinnerColor)
        }
        if let spinnerBackgroundColor {
            visualConfiguration.iconButtonConfig.loaderViewConfig.circleColor = Color(spinnerBackgroundColor)
            visualConfiguration.authButtonConfig.loaderViewConfig.circleColor = Color(spinnerBackgroundColor)
        }

        visualConfiguration.iconButtonConfig.tooltipConfig.isEnabled = shouldShowTooltip
        visualConfiguration.iconButtonConfig.tooltipConfig.tooltipPosition = tooltipPosition
        if let tooltipTextColor {
            visualConfiguration.iconButtonConfig.tooltipConfig.textColor = Color(tooltipTextColor)
        }
        if let tooltipBorderColor {
            visualConfiguration.iconButtonConfig.tooltipConfig.borderColor = Color(tooltipBorderColor)
        }
        if let tooltipBackgroundColor {
            visualConfiguration.iconButtonConfig.tooltipConfig.backgroundColor = Color(tooltipBackgroundColor)
        }
        return visualConfiguration
    }

    @discardableResult
    private func applyVisualConfiguration() -> Bool {
        let visualConfiguration = makeVisualConfiguration()
        var changed = false

        if let hostedController = ownIdRegisterButton {
            var content = hostedController.contentRootView
            if content.visualConfig != visualConfiguration {
                content.visualConfig = visualConfiguration
                hostedController.contentRootView = content
                hostedController.view.invalidateIntrinsicContentSize()
                hostedController.view.setNeedsLayout()
                changed = true
            }
        }
        if let hostedController = ownIdLoginButton {
            var content = hostedController.contentRootView
            if content.visualConfig != visualConfiguration {
                content.visualConfig = visualConfiguration
                hostedController.contentRootView = content
                hostedController.view.invalidateIntrinsicContentSize()
                hostedController.view.setNeedsLayout()
                changed = true
            }
        }
        return changed
    }

    fileprivate func notifyContentReady() {
        guard let onContentReady else { return }
        DispatchQueue.main.async {
            onContentReady()
        }
    }

    fileprivate func createContentIfNeeded() {
        guard !hasCreatedContent else { return }
        guard authIntegration != nil else { return }
        hasCreatedContent = true
        createButtonViewForButton(type: type)
    }
    fileprivate func forwardLayoutInfo(size measuredSize: CGSize? = nil) {
        let size = measuredSize ?? viewSize()
        guard size.width.isFinite, size.height.isFinite, size.width > 0, size.height > 0 else {
            return
        }
        let ignoreParentSize = widgetType.shouldIgnoreParentSize
        let shouldForce = forceNextForward
        if let lastForwardedLayout, !shouldForce,
            lastForwardedLayout.ignoreParent == ignoreParentSize,
            lastForwardedLayout.size.isClose(to: size)
        {
            return
        }
        lastForwardedLayout = (size, ignoreParentSize)
        if shouldForce { forceNextForward = false }
        paperOwner?.receiveLayoutInfo(size: size, shouldIgnoreParentSize: ignoreParentSize)
        onNativeContentSize?(size, ignoreParentSize)
    }
}

extension OwnIDButtonViewController {
    @objc public func bridge_forceForwardLayout() {
        forceNextForward = true
        forwardLayoutInfo()
    }
    @objc public func bridge_commandAuth(_ onlyReturningUser: NSNumber?) {
        let onlyReturning = onlyReturningUser?.boolValue ?? false
        if type == .login {
            _ = ownIDLoginViewModel?.auth(loginId: loginId, onlyReturningUser: onlyReturning)
        }
    }

    @objc public func bridge_commandReset() {
        teardownContent()
        onNativeReset?()
    }

    @objc public func bridge_prepareForRecycle() {
        teardownContent()
        ownerToken = ""
        height = 0
    }

    @objc public func bridge_commandRegister(_ params: [String: Any]?, login: NSString?) {
        guard type == .register else { return }
        let p = authIntegration.registerParameters(from: params)
        if let loginStr = login as String? { self.loginId = loginStr }
        ownIDRegisterModel?.register(registerParameters: p)
    }
}

extension OwnID.UISDK.WidgetType {
    var shouldIgnoreParentSize: Bool {
        switch self {
        case .iconButton:
            return true

        case .authButton:
            return false
        }
    }
}

extension OwnIDButtonViewController: UIGestureRecognizerDelegate {
    public func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
        ownIDRegisterModel?.shouldShowTooltip = false
        ownIDLoginViewModel?.shouldShowTooltip = false
        return false
    }
}

public class AutoSizingHostingController<Content>: UIHostingController<Content> where Content: View {
    public enum ResizingMode { case intrinsicWidth, fillParentWidth }
    public var resizingMode: ResizingMode = .intrinsicWidth
    public var onIntrinsicSizeChange: ((CGSize) -> Void)?
    private var lastSentIntrinsicSize: CGSize = .zero
    private var pendingIntrinsicSize: CGSize?
    private var isIntrinsicNotificationScheduled = false
    private var isMeasuringContent = false

    public override func viewDidLoad() {
        super.viewDidLoad()
        if #available(iOS 16.0, *) {
            self.sizingOptions = [.intrinsicContentSize]
        }
    }
    public override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        guard !isMeasuringContent else { return }
        let intrinsic = view.intrinsicContentSize
        let parentSize = view.superview?.bounds.size ?? .zero
        let reported: CGSize
        switch resizingMode {
        case .intrinsicWidth:
            reported = intrinsic
        case .fillParentWidth:
            reported = CGSize(
                width: parentSize.width.isFinite && parentSize.width > 0 ? parentSize.width : intrinsic.width,
                height: intrinsic.height.isFinite && intrinsic.height > 0 ? intrinsic.height : parentSize.height
            )
        }
        scheduleIntrinsicSizeNotification(reported)
    }

    func contentSizeThatFits(constrainedWidth: CGFloat?, constrainedHeight: CGFloat?) -> CGSize {
        let validWidth = constrainedWidth.flatMap { $0.isFinite && $0 > 0 ? $0 : nil }
        let validHeight = constrainedHeight.flatMap { $0.isFinite && $0 > 0 ? $0 : nil }
        let parentWidth = view.superview?.bounds.width ?? view.bounds.width
        let proposedWidth: CGFloat
        switch resizingMode {
        case .intrinsicWidth:
            proposedWidth = validWidth ?? UIView.layoutFittingExpandedSize.width
        case .fillParentWidth:
            proposedWidth = validWidth ?? (parentWidth.isFinite && parentWidth > 0
                ? parentWidth
                : UIView.layoutFittingCompressedSize.width)
        }
        let proposal = CGSize(
            width: proposedWidth,
            height: validHeight ?? UIView.layoutFittingExpandedSize.height
        )

        isMeasuringContent = true
        defer { isMeasuringContent = false }

        var measured = sizeThatFits(in: proposal)
        if #unavailable(iOS 16.0), !measured.hasUsableDimensions {
            measured = view.systemLayoutSizeFitting(
                proposal,
                withHorizontalFittingPriority: validWidth != nil ? .required : .fittingSizeLevel,
                verticalFittingPriority: validHeight != nil ? .required : .fittingSizeLevel
            )
        }
        if !measured.hasUsableDimensions {
            let fallback = view.systemLayoutSizeFitting(
                proposal,
                withHorizontalFittingPriority: validWidth != nil ? .required : .fittingSizeLevel,
                verticalFittingPriority: validHeight != nil ? .required : .fittingSizeLevel
            )
            if fallback.width.isFinite, fallback.width > 0 { measured.width = fallback.width }
            if fallback.height.isFinite, fallback.height > 0 { measured.height = fallback.height }
        }
        return measured
    }

    private func scheduleIntrinsicSizeNotification(_ size: CGSize) {
        guard size.hasUsableDimensions else { return }
        pendingIntrinsicSize = size
        guard !isIntrinsicNotificationScheduled else { return }
        isIntrinsicNotificationScheduled = true
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            self.isIntrinsicNotificationScheduled = false
            guard let reported = self.pendingIntrinsicSize else { return }
            self.pendingIntrinsicSize = nil
            guard !self.lastSentIntrinsicSize.isClose(to: reported) else { return }
            self.lastSentIntrinsicSize = reported
            self.onIntrinsicSizeChange?(reported)
        }
    }
}

private struct SafeAreaIgnoringContainer<Content: View>: View {
    var content: Content

    var body: some View {
        content.ignoresSafeArea(.container, edges: .all)
    }
}

private final class SafeAreaIgnoringAutoSizingHostingController<Content: View>:
    AutoSizingHostingController<SafeAreaIgnoringContainer<Content>>
{
    var contentRootView: Content {
        get { rootView.content }
        set { rootView.content = newValue }
    }

    init(wrapping controller: AutoSizingHostingController<Content>) {
        super.init(rootView: SafeAreaIgnoringContainer(content: controller.rootView))
        view.backgroundColor = controller.view.backgroundColor
    }

    @MainActor @preconcurrency required dynamic init?(coder aDecoder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
}

extension OwnIDButtonViewController {
    fileprivate func deliverPendingContentReadyIfNeeded() {
        guard onContentReady != nil else { return }
        notifyContentReady()
    }
}

extension CGSize {
    fileprivate var hasUsableDimensions: Bool {
        width.isFinite && height.isFinite && width > 0 && height > 0
    }

    fileprivate func isClose(to other: CGSize, tolerance: CGFloat = 0.5) -> Bool {
        abs(width - other.width) < tolerance && abs(height - other.height) < tolerance
    }
}
