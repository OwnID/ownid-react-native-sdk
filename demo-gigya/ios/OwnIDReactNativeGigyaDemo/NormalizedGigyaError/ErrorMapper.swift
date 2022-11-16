import Foundation
import Gigya
import OwnIDGigyaSDK

extension NormalizedGigyaError: PluginError { }

extension OwnID.CoreSDK.Error {
    
    public func mapGigyaCoreError<T: GigyaAccountProtocol>(_ type: T.Type) -> OwnID.CoreSDK.Error {
        switch self {
        case .initRequestNetworkFailed,
                .statusRequestNetworkFailed,
                .loadJWTTokenFailed:
            return OwnID.CoreSDK.Error.plugin(error: NormalizedGigyaError(errorMessage: "Request Failed"))
        case .plugin(error: let underlying):
            if let plugin = underlying as? OwnID.GigyaSDK.Error<T> {
                switch plugin {
                case .login(let error):
                    return .plugin(error: error.error.generalError)
                case .gigyaSDK(error: let error):
                    if let networkError = error as? NetworkError {
                        return .plugin(error: networkError.generalError)
                    }
                    return self
                default:
                    return self
                }
            } else {
                return OwnID.CoreSDK.Error.plugin(error: NormalizedGigyaError(errorMessage: "Request Failed"))
            }
            
        default:
            return self
        }
    }
}
