import Foundation
import React

extension ButtonEventsEventEmitter {
  enum EventType: String {
    case OwnIdEvent
  }
}

@objc(ButtonEventsEventEmitter)
final class ButtonEventsEventEmitter: RCTEventEmitter {
  
  static var shared:ButtonEventsEventEmitter?
  
  override init() {
    super.init()
    ButtonEventsEventEmitter.shared = self
  }
  
  override func supportedEvents() -> [String]! { [EventType.OwnIdEvent.rawValue] }
  
  override class func requiresMainQueueSetup() -> Bool { true }
}
