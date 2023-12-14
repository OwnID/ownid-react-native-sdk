package com.ownid.reactnative.demo.custom

import android.app.Application
import android.content.Context
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.soloader.SoLoader
import com.ownid.sdk.Configuration
import com.ownid.sdk.OwnId
import com.ownid.sdk.internal.LocaleService

class MainApplication : Application(), ReactApplication {

    private val customAuthSystem = CustomAuthSystem()

    private val mReactNativeHost: ReactNativeHost = object : ReactNativeHost(this) {

        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.apply {
                add(OwnIdCustomPackage())
                add(CustomAuthPackage(customAuthSystem))
            }

        override fun getJSMainModuleName(): String = "index"
    }

    override fun getReactNativeHost(): ReactNativeHost = mReactNativeHost

    override fun onCreate() {
        super.onCreate()
        SoLoader.init(this,  /* native exopackage */false)

        createCustomOwnIdInstance(this, customAuthSystem)
    }

    private fun createCustomOwnIdInstance(context: Context, customAuthSystem: CustomAuthSystem) {
        // Create OwnID configuration
        val configuration = Configuration.createFromAssetFile(context, OwnIdCustom.CONFIGURATION_FILE, OwnIdCustom.PRODUCT_NAME_VERSION)

        // Create instance of OwnIDCustom
        val ownIdCustom = OwnIdCustom(OwnIdCustom.INSTANCE_NAME, configuration, customAuthSystem)

        // Put instance of OwnIdCustom to OwnID registry
        OwnId.putInstance(ownIdCustom)

        // Create Locale service for OwnIdCustom
        LocaleService.createInstance(context, ownIdCustom)
    }
}