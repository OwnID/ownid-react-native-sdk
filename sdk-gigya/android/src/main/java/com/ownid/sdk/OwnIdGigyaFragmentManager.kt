package com.ownid.sdk

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.ownid.sdk.reactnative.BaseOwnIdFragmentManager
import com.ownid.sdk.reactnative.OwnIdFragment

@OptIn(InternalOwnIdAPI::class)
public class OwnIdGigyaFragmentManager(reactContext: ReactApplicationContext) : BaseOwnIdFragmentManager(reactContext) {

    override var instanceName: InstanceName = OwnIdGigya.DEFAULT_INSTANCE_NAME

    protected override fun register(ownIdFragment: OwnIdFragment, args: ReadableArray?) {
        val loginId = args?.getString(0) ?: ""
        val params = GigyaRegistrationParameters(args?.getMap(1)?.toHashMap() ?: emptyMap())
        ownIdFragment.register(loginId, params)
    }
}