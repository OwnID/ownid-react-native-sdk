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
            static let enrollmentInProgressMessage = "Credential enrollment is already in progress"
        }

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
            OwnID.runOnMainThread {
                OwnID.CoreSDK.setSupportedLanguages(locale.map { [$0] } ?? Locale.preferredLanguages)
                resolve(nil)
            }
        }

        @objc public func enrollCredential(
            _ loginId: String,
            authToken: String,
            force: Bool,
            instanceName: String?,
            resolve: @escaping RCTPromiseResolveBlock,
            reject: @escaping RCTPromiseRejectBlock
        ) {
            guard instanceName == nil else {
                reject(
                    OwnID.GenericError.unsupportedInstanceNameCode,
                    OwnID.GenericError.unsupportedInstanceNameMessage,
                    OwnID.GenericError()
                )
                return
            }

            DispatchQueue.main.async {
                guard let operationID = EnrollmentOperationOwner.shared.begin(
                    settle: { event in
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
                ) else {
                    reject(Constants.enrollErrorCode, Constants.enrollmentInProgressMessage, nil)
                    return
                }

                let cancellable = OwnID.CoreSDK.enrollCredential(loginId: loginId, authToken: authToken, force: force)
                    .receive(on: DispatchQueue.main)
                    .sink { event in
                        EnrollmentOperationOwner.shared.settle(event, for: operationID)
                    }
                EnrollmentOperationOwner.shared.retain(cancellable, for: operationID)
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
