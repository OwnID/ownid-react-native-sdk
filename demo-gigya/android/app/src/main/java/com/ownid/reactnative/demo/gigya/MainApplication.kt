package com.ownid.reactnative.demo.gigya

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.soloader.SoLoader
import com.gigya.android.sdk.Gigya
import com.ownid.sdk.OwnId
import com.ownid.sdk.OwnIdPackage
import com.ownid.sdk.createGigyaInstance

class MainApplication : Application(), ReactApplication {

    private val mReactNativeHost: ReactNativeHost = object : ReactNativeHost(this) {

        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.apply {
                add(OwnIdPackage())
                add(GigyaPackage())
            }

        override fun getJSMainModuleName(): String = "index"
    }

    override fun getReactNativeHost(): ReactNativeHost = mReactNativeHost

    override fun onCreate() {
        super.onCreate()
        SoLoader.init(this,  /* native exopackage */false)

        Gigya.setApplication(this)
        val gigya = Gigya.getInstance(MyAccount::class.java)

        OwnId.createGigyaInstance(this, gigya)
    }
}