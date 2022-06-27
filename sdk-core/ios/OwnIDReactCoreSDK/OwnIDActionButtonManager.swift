import Foundation
import React
import UIKit
import OwnIDCoreSDK

@objc(OwnIDActionButtonManager)
final class OwnIDActionButtonManager: RCTViewManager {
  
  override func view() -> UIView! {
    let instance = OwnIDButtonViewControllerWrapperView()
    CreationInformation.shared.viewInstance = instance
    return instance
  }
  
  override func shadowView() -> RCTShadowView! {
    let shadowView = OwnIDButtonRCTShadowView()
    CreationInformation.shared.managerInstance = self
    return shadowView
  }
  
  override class func requiresMainQueueSetup() -> Bool { true }
  
  func updateLayoutInfo(info: SizeInfo) {
      RCTExecuteOnUIManagerQueue {
        let shadowView = self.bridge.uiManager.shadowView(forReactTag: CreationInformation.shared.viewInstance?.reactTag)
        shadowView?.setLocalData(info)
        self.bridge.uiManager.setNeedsLayout()
      }
  }
}
