package com.ownid.sdk.reactnative.gigya

import android.view.View
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ReactShadowNode
import com.facebook.react.uimanager.ViewManager
import com.ownid.sdk.InternalOwnIdAPI

@androidx.annotation.OptIn(InternalOwnIdAPI::class)
public class OwnIdGigyaPackage : ReactPackage {

    override fun createNativeModules(reactContext: ReactApplicationContext): MutableList<NativeModule> =
        mutableListOf(OwnIdGigyaModule(reactContext))

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<out View, out ReactShadowNode<*>>> =
        mutableListOf(OwnIdGigyaFragmentManager(reactContext))
}