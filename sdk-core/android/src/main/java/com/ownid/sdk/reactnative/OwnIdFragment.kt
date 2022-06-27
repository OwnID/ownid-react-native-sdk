package com.ownid.sdk.reactnative

import android.content.res.ColorStateList
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import androidx.fragment.app.Fragment
import androidx.lifecycle.Observer
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.ownid.sdk.InstanceName
import com.ownid.sdk.InternalOwnIdAPI
import com.ownid.sdk.OwnId
import com.ownid.sdk.OwnIdCore
import com.ownid.sdk.OwnIdViewModelFactory
import com.ownid.sdk.RegistrationParameters
import com.ownid.sdk.event.OwnIdEvent
import com.ownid.sdk.event.OwnIdLoginEvent
import com.ownid.sdk.event.OwnIdRegisterEvent
import com.ownid.sdk.exception.OwnIdException
import com.ownid.sdk.view.OwnIdButton
import com.ownid.sdk.viewmodel.OwnIdBaseViewModel
import com.ownid.sdk.viewmodel.OwnIdLoginViewModel
import com.ownid.sdk.viewmodel.OwnIdRegisterViewModel


@OptIn(InternalOwnIdAPI::class)
public class OwnIdFragment(
    private val instanceName: InstanceName,
    private val type: Type,
    private val shadowNode: OwnIdLayoutShadowNode,
    private var backgroundColor: Int? = null,
    private var borderColor: Int? = null,
    private var biometryIconColor: Int? = null,
    private var showOr: Boolean = true,
    internal var loginId: String? = null
) : Fragment() {

    public enum class Type(internal val viewModelClass: Class<out OwnIdBaseViewModel<out OwnIdEvent>>) {
        REGISTER(OwnIdRegisterViewModel::class.java),
        LOGIN(OwnIdLoginViewModel::class.java)
    }

    private lateinit var ownIdViewModel: OwnIdBaseViewModel<out OwnIdEvent>

    private val eventEmitter: DeviceEventManagerModule.RCTDeviceEventEmitter by lazy(LazyThreadSafetyMode.NONE) {
        (requireActivity().application as ReactApplication).reactNativeHost.reactInstanceManager
            .currentReactContext!!.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
    }

    private val stringsSetListener = object : OwnIdButton.StringsSetListener {
        override fun onStringsSet() {
            manualLayout()
        }
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View =
        OwnIdButton(requireContext()).apply {
            registerStringsSetListener(stringsSetListener)
            if (backgroundColor != null || borderColor != null || biometryIconColor != null)
                setColors(
                    backgroundColor?.let { ColorStateList.valueOf(it) },
                    borderColor?.let { ColorStateList.valueOf(it) },
                    biometryIconColor?.let { ColorStateList.valueOf(it) }
                )

            setShowOr(showOr)
        }

    override fun onDestroyView() {
        (view as OwnIdButton).unregisterStringsSetListener(stringsSetListener)
        super.onDestroyView()
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val ownId = OwnId.getInstanceOrThrow<OwnIdCore>(instanceName)
        val viewModel = OwnIdViewModelFactory.getOwnIdViewModel(this, type.viewModelClass, ownId)

        with(view as OwnIdButton) {
            setViewModel(viewModel, viewLifecycleOwner)
            setEmailProducer { loginId ?: "" }
        }

        when (viewModel) {
            is OwnIdLoginViewModel -> viewModel.events.observe(viewLifecycleOwner, LoginObserver(eventEmitter))
            is OwnIdRegisterViewModel -> viewModel.events.observe(viewLifecycleOwner, RegisterObserver(eventEmitter))
        }

        ownIdViewModel = viewModel
    }

    private fun manualLayout() {
        (view as LinearLayout).apply {
            measure(shadowNode.getProposedWidthMeasureSpec(), shadowNode.getProposedHeightMeasureSpec())
            layout(0, 0, measuredWidth, measuredHeight)
            shadowNode.updateSize(measuredWidth, measuredHeight)
        }
    }

    public fun register(loginId: String, params: RegistrationParameters? = null) {
        when (ownIdViewModel) {
            is OwnIdLoginViewModel -> throw OwnIdException("Cannot call register for login")
            is OwnIdRegisterViewModel -> (ownIdViewModel as OwnIdRegisterViewModel).register(loginId, params)
        }
    }

    private class RegisterObserver(
        val eventEmitter: DeviceEventManagerModule.RCTDeviceEventEmitter
    ) : Observer<OwnIdRegisterEvent> {
        override fun onChanged(ownIdEvent: OwnIdRegisterEvent?) {
            val arguments = when (ownIdEvent) {
                is OwnIdRegisterEvent.Busy -> Arguments.createMap().apply {
                    putString("eventType", "OwnIdRegisterEvent.Busy")
                    putBoolean("isBusy", ownIdEvent.isBusy)
                }

                is OwnIdRegisterEvent.ReadyToRegister -> Arguments.createMap().apply {
                    putString("eventType", "OwnIdRegisterEvent.ReadyToRegister")
                    putString("loginId", ownIdEvent.loginId)
                }

                OwnIdRegisterEvent.Undo -> Arguments.createMap().apply {
                    putString("eventType", "OwnIdRegisterEvent.Undo")
                }

                OwnIdRegisterEvent.LoggedIn -> Arguments.createMap().apply {
                    putString("eventType", "OwnIdRegisterEvent.LoggedIn")
                }

                is OwnIdRegisterEvent.Error -> Arguments.createMap().apply {
                    putString("eventType", "OwnIdRegisterEvent.Error")
                    putMap("cause", Arguments.makeNativeMap(ownIdEvent.cause.toMap()))
                }

                null -> return
            }

            eventEmitter.emit("OwnIdEvent", arguments)
        }
    }

    private class LoginObserver(
        val eventEmitter: DeviceEventManagerModule.RCTDeviceEventEmitter
    ) : Observer<OwnIdLoginEvent> {
        override fun onChanged(ownIdEvent: OwnIdLoginEvent?) {

            val arguments = when (ownIdEvent) {
                is OwnIdLoginEvent.Busy -> Arguments.createMap().apply {
                    putString("eventType", "OwnIdLoginEvent.Busy")
                    putBoolean("isBusy", ownIdEvent.isBusy)
                }

                OwnIdLoginEvent.LoggedIn -> Arguments.createMap().apply {
                    putString("eventType", "OwnIdLoginEvent.LoggedIn")
                }

                is OwnIdLoginEvent.Error -> Arguments.createMap().apply {
                    putString("eventType", "OwnIdLoginEvent.Error")
                    putMap("cause", Arguments.makeNativeMap(ownIdEvent.cause.toMap()))
                }

                null -> return
            }

            eventEmitter.emit("OwnIdEvent", arguments)
        }
    }
}