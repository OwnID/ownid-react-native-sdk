package com.ownid.sdk.reactnative

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.annotation.RestrictTo
import androidx.fragment.app.Fragment
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.ownid.sdk.InternalOwnIdAPI
import com.ownid.sdk.OwnIdInstance
import com.ownid.sdk.RegistrationParameters
import com.ownid.sdk.event.OwnIdEvent
import com.ownid.sdk.exception.OwnIdException
import com.ownid.sdk.getOwnIdViewModel
import com.ownid.sdk.view.AbstractOwnIdWidget
import com.ownid.sdk.viewmodel.OwnIdBaseViewModel
import com.ownid.sdk.viewmodel.OwnIdLoginViewModel
import com.ownid.sdk.viewmodel.OwnIdRegisterViewModel

@OptIn(InternalOwnIdAPI::class)
@RestrictTo(RestrictTo.Scope.LIBRARY_GROUP)
public class OwnIdFragment(
    private val ownIdInstance: OwnIdInstance,
    private val fragmentType: Type,
    private val widgetProperties: OwnIdWidget.Properties,
    private val shadowNode: OwnIdLayoutShadowNode,
    private val eventEmitter: DeviceEventManagerModule.RCTDeviceEventEmitter,
    private val loginId: String?
) : Fragment() {

    public enum class Type(internal val viewModelClass: Class<out OwnIdBaseViewModel<out OwnIdEvent, out OwnIdEvent>>) {
        REGISTER(OwnIdRegisterViewModel::class.java),
        LOGIN(OwnIdLoginViewModel::class.java)
    }

    private val ownIdViewModel: OwnIdBaseViewModel<out OwnIdEvent, out OwnIdEvent> by lazy(LazyThreadSafetyMode.NONE) {
        getOwnIdViewModel(this@OwnIdFragment, fragmentType.viewModelClass, ownIdInstance)
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View =
        when (widgetProperties.widgetType) {
            OwnIdWidget.Type.OwnIdButton -> OwnIdButtonReact(requireContext(), widgetProperties, shadowNode)
            OwnIdWidget.Type.OwnIdAuthButton -> OwnIdAuthButtonReact(requireContext(), widgetProperties, shadowNode)
        }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        when (val viewModel = ownIdViewModel) {
            is OwnIdLoginViewModel -> {
                viewModel.flowEvents.observe(viewLifecycleOwner) { it?.emitToReact(eventEmitter) }
                viewModel.integrationEvents.observe(viewLifecycleOwner) { it?.emitToReact(eventEmitter) }
            }

            is OwnIdRegisterViewModel -> {
                viewModel.flowEvents.observe(viewLifecycleOwner) { it?.emitToReact(eventEmitter) }
                viewModel.integrationEvents.observe(viewLifecycleOwner) { it?.emitToReact(eventEmitter) }
            }
        }

        view.postDelayed(::setViewModel, 500)
    }

    override fun onDestroyView() {
        view?.removeCallbacks(::setViewModel)
        super.onDestroyView()
    }

    public fun register(loginId: String, params: RegistrationParameters? = null) {
        when (val vm = ownIdViewModel) {
            is OwnIdLoginViewModel -> throw OwnIdException("Cannot call register for login")
            is OwnIdRegisterViewModel -> vm.register(loginId, params)
        }
    }

    private fun setViewModel() {
        (view as? AbstractOwnIdWidget)?.let {
            when (val vm = ownIdViewModel) {
                is OwnIdLoginViewModel -> vm.attachToView(it, viewLifecycleOwner)
                is OwnIdRegisterViewModel -> vm.attachToView(it, viewLifecycleOwner)
            }
            it.setLoginId(loginId)
        }
    }

    internal fun setLoginId(loginId: String?) {
        (view as? AbstractOwnIdWidget)?.setLoginId(loginId)
    }
}