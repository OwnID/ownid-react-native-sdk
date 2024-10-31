import Foundation
import UIKit
import OwnIDCoreSDK

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

final class OwnIDButtonViewControllerWrapperView: UIView {
    var controller: OwnIDButtonViewController!
    
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
    
    override func reactSetFrame(_ frame: CGRect) {
        super.reactSetFrame(frame)
        
        if controller != nil, let height = superview?.bounds.height {
            controller.height = height
        }
    }
    
    override func didSetProps(_ changedProps: [String]!) {
        super.didSetProps(changedProps)
        
        createButtonControllerIfNeeded()
        applyControllerFields()
        addButtonController()
    }
}

// MARK: Init

private extension OwnIDButtonViewControllerWrapperView {
    func createButtonControllerIfNeeded() {
        guard controller == nil else { return }
        
        controller = OwnIDButtonViewController()
        controller.authIntegration = CreationInformation.shared.authIntegration
    }
    
    func applyControllerFields() {
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
    
    func addButtonController() {
        guard controller != nil else { return }
        
        controller.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        addSubview(controller.view)
        controller.didMove(toParent: .none)
    }
    
    func updateTooltipPosition() {
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

private extension NSString {
    var nonEmptyColor: UIColor? {
        guard length != 0 else { return nil }
        let string = self as String
        return string.hexToUIColor
    }
}

private extension OwnID.UISDK.TooltipPositionType {
    static func mapPosition(position: String) -> OwnID.UISDK.TooltipPositionType? {
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
