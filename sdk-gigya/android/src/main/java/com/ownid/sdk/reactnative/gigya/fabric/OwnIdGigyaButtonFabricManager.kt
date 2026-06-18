package com.ownid.sdk.reactnative.gigya.fabric

import androidx.fragment.app.FragmentContainerView
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.ownid.sdk.GigyaRegistrationParameters
import com.ownid.sdk.InternalOwnIdAPI
import com.ownid.sdk.OwnIdGigya
import com.ownid.sdk.reactnative.fabric.BaseOwnIdFabricManager
import com.ownid.sdk.reactnative.fabric.FabricFragmentRegistry

@OptIn(InternalOwnIdAPI::class)
internal class OwnIdGigyaButtonFabricManager(reactContext: ReactApplicationContext) : BaseOwnIdFabricManager(reactContext) {

    override fun getName(): String = "OwnIdGigyaButton"

    override var instanceName = OwnIdGigya.DEFAULT_INSTANCE_NAME

    companion object {
        private const val REGISTER: Int = 2
    }

    override fun getCommandsMap(): MutableMap<String, Int> =
        mapOf("register" to REGISTER).toMutableMap()

    override fun receiveCommand(view: FragmentContainerView, commandId: String, args: ReadableArray?) {
        when (commandId.toInt()) {
            REGISTER -> {
                val loginId = args?.getString(0) ?: ""
                val paramsMap = (args?.getMap(1)?.toHashMap() ?: emptyMap()).filterValues { it != null } as Map<String, Any>
                val params = GigyaRegistrationParameters(paramsMap)
                FabricFragmentRegistry.get(view.id)?.register(loginId, params)
            }
        }
    }
}