import Foundation
import React
import OwnIDCoreSDK
import Combine

@objc(OwnIdModule)
final class OwnIdModule: RCTViewManager {
    private enum Constants {
        static let enrollErrorCode = "enrollError"
    }
    
    private var bag = Set<AnyCancellable>()
    
    @objc func createInstance(_ config: [String: Any],
                              productName: String,
                              instanceName: String?,
                              resolve: @escaping RCTPromiseResolveBlock,
                              reject: @escaping RCTPromiseRejectBlock) {
        OwnID.createInstanceReact(config, productName: productName, instanceName: instanceName, resolve: resolve, reject: reject)
    }
    
    @objc func enrollCredential(_ loginId: String,
                                authToken: String,
                                force: Bool,
                                instanceName: String?,
                                resolve: @escaping RCTPromiseResolveBlock,
                                reject: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            OwnID.CoreSDK.enrollCredential(loginId: loginId, authToken: authToken, force: force)
            OwnID.CoreSDK.enrollEventPublisher
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
    override class func requiresMainQueueSetup() -> Bool { true }
}
