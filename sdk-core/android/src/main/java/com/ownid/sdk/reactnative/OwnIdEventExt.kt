package com.ownid.sdk.reactnative

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.ownid.sdk.InternalOwnIdAPI
import com.ownid.sdk.event.OwnIdEvent
import com.ownid.sdk.event.OwnIdLoginEvent
import com.ownid.sdk.event.OwnIdRegisterEvent

@InternalOwnIdAPI
internal fun OwnIdEvent.toWritableMap(): WritableMap =
    when (this) {
        is OwnIdRegisterEvent -> {
            val arguments = Arguments.createMap().apply {
                putString("eventType", this@toWritableMap.toString())
            }

            when (this) {
                is OwnIdRegisterEvent.Busy -> arguments.putBoolean("isBusy", this.isBusy)
                is OwnIdRegisterEvent.ReadyToRegister -> {
                    arguments.putString("loginId", loginId)
                    arguments.putString("authType", authType)
                }
                OwnIdRegisterEvent.Undo -> Unit
                is OwnIdRegisterEvent.LoggedIn -> arguments.putString("authType", authType)
                is OwnIdRegisterEvent.Error -> arguments.putMap("cause", Arguments.makeNativeMap(cause.toMap()))
            }

            arguments
        }

        is OwnIdLoginEvent -> {
            val arguments = Arguments.createMap().apply {
                putString("eventType", this@toWritableMap.toString())
            }

            when (this) {
                is OwnIdLoginEvent.Busy -> arguments.putBoolean("isBusy", isBusy)
                is OwnIdLoginEvent.LoggedIn -> arguments.putString("authType", authType)
                is OwnIdLoginEvent.Error -> arguments.putMap("cause", Arguments.makeNativeMap(cause.toMap()))
            }

            arguments
        }

        else -> throw IllegalArgumentException("Unknown OwnIdEvent type: ${this::class.java}")
    }
