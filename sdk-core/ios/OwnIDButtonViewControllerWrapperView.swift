import Foundation
import UIKit
import OwnIDCoreSDK

enum OwnIdButtonVariantBridge: String {
    case Fingerprint = "fingerprint"
    case FaceID = "faceId"
    
    func toCoreVariant() -> OwnID.UISDK.ButtonVariant {
        switch self {
        case .Fingerprint:
            return .fingerprint
            
        case .FaceID:
            return .faceId
        }
    }
}

final class OwnIDButtonViewControllerWrapperView: UIView {
    var controller: OwnIDButtonViewController!
    
    // MARK: Button General Properties
    
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
    
    @objc var widgetPosition: NSString = "" {
        didSet {
            setWidgetPosition(value: widgetPosition)
        }
    }
    
    @objc var loginId: NSString = "" {
        didSet {
            controller?.loginId = loginId as String
        }
    }
    
    // MARK: Button Visual Properties
    
    @objc var variant: NSString = "" {
        didSet {
            setVariant(value: variant)
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
    
    @objc var iconColor: NSString = "" {
        didSet {
            setIconColor(value: iconColor)
        }
    }
    
    // MARK: Tooltip Visual Properties
    
    @objc var tooltipPosition: NSString = "" {
        didSet {
            setTooltipPosition(value: tooltipPosition)
        }
    }
    
    @objc var tooltipBackgroundColor: NSString = "" {
        didSet {
            setTooltipBackgroundColor(value: tooltipBackgroundColor)
        }
    }
    
    @objc var tooltipBorderColor: NSString = "" {
        didSet {
            setTooltipBorderColor(value: tooltipBorderColor)
        }
    }
}

// MARK: Button Visual Functions

private extension OwnIDButtonViewControllerWrapperView {
    func setVariant(value: NSString) {
        guard let variant = OwnIdButtonVariantBridge(rawValue: value as String)?.toCoreVariant() else { return }
        controller?.applyVariant(variant: variant)
    }
    
    func setButtonBorderColor(value: NSString) {
        guard let color = value.nonEmptyColor else { return }
        controller?.applyBorderColor(color: color)
    }
    
    func setButtonBackgroundColor(value: NSString) {
        guard let color = value.nonEmptyColor else { return }
        controller?.applyBackgroundColor(color: color)
    }
    
    func setIconColor(value: NSString) {
        guard let color = value.nonEmptyColor else { return }
        controller?.applyIconColor(color: color)
    }
    
    func setShowOr(value: NSNumber) {
        let isOrViewEnabled = value.boolValue
        controller?.applyShowOr(isOrViewEnabled: isOrViewEnabled)
    }
    
    func setWidgetPosition(value: NSString) {
        if let widgetPosition = OwnID.UISDK.WidgetPosition(rawValue: widgetPosition.lowercased) {
            controller?.applyWidgetPosition(widgetPosition: widgetPosition)
        }
    }
}

private extension OwnIDButtonViewControllerWrapperView {
    func createButtonController(type: ViewDisplayType) {
        if !OwnID.CoreSDK.shared.isSDKConfigured {
            let loadingEventDictionary = ["eventType": "OwnIdRegisterEvent.Error", "cause": ["message": "SDK is not initialized. Please initalize it before using it's code."]] as [String : Any]
            ButtonEventsEventEmitter.shared?.sendEvent(withName: ButtonEventsEventEmitter.EventType.OwnIdEvent.rawValue, body: loadingEventDictionary)
            return
        }
        controller = CreationInformation.shared.controllerCreationClosure()
        controller.type = type
        controller.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        addSubview(controller.view)
        controller.didMove(toParent: .none)
        
        // button styles
        setButtonBorderColor(value: buttonBorderColor)
        setButtonBackgroundColor(value: buttonBackgroundColor)
        setIconColor(value: iconColor)
        setShowOr(value: showOr)
        setVariant(value: variant)
        setWidgetPosition(value: widgetPosition)
        
        // tooltip styles
        setTooltipPosition(value: tooltipPosition)
        setTooltipBackgroundColor(value: tooltipBackgroundColor)
        setTooltipBorderColor(value: tooltipBorderColor)
    }
}

// MARK: Tooltip Functions

private extension OwnIDButtonViewControllerWrapperView {
    func setTooltipPosition(value: NSString) {
        guard value.length != 0 else { return }
        let unifiedPosition = value as String
        let hideTooltip = unifiedPosition == "none"
        if hideTooltip {
            controller?.hideTooltip()
        } else {
            if let mappedPosition = OwnID.UISDK.TooltipPositionType.mapPosition(position: unifiedPosition) {
                controller?.applyTooltipPosition(position: mappedPosition)
            }
        }
    }
    
    func setTooltipBackgroundColor(value: NSString) {
        guard let color = value.nonEmptyColor else { return }
        controller?.applyTooltipBackgroundColor(color: color)
    }
    
    func setTooltipBorderColor(value: NSString) {
        guard let color = value.nonEmptyColor else { return }
        controller?.applyTooltipBorderColor(color: color)
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
            return .left
        case "end":
            return .right
            
        default:
            return OwnID.UISDK.TooltipPositionType(rawValue: position)
        }
    }
}
