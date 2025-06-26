package com.ownid.demo.custom

import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {
    override fun getMainComponentName(): String = "OwnIDReactNativeIntegrationDemo"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(null);
    }

    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}