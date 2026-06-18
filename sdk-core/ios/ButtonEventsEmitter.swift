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
    private var hasListeners = false

    override init() {
        super.init()
        ButtonEventsEventEmitter.shared = self
    }

    deinit {
        if ButtonEventsEventEmitter.shared === self {
            ButtonEventsEventEmitter.shared = nil
        }
    }

    override func supportedEvents() -> [String]! { EventType.allCases.map { $0.rawValue } }

    override func sendEvent(withName name: String!, body: Any!) {
        guard hasListeners else { return }
        super.sendEvent(withName: name, body: body)
    }

    override func startObserving() { hasListeners = true }
    override func stopObserving() { hasListeners = false }

    override class func requiresMainQueueSetup() -> Bool { true }
}
