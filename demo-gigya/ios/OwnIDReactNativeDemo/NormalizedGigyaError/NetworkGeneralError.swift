import Foundation
import Gigya

public extension NetworkError {
    var generalError: NormalizedGigyaError {
        switch self {
        case .gigyaError(data: let data):
            return NormalizedGigyaError(errorMessage: data.errorMessage)
        case .providerError(data: let data):
            return NormalizedGigyaError(errorMessage: data)
        case .networkError:
            return NormalizedGigyaError(errorMessage: "Request Error")
        case .emptyResponse:
            return NormalizedGigyaError(errorMessage: "Empty Response")
        case .jsonParsingError:
            return NormalizedGigyaError(errorMessage: "Parsing Error")
        case .createURLRequestFailed:
            return NormalizedGigyaError(errorMessage: "Request Error")
        }
    }
}
