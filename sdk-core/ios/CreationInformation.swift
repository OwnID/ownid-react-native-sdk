import Foundation
import OwnIDCoreSDK

@objc
final public class CreationInformation: NSObject {
    public static let shared = CreationInformation()
    private override init() {}
    public weak var registerViewModel: OwnID.FlowsSDK.RegisterView.ViewModel?
    public var hasIntegration = false
    public var authIntegration: AuthIntegration!
}
