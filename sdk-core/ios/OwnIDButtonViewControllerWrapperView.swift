import Foundation
import React
import UIKit

@objcMembers
@objc(OwnIDButtonViewControllerWrapperView)
public final class OwnIDButtonViewControllerWrapperView: UIView {
    private static let minHeight: CGFloat = 40
    private var lastResolvedHeight: CGFloat?
    private var lastMeasuredSize: CGSize = .zero
    private var rendererResolvedWidth: CGFloat = 0
    private var rendererResolvedHeight: CGFloat = 0
    private var jsResolvedWidth: CGFloat = 0
    private var pendingControllerAttach = false
    private var isMeasurementScheduled = false
    private var pendingContentSizeEvent: CGSize?
    private var lastContentSizeEvent: CGSize = .zero
    private var isContentSizeEventScheduled = false
    private var hasAppliedPropBatch = false
    @objc public var measurementCallback: (() -> Void)?
    weak var paperManager: OwnIDActionButtonManager?

    @objc(registerMeasurementCallback:)
    public func registerMeasurementCallback(_ callback: @escaping () -> Void) {
        measurementCallback = callback
    }
    var controller: OwnIDButtonViewController!

    public override init(frame: CGRect) {
        super.init(frame: frame)
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
    }

    deinit {
        controller?.bridge_prepareForRecycle()
        removeButtonController()
    }

    // MARK: Button General Properties

    @objc var loginId: NSString = ""
    @objc var ownerToken: NSString = ""

    @objc var showOr: NSNumber = 1
    @objc var type: NSString = ""
    @objc var widgetType: NSString = ""
    @objc var widgetPosition: NSString = ""

    // MARK: Button Visual Properties

    @objc var iconColor: NSString = ""
    @objc var buttonBorderColor: NSString = ""
    @objc var buttonBackgroundColor: NSString = ""
    @objc var buttonTextColor: NSString = ""

    // MARK: Tooltip Visual Properties

    @objc var tooltipPosition: NSString = ""
    @objc var tooltipBackgroundColor: NSString = ""
    @objc var tooltipBorderColor: NSString = ""
    @objc var tooltipTextColor: NSString = ""

    // MARK: Spinner Visual Properties

    @objc var showSpinner: NSNumber = 1
    @objc var spinnerColor: NSString = ""
    @objc var spinnerBackgroundColor: NSString = ""

    // NA interop compatibility
    @objc var preferredHeight: NSNumber? {
        didSet {
            guard let value = preferredHeight?.doubleValue, value > 0 else {
                // React Native sends nil when an explicit height is removed.
                // Do not let the previous numeric value force the next
                // intrinsic measurement.
                lastResolvedHeight = nil
                return
            }
            applyResolvedHeight(CGFloat(value))
        }
    }

    @objc var resolvedWidth: NSNumber? {
        didSet {
            let numeric = CGFloat(resolvedWidth?.doubleValue ?? 0)
            jsResolvedWidth = numeric > 0 ? numeric : 0
        }
    }
    @objc var onContentSizeChange: RCTDirectEventBlock? = nil

    public override func reactSetFrame(_ frame: CGRect) {
        super.reactSetFrame(frame)
        controller?.view.frame = bounds
        if bounds.width.isFinite, bounds.width > 0 {
            rendererResolvedWidth = bounds.width
        }
        if bounds.height.isFinite, bounds.height > 0 {
            rendererResolvedHeight = bounds.height
        }
        addButtonController()
    }

    public override func layoutSubviews() {
        super.layoutSubviews()
        if let hostedView = controller?.view {
            hostedView.frame = bounds
        }
        if bounds.width.isFinite, bounds.width > 0 {
            rendererResolvedWidth = bounds.width
        }
        if bounds.height.isFinite, bounds.height > 0 {
            rendererResolvedHeight = bounds.height
        }
    }

    public override func didMoveToWindow() {
        super.didMoveToWindow()
        if window != nil {
            addButtonController()
        } else {
            detachButtonController()
        }
    }

    public override func didMoveToSuperview() {
        super.didMoveToSuperview()
        if superview != nil {
            addButtonController()
        } else {
            detachButtonController()
        }
    }

    public override func didSetProps(_ changedProps: [String]!) {
        super.didSetProps(changedProps)
        createButtonControllerIfNeeded()
        configureController()
        hasAppliedPropBatch = true
        addButtonController()
    }
}

extension OwnIDButtonViewControllerWrapperView {
    fileprivate func hostViewController() -> UIViewController? {
        if let vc = reactViewController() {
            return vc
        }
        var ancestor = superview
        while let view = ancestor {
            if let vc = view.reactViewController() {
                return vc
            }
            ancestor = view.superview
        }
        var responder: UIResponder? = self
        while let next = responder?.next {
            if let vc = next as? UIViewController {
                return vc
            }
            responder = next
        }
        if #available(iOS 15.0, *) {
            if let scene = UIApplication.shared.connectedScenes
                .compactMap({ $0 as? UIWindowScene })
                .first(where: { $0.activationState == .foregroundActive }),
                let window = scene.windows.first(where: { $0.isKeyWindow })
            {
                return window.rootViewController
            }
        } else {
            if let window = UIApplication.shared.windows.first(where: { $0.isKeyWindow }) {
                return window.rootViewController
            }
        }
        return nil
    }

    fileprivate func requestMeasurement() {
        guard let measurementCallback else { return }
        if isMeasurementScheduled { return }
        isMeasurementScheduled = true
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            self.isMeasurementScheduled = false
            measurementCallback()
        }
    }

    fileprivate func applyResolvedHeight(_ rawHeight: CGFloat) {
        guard rawHeight.isFinite, rawHeight > 0 else { return }
        let resolvedHeight = max(Self.minHeight, rawHeight)
        if let lastResolvedHeight, abs(lastResolvedHeight - resolvedHeight) < 0.5 {
            return
        }
        lastResolvedHeight = resolvedHeight
        rendererResolvedHeight = resolvedHeight
        createButtonControllerIfNeeded()
        controller.bridge_applyResolvedHeight(NSNumber(value: Double(resolvedHeight)))
        addButtonController()
    }
}

// MARK: Init

extension OwnIDButtonViewControllerWrapperView {
    fileprivate func createButtonControllerIfNeeded() {
        guard controller == nil else { return }

        controller = OwnIDButtonViewController()
        controller.authIntegration = CreationInformation.shared.authIntegration
        controller.paperOwner = self
    }

    fileprivate func removeButtonController() {
        guard let controller else { return }
        detachButtonController()
        self.controller = nil
        pendingControllerAttach = false
    }

    fileprivate func detachButtonController() {
        guard let controller else { return }
        if controller.parent != nil {
            controller.willMove(toParent: nil)
        }
        controller.viewIfLoaded?.removeFromSuperview()
        if controller.parent != nil {
            controller.removeFromParent()
        }
    }

    fileprivate func configureController() {
        guard controller != nil else { return }

        controller.bridge_configure(
            type: type,
            widgetType: widgetType,
            widgetPosition: widgetPosition,
            login: loginId,
            ownerToken: ownerToken,
            showOr: showOr,
            showSpinner: showSpinner,
            iconColor: iconColor,
            buttonBorderColor: buttonBorderColor,
            buttonBackgroundColor: buttonBackgroundColor,
            buttonTextColor: buttonTextColor,
            tooltipPositionStr: tooltipPosition,
            tooltipTextColor: tooltipTextColor,
            tooltipBackgroundColor: tooltipBackgroundColor,
            tooltipBorderColor: tooltipBorderColor,
            spinnerColor: spinnerColor,
            spinnerBackgroundColor: spinnerBackgroundColor,
            preferredHeight: preferredHeight
        )
    }

