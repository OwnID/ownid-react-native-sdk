import Foundation
import UIKit

final class OwnIDButtonViewControllerWrapperView: UIView {
  var controller: OwnIDButtonViewController!
  
  @objc var showOr: NSNumber = 1 {
    didSet {
      setShowOr(value: showOr)
    }
  }
  
  @objc var type: NSString = "" {
    didSet {
      if let type = ViewDisplayType(rawValue: type.lowercased) {
        createButtonController(type: type)
      }
    }
  }
  
  @objc var loginId: NSString = "" {
    didSet {
      controller?.loginId = loginId as String
    }
  }
  
  @objc var buttonBorderColor: NSString = "" {
    didSet {
      setButtonBorderColor(value: buttonBorderColor)
    }
  }
  
  @objc var buttonBackgroundColor: NSString = "" {
    didSet {
      setButtonBackgroundColor(value: buttonBackgroundColor)
    }
  }
  
  @objc var biometryIconColor: NSString = "" {
    didSet {
      setBiometryIconColor(value: biometryIconColor)
    }
  }
}

private extension OwnIDButtonViewControllerWrapperView {
  
  func setButtonBorderColor(value: NSString) {
    guard value.length != 0 else { return }
    let string = value as String
    controller?.applyBorderColor(color: string.hexToUIColor)
  }
  
  func setButtonBackgroundColor(value: NSString) {
    guard value.length != 0 else { return }
    let string = value as String
    controller?.applyBackgroundColor(color: string.hexToUIColor)
  }
  
  func setBiometryIconColor(value: NSString) {
    guard value.length != 0 else { return }
    let string = value as String
    controller?.applyIconColor(color: string.hexToUIColor)
  }
  
  func setShowOr(value: NSNumber) {
    let isOrViewEnabled = value.boolValue
    controller?.applyShowOr(isOrViewEnabled: isOrViewEnabled)
  }
  
  func createButtonController(type: ViewDisplayType) {
    controller = CreationInformation.shared.viewCreationClosure(type)
    addSubviewWithConstraints(viewToAdd: controller.view)
    controller.didMove(toParent: .none)
    
    setButtonBorderColor(value: buttonBorderColor)
    setButtonBackgroundColor(value: buttonBackgroundColor)
    setBiometryIconColor(value: biometryIconColor)
    setShowOr(value: showOr)
  }
}
