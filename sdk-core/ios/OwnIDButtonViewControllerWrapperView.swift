import Foundation
import OwnIDCoreSDK
import React
import UIKit

enum OwnIdButtonWidgetTypeBridge: String {
    case iconButton = "OwnIdButton"
    case authButton = "OwnIdAuthButton"

    func toCoreVariant() -> OwnID.UISDK.WidgetType {
        switch self {
        case .iconButton:
            return .iconButton
        case .authButton:
            return .authButton
        }
    }
}

enum OwnIdButtonWidgetPositionBridge: String {
    case start
    case end

    func toCoreVariant() -> OwnID.UISDK.WidgetPosition {
        switch self {
        case .start:
            return .leading
        case .end:
            return .trailing
        }
    }
}

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
    @objc public var measurementCallback: (() -> Void)?

    @objc(registerMeasurementCallback:)
    public func registerMeasurementCallback(_ callback: @escaping () -> Void) {
        measurementCallback = callback
    }
    var controller: OwnIDButtonViewController!

    public override init(frame: CGRect) {
        super.init(frame: frame)
        CreationInformation.shared.viewInstance = self
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        CreationInformation.shared.viewInstance = self
    }

    // MARK: Button General Properties

    @objc var loginId: NSString = "" {
        didSet {
            controller?.loginId = loginId as String
        }
    }

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
            guard let value = preferredHeight?.doubleValue, value > 0 else { return }
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
        let frameHeight = frame.size.height
        let fallbackHeight = superview?.bounds.height ?? 0
        let candidateHeight = frameHeight > 0 ? frameHeight : fallbackHeight
        controller?.view.frame = bounds
        if bounds.width.isFinite, bounds.width > 0 {
            rendererResolvedWidth = bounds.width
        }
        if bounds.height.isFinite, bounds.height > 0 {
            rendererResolvedHeight = bounds.height
        }
        if candidateHeight > 0 {
            applyResolvedHeight(candidateHeight)
        }
        addButtonController()
    }

    public override func layoutSubviews() {
        super.layoutSubviews()
        if let hostedView = controller?.view {
            hostedView.frame = bounds
            hostedView.setNeedsLayout()
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
        }
    }

    public override func didSetProps(_ changedProps: [String]!) {
        super.didSetProps(changedProps)
        createButtonControllerIfNeeded()
        applyControllerFields()
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
        controller.height = resolvedHeight
        applyControllerFields()
        addButtonController()
    }
}

// MARK: Init

extension OwnIDButtonViewControllerWrapperView {
    fileprivate func createButtonControllerIfNeeded() {
        guard controller == nil else { return }

        controller = OwnIDButtonViewController()
        controller.authIntegration = CreationInformation.shared.authIntegration
    }

    fileprivate func removeButtonController() {
        guard let controller else { return }
        controller.view.removeFromSuperview()
        if controller.parent != nil {
            controller.willMove(toParent: nil)
            controller.removeFromParent()
        }
        self.controller = nil
        pendingControllerAttach = false
    }

    fileprivate func applyControllerFields() {
        guard controller != nil else { return }

        controller.type = ViewDisplayType(rawValue: type.lowercased) ?? .login
        controller.showOr = showOr.boolValue

        if let widgetType = OwnIdButtonWidgetTypeBridge(rawValue: widgetType as String)?.toCoreVariant() {
            controller.widgetType = widgetType
        }
        if let widgetPosition = OwnIdButtonWidgetPositionBridge(rawValue: widgetPosition as String)?.toCoreVariant() {
            controller.widgetPosition = widgetPosition
        }

        if let iconColor = iconColor.nonEmptyColor {
            controller.iconColor = iconColor
        }
        if let buttonBorderColor = buttonBorderColor.nonEmptyColor {
            controller.buttonBorderColor = buttonBorderColor
        }
        if let buttonBackgroundColor = buttonBackgroundColor.nonEmptyColor {
            controller.buttonBackgroundColor = buttonBackgroundColor
        }
        if let buttonTextColor = buttonTextColor.nonEmptyColor {
            controller.buttonTextColor = buttonTextColor
        }

        updateTooltipPosition()
        if let tooltipBorderColor = tooltipBorderColor.nonEmptyColor {
            controller.tooltipBorderColor = tooltipBorderColor
        }
        if let tooltipBackgroundColor = tooltipBackgroundColor.nonEmptyColor {
            controller.tooltipBackgroundColor = tooltipBackgroundColor
        }
        if let tooltipTextColor = tooltipTextColor.nonEmptyColor {
            controller.tooltipTextColor = tooltipTextColor
        }

        controller.showSpinner = showSpinner.boolValue
        if let spinnerColor = spinnerColor.nonEmptyColor {
            controller.spinnerColor = spinnerColor
        }
        if let spinnerBackgroundColor = spinnerBackgroundColor.nonEmptyColor {
            controller.spinnerBackgroundColor = spinnerBackgroundColor
        }
    }

