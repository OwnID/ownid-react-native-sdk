package com.ownid.sdk.reactnative

import androidx.annotation.RestrictTo
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.ownid.sdk.InternalOwnIdAPI
import com.ownid.sdk.event.OwnIdEvent
import com.ownid.sdk.event.OwnIdLoginEvent
import com.ownid.sdk.event.OwnIdLoginFlow
import com.ownid.sdk.event.OwnIdRegisterEvent
import com.ownid.sdk.event.OwnIdRegisterFlow

@InternalOwnIdAPI
@RestrictTo(RestrictTo.Scope.LIBRARY_GROUP)
internal fun OwnIdEvent.emitToReact(eventEmitter: DeviceEventManagerModule.RCTDeviceEventEmitter) {
    eventEmitter.emit(getReactEventName(), toWritableMap())
}

@InternalOwnIdAPI
@RestrictTo(RestrictTo.Scope.LIBRARY_GROUP)
internal fun OwnIdEvent.getReactEventName(): String = when (this) {
    is OwnIdRegisterFlow, is OwnIdLoginFlow -> "OwnIdFlowEvent"
    is OwnIdRegisterEvent, is OwnIdLoginEvent -> "OwnIdIntegrationEvent"
    else -> throw IllegalArgumentException("Unknown OwnIdEvent type: ${this::class.java}")
}

@InternalOwnIdAPI
@RestrictTo(RestrictTo.Scope.LIBRARY_GROUP)
internal fun OwnIdEvent.toWritableMap(): WritableMap = when (this) {
    is OwnIdRegisterFlow -> {
        val arguments = Arguments.createMap().apply {
            putString("eventType", this@toWritableMap.toString())
        }

        when (this) {
            is OwnIdRegisterFlow.Busy -> arguments.putBoolean("isBusy", isBusy)

            is OwnIdRegisterFlow.Response -> {
                arguments.putString("loginId", loginId)
                arguments.putMap("payload", Arguments.createMap().apply {
                    putString("type", payload.type.name)
                    putString("data", payload.data)
                    putString("metadata", payload.metadata)
                })
                arguments.putString("authType", authType)
                authToken?.let { arguments.putString("authToken", it) }
            }

            OwnIdRegisterFlow.Undo -> Unit

            is OwnIdRegisterFlow.Error -> arguments.putMap("error", Arguments.makeNativeMap(cause.toMap()))
        }

        arguments
    }

    is OwnIdLoginFlow -> {
        val arguments = Arguments.createMap().apply {
            putString("eventType", this@toWritableMap.toString())
        }

        when (this) {
            is OwnIdLoginFlow.Busy -> arguments.putBoolean("isBusy", isBusy)
            is OwnIdLoginFlow.Response -> {
                arguments.putString("loginId", loginId)
                arguments.putMap("payload", Arguments.createMap().apply {
                    putString("type", payload.type.name)
                    putString("data", payload.data)
                    putString("metadata", payload.metadata)
                })
                arguments.putString("authType", authType)
                authToken?.let { arguments.putString("authToken", it) }
            }

            is OwnIdLoginFlow.Error -> arguments.putMap("error", Arguments.makeNativeMap(cause.toMap()))
        }

        arguments
    }

    is OwnIdRegisterEvent -> {
        val arguments = Arguments.createMap().apply {
            putString("eventType", this@toWritableMap.toString())
        }

        when (this) {
            is OwnIdRegisterEvent.Busy -> arguments.putBoolean("isBusy", isBusy)
            is OwnIdRegisterEvent.ReadyToRegister -> {
                arguments.putString("loginId", loginId)
                arguments.putString("authType", authType)
            }

            OwnIdRegisterEvent.Undo -> Unit
            is OwnIdRegisterEvent.LoggedIn -> {
                arguments.putString("authType", authType)
                authToken?.let { arguments.putString("authToken", it) }
            }
            is OwnIdRegisterEvent.Error -> arguments.putMap("error", Arguments.makeNativeMap(cause.toMap()))
        }

        arguments
    }

    is OwnIdLoginEvent -> {
        val arguments = Arguments.createMap().apply {
            putString("eventType", this@toWritableMap.toString())
        }

        when (this) {
            is OwnIdLoginEvent.Busy -> arguments.putBoolean("isBusy", isBusy)
            is OwnIdLoginEvent.LoggedIn -> {
                arguments.putString("authType", authType)
                authToken?.let { arguments.putString("authToken", it) }
            }
            is OwnIdLoginEvent.Error -> arguments.putMap("error", Arguments.makeNativeMap(cause.toMap()))
        }

        arguments
    }

    else -> throw IllegalArgumentException("Unknown OwnIdEvent type: ${this::class.java}")
}