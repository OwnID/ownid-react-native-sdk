import Foundation
import OwnIDGigyaSDK

@objc
final class CreationInformation: NSObject {
  static let shared = CreationInformation()
  private override init() {}
  weak var viewInstance: OwnIDButtonViewControllerWrapperView?
  weak var managerInstance: OwnIDActionButtonManager?
  var viewCreationClosure: ((_ viewType: ViewDisplayType) -> OwnIDButtonViewController)!
  var errorTransformClosure: ((_ error: OwnID.CoreSDK.Error) -> OwnID.CoreSDK.Error) = { $0 }
}
