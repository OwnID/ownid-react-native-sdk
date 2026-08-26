package com.ownid.sdk.reactnative

import android.os.Handler
import android.os.Looper
import androidx.activity.ComponentActivity
import androidx.annotation.MainThread
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.viewmodel.CreationExtras
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.ownid.sdk.InstanceName
import com.ownid.sdk.InternalOwnIdAPI
import com.ownid.sdk.OwnId
import com.ownid.sdk.OwnIdCoreImpl
import com.ownid.sdk.OwnIdInstance
import com.ownid.sdk.exception.OwnIdException
import com.ownid.sdk.internal.component.OwnIdInternalLogger
import com.ownid.sdk.viewmodel.OwnIdEnrollmentViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.flow.filterNotNull
import kotlinx.coroutines.launch
import java.lang.ref.WeakReference
import java.util.UUID

@OptIn(InternalOwnIdAPI::class)
public class OwnIdModule(
    reactContext: ReactApplicationContext
) : NativeOwnIdModuleSpec(reactContext), LifecycleEventListener {

    private class EnrollmentOperation(
        val key: String,
        val promise: Promise,
        val hostViewModelStore: ViewModelStore,
        val viewModelStore: ViewModelStore = ViewModelStore(),
    ) {
        var activity: WeakReference<ComponentActivity>? = null
        var viewModel: OwnIdEnrollmentViewModel? = null
        var collector: Job? = null
        var settled: Boolean = false
    }

    private var enrollmentOperation: EnrollmentOperation? = null
    @Volatile
    private var invalidated: Boolean = false

    override fun getName(): String = "OwnIdModule"

    override fun getConstants(): MutableMap<String, Any> = mutableMapOf(
        "naComponents" to mapOf("core" to true)
    )

    @ReactMethod
    public override fun createInstance(config: ReadableMap, productName: String, instanceName: String?, promise: Promise) {
        if (rejectNamedInstance(instanceName, promise)) return
        OwnId.createInstanceReact(
            reactApplicationContext,
            promise,
            config,
            productName,
            InstanceName.DEFAULT,
        )
    }

    @ReactMethod
    @OptIn(InternalOwnIdAPI::class)
    public override fun setLocale(locale: String?, promise: Promise) {
        runOnMainThread {
            runCatching {
                @Suppress("DEPRECATION")
                val ownIdInstance = OwnId.getInstanceOrNull<OwnIdInstance>(InstanceName.DEFAULT)
                    ?: throw OwnIdException("No OwnID instance found")
                (ownIdInstance.ownIdCore as OwnIdCoreImpl).apply {
                    localeService.setLanguageTags(locale)
                    localeService.updateCurrentOwnIdLocale(reactApplicationContext)
                }
            }
                .onSuccess { promise.resolve(null) }
                .onFailure { cause -> promise.reject(cause) }
        }
    }

    @ReactMethod
    @OptIn(InternalOwnIdAPI::class)
    public override fun enrollCredential(loginId: String, authToken: String, force: Boolean, instanceName: String?, promise: Promise) {
        if (rejectNamedInstance(instanceName, promise)) return

        if (Looper.getMainLooper().isCurrentThread) {
            enrollCredential(loginId, authToken, force, promise)
        } else {
            Handler(Looper.getMainLooper()).post {
                enrollCredential(loginId, authToken, force, promise)
            }
        }
    }

    @MainThread
    @OptIn(InternalOwnIdAPI::class)
    private fun enrollCredential(
        loginId: String,
        authToken: String,
        force: Boolean,
        promise: Promise,
    ) {
        if (invalidated) {
            promise.reject(OwnIdException("OwnID module is no longer available"))
            return
        }
        if (enrollmentOperation != null) {
            promise.reject(OwnIdException("An OwnID enrollment operation is already in progress"))
            return
        }

        val activity = reactApplicationContext.getCurrentActivity() as? ComponentActivity
        if (activity == null || activity.isFinishing || activity.isDestroyed) {
            OwnIdInternalLogger.logW(this, "enrollCredential", "No ComponentActivity available")
            promise.reject(OwnIdException("No ComponentActivity available"))
            return
        }

        runCatching {
            @Suppress("DEPRECATION")
            val ownIdInstance = OwnId.getInstanceOrThrow<OwnIdInstance>(InstanceName.DEFAULT)
            val operation = EnrollmentOperation(
                key = "$ENROLLMENT_VIEW_MODEL_KEY_PREFIX${UUID.randomUUID()}",
                promise = promise,
                hostViewModelStore = activity.viewModelStore,
            )
            enrollmentOperation = operation
            val viewModel = bindEnrollmentOperation(operation, activity, ownIdInstance)
            viewModel.enrollCredential(activity, loginId, authToken, force)
        }.onFailure { cause ->
            OwnIdInternalLogger.logW(this, "enrollCredential", "Fail to enroll credential: ${cause.message}", cause)
            val operation = enrollmentOperation
            if (operation != null && operation.promise === promise) {
                settleEnrollment(operation, Result.failure(cause))
            } else {
                promise.reject(cause)
            }
        }
    }

    @MainThread
    @OptIn(InternalOwnIdAPI::class)
    private fun bindEnrollmentOperation(
        operation: EnrollmentOperation,
        activity: ComponentActivity,
        ownIdInstance: OwnIdInstance,
    ): OwnIdEnrollmentViewModel {
        check(operation.hostViewModelStore === activity.viewModelStore) {
            "OwnID enrollment cannot move to a different Activity"
        }

        val factory = OwnIdEnrollmentViewModel.Factory(ownIdInstance)
        val viewModel = ViewModelProvider(
            operation.viewModelStore,
            factory,
            CreationExtras.Empty,
        ).get(operation.key, OwnIdEnrollmentViewModel::class.java)
        check(operation.viewModel == null || operation.viewModel === viewModel) {
            "OwnID enrollment ViewModel was replaced"
        }

        operation.activity = WeakReference(activity)
        operation.viewModel = viewModel
        viewModel.createResultLauncher(activity.activityResultRegistry)
        operation.collector?.cancel()
        operation.collector = activity.lifecycleScope.launch {
            viewModel.enrollmentResultFlow.filterNotNull().collect { result ->
                settleEnrollment(operation, result)
            }
        }
        return viewModel
    }

    @MainThread
    @OptIn(InternalOwnIdAPI::class)
    private fun settleEnrollment(operation: EnrollmentOperation, result: Result<String>) {
        if (enrollmentOperation !== operation || operation.settled) return
        operation.settled = true
        enrollmentOperation = null
        operation.collector?.cancel()
        operation.collector = null
        operation.viewModel?.unregisterResultLauncher()
        operation.viewModel = null
        operation.activity = null
        operation.viewModelStore.clear()
        result.onSuccess { operation.promise.resolve(null) }
        result.onFailure { operation.promise.reject(it) }
    }

    override fun initialize() {
        super.initialize()
        reactApplicationContext.addLifecycleEventListener(this)
    }

    public override fun invalidate() {
        invalidated = true
        reactApplicationContext.removeLifecycleEventListener(this)
        runOnMainThread {
            enrollmentOperation?.let { operation ->
                settleEnrollment(
                    operation,
                    Result.failure(OwnIdException("OwnID module was invalidated during enrollment")),
                )
            }
        }
        super.invalidate()
    }

    override fun onHostResume() {
        runOnMainThread {
            val operation = enrollmentOperation ?: return@runOnMainThread
            val activity = reactApplicationContext.getCurrentActivity() as? ComponentActivity
            if (activity == null || activity.isFinishing || activity.isDestroyed) {
                settleEnrollment(
                    operation,
                    Result.failure(OwnIdException("No ComponentActivity available during enrollment")),
                )
                return@runOnMainThread
            }
            if (operation.activity?.get() === activity && operation.collector?.isActive == true) {
                return@runOnMainThread
            }

            runCatching {
                @Suppress("DEPRECATION")
                val ownIdInstance = OwnId.getInstanceOrThrow<OwnIdInstance>(InstanceName.DEFAULT)
                bindEnrollmentOperation(operation, activity, ownIdInstance)
            }.onFailure { cause ->
                settleEnrollment(operation, Result.failure(cause))
            }
        }
    }

    override fun onHostPause(): Unit = Unit

    override fun onHostDestroy() {
        runOnMainThread {
            val operation = enrollmentOperation ?: return@runOnMainThread
            val activity = operation.activity?.get()
            operation.collector?.cancel()
            operation.collector = null
            if (activity?.isChangingConfigurations == true) return@runOnMainThread

            settleEnrollment(
                operation,
                Result.failure(OwnIdException("ComponentActivity was destroyed during enrollment")),
            )
        }
    }

    private fun rejectNamedInstance(instanceName: String?, promise: Promise): Boolean {
        if (instanceName == null) return false
        promise.reject(OwnIdException(UNSUPPORTED_INSTANCE_NAME_MESSAGE))
        return true
    }

    private fun runOnMainThread(block: () -> Unit) {
        if (Looper.getMainLooper().isCurrentThread) block()
        else Handler(Looper.getMainLooper()).post(block)
    }

    private companion object {
        const val UNSUPPORTED_INSTANCE_NAME_MESSAGE: String = "Named OwnID instances are not supported"
        const val ENROLLMENT_VIEW_MODEL_KEY_PREFIX: String =
            "com.ownid.sdk.reactnative.enrollment.operation:"
    }
}
