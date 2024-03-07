package com.ownid.sdk.reactnative

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.ownid.sdk.InstanceName
import com.ownid.sdk.OwnId

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
}