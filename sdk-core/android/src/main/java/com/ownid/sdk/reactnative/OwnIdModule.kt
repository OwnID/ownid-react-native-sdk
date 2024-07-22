package com.ownid.sdk.reactnative

import android.os.Handler
import android.os.Looper
import androidx.activity.ComponentActivity
import androidx.annotation.MainThread
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.get
import androidx.lifecycle.lifecycleScope
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
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
import kotlinx.coroutines.flow.onCompletion
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.launch

public class OwnIdModule(
    reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "OwnIdModule"

    @ReactMethod
    public fun createInstance(config: ReadableMap, productName: String, instanceName: String?, promise: Promise) {
        if (instanceName != null)
            OwnId.createInstanceReact(reactApplicationContext, promise, config, productName, InstanceName(instanceName))
        else
            OwnId.createInstanceReact(reactApplicationContext, promise, config, productName)
    }

    @ReactMethod
    @OptIn(InternalOwnIdAPI::class)
    public fun setLocale(locale: String?, promise: Promise) {
        val ownIdInstance = OwnId.firstInstanceOrNull<OwnIdInstance>()

        if (ownIdInstance == null) {
            promise.reject(OwnIdException("No OwnID instance found"))
        } else {
            (ownIdInstance.ownIdCore as OwnIdCoreImpl).apply {
                localeService.setLanguageTags(locale)
                localeService.updateCurrentOwnIdLocale(reactApplicationContext)
            }
            promise.resolve(null)
        }
    }

    @ReactMethod
    @OptIn(InternalOwnIdAPI::class)
    public fun enrollCredential(loginId: String, authToken: String, force: Boolean, instanceName: String?, promise: Promise) {
        val activity = currentActivity as? ComponentActivity

        if (activity == null) {
            OwnIdInternalLogger.logW(this, "enrollCredential", "No ComponentActivity available")
            promise.reject(OwnIdException("No ComponentActivity available"))
            return
        }

        if (Looper.getMainLooper().isCurrentThread) {
            enrollCredential(activity, loginId, authToken, force, instanceName, promise)
        } else {
            Handler(Looper.getMainLooper()).post {
                enrollCredential(activity, loginId, authToken, force, instanceName, promise)
            }
        }
    }

    @MainThread
    @OptIn(InternalOwnIdAPI::class)
    private fun enrollCredential(
        activity: ComponentActivity, loginId: String, authToken: String, force: Boolean, instanceName: String?, promise: Promise
    ) {
        runCatching {
            val ownIdInstance: OwnIdInstance = if (instanceName == null) OwnId.firstInstanceOrThrow()
            else OwnId.getInstanceOrThrow(InstanceName(instanceName))

            val factory = OwnIdEnrollmentViewModel.Factory(ownIdInstance)

            val ownIdEnrollmentViewModel = ViewModelProvider(activity.viewModelStore, factory).get<OwnIdEnrollmentViewModel>()
            ownIdEnrollmentViewModel.createResultLauncher(activity.activityResultRegistry)

            ownIdEnrollmentViewModel.enrollCredential(activity, loginId, authToken, force)

            val job = Job()
            activity.lifecycleScope.launch(job) {
                ownIdEnrollmentViewModel.enrollmentResultFlow
                    .filterNotNull()
                    .onEach { enrollmentResult ->
                        enrollmentResult.onSuccess { promise.resolve(it) }
                        enrollmentResult.onFailure { promise.reject(it) }
                        job.cancel()
                    }
                    .onCompletion {
                        ownIdEnrollmentViewModel.unregisterResultLauncher()
                    }
                    .collect()
            }

        }.onFailure { cause ->
            OwnIdInternalLogger.logW(this, "enrollCredential", "Fail to enroll credential: ${cause.message}", cause)
            promise.reject(cause)
        }
    }
}