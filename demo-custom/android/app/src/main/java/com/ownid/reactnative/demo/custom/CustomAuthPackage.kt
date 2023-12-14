package com.ownid.reactnative.demo.custom

import android.view.View
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ReactShadowNode
import com.facebook.react.uimanager.ViewManager

class CustomAuthPackage(private val customAuthSystem :CustomAuthSystem) : ReactPackage {
    override fun createViewManagers(reactContext: ReactApplicationContext): MutableList<ViewManager<out View, out ReactShadowNode<*>>> =
        mutableListOf()

    override fun createNativeModules(reactContext: ReactApplicationContext) =
        listOf(CustomAuthModule(reactContext, customAuthSystem))
}
