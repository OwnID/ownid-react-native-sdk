package com.ownid.sdk.reactnative.fabric

import com.facebook.react.bridge.ReactApplicationContext

internal class OwnIdButtonFabricManager(reactContext: ReactApplicationContext) : BaseOwnIdFabricManager(reactContext) {
    override fun getName(): String = "OwnIdButton"
}
