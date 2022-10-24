import Foundation
import React
import UIKit
import OwnIDCoreSDK

@objc(OwnIDActionButtonManager)
final class OwnIDActionButtonManager: RCTViewManager {
    
    override func view() -> UIView! {
        let instance = OwnIDButtonViewControllerWrapperView()
        CreationInformation.shared.viewInstance = instance
        CreationInformation.shared.managerInstance = self
        return instance
    }
    
    override class func requiresMainQueueSetup() -> Bool { true }
    
    func updateLayoutInfo(info: SizeInfo) {
        DispatchQueue.main.async {
            self.bridge.uiManager.setSize(info.size, for: CreationInformation.shared.viewInstance)
        }
    }
}
