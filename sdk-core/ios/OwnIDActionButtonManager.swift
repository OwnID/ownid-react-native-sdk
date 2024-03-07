import Foundation
import React
import UIKit
import OwnIDCoreSDK

final class LocalDataSize: NSObject {
    init(size: CGSize, shouldIgnoreParentSize: Bool) {
        self.size = size
        self.shouldIgnoreParentSize = shouldIgnoreParentSize
    }
    
    let size: CGSize
    let shouldIgnoreParentSize: Bool
}

final class OwnIDShadowView: RCTShadowView {
    override func layout(with layoutMetrics: RCTLayoutMetrics, layoutContext: RCTLayoutContext) {
        if localData.shouldIgnoreParentSize {
            var layoutMetrics = layoutMetrics
            layoutMetrics.frame.size = localData.size
            super.layout(with: layoutMetrics, layoutContext: layoutContext)
        } else {
            var layoutMetrics = layoutMetrics
            layoutMetrics.frame.size = CGSize(width: layoutMetrics.frame.width, height: localData.size.height)
            super.layout(with: layoutMetrics, layoutContext: layoutContext)
        }
    }
    
    var localData = LocalDataSize(size: .zero, shouldIgnoreParentSize: true)
    
    override func canHaveSubviews() -> Bool { false }
    
    override func setLocalData(_ localData: NSObject!) {
        guard let data = localData as? LocalDataSize else { return }
        self.localData = data
        YGNodeSetHasNewLayout(yogaNode, true)
        dirtyLayout()
    }
}

@objc(OwnIDActionButtonManager)
final class OwnIDActionButtonManager: RCTViewManager {
    
    override func view() -> UIView! {
        let instance = OwnIDButtonViewControllerWrapperView()
        CreationInformation.shared.viewInstance = instance
        CreationInformation.shared.managerInstance = self
        return instance
    }
    
    override class func requiresMainQueueSetup() -> Bool { true }
    override func shadowView() -> RCTShadowView! { OwnIDShadowView() }
    override var methodQueue: DispatchQueue! { .main }
    
    func updateLayoutInfo(size: CGSize, shouldIgnoreParentSize: Bool) {
        if shouldIgnoreParentSize {
            DispatchQueue.main.async {
                self.bridge.uiManager.setSize(size, for: CreationInformation.shared.viewInstance)
            }
        }
        RCTExecuteOnUIManagerQueue({
            self.bridge.uiManager.shadowView(forReactTag: CreationInformation.shared.viewInstance!.reactTag).setLocalData(LocalDataSize(size: size, shouldIgnoreParentSize: shouldIgnoreParentSize))
        })
    }
}
