import Foundation
import UIKit
import OwnIDCoreSDK
import Combine
import SwiftUI

open class OwnIDButtonViewController: UIViewController {
    private enum Constants {
        static let buttonHeightOffset = 14.0
    }
    
    private let resultPublisher = PassthroughSubject<Void, Never>()
    private var bag = Set<AnyCancellable>()
    
    private var ownIdRegisterButton: UIHostingController<OwnID.FlowsSDK.RegisterView>?
    private var ownIdLoginButton: UIHostingController<OwnID.FlowsSDK.LoginView>?
    
    public var ownIDLoginViewModel: OwnID.FlowsSDK.LoginView.ViewModel?
    public var ownIDRegisterModel: OwnID.FlowsSDK.RegisterView.ViewModel?
    
    var authIntegration: AuthIntegration!
    
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
        switch self.type {
        case .register:
            return self.ownIdRegisterButton?.view.intrinsicContentSize ?? .zero
        case .login:
            return self.ownIdLoginButton?.view.intrinsicContentSize ?? .zero
        }
    }
    
    open override func viewDidLoad() {
        super.viewDidLoad()
        
        CreationInformation.shared.managerInstance?.updateLayoutInfo(size: viewSize(),
                                                                     shouldIgnoreParentSize: widgetType.shouldIgnoreParentSize)
    }
    
    open override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        
        CreationInformation.shared.managerInstance?.updateLayoutInfo(size: viewSize(),
                                                                     shouldIgnoreParentSize: widgetType.shouldIgnoreParentSize)
    }
    
    open override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)

        addTapGestureRecognizer()
        createButtonViewForButton(type: type)
    }
    
    private func addTapGestureRecognizer() {
        let tapGestureRecognizer = UITapGestureRecognizer(target: self, action: #selector(handleTap(_:)))
        tapGestureRecognizer.cancelsTouchesInView = false
        tapGestureRecognizer.delegate = self
        window.rootViewController?.view.addGestureRecognizer(tapGestureRecognizer)
    }
    
    @objc private func handleTap(_ sender: UITapGestureRecognizer?) { }
    
    private func createButtonViewForButton(type: ViewDisplayType) {
        let resultingController: UIViewController
        switch type {
        case .register:
            let vm = authIntegration.createRegisterViewModel(loginIdPublisher: $loginId.eraseToAnyPublisher())
            ownIDRegisterModel = vm
            CreationInformation.shared.registerViewModel = vm
            
            let ownIdRegisterButton = authIntegration.createOwnIDRegisterButton(for: vm)
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
            
        case .login:
            let vm = authIntegration.createLoginViewModel(loginIdPublisher: $loginId.eraseToAnyPublisher())
            ownIDLoginViewModel = vm
            
            let ownIdLoginButton = authIntegration.createOwnIDLoginButton(for: vm)
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
        }
        
        addChild(resultingController)
        resultingController.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(resultingController.view)
        resultingController.didMove(toParent: self)
        
        if #unavailable(iOS 15) {
            view.addSubview(overlayTouchButton)
        }
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
                        
                    case .userRegisteredAndLoggedIn(_, let authType):
                        isBusy = false
                        eventDictionary = ["eventType": "OwnIdRegisterEvent.LoggedIn"]
                        if let authType {
                            eventDictionary["authType"] = authType
                        }
                        
                    case .loading:
                        isBusy = true
                        
                    case .resetTapped:
                        eventDictionary = ["eventType": "OwnIdRegisterEvent.Undo"]
                    }
                    
                case .failure(let error):
                    isBusy = false
                    eventDictionary = ["eventType": "OwnIdRegisterFlow.Error",
                                       "error": self.authIntegration.errorDictionary(error)]
                }
                let loadingEventDictionary = ["eventType": "OwnIdRegisterEvent.Busy", "isBusy": isBusy] as [String : Any]
                ButtonEventsEventEmitter.shared?.sendEvent(withName: ButtonEventsEventEmitter.EventType.ownIdIntegrationEvent.rawValue, 
                                                           body: loadingEventDictionary)
                if !eventDictionary.isEmpty {
                    ButtonEventsEventEmitter.shared?.sendEvent(withName: ButtonEventsEventEmitter.EventType.ownIdIntegrationEvent.rawValue, 
                                                               body: eventDictionary)
                }
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
                    case .response(let loginId, let payload, let authType):
                        isBusy = false
                        eventDictionary = ["eventType": "OwnIdRegisterFlow.Response"]
                        eventDictionary["loginId"] = loginId
                        eventDictionary["authType"] = authType
                        
                        let type: String
                        switch payload.responseType {
                        case .registrationInfo:
                            type = "Registration"
                        case .session:
                            type = "Login"
                        }
                        
                        eventDictionary["payload"] = ["type": type,
                                                      "data": payload.data ?? "",
                                                      "metadata": payload.metadata ?? ""]
                    case .loading:
                        isBusy = true
                    case .resetTapped:
                        eventDictionary = ["eventType": "OwnIdRegisterFlow.Undo"]
                    }
                    
                case .failure(let error):
                    isBusy = false
                    eventDictionary = ["eventType": "OwnIdRegisterFlow.Error",
                                       "error": self.authIntegration.errorDictionary(error)]
                }
                let loadingEventDictionary = ["eventType": "OwnIdRegisterFlow.Busy", "isBusy": isBusy] as [String : Any]
                ButtonEventsEventEmitter.shared?.sendEvent(withName: ButtonEventsEventEmitter.EventType.ownIdFlowEvent.rawValue,
                                                           body: loadingEventDictionary)
                if !eventDictionary.isEmpty {
                    ButtonEventsEventEmitter.shared?.sendEvent(withName: ButtonEventsEventEmitter.EventType.ownIdFlowEvent.rawValue,
                                                               body: eventDictionary)
                }
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
                    case .loggedIn(_, let authType):
                        isBusy = false
                        eventDictionary = ["eventType": "OwnIdLoginEvent.LoggedIn"]
                        if let authType = authType {
                            eventDictionary["authType"] = authType as Any
                        }
                        
                    case .loading:
                        isBusy = true
                    }
                    
                case .failure(let error):
                    isBusy = false
                    eventDictionary = ["eventType": "OwnIdLoginEvent.Error",
                                       "error": self.authIntegration.errorDictionary(error)]
                }
                let loadingEventDictionary = ["eventType": "OwnIdLoginEvent.Busy", "isBusy": isBusy] as [String : Any]
                ButtonEventsEventEmitter.shared?.sendEvent(withName: ButtonEventsEventEmitter.EventType.ownIdIntegrationEvent.rawValue,
                                                           body: loadingEventDictionary)
                if !eventDictionary.isEmpty {
                    ButtonEventsEventEmitter.shared?.sendEvent(withName: ButtonEventsEventEmitter.EventType.ownIdIntegrationEvent.rawValue,
                                                               body: eventDictionary)
                }
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
                    case .response(let loginId, let payload, let authType):
                        isBusy = false
                        eventDictionary = ["eventType": "OwnIdLoginFlow.Response"]
                        eventDictionary["loginId"] = loginId
                        eventDictionary["authType"] = authType
                        
                        let type: String
                        switch payload.responseType {
                        case .registrationInfo:
                            type = "Registration"
                        case .session:
                            type = "Login"
                        }
                        
                        eventDictionary["payload"] = ["type": type,
                                                      "data": payload.data ?? "",
                                                      "metadata": payload.metadata ?? ""]
                    }
                    
                case .failure(let error):
                    isBusy = false
                    eventDictionary = ["eventType": "OwnIdLoginFlow.Error",
                                       "error": self.authIntegration.errorDictionary(error)]
                }
                let loadingEventDictionary = ["eventType": "OwnIdLoginFlow.Busy", "isBusy": isBusy] as [String : Any]
                ButtonEventsEventEmitter.shared?.sendEvent(withName: ButtonEventsEventEmitter.EventType.ownIdFlowEvent.rawValue,
                                                           body: loadingEventDictionary)
                if !eventDictionary.isEmpty {
                    ButtonEventsEventEmitter.shared?.sendEvent(withName: ButtonEventsEventEmitter.EventType.ownIdFlowEvent.rawValue,
                                                               body: eventDictionary)
                }
            }
            .store(in: &bag)
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
    public func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer,
                                  shouldReceive touch: UITouch) -> Bool {
        ownIDRegisterModel?.shouldShowTooltip = false
        ownIDLoginViewModel?.shouldShowTooltip = false
        return false
    }
}
