package com.ownid.sdk.reactnative.gigya

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.ownid.sdk.Configuration
import com.ownid.sdk.OwnId
import com.ownid.sdk.OwnIdLogger
import com.ownid.sdk.createGigyaInstanceFromJson
import org.json.JSONObject

public class OwnIdGigyaModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "OwnIdGigyaModule"

    @ReactMethod
    public fun createInstance(configuration: ReadableMap, promise: Promise) {
        try {
            val configurationJson = JSONObject(configuration.toHashMap())
            val redirectionUriAndroid = configurationJson.optString(Configuration.KEY.REDIRECTION_URI_ANDROID)

            if (redirectionUriAndroid.isNotBlank()) {
                configurationJson.put(Configuration.KEY.REDIRECTION_URI, redirectionUriAndroid)
            }

            OwnId.createGigyaInstanceFromJson(reactApplicationContext, configurationJson.toString())
            promise.resolve(null)
        } catch (cause: Throwable) {
            promise.reject(cause)
            OwnIdLogger.e("OwnIdGigyaModule", "Fail to create OwnID Gigya instance", cause)
        }
    }
}