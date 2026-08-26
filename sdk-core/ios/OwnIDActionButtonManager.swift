import Foundation
import OwnIDCoreSDK
import React
import UIKit

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
        instance.paperManager = self
        return instance
    }

    override class func requiresMainQueueSetup() -> Bool { true }
    override func shadowView() -> RCTShadowView! { OwnIDShadowView() }
    override var methodQueue: DispatchQueue! { .main }

    func updateLayoutInfo(
        size: CGSize,
        shouldIgnoreParentSize: Bool,
        for viewInstance: OwnIDButtonViewControllerWrapperView
    ) {
        let reactTag = viewInstance.reactTag
        if shouldIgnoreParentSize {
            DispatchQueue.main.async { [weak self, weak viewInstance] in
                guard let self, let viewInstance else { return }
                guard viewInstance.reactTag == reactTag else { return }
                self.bridge.uiManager.setSize(size, for: viewInstance)
            }
        }
        RCTExecuteOnUIManagerQueue({ [weak self, weak viewInstance] in
            guard let self, let viewInstance, viewInstance.reactTag == reactTag else { return }
            let view = self.bridge.uiManager.shadowView(forReactTag: reactTag)
            view?.setLocalData(LocalDataSize(size: size, shouldIgnoreParentSize: shouldIgnoreParentSize))
        })
    }
}
