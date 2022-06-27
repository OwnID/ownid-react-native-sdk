package com.ownid.reactnative.demo.gigya

import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableNativeMap
import com.gigya.android.sdk.Gigya
import com.gigya.android.sdk.GigyaLoginCallback
import com.gigya.android.sdk.network.GigyaError
import org.json.JSONObject

class GigyaModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "GigyaModule"

    @ReactMethod
    fun isLoggedIn(promise: Promise) {
        val loggedIn = Gigya.getInstance(MyAccount::class.java).isLoggedIn
        promise.resolve(loggedIn)
    }

    @ReactMethod
    fun getProfile(promise: Promise) {
        Gigya.getInstance(MyAccount::class.java)
            .getAccount(loginCallback(promise))
    }

    @ReactMethod
    fun register(loginId: String, password: String, name: String, promise: Promise) {
        val params = mutableMapOf<String, Any>()
        params["profile"] = JSONObject().put("firstName", name).toString()
        Log.e("register", "loginId: $loginId, password: $password, params: ${params}")
        Gigya.getInstance(MyAccount::class.java)
            .register(loginId, password, params, loginCallback(promise))
    }

    @ReactMethod
    fun login(loginId: String, password: String, params: ReadableMap?, promise: Promise) {
        Gigya.getInstance(MyAccount::class.java)
            .login(loginId, password, params?.toHashMap() ?: HashMap(), loginCallback(promise))
    }

    @ReactMethod
    fun logout(promise: Promise) {
        val gigya = Gigya.getInstance(MyAccount::class.java)
        if (gigya.isLoggedIn) gigya.logout()
        promise.resolve(null)
    }

    private fun loginCallback(promise: Promise) = object : GigyaLoginCallback<MyAccount>() {
        override fun onError(error: GigyaError?) {
            promise.reject(
                error?.errorCode?.toString(),
                error?.localizedMessage,
                Exception(error?.toString())
            )
        }

        override fun onOperationCanceled() {
            promise.reject("200001", "Operation canceled")
        }

        override fun onSuccess(account: MyAccount?) {
            promise.resolve(WritableNativeMap().apply {
                putString("name", account?.profile?.firstName)
                putString("email", account?.profile?.email)
            })
        }
    }
}
