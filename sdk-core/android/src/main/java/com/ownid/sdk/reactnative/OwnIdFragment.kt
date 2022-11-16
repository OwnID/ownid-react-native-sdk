package com.ownid.sdk.reactnative

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.ownid.sdk.InternalOwnIdAPI
import com.ownid.sdk.OwnIdCore
import com.ownid.sdk.RegistrationParameters
import com.ownid.sdk.event.OwnIdEvent
import com.ownid.sdk.event.OwnIdLoginEvent
import com.ownid.sdk.event.OwnIdRegisterEvent
import com.ownid.sdk.exception.OwnIdException
import com.ownid.sdk.getOwnIdViewModel
import com.ownid.sdk.viewmodel.OwnIdBaseViewModel
import com.ownid.sdk.viewmodel.OwnIdLoginViewModel
import com.ownid.sdk.viewmodel.OwnIdRegisterViewModel


@androidx.annotation.OptIn(InternalOwnIdAPI::class)
public class OwnIdFragment(
    private val ownId: OwnIdCore,
    private val fragmentType: Type,
    private val buttonProperties: OwnIdButtonReact.Properties,
    private val shadowNode: OwnIdLayoutShadowNode,
    private val eventEmitter: DeviceEventManagerModule.RCTDeviceEventEmitter,
    internal var loginId: String? = null
) : Fragment() {

    public enum class Type(internal val viewModelClass: Class<out OwnIdBaseViewModel<out OwnIdEvent>>) {
        REGISTER(OwnIdRegisterViewModel::class.java),
        LOGIN(OwnIdLoginViewModel::class.java)
    }

    private lateinit var ownIdViewModel: OwnIdBaseViewModel<out OwnIdEvent>

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View =
        OwnIdButtonReact(requireContext(), buttonProperties, shadowNode)

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val viewModel = getOwnIdViewModel(this, fragmentType.viewModelClass, ownId)

        when (viewModel) {
            is OwnIdLoginViewModel -> viewModel.events.observe(viewLifecycleOwner) { ownIdEvent: OwnIdLoginEvent? ->
                if (ownIdEvent != null) eventEmitter.emit("OwnIdEvent", ownIdEvent.toWritableMap())
            }

            is OwnIdRegisterViewModel -> viewModel.events.observe(viewLifecycleOwner) { ownIdEvent: OwnIdRegisterEvent? ->
                if (ownIdEvent != null) eventEmitter.emit("OwnIdEvent", ownIdEvent.toWritableMap())
            }
        }

        with(view as OwnIdButtonReact) {
            setViewModel(viewModel, viewLifecycleOwner)
            setEmailProducer { loginId ?: "" }
        }

        ownIdViewModel = viewModel
    }

    public fun register(loginId: String, params: RegistrationParameters? = null) {
        when (ownIdViewModel) {
            is OwnIdLoginViewModel -> throw OwnIdException("Cannot call register for login")
            is OwnIdRegisterViewModel -> (ownIdViewModel as OwnIdRegisterViewModel).register(loginId, params)
        }
    }
}