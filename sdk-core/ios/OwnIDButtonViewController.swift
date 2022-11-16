import Foundation
import UIKit
import OwnIDCoreSDK
import Combine
import SwiftUI

open class OwnIDButtonViewController: UIViewController {
    
    private let resultPublisher = PassthroughSubject<Void, Never>()
    private var bag = Set<AnyCancellable>()
    
    private var ownIdRegisterButton: UIHostingController<OwnID.FlowsSDK.RegisterView>?
    private var ownIdLoginButton: UIHostingController<OwnID.FlowsSDK.LoginView>?
    
    public var ownIDLoginViewModel: OwnID.FlowsSDK.LoginView.ViewModel?
    public var ownIDRegisterModel: OwnID.FlowsSDK.RegisterView.ViewModel?
    
    public var loginId = ""
    var type: ViewDisplayType = .login
    
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
    
    open override func viewDidLoad() {
        super.viewDidLoad()
        createButtonViewForButton(type: type)
    }
    
    open override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        let size: CGSize
        switch type {
        case .register:
            size = ownIdRegisterButton?.view.intrinsicContentSize ?? .zero
        case .login:
            size = ownIdLoginButton?.view.intrinsicContentSize ?? .zero
        }
        CreationInformation.shared.managerInstance?.updateLayoutInfo(info: .init(size: size))
    }
    
    private func createButtonViewForButton(type: ViewDisplayType) {
        let resultingController: UIViewController
        let getEmail = { [weak self] in
            self?.loginId ?? ""
        }
        switch type {
        case .register:
            let vm = createRegisterViewModel()
            ownIDRegisterModel = vm
            
            let ownIdRegisterButton = createOwnIDRegisterButton(for: vm)
            self.ownIdRegisterButton = ownIdRegisterButton
            resultingController = ownIdRegisterButton
            
            subscribeRegister(to: vm.eventPublisher)
            vm.getEmail = getEmail
            vm.subscribe(to: resultPublisher.eraseToAnyPublisher())
            
            ownIdRegisterButton.rootView.visualConfig.tooltipVisualLookConfig.isNativePlatform = false
            
        case .login:
            let vm = createLoginViewModel()
            ownIDLoginViewModel = vm
            
            let ownIdLoginButton = createOwnIDLoginButton(for: vm)
            self.ownIdLoginButton = ownIdLoginButton
            resultingController = ownIdLoginButton
            
            subscribeLogin(to: vm.eventPublisher)
            vm.getEmail = getEmail
            vm.subscribe(to: resultPublisher.eraseToAnyPublisher())
            
            ownIdLoginButton.rootView.visualConfig.tooltipVisualLookConfig.isNativePlatform = false
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
    
    open func createOwnIDRegisterButton(for viewModel: OwnID.FlowsSDK.RegisterView.ViewModel) -> UIHostingController<OwnID.FlowsSDK.RegisterView> {
        fatalError("Needs override")
    }
    
    open func createOwnIDLoginButton(for viewModel: OwnID.FlowsSDK.LoginView.ViewModel) -> UIHostingController<OwnID.FlowsSDK.LoginView> {
        fatalError("Needs override")
    }
    
    open func register(_ loginId: String, registrationParameters: [String: Any]) {
        fatalError("Needs override")
    }
    
    open func createRegisterViewModel() -> OwnID.FlowsSDK.RegisterView.ViewModel {
        fatalError("Needs override")
    }
    
    open func createLoginViewModel() -> OwnID.FlowsSDK.LoginView.ViewModel {
        fatalError("Needs override")
    }
    
    func subscribeRegister(to eventsPublisher: OwnID.RegistrationPublisher) {
        eventsPublisher
            .sink { event in
                var eventDictionary = [String: Any]()
                var isBusy = false
                switch event {
                case .success(let event):
                    switch event {
                    case .readyToRegister(let usersEmailFromWebApp, let authType):
                        isBusy = false
                        eventDictionary["loginId"] = usersEmailFromWebApp as Any
                        if let authType = authType {
                            eventDictionary["authType"] = authType as Any
                        }
                        eventDictionary["eventType"] = "OwnIdRegisterEvent.ReadyToRegister"
                        
                    case .userRegisteredAndLoggedIn(_, let authType):
                        isBusy = false
                        if let authType = authType {
                            eventDictionary["authType"] = authType as Any
                        }
                        eventDictionary = ["eventType": "OwnIdRegisterEvent.LoggedIn"]
                        
                    case .loading:
                        isBusy = true
                        
                    case .resetTapped:
                        eventDictionary = ["eventType": "OwnIdRegisterEvent.Undo"]
                    }
                    
                case .failure(let error):
                    isBusy = false
                    if CreationInformation.shared.shouldSkipErrorClosure(error) {
                        let transformedError = CreationInformation.shared.errorTransformClosure(error)
                        eventDictionary = ["eventType": "OwnIdRegisterEvent.Error", "cause": ["message": transformedError.localizedDescription]]
                    }
                }
                let loadingEventDictionary = ["eventType": "OwnIdRegisterEvent.Busy", "isBusy": isBusy] as [String : Any]
                ButtonEventsEventEmitter.shared?.sendEvent(withName: ButtonEventsEventEmitter.EventType.OwnIdEvent.rawValue, body: loadingEventDictionary)
                if !eventDictionary.isEmpty {
                    ButtonEventsEventEmitter.shared?.sendEvent(withName: ButtonEventsEventEmitter.EventType.OwnIdEvent.rawValue, body: eventDictionary)
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
                        if let authType = authType {
                            eventDictionary["authType"] = authType as Any
                        }
                        eventDictionary = ["eventType": "OwnIdLoginEvent.LoggedIn"]
                        
                    case .loading:
                        isBusy = true
                    }
                    
                case .failure(let error):
                    isBusy = false
                    if CreationInformation.shared.shouldSkipErrorClosure(error) {
                        let transformedError = CreationInformation.shared.errorTransformClosure(error)
                        eventDictionary = ["eventType": "OwnIdLoginEvent.Error", "cause": ["message": transformedError.localizedDescription]]
                    }
                }
                let loadingEventDictionary = ["eventType": "OwnIdLoginEvent.Busy", "isBusy": isBusy] as [String : Any]
                ButtonEventsEventEmitter.shared?.sendEvent(withName: ButtonEventsEventEmitter.EventType.OwnIdEvent.rawValue, body: loadingEventDictionary)
                if !eventDictionary.isEmpty {
                    ButtonEventsEventEmitter.shared?.sendEvent(withName: ButtonEventsEventEmitter.EventType.OwnIdEvent.rawValue, body: eventDictionary)
                }
            }
            .store(in: &bag)
    }
}

