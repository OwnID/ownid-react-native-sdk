package com.ownid.sdk.reactnative.gigya

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.ownid.sdk.OwnId
import com.ownid.sdk.createGigyaInstanceFromJson
import com.ownid.sdk.reactnative.createInstanceReact

public class OwnIdGigyaModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "OwnIdGigyaModule"

    @ReactMethod
    public fun createInstance(config: ReadableMap, promise: Promise) {
        OwnId.createInstanceReact(config, promise) { configurationString ->
            OwnId.createGigyaInstanceFromJson(reactApplicationContext, configurationString)
        }
    }
}