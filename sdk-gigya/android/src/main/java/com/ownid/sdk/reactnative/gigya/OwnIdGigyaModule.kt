package com.ownid.sdk.reactnative.gigya

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.UiThreadUtil
import com.ownid.sdk.GigyaRegistrationParameters
import com.ownid.sdk.OwnId
import com.ownid.sdk.createGigyaInstanceFromJson
import com.ownid.sdk.reactnative.createInstanceReact
import com.ownid.sdk.reactnative.fabric.FabricFragmentRegistry

public class OwnIdGigyaModule(reactContext: ReactApplicationContext) : NativeOwnIdGigyaModuleSpec(reactContext) {

    override fun getName(): String = "OwnIdGigyaModule"

    override fun getConstants(): MutableMap<String, Any> {
        val constants: MutableMap<String, Any> = mutableMapOf("naComponents" to mapOf("gigya" to true))
        return constants
    }

    @ReactMethod
    public override fun createInstance(config: ReadableMap, promise: Promise) {
        OwnId.createInstanceReact(config, promise) { configurationString ->
            OwnId.createGigyaInstanceFromJson(reactApplicationContext, configurationString)
        }
    }

    @ReactMethod
    public override fun registerUser(loginId: String, params: ReadableMap?, promise: Promise) {
        promise.resolve(null)
    }

    @ReactMethod
    public override fun registerAtViewTag(viewTag: Double, loginId: String, params: ReadableMap?) {
        UiThreadUtil.runOnUiThread {
            val paramsMap = (params?.toHashMap() ?: emptyMap()).filterValues { it != null } as Map<String, Any>
            val params = GigyaRegistrationParameters(paramsMap)
            FabricFragmentRegistry.get(viewTag.toInt())?.register(loginId, params)
        }
    }
}