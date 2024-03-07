package com.ownid.sdk.reactnative

import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.ownid.sdk.Configuration
import com.ownid.sdk.InstanceName
import com.ownid.sdk.InternalOwnIdAPI
import com.ownid.sdk.OwnId
import com.ownid.sdk.OwnIdCore
import com.ownid.sdk.OwnIdIntegration
import com.ownid.sdk.ProductName
import com.ownid.sdk.internal.OwnIdInternalLogger
import org.json.JSONObject

/**
 * Creates an instance of OwnID with optional [OwnIdIntegration] component.
 *
 * If an instance for [instanceName] already exist, new instance will not be created.
 *
 * Resolves [promise] with null if OwnID instance created successfully (or already exist) or with error.
 *
 * @param reactApplicationContext   Instance of [ReactApplicationContext].
 * @param promise                   A [Promise] to be resolved with result.
 * @param config                    A [ReadableMap] with OwnID [Configuration] parameters.
 * @param productName               An SDK [ProductName].
 * @param instanceName              An optional [InstanceName] of OwnID. Default: [InstanceName.DEFAULT].
 * @param ownIdIntegration          An optional function that creates an instance of [OwnIdIntegration] component.
 */
public fun OwnId.createInstanceReact(
    reactApplicationContext: ReactApplicationContext,
    promise: Promise,
    config: ReadableMap,
    productName: ProductName,
    instanceName: InstanceName = InstanceName.DEFAULT,
    ownIdIntegration: ((OwnIdCore) -> OwnIdIntegration)? = null
) {
    createInstanceReact(config, promise) { configurationString ->
        OwnId.createInstanceFromJson(reactApplicationContext, configurationString, productName, instanceName, ownIdIntegration)
    }
}

/**
 * Creates OwnID [Configuration] JSON string from [ReadableMap] in [config] parameter.
 * Use it to create OwnID instance by providing [createInstance] function.
 *
 * Resolves [promise] with null if OwnID instance created successfully or with error.
 *
 * The function [createInstance] is always called on Android Main thread.
 *
 * The function [createInstance] must put the instance it created into the OwnID instances registry by calling [OwnId.putInstance]
 *
 * @param config            A [ReadableMap] with OwnID [Configuration] parameters.
 * @param promise           A [Promise] to be resolved with result.
 * @param createInstance    A function that will be called to create OwnID instance.
 */
@OptIn(InternalOwnIdAPI::class)
public fun OwnId.createInstanceReact(
    config: ReadableMap,
    promise: Promise,
    createInstance: (String) -> Unit
) {
    try {
        val configurationJson = JSONObject(config.toHashMap())

        configurationJson.optString(Configuration.KEY.REDIRECT_URL_ANDROID).let { redirectionUriAndroid ->
            if (redirectionUriAndroid.isNotBlank()) configurationJson.put(Configuration.KEY.REDIRECT_URL, redirectionUriAndroid)
        }

        val configurationString = configurationJson.toString()

        if (Looper.getMainLooper().isCurrentThread) {
            createInstance.invoke(configurationString)
            promise.resolve(null)
        } else {
            Handler(Looper.getMainLooper()).post {
                try {
                    createInstance.invoke(configurationString)
                    promise.resolve(null)
                } catch (cause: Throwable) {
                    promise.reject("Fail to create OwnID instance: ${cause.message}", cause)
                    OwnIdInternalLogger.logE(this, "createInstanceReact", "Fail to create OwnID instance: ${cause.message}", cause)
                }
            }
        }
    } catch (cause: Throwable) {
        promise.reject("Fail to create OwnID instance: ${cause.message}", cause)
        OwnIdInternalLogger.logE(this, "createInstanceReact", "Fail to create OwnID instance: ${cause.message}", cause)
    }
}