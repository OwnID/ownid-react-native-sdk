package com.ownid.sdk.reactnative.gigya

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.ownid.sdk.GigyaRegistrationParameters
import com.ownid.sdk.InstanceName
import com.ownid.sdk.InternalOwnIdAPI
import com.ownid.sdk.OwnIdGigya
import com.ownid.sdk.reactnative.BaseOwnIdFragmentManager
import com.ownid.sdk.reactnative.OwnIdFragment

@OptIn(InternalOwnIdAPI::class)
public class OwnIdGigyaFragmentManager(reactContext: ReactApplicationContext) : BaseOwnIdFragmentManager(reactContext) {

    override var instanceName: InstanceName = OwnIdGigya.DEFAULT_INSTANCE_NAME

    override fun getName(): String = "OwnIdGigyaButtonManager"

    protected override fun register(ownIdFragment: OwnIdFragment, args: ReadableArray?) {
        val loginId = args?.getString(0) ?: ""
        val paramsMap = (args?.getMap(1)?.toHashMap() ?: emptyMap()).filterValues { it != null } as Map<String, Any>
        val params = GigyaRegistrationParameters(paramsMap)
        ownIdFragment.register(loginId, params)
    }
}