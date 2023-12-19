package com.ownid.reactnative.demo.custom

import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.ReactRootView

class MainActivity : ReactActivity() {
    override fun getMainComponentName(): String = "OwnIDReactNativeCustomDemo"

    override fun createReactActivityDelegate(): ReactActivityDelegate =
        MainActivityDelegate(this, mainComponentName)

    class MainActivityDelegate(activity: ReactActivity?, mainComponentName: String?) :
        ReactActivityDelegate(activity, mainComponentName) {

        override fun createRootView(): ReactRootView = ReactRootView(context)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(null)
    }
}