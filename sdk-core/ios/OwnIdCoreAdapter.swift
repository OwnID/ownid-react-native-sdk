import Combine
import Foundation
import OwnIDCoreSDK
import React

/**
 * Owns the one enrollment operation that the shared Core SDK can safely run.
 *
 * TurboModule methods use a short-lived adapter, while Paper keeps a module
 * instance alive. A process-wide owner gives both paths the same lifecycle.
 * A main-queue caller claims the slot immediately before invoking Core, and a
 * newer request is rejected while the slot is occupied. The operation ID is
 * checked on every completion so a late callback cannot settle another
 * operation.
 */
final class EnrollmentOperationOwner {
    static let shared = EnrollmentOperationOwner()

    private struct Operation {
        let id: UUID
        let settle: (Result<Void, OwnID.CoreSDK.Error>) -> Void
        var cancellable: AnyCancellable?
    }

    private let lock = NSLock()
    private var activeOperation: Operation?

    /// Atomically claims the active operation slot. A second caller receives
    /// `nil` and must reject its request without invoking Core.
    func begin(
        settle: @escaping (Result<Void, OwnID.CoreSDK.Error>) -> Void
    ) -> UUID? {
        let operation = Operation(id: UUID(), settle: settle, cancellable: nil)

        lock.lock()
        guard activeOperation == nil else {
            lock.unlock()
            return nil
        }
        activeOperation = operation
        lock.unlock()

        return operation.id
    }

    /// Retains a subscription unless the operation already settled
    /// synchronously while `sink` was being installed.
    func retain(_ cancellable: AnyCancellable, for operationID: UUID) {
        var cancelImmediately = false
        var previousCancellable: AnyCancellable?

        lock.lock()
        if activeOperation?.id == operationID {
            previousCancellable = activeOperation?.cancellable
            activeOperation?.cancellable = cancellable
        } else {
            cancelImmediately = true
        }
        lock.unlock()

        previousCancellable?.cancel()
        if cancelImmediately {
            cancellable.cancel()
        }
    }

    /// Atomically clears the operation ID, bridge settlement, and cancellable
    /// before invoking the bridge callback. This makes repeated and stale
    /// publisher events harmless.
    func settle(_ event: Result<Void, OwnID.CoreSDK.Error>, for operationID: UUID) {
        lock.lock()
        guard let operation = activeOperation, operation.id == operationID else {
            lock.unlock()
            return
        }
        activeOperation = nil
        lock.unlock()

        withExtendedLifetime(operation) {
            operation.settle(event)
        }
    }
}

@objc(OwnIdCoreAdapter)
public final class OwnIdCoreAdapter: NSObject {
    private enum Constants {
        static let enrollErrorCode = "enrollError"
        static let enrollmentInProgressMessage = "Credential enrollment is already in progress"
    }

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
        resolve: @escaping (Any?) -> Void,
        reject: @escaping (String?, String?, Error?) -> Void
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
}
