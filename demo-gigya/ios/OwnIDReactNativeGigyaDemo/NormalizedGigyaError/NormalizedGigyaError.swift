import Foundation

public struct NormalizedGigyaError: Swift.Error {
    public init(errorMessage: String?) {
        self.errorMessage = errorMessage
    }
    
    public let errorMessage: String?
}

extension NormalizedGigyaError: LocalizedError {
    public var errorDescription: String? {
        errorMessage ?? ""
    }
}
