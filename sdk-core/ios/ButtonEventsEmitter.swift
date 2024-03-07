import Foundation
import React

extension ButtonEventsEventEmitter {
    enum EventType: String, CaseIterable {
        case ownIdIntegrationEvent = "OwnIdIntegrationEvent"
        case ownIdFlowEvent = "OwnIdFlowEvent"
    }
}

@objc(ButtonEventsEventEmitter)
final class ButtonEventsEventEmitter: RCTEventEmitter {
    
    static var shared: ButtonEventsEventEmitter?
    
    override init() {
        super.init()
        ButtonEventsEventEmitter.shared = self
    }
    
    override func supportedEvents() -> [String]! { EventType.allCases.map { $0.rawValue } }
    
    override class func requiresMainQueueSetup() -> Bool { true }
}
