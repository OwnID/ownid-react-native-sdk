import Foundation
import UIKit
import OwnIDCoreSDK
import Combine
import SwiftUI
import NormalizedGigyaError

open class OwnIDButtonViewController: UIViewController {
  
  private var bag = Set<AnyCancellable>()
  
  private var ownIdRegisterButton: UIHostingController<OwnID.FlowsSDK.RegisterView>?
  private var ownIdLoginButton: UIHostingController<OwnID.FlowsSDK.LoginView>?
  
  var ownIDLoginViewModel: OwnID.FlowsSDK.LoginView.ViewModel?
  var ownIDVRegisteriewModel: OwnID.FlowsSDK.RegisterView.ViewModel?
  
  var loginId = ""
  var type: ViewDisplayType = .login
  
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
    switch type {
    case .register:
      let vm = createRegisterViewModel()
      ownIDVRegisteriewModel = vm
      ownIdRegisterButton = createOwnIDRegisterButton(for: vm)
      
      guard let ownIdRegisterButton = ownIdRegisterButton else { return }
      subscribeRegister(to: vm.eventPublisher)
      addChild(ownIdRegisterButton)
      view.addSubviewWithConstraints(viewToAdd: ownIdRegisterButton.view)
      ownIdRegisterButton.didMove(toParent: self)
      
    case .login:
      let vm = createLoginViewModel()
      ownIDLoginViewModel = vm
      ownIdLoginButton = createOwnIDLoginButton(for: vm)
      
      guard let ownIdLoginButton = ownIdLoginButton else { return }
      subscribeLogin(to: vm.eventPublisher)
      addChild(ownIdLoginButton)
      view.addSubviewWithConstraints(viewToAdd: ownIdLoginButton.view)
      ownIdLoginButton.didMove(toParent: self)
    }
  }
  
  func applyIconColor(color: UIColor) {
    ownIdLoginButton?.rootView.visualConfig.biometryIconColor = Color(color)
    ownIdRegisterButton?.rootView.visualConfig.biometryIconColor = Color(color)
  }
  
  func applyBackgroundColor(color: UIColor) {
    ownIdLoginButton?.rootView.visualConfig.backgroundColor = Color(color)
    ownIdRegisterButton?.rootView.visualConfig.backgroundColor = Color(color)
  }
  
  func applyBorderColor(color: UIColor) {
    ownIdLoginButton?.rootView.visualConfig.borderColor = Color(color)
    ownIdRegisterButton?.rootView.visualConfig.borderColor = Color(color)
  }
  
  func applyShowOr(isOrViewEnabled: Bool) {
    ownIdLoginButton?.rootView.visualConfig.isOrViewEnabled = isOrViewEnabled
    ownIdRegisterButton?.rootView.visualConfig.isOrViewEnabled = isOrViewEnabled
  }
  
  func undo() {
    ownIDVRegisteriewModel?.reset()
    ownIDLoginViewModel?.reset()
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
          case .readyToRegister(let usersEmailFromWebApp):
            isBusy = false
            eventDictionary = ["eventType": "OwnIdRegisterEvent.ReadyToRegister", "loginId": usersEmailFromWebApp as Any]
            
          case .userRegisteredAndLoggedIn:
            isBusy = false
            eventDictionary = ["eventType": "OwnIdRegisterEvent.LoggedIn"]
            
          case .loading:
            isBusy = true
          case .resetTapped:
            eventDictionary = ["eventType": "OwnIdRegisterEvent.Undo"]
          }
          
        case .failure(let error):
          isBusy = false
          let transformedError = CreationInformation.shared.errorTransformClosure(error)
          eventDictionary = ["eventType": "OwnIdRegisterEvent.Error", "cause": ["message": transformedError.localizedDescription]]
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
          case .loggedIn:
            isBusy = false
            eventDictionary = ["eventType": "OwnIdLoginEvent.LoggedIn"]
            
          case .loading:
            isBusy = true
          }
          
        case .failure(let error):
          isBusy = false
          let transformedError = CreationInformation.shared.errorTransformClosure(error)
          eventDictionary = ["eventType": "OwnIdLoginEvent.Error", "cause": ["message": transformedError.localizedDescription]]
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
