package com.ownid.reactnative.demo.custom

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.ownid.sdk.InstanceName
import com.ownid.sdk.InternalOwnIdAPI
import com.ownid.sdk.reactnative.BaseOwnIdFragmentManager
import com.ownid.sdk.reactnative.OwnIdFragment

@androidx.annotation.OptIn(InternalOwnIdAPI::class)
public class OwnIdCustomFragmentManager(reactContext: ReactApplicationContext) : BaseOwnIdFragmentManager(reactContext) {

    override var instanceName: InstanceName = OwnIdCustom.INSTANCE_NAME

    protected override fun register(ownIdFragment: OwnIdFragment, args: ReadableArray?) {
        val loginId = args?.getString(0) ?: ""
        val name = args?.getMap(1)?.getString("name") ?: ""
        val params = OwnIdCustom.CustomRegistrationParameters(name)
        ownIdFragment.register(loginId, params)
    }
}