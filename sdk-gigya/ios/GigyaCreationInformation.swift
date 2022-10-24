import Foundation
import Gigya
import SDKCore

extension CreationInformation {
  func setupGigyaController<T>(gigyaAccountType: T.Type) where T: GigyaAccountProtocol {
    controllerCreationClosure = { OwnIDGigyaButtonViewController<T>() }
  }
}
