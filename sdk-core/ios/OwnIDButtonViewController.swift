import Combine
import Foundation
import LocalAuthentication
import OwnIDCoreSDK
import SwiftUI
import UIKit

open class OwnIDButtonViewController: UIViewController {
    private enum Constants {
        static let buttonHeightOffset = 14.0
    }

    private static var nextInstanceId: Int = 0
    private let instanceId: Int

    private let resultPublisher = PassthroughSubject<Void, Never>()
    private var bag = Set<AnyCancellable>()

    private var ownIdRegisterButton: AutoSizingHostingController<OwnID.FlowsSDK.RegisterView>?
    private var ownIdLoginButton: AutoSizingHostingController<OwnID.FlowsSDK.LoginView>?

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
    var iconColor = UIColor.clear
    var buttonBorderColor = UIColor.clear
    var buttonBackgroundColor = UIColor.clear
    var buttonTextColor = UIColor.clear
    var shouldShowTooltip = true
    var tooltipPosition: OwnID.UISDK.TooltipPositionType = .bottom
    var tooltipBackgroundColor = UIColor.clear
    var tooltipBorderColor = UIColor.clear
    var tooltipTextColor = UIColor.clear
    var showSpinner = true
    var spinnerColor = UIColor.clear
    var spinnerBackgroundColor = UIColor.clear
    var height = CGFloat.zero
    private var lastAppliedVisualHeight: CGFloat = 0
    //    private var pendingContentReadyReason: String?
    private var lastForwardedLayout: (size: CGSize, ignoreParent: Bool)?
    private var isForwardingLayoutInfo = false
    private var hasCreatedContent = false
    private var forceNextForward = false
    private var lastConfiguredType: ViewDisplayType?
    private var lastConfiguredWidgetType: OwnID.UISDK.WidgetType?
    private var tapGestureRecognizer: UITapGestureRecognizer?

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
        let candidateView: UIView?
        switch self.type {
        case .register:
            candidateView = self.ownIdRegisterButton?.view
        case .login:
            candidateView = self.ownIdLoginButton?.view
        }
        guard let view = candidateView else { return .zero }
        view.setNeedsLayout()
        view.layoutIfNeeded()
        var size = view.intrinsicContentSize
        if size.width <= 0 || size.height <= 0 {
            let fitting = view.systemLayoutSizeFitting(
                CGSize(width: UIView.layoutFittingCompressedSize.width, height: UIView.layoutFittingCompressedSize.height),
                withHorizontalFittingPriority: .fittingSizeLevel,
                verticalFittingPriority: .required
            )
            if size.width <= 0 {
                size.width = fitting.width
            }
            if size.height <= 0 {
                size.height = fitting.height
            }
        }
        if size.width <= 0 {
            size.width = view.bounds.width
        }
        if size.height <= 0 {
            size.height = view.bounds.height
        }
        return size
    }

    func measureContent(constrainedWidth: CGFloat?, constrainedHeight: CGFloat?) -> CGSize {
        guard let hostingView = currentHostingView else {
            return .zero
        }
        if let ch = constrainedHeight, ch > 0, abs(lastAppliedVisualHeight - ch) >= 0.5 {
            applyVisualHeight(ch)
        }
        hostingView.setNeedsLayout()
        hostingView.layoutIfNeeded()

        let targetSize = CGSize(
            width: constrainedWidth ?? UIView.layoutFittingCompressedSize.width,
            height: constrainedHeight ?? UIView.layoutFittingCompressedSize.height
        )
        var measured = hostingView.systemLayoutSizeFitting(
            targetSize,
            withHorizontalFittingPriority: constrainedWidth != nil ? .required : .fittingSizeLevel,
            verticalFittingPriority: constrainedHeight != nil ? .required : .fittingSizeLevel
        )
        // Fallback: some SwiftUI hosting views report unrealistically small width under compressed width.
        if measured.width < 20 {
            let alt = hostingView.sizeThatFits(
                CGSize(width: 10_000, height: constrainedHeight ?? UIView.layoutFittingCompressedSize.height)
            )
            if alt.width > measured.width { measured.width = alt.width }
            if let h = constrainedHeight, alt.height > 0 { measured.height = max(h, alt.height) }
        }
        if let h = constrainedHeight, h > 0 { measured.height = max(h, measured.height) }
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
        let isDetatched = hasCreatedContent && (view.window == nil || view.superview == nil)
        let rebuildNeeded = hasCreatedContent && (newType != self.type || newWidgetType != self.widgetType || isDetatched)
        self.type = newType
        self.widgetType = newWidgetType
        switch widgetPosition as String {
        case "end": self.widgetPosition = .trailing
        default: self.widgetPosition = .leading
        }
        self.loginId = login as String
        self.showOr = showOr.boolValue
        self.showSpinner = showSpinner.boolValue

        // Colors
        if iconColor.length > 0 { self.iconColor = (iconColor as String).hexToUIColor }
        if buttonBorderColor.length > 0 { self.buttonBorderColor = (buttonBorderColor as String).hexToUIColor }
        if buttonBackgroundColor.length > 0 { self.buttonBackgroundColor = (buttonBackgroundColor as String).hexToUIColor }
        if buttonTextColor.length > 0 { self.buttonTextColor = (buttonTextColor as String).hexToUIColor }

        // Tooltip
        if tooltipPositionStr.length > 0 {
            let p = tooltipPositionStr as String
            switch p {
            case "start": self.tooltipPosition = .leading
            case "end": self.tooltipPosition = .trailing
            case "top": self.tooltipPosition = .top
            case "bottom": self.tooltipPosition = .bottom
            case "none": fallthrough
            default: break
            }
        }
        if tooltipTextColor.length > 0 { self.tooltipTextColor = (tooltipTextColor as String).hexToUIColor }
        if tooltipBackgroundColor.length > 0 { self.tooltipBackgroundColor = (tooltipBackgroundColor as String).hexToUIColor }
        if tooltipBorderColor.length > 0 { self.tooltipBorderColor = (tooltipBorderColor as String).hexToUIColor }
        self.shouldShowTooltip = false
        // Spinner
        if spinnerColor.length > 0 { self.spinnerColor = (spinnerColor as String).hexToUIColor }
        if spinnerBackgroundColor.length > 0 { self.spinnerBackgroundColor = (spinnerBackgroundColor as String).hexToUIColor }

        if let ph = preferredHeight?.doubleValue, ph > 0 {
            self.height = max(Self.Constants.buttonHeightOffset, CGFloat(ph))
        }

        if rebuildNeeded {
            teardownContent()
        }

        createContentIfNeeded()
        if rebuildNeeded {
            forceNextForward = true
            forwardLayoutInfo()
        }
    }

    private var currentHostingView: UIView? {
        switch type {
        case .register:
            return ownIdRegisterButton?.view
        case .login:
            return ownIdLoginButton?.view
        }
    }

    open override func viewDidLoad() {
        super.viewDidLoad()

        if authIntegration != nil {
            createContentIfNeeded()
        }
        forwardLayoutInfo()
    }

    open override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        forwardLayoutInfo()
    }

    open override var shouldAutomaticallyForwardAppearanceMethods: Bool {
        return false
    }

    open override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        ownIdRegisterButton?.beginAppearanceTransition(true, animated: animated)
        ownIdLoginButton?.beginAppearanceTransition(true, animated: animated)

        addTapGestureRecognizer()
        if authIntegration != nil { createContentIfNeeded() }

        ownIdRegisterButton?.endAppearanceTransition()
        ownIdLoginButton?.endAppearanceTransition()
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

    private func teardownContent() {
        bag.removeAll()

        ownIDRegisterModel?.resetDataAndState()
        ownIDLoginViewModel?.resetDataAndState()
        ownIDRegisterModel = nil
        ownIDLoginViewModel = nil

        ownIdRegisterButton?.view.removeFromSuperview()
        ownIdLoginButton?.view.removeFromSuperview()
        ownIdRegisterButton = nil
        ownIdLoginButton = nil

        lastForwardedLayout = nil
        forceNextForward = false
        hasCreatedContent = false
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

            let ownIdRegisterButton = authIntegration.createOwnIDRegisterButton(for: vm)
            ownIdRegisterButton.resizingMode = (widgetType == .authButton) ? .fillParentWidth : .intrinsicWidth
            ownIdRegisterButton.onIntrinsicSizeChange = { [weak self] _ in
                self?.forwardLayoutInfo()
            }
            self.ownIdRegisterButton = ownIdRegisterButton
            resultingController = ownIdRegisterButton

            subscribeRegister(to: vm.integrationEventPublisher)
            subscribeRegister(to: vm.flowEventPublisher)
            vm.subscribe(to: resultPublisher.eraseToAnyPublisher())

            ownIdRegisterButton.rootView.visualConfig.widgetType = widgetType
            ownIdRegisterButton.rootView.visualConfig.iconButtonConfig.widgetPosition = widgetPosition
            ownIdRegisterButton.rootView.visualConfig.iconButtonConfig.orViewConfig.isEnabled = showOr
            ownIdRegisterButton.rootView.visualConfig.iconButtonConfig.iconColor = Color(iconColor)
            ownIdRegisterButton.rootView.visualConfig.iconButtonConfig.height = height
            ownIdRegisterButton.rootView.visualConfig.iconButtonConfig.borderColor = Color(buttonBorderColor)
            ownIdRegisterButton.rootView.visualConfig.iconButtonConfig.backgroundColor = Color(buttonBackgroundColor)
            ownIdRegisterButton.rootView.visualConfig.iconButtonConfig.orViewConfig.textColor = Color(buttonTextColor)
            ownIdRegisterButton.rootView.visualConfig.iconButtonConfig.tooltipConfig.isEnabled = shouldShowTooltip
            ownIdRegisterButton.rootView.visualConfig.iconButtonConfig.tooltipConfig.tooltipPosition = tooltipPosition
            ownIdRegisterButton.rootView.visualConfig.iconButtonConfig.tooltipConfig.borderColor = Color(tooltipBorderColor)
            ownIdRegisterButton.rootView.visualConfig.iconButtonConfig.tooltipConfig.backgroundColor = Color(tooltipBackgroundColor)
            ownIdRegisterButton.rootView.visualConfig.iconButtonConfig.tooltipConfig.textColor = Color(tooltipTextColor)
            ownIdRegisterButton.rootView.visualConfig.iconButtonConfig.loaderViewConfig.isEnabled = showSpinner
            ownIdRegisterButton.rootView.visualConfig.iconButtonConfig.loaderViewConfig.spinnerColor = Color(spinnerColor)
            ownIdRegisterButton.rootView.visualConfig.iconButtonConfig.loaderViewConfig.circleColor = Color(spinnerBackgroundColor)
            ownIdRegisterButton.rootView.visualConfig.authButtonConfig.backgroundColor = Color(buttonBackgroundColor)
            ownIdRegisterButton.rootView.visualConfig.authButtonConfig.textColor = Color(buttonTextColor)
            ownIdRegisterButton.rootView.visualConfig.authButtonConfig.loaderViewConfig.spinnerColor = Color(spinnerColor)
            ownIdRegisterButton.rootView.visualConfig.authButtonConfig.loaderViewConfig.circleColor = Color(spinnerBackgroundColor)
            lastAppliedVisualHeight = height

        case .login:
            ensureIntegration()
            let vm = authIntegration.createLoginViewModel(loginIdPublisher: $loginId.eraseToAnyPublisher())
            ownIDLoginViewModel = vm

            let ownIdLoginButton = authIntegration.createOwnIDLoginButton(for: vm)
            ownIdLoginButton.resizingMode = (widgetType == .authButton) ? .fillParentWidth : .intrinsicWidth
            ownIdLoginButton.onIntrinsicSizeChange = { [weak self] _ in
                self?.forwardLayoutInfo()
            }
            self.ownIdLoginButton = ownIdLoginButton
            resultingController = ownIdLoginButton

            subscribeLogin(to: vm.integrationEventPublisher)
            subscribeLogin(to: vm.flowEventPublisher)
            vm.subscribe(to: resultPublisher.eraseToAnyPublisher())

            ownIdLoginButton.rootView.visualConfig.widgetType = widgetType
            ownIdLoginButton.rootView.visualConfig.iconButtonConfig.widgetPosition = widgetPosition
            ownIdLoginButton.rootView.visualConfig.iconButtonConfig.orViewConfig.isEnabled = showOr
            ownIdLoginButton.rootView.visualConfig.iconButtonConfig.iconColor = Color(iconColor)
            ownIdLoginButton.rootView.visualConfig.iconButtonConfig.height = height
            ownIdLoginButton.rootView.visualConfig.iconButtonConfig.borderColor = Color(buttonBorderColor)
            ownIdLoginButton.rootView.visualConfig.iconButtonConfig.backgroundColor = Color(buttonBackgroundColor)
            ownIdLoginButton.rootView.visualConfig.iconButtonConfig.orViewConfig.textColor = Color(buttonTextColor)
            ownIdLoginButton.rootView.visualConfig.iconButtonConfig.tooltipConfig.isEnabled = shouldShowTooltip
            ownIdLoginButton.rootView.visualConfig.iconButtonConfig.tooltipConfig.tooltipPosition = tooltipPosition
            ownIdLoginButton.rootView.visualConfig.iconButtonConfig.tooltipConfig.borderColor = Color(tooltipBorderColor)
            ownIdLoginButton.rootView.visualConfig.iconButtonConfig.tooltipConfig.backgroundColor = Color(tooltipBackgroundColor)
            ownIdLoginButton.rootView.visualConfig.iconButtonConfig.tooltipConfig.textColor = Color(tooltipTextColor)
            ownIdLoginButton.rootView.visualConfig.iconButtonConfig.loaderViewConfig.isEnabled = showSpinner
            ownIdLoginButton.rootView.visualConfig.iconButtonConfig.loaderViewConfig.spinnerColor = Color(spinnerColor)
            ownIdLoginButton.rootView.visualConfig.iconButtonConfig.loaderViewConfig.circleColor = Color(spinnerBackgroundColor)
            ownIdLoginButton.rootView.visualConfig.authButtonConfig.backgroundColor = Color(buttonBackgroundColor)
            ownIdLoginButton.rootView.visualConfig.authButtonConfig.textColor = Color(buttonTextColor)
            ownIdLoginButton.rootView.visualConfig.authButtonConfig.loaderViewConfig.spinnerColor = Color(spinnerColor)
            ownIdLoginButton.rootView.visualConfig.authButtonConfig.loaderViewConfig.circleColor = Color(spinnerBackgroundColor)
            lastAppliedVisualHeight = height
        }

        addChild(resultingController)
        resultingController.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(resultingController.view)
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
        eventsPublisher
            .sink { event in
                var eventDictionary = [String: Any]()
                var isBusy = false
                switch event {
                case .success(let event):
                    switch event {
                    case .readyToRegister(let loginId, let authType):
                        isBusy = false
                        eventDictionary["loginId"] = loginId ?? ""
                        if let authType {
                            eventDictionary["authType"] = authType
                        }
                        eventDictionary["eventType"] = "OwnIdRegisterEvent.ReadyToRegister"

                    case .userRegisteredAndLoggedIn(_, let authType, let authToken):
                        isBusy = false
                        eventDictionary = ["eventType": "OwnIdRegisterEvent.LoggedIn"]
                        if let authType {
                            eventDictionary["authType"] = authType
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
                    body: ["eventType": "OwnIdRegisterEvent.Busy", "isBusy": isBusy]
                )

                ButtonEventsEventEmitter.shared?.sendEvent(
                    withName: ButtonEventsEventEmitter.EventType.ownIdIntegrationEvent.rawValue,
                    body: eventDictionary
                )
            }
            .store(in: &bag)
    }

    func subscribeRegister(to flowsPublisher: OwnID.RegistrationFlowPublisher) {
        flowsPublisher
            .sink { event in
                var eventDictionary = [String: Any]()
                var isBusy = false
                switch event {
                case .success(let flow):
                    switch flow {
                    case .response(let loginId, let payload, let authType, let authToken):
                        isBusy = false
                        eventDictionary = ["eventType": "OwnIdRegisterFlow.Response"]
                        eventDictionary["loginId"] = loginId
                        eventDictionary["authType"] = authType
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
                            "metadata": payload.metadata ?? "",
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
                    body: ["eventType": "OwnIdRegisterFlow.Busy", "isBusy": isBusy]
                )

                ButtonEventsEventEmitter.shared?.sendEvent(
                    withName: ButtonEventsEventEmitter.EventType.ownIdFlowEvent.rawValue,
                    body: eventDictionary
                )
            }
            .store(in: &bag)
    }

    func subscribeLogin(to eventsPublisher: OwnID.LoginPublisher) {
        eventsPublisher
            .eraseToAnyPublisher()
            .sink { event in
                var eventDictionary = [String: Any]()
                var isBusy = false
                switch event {
                case .success(let event):
                    switch event {
                    case .loggedIn(_, let authType, let authToken):
                        isBusy = false
                        eventDictionary = ["eventType": "OwnIdLoginEvent.LoggedIn"]
                        if let authType = authType {
                            eventDictionary["authType"] = authType as Any
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
                    body: ["eventType": "OwnIdLoginEvent.Busy", "isBusy": isBusy]
                )

                ButtonEventsEventEmitter.shared?.sendEvent(
                    withName: ButtonEventsEventEmitter.EventType.ownIdIntegrationEvent.rawValue,
                    body: eventDictionary
                )
            }
            .store(in: &bag)
    }

    func subscribeLogin(to flowsPublisher: OwnID.LoginFlowPublisher) {
        flowsPublisher
            .eraseToAnyPublisher()
            .sink { event in
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
                        eventDictionary["authType"] = authType
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

                        eventDictionary["payload"] = ["type": type, "data": payload.data ?? "", "metadata": payload.metadata ?? ""]
                    }

                case .failure(let error):
                    isBusy = false
                    eventDictionary = ["eventType": "OwnIdLoginFlow.Error", "error": self.authIntegration.errorDictionary(error)]
                }

                ButtonEventsEventEmitter.shared?.sendEvent(
                    withName: ButtonEventsEventEmitter.EventType.ownIdFlowEvent.rawValue,
                    body: ["eventType": "OwnIdLoginFlow.Busy", "isBusy": isBusy]
                )

                ButtonEventsEventEmitter.shared?.sendEvent(
                    withName: ButtonEventsEventEmitter.EventType.ownIdFlowEvent.rawValue,
                    body: eventDictionary
                )
            }
            .store(in: &bag)
    }
}

extension OwnIDButtonViewController {
    fileprivate func applyVisualHeight(_ newHeight: CGFloat) {
        guard newHeight.isFinite, newHeight > 0 else { return }
        if abs(lastAppliedVisualHeight - newHeight) < 0.5 { return }
        lastAppliedVisualHeight = newHeight
        switch type {
        case .register:
            ownIdRegisterButton?.rootView.visualConfig.iconButtonConfig.height = newHeight
            ownIdRegisterButton?.rootView.visualConfig.authButtonConfig.height = newHeight
        case .login:
            ownIdLoginButton?.rootView.visualConfig.iconButtonConfig.height = newHeight
            ownIdLoginButton?.rootView.visualConfig.authButtonConfig.height = newHeight
        }
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
    fileprivate func forwardLayoutInfo() {
        guard !isForwardingLayoutInfo else { return }
        isForwardingLayoutInfo = true
        defer { isForwardingLayoutInfo = false }
        let size = viewSize()
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
        if let manager = CreationInformation.shared.managerInstance {
            manager.updateLayoutInfo(size: size, shouldIgnoreParentSize: ignoreParentSize)
        }
        CreationInformation.shared.viewInstance?.receiveLayoutInfo(size: size, shouldIgnoreParentSize: ignoreParentSize)
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

    public override func viewDidLoad() {
        super.viewDidLoad()
        if #available(iOS 16.0, *) {
            self.sizingOptions = [.intrinsicContentSize]
        }
    }
    public override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        let intrinsic = view.intrinsicContentSize
        let parentSize = view.superview?.bounds.size ?? .zero
        let targetWidth: CGFloat
        let targetHeight: CGFloat
        switch resizingMode {
        case .intrinsicWidth:
            targetWidth = intrinsic.width
            targetHeight = intrinsic.height
        case .fillParentWidth:
            targetWidth = parentSize.width.isFinite && parentSize.width > 0 ? parentSize.width : intrinsic.width
            targetHeight = parentSize.height.isFinite && parentSize.height > 0 ? parentSize.height : intrinsic.height
        }
        view.frame = CGRect(x: 0, y: 0, width: targetWidth, height: targetHeight)

        let reported = CGSize(width: targetWidth, height: targetHeight)
        if reported.width.isFinite, reported.height.isFinite {
            if abs(lastSentIntrinsicSize.width - reported.width) > 0.5 || abs(lastSentIntrinsicSize.height - reported.height) > 0.5 {
                lastSentIntrinsicSize = reported
                onIntrinsicSizeChange?(reported)
            }
        }
    }
}

extension OwnIDButtonViewController {
    fileprivate func deliverPendingContentReadyIfNeeded() {
        guard onContentReady != nil else { return }
        notifyContentReady()
    }
}

extension CGSize {
    fileprivate func isClose(to other: CGSize, tolerance: CGFloat = 0.5) -> Bool {
        abs(width - other.width) < tolerance && abs(height - other.height) < tolerance
    }
}
