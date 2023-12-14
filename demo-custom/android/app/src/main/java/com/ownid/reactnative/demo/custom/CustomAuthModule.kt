package com.ownid.reactnative.demo.custom

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeMap

class CustomAuthModule(
    reactContext: ReactApplicationContext,
    private val customAuthSystem: CustomAuthSystem
) : ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "CustomAuthModule"

    @ReactMethod
    fun isLoggedIn(promise: Promise) {
        promise.resolve(customAuthSystem.isLoggedIn())
    }

    @ReactMethod
    fun getProfile(promise: Promise) {
        customAuthSystem.currentUser?.let {
            promise.resolve(WritableNativeMap().apply {
                putString("name", it.name)
                putString("email", it.email)
            })
        } ?: promise.reject(IllegalStateException("User is not logged in"))
    }

    @ReactMethod
    fun register(loginId: String, password: String, name: String, promise: Promise) {
        customAuthSystem.register(name, loginId, password) {
            onSuccess {
                promise.resolve(WritableNativeMap().apply {
                    putString("name", it.name)
                    putString("email", it.email)
                })
            }
            onFailure { promise.reject(it) }
        }
    }

    @ReactMethod
    fun login(loginId: String, password: String, promise: Promise) {
        customAuthSystem.login(loginId, password) {
            onSuccess {
                promise.resolve(WritableNativeMap().apply {
                    putString("name", it.name)
                    putString("email", it.email)
                })
            }
            onFailure { promise.reject(it) }
        }
    }

    @ReactMethod
    fun logout(promise: Promise) {
        if (customAuthSystem.isLoggedIn()) customAuthSystem.logout()
        promise.resolve(null)
    }
}
