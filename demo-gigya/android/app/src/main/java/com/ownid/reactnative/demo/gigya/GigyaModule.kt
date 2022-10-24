package com.ownid.reactnative.demo.gigya

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeMap
import com.gigya.android.sdk.Gigya
import com.gigya.android.sdk.GigyaLoginCallback
import com.gigya.android.sdk.account.models.GigyaAccount
import com.gigya.android.sdk.network.GigyaError
import org.json.JSONObject

class GigyaModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "GigyaModule"

    @ReactMethod
    fun isLoggedIn(promise: Promise) {
        val loggedIn = Gigya.getInstance(GigyaAccount::class.java).isLoggedIn
        promise.resolve(loggedIn)
    }

    @ReactMethod
    fun getProfile(promise: Promise) {
        Gigya.getInstance(GigyaAccount::class.java)
            .getAccount(loginCallback(promise))
    }

    @ReactMethod
    fun register(loginId: String, password: String, name: String, promise: Promise) {
        val params = mutableMapOf<String, Any>()
        params["profile"] = JSONObject().put("firstName", name).toString()
        Gigya.getInstance(GigyaAccount::class.java)
            .register(loginId, password, params, loginCallback(promise))
    }

    @ReactMethod
    fun login(loginId: String, password: String, promise: Promise) {
        Gigya.getInstance(GigyaAccount::class.java)
            .login(loginId, password, loginCallback(promise))
    }

    @ReactMethod
    fun logout(promise: Promise) {
        val gigya = Gigya.getInstance()
        if (gigya.isLoggedIn) gigya.logout()
        promise.resolve(null)
    }

    private fun loginCallback(promise: Promise) = object : GigyaLoginCallback<GigyaAccount>() {
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

        override fun onSuccess(account: GigyaAccount?) {
            promise.resolve(WritableNativeMap().apply {
                putString("name", account?.profile?.firstName)
                putString("email", account?.profile?.email)
            })
        }
    }
}