    fileprivate func addButtonController() {
        // Paper invokes individual prop setters before didSetProps. Do not create
        // publisher subscriptions until the complete prop batch (including the
        // owner token) has been applied.
        guard hasAppliedPropBatch else { return }
        guard let controller else { return }
        guard window != nil else { return }
        // Attach only when we have a valid React-managed view controller
        guard let parentViewController = self.reactViewController() else {
            guard !pendingControllerAttach else { return }
            pendingControllerAttach = true
            DispatchQueue.main.async { [weak self] in
                self?.pendingControllerAttach = false
                self?.addButtonController()
            }
            return
        }
        pendingControllerAttach = false
        controller.onContentReady = { [weak self] in
            self?.requestMeasurement()
        }
        controller.loadViewIfNeeded()
        if controller.parent === parentViewController, controller.view.superview === self {
            requestMeasurement()
            return
        }
        detachButtonController()
        controller.view.translatesAutoresizingMaskIntoConstraints = false
        controller.view.frame = bounds
        parentViewController.addChild(controller)
        addSubview(controller.view)
        NSLayoutConstraint.activate([
            controller.view.leadingAnchor.constraint(equalTo: leadingAnchor),
            controller.view.trailingAnchor.constraint(equalTo: trailingAnchor),
            controller.view.topAnchor.constraint(equalTo: topAnchor),
            controller.view.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])
        controller.didMove(toParent: parentViewController)
        requestMeasurement()
    }

    @objc fileprivate func resolvedContentSize() -> CGSize {
        guard let controller else {
            return lastMeasuredSize
        }
        let preferred = CGFloat(preferredHeight?.doubleValue ?? 0)
        let baseHeight = max(preferred, Self.minHeight)
        let widthConstraint: CGFloat? = rendererResolvedWidth > 0 ? rendererResolvedWidth : (jsResolvedWidth > 0 ? jsResolvedWidth : nil)
        let measuredSize = controller.measureContent(
            constrainedWidth: widthConstraint,
            constrainedHeight: preferred > 0 ? baseHeight : nil
        )
        var width = widthConstraint ?? measuredSize.width
        var height = measuredSize.height
        if width <= 0 {
            width = lastMeasuredSize.width
        }
        if height <= 0 {
            height = baseHeight
        }
        if width < 0 {
            width = 0
        }
        if height < Self.minHeight {
            height = Self.minHeight
        }
        let resolved = CGSize(width: width, height: height)
        lastMeasuredSize = resolved
        return resolved
    }

    @objc fileprivate func updateRendererLayout(width: CGFloat, height: CGFloat) {
        if width.isFinite, width >= 0 {
            rendererResolvedWidth = width
        }
        if height.isFinite, height >= 0 {
            rendererResolvedHeight = height
        }
    }

}

extension OwnIDButtonViewControllerWrapperView {
    func receiveLayoutInfo(size: CGSize, shouldIgnoreParentSize: Bool) {
        paperManager?.updateLayoutInfo(
            size: size,
            shouldIgnoreParentSize: shouldIgnoreParentSize,
            for: self
        )
        if shouldIgnoreParentSize, size.width.isFinite {
            rendererResolvedWidth = max(0, size.width)
        }
        rendererResolvedHeight = size.height.isFinite ? max(Self.minHeight, size.height) : rendererResolvedHeight
        addButtonController()
        requestMeasurement()
        scheduleContentSizeEvent(
            CGSize(width: rendererResolvedWidth, height: rendererResolvedHeight)
        )
    }

    private func scheduleContentSizeEvent(_ size: CGSize) {
        guard size.width.isFinite, size.height.isFinite, size.width > 0, size.height > 0 else { return }
        pendingContentSizeEvent = size
        guard !isContentSizeEventScheduled else { return }
        isContentSizeEventScheduled = true
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            self.isContentSizeEventScheduled = false
            guard let size = self.pendingContentSizeEvent else { return }
            self.pendingContentSizeEvent = nil
            guard abs(self.lastContentSizeEvent.width - size.width) >= 0.5 ||
                abs(self.lastContentSizeEvent.height - size.height) >= 0.5
            else { return }
            self.lastContentSizeEvent = size
            self.onContentSizeChange?([
                "width": Int(lround(size.width)),
                "height": Int(lround(size.height)),
            ])
        }
    }
}
