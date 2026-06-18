// Exclude legacy RCTViewManager module when building with New Architecture.
#if RCT_NEW_ARCH_ENABLED
    // New Architecture: TurboModule (OwnIdTurboModule) is used instead of this legacy bridge.
#else
    import Foundation
    import React
    import OwnIDCoreSDK
    import Combine

    @objc(OwnIdModule)
    public final class OwnIdModule: RCTViewManager {
        private enum Constants {
            static let enrollErrorCode = "enrollError"
        }

        private var bag = Set<AnyCancellable>()

        @objc public func createInstance(
            _ config: [String: Any],
            productName: String,
            instanceName: String?,
            resolve: @escaping RCTPromiseResolveBlock,
            reject: @escaping RCTPromiseRejectBlock
        ) {
            OwnID.createInstanceReact(config, productName: productName, instanceName: instanceName, resolve: resolve, reject: reject)
        }

        @objc public func setLocale(_ locale: String?, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
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
            resolve: @escaping RCTPromiseResolveBlock,
            reject: @escaping RCTPromiseRejectBlock
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

        @objc
        override public class func requiresMainQueueSetup() -> Bool { true }

        @objc
        override public func constantsToExport() -> [AnyHashable: Any]! {
            return ["naComponents": ["core": true]]
        }
    }
#endif