    fileprivate func addButtonController() {
        guard let controller else { return }
        guard controller.view.superview !== self else { return }
        // Attach only when we have a valid React-managed view controller
        guard let parentViewController = self.reactViewController() else {
            if !pendingControllerAttach {
                pendingControllerAttach = true
            }
            DispatchQueue.main.async { [weak self] in
                self?.addButtonController()
            }
            return
        }
        // Paper: do not defer on window/bounds; attach now and rely on constraints + later measurements
        pendingControllerAttach = false
        controller.onContentReady = { [weak self] in
            self?.requestMeasurement()
        }
        controller.loadViewIfNeeded()
        controller.view.translatesAutoresizingMaskIntoConstraints = false
        controller.view.frame = bounds
        // Paper: avoid VC containment to prevent parent mismatch with react-native-screens
        if isFabricRuntime {
            // Defensive: only for Fabric (wrapper normally not used in Fabric)
            parentViewController.addChild(controller)
            addSubview(controller.view)
            NSLayoutConstraint.activate([
                controller.view.leadingAnchor.constraint(equalTo: leadingAnchor),
                controller.view.trailingAnchor.constraint(equalTo: trailingAnchor),
                controller.view.topAnchor.constraint(equalTo: topAnchor),
                controller.view.bottomAnchor.constraint(equalTo: bottomAnchor),
            ])
            setNeedsLayout()
            layoutIfNeeded()
            controller.didMove(toParent: parentViewController)
        } else {
            // Detach from any previous parent to avoid VC tree assertions
            if controller.parent != nil {
                controller.willMove(toParent: nil)
                controller.removeFromParent()
            }
            addSubview(controller.view)
            NSLayoutConstraint.activate([
                controller.view.leadingAnchor.constraint(equalTo: leadingAnchor),
                controller.view.trailingAnchor.constraint(equalTo: trailingAnchor),
                controller.view.topAnchor.constraint(equalTo: topAnchor),
                controller.view.bottomAnchor.constraint(equalTo: bottomAnchor),
            ])
            setNeedsLayout()
            layoutIfNeeded()
        }
        requestMeasurement()
    }

    @objc fileprivate func resolvedContentSize() -> CGSize {
        guard let controller else {
            return lastMeasuredSize
        }
        let preferred = lastResolvedHeight ?? CGFloat(preferredHeight?.doubleValue ?? 0)
        let fallbackHeight = rendererResolvedHeight > 0 ? rendererResolvedHeight : (bounds.height > 0 ? bounds.height : Self.minHeight)
        let baseHeight = max(max(preferred, fallbackHeight), Self.minHeight)
        let widthConstraint: CGFloat? = rendererResolvedWidth > 0 ? rendererResolvedWidth : (jsResolvedWidth > 0 ? jsResolvedWidth : nil)
        let measuredSize = controller.measureContent(
            constrainedWidth: widthConstraint,
            constrainedHeight: baseHeight
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

    fileprivate func updateTooltipPosition() {
        if tooltipPosition.length != 0 {
            let unifiedPosition = tooltipPosition as String
            let hideTooltip = unifiedPosition == "none"
            if hideTooltip {
                controller.shouldShowTooltip = false
            } else {
                if let mappedPosition = OwnID.UISDK.TooltipPositionType.mapPosition(position: unifiedPosition) {
                    controller.tooltipPosition = mappedPosition
                }
            }
        }
    }
}

extension OwnIDButtonViewControllerWrapperView {
    func receiveLayoutInfo(size: CGSize, shouldIgnoreParentSize: Bool) {
        rendererResolvedWidth = size.width.isFinite ? max(0, size.width) : rendererResolvedWidth
        rendererResolvedHeight = size.height.isFinite ? max(Self.minHeight, size.height) : rendererResolvedHeight
        setNeedsLayout()
        layoutIfNeeded()
        addButtonController()
        requestMeasurement()
        if let onContentSizeChange, rendererResolvedWidth > 0, rendererResolvedHeight > 0 {
            onContentSizeChange(["width": Int(lround(rendererResolvedWidth)), "height": Int(lround(rendererResolvedHeight))])
        }
    }
}

extension OwnIDButtonViewControllerWrapperView {
    fileprivate var isFabricRuntime: Bool {
        CreationInformation.shared.managerInstance == nil
    }
}
extension NSString {
    fileprivate var nonEmptyColor: UIColor? {
        guard length != 0 else { return nil }
        let string = self as String
        return string.hexToUIColor
    }
}

extension OwnID.UISDK.TooltipPositionType {
    fileprivate static func mapPosition(position: String) -> OwnID.UISDK.TooltipPositionType? {
        switch position {
        case "start":
            return .leading
        case "end":
            return .trailing

        default:
            return OwnID.UISDK.TooltipPositionType(rawValue: position)
        }
    }
}