// MARK: Button Visual Functions

extension OwnIDButtonViewController {
    func applyIconColor(color: UIColor) {
        ownIdLoginButton?.rootView.visualConfig.iconColor = Color(color)
        ownIdRegisterButton?.rootView.visualConfig.iconColor = Color(color)
    }
    
    func applyBackgroundColor(color: UIColor) {
        ownIdLoginButton?.rootView.visualConfig.backgroundColor = Color(color)
        ownIdRegisterButton?.rootView.visualConfig.backgroundColor = Color(color)
    }
    
    func applyBorderColor(color: UIColor) {
        ownIdLoginButton?.rootView.visualConfig.borderColor = Color(color)
        ownIdRegisterButton?.rootView.visualConfig.borderColor = Color(color)
    }
    
    func applyVariant(variant: OwnID.UISDK.ButtonVariant) {
        ownIdLoginButton?.rootView.visualConfig.variant = variant
        ownIdRegisterButton?.rootView.visualConfig.variant = variant
    }
    
    func applyShowOr(isOrViewEnabled: Bool) {
        ownIdLoginButton?.rootView.visualConfig.isOrViewEnabled = isOrViewEnabled
        ownIdRegisterButton?.rootView.visualConfig.isOrViewEnabled = isOrViewEnabled
    }
    
    func applyWidgetPosition(widgetPosition: OwnID.UISDK.WidgetPosition) {
        ownIdLoginButton?.rootView.visualConfig.widgetPosition = widgetPosition
        ownIdRegisterButton?.rootView.visualConfig.widgetPosition = widgetPosition
    }
}

// MARK: Tooltip Visual Functions

extension OwnIDButtonViewController {
    func applyTooltipPosition(position: OwnID.UISDK.TooltipPositionType) {
        ownIdLoginButton?.rootView.visualConfig.tooltipVisualLookConfig.tooltipPosition = position
        ownIdRegisterButton?.rootView.visualConfig.tooltipVisualLookConfig.tooltipPosition = position
    }
    
    func hideTooltip() {
        ownIDLoginViewModel?.shouldShowTooltip = true
        ownIDRegisterModel?.shouldShowTooltip = true
    }
    
    func applyTooltipBorderColor(color: UIColor) {
        ownIdLoginButton?.rootView.visualConfig.tooltipVisualLookConfig.borderColor = Color(color)
        ownIdRegisterButton?.rootView.visualConfig.tooltipVisualLookConfig.borderColor = Color(color)
    }
    
    func applyTooltipBackgroundColor(color: UIColor) {
        ownIdLoginButton?.rootView.visualConfig.tooltipVisualLookConfig.backgroundColor = Color(color)
        ownIdRegisterButton?.rootView.visualConfig.tooltipVisualLookConfig.backgroundColor = Color(color)
    }
}
