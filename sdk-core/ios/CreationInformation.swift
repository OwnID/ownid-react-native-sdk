import Foundation
import OwnIDCoreSDK

@objc
final public class CreationInformation: NSObject {
    public static let shared = CreationInformation()
    private override init() {}
    weak var viewInstance: OwnIDButtonViewControllerWrapperView?
    weak var managerInstance: OwnIDActionButtonManager?
    public var controllerCreationClosure: (() -> OwnIDButtonViewController)!
    public var errorTransformClosure: ((_ error: OwnID.CoreSDK.Error) -> OwnID.CoreSDK.Error) = { $0 }
    public var shouldSkipErrorClosure: ((_ error: OwnID.CoreSDK.Error) -> Bool) = { _ in true }
}
