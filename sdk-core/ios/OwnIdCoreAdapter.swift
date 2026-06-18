import Combine
import Foundation
import OwnIDCoreSDK
import React

@objc(OwnIdCoreAdapter)
public final class OwnIdCoreAdapter: NSObject {
    private enum Constants {
        static let enrollErrorCode = "enrollError"
    }

    private var bag = Set<AnyCancellable>()

    @objc public func createInstance(
        _ config: [String: Any],
        productName: String,
        instanceName: String?,
        resolve: @escaping (Any?) -> Void,
        reject: @escaping (String?, String?, Error?) -> Void
    ) {
        OwnID.createInstanceReact(config, productName: productName, instanceName: instanceName, resolve: resolve, reject: reject)
    }

    @objc public func setLocale(
        _ locale: String?,
        resolve: @escaping (Any?) -> Void,
        reject: @escaping (String?, String?, Error?) -> Void
    ) {
        if let locale {
            OwnID.CoreSDK.setSupportedLanguages([locale])
        }
        resolve(nil)
    }

    @objc public func enrollCredential(
        _ loginId: String,
        authToken: String,
        force: Bool,
        instanceName: String?,
        resolve: @escaping (Any?) -> Void,
        reject: @escaping (String?, String?, Error?) -> Void
    ) {
        DispatchQueue.main.async {
            OwnID.CoreSDK.enrollCredential(loginId: loginId, authToken: authToken, force: force)
                .receive(on: DispatchQueue.main)
                .sink { event in
                    switch event {
                    case .success:
                        resolve(nil)
                    case .failure(let error):
                        switch error {
                        case .flowCancelled:
                            reject(Constants.enrollErrorCode, error.localizedDescription, error)
                        case .userError(let errorModel):
                            reject(errorModel.code.rawValue, errorModel.message, error)
                        default:
                            reject(Constants.enrollErrorCode, error.localizedDescription, error)
                        }
                    }
                }
                .store(in: &self.bag)
        }
    }
}
