package com.ownid.reactnative.demo.custom

import com.ownid.sdk.Configuration
import com.ownid.sdk.InstanceName
import com.ownid.sdk.OwnIdCallback
import com.ownid.sdk.RegistrationParameters
import com.ownid.sdk.internal.OwnIdCoreImpl
import com.ownid.sdk.internal.OwnIdResponse
import org.json.JSONObject

class OwnIdCustom(
    instanceName: InstanceName,
    configuration: Configuration,
    private val customAuthSystem: CustomAuthSystem
) : OwnIdCoreImpl(instanceName, configuration) {

    // Custom registration parameters in addition to user email (optional)
    class CustomRegistrationParameters(val name: String) : RegistrationParameters

    override fun register(
        email: String, params: RegistrationParameters?, ownIdResponse: OwnIdResponse, callback: OwnIdCallback<Unit>
    ) {
        // Get custom registration parameters (optional)
        val name = (params as? CustomRegistrationParameters)?.name ?: ""

        // Generate random password
        val password = generatePassword(16)

        // Register user with your authentication system and set OwnId Data to user profile
        customAuthSystem.register(name, email, password, ownIdResponse.payload.ownIdData) {
            onFailure { callback(Result.failure(it)) }
            onSuccess { callback(Result.success(Unit)) }
        }
    }

    override fun login(ownIdResponse: OwnIdResponse, callback: OwnIdCallback<Unit>) {
        // Use OwnID Data to login user
        val token = JSONObject(ownIdResponse.payload.ownIdData).getString("token")

        customAuthSystem.getProfile(token) {
            onSuccess { callback(Result.success(Unit)) }
            onFailure { callback(Result.failure(it)) }
        }
    }

    companion object {
        @JvmStatic
        val INSTANCE_NAME: InstanceName = InstanceName("OwnIdCustom")

        const val CONFIGURATION_FILE: String = "ownIdCustomSdkConfig.json"

        const val PRODUCT_NAME_VERSION: String = "OwnIDCustom/2.1.0"
    }
}