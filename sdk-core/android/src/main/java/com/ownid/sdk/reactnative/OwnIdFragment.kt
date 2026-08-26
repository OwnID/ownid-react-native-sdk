package com.ownid.sdk.reactnative

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.annotation.RestrictTo
import androidx.fragment.app.Fragment
import androidx.fragment.app.FragmentActivity
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.ownid.sdk.InternalOwnIdAPI
import com.ownid.sdk.OwnIdInstance
import com.ownid.sdk.RegistrationParameters
import com.ownid.sdk.event.OwnIdLoginEvent
import com.ownid.sdk.event.OwnIdLoginFlow
import com.ownid.sdk.event.OwnIdRegisterEvent
import com.ownid.sdk.event.OwnIdRegisterFlow
import com.ownid.sdk.exception.OwnIdException
import com.ownid.sdk.internal.component.OwnIdInternalLogger
import com.ownid.sdk.view.AbstractOwnIdWidget
import com.ownid.sdk.viewmodel.OwnIdBaseViewModel
import com.ownid.sdk.viewmodel.OwnIdLoginViewModel
import com.ownid.sdk.viewmodel.OwnIdRegisterViewModel

@OptIn(InternalOwnIdAPI::class)
@RestrictTo(RestrictTo.Scope.LIBRARY_GROUP)
public class OwnIdFragment private constructor(
    private val liveDependencies: LiveDependencies?,
) : Fragment() {

    private class LiveDependencies(
        val ownIdInstance: OwnIdInstance,
        val fragmentType: Type,
        var widgetProperties: OwnIdWidget.Properties,
        val shadowNode: OwnIdLayoutShadowNode,
        val eventEmitter: DeviceEventManagerModule.RCTDeviceEventEmitter,
        val loginId: String?,
        val ownerToken: String,
    )

    public constructor(
        ownIdInstance: OwnIdInstance,
        fragmentType: Type,
        widgetProperties: OwnIdWidget.Properties,
        shadowNode: OwnIdLayoutShadowNode,
        eventEmitter: DeviceEventManagerModule.RCTDeviceEventEmitter,
        loginId: String?,
        ownerToken: String,
    ) : this(
        LiveDependencies(
            ownIdInstance,
            fragmentType,
            widgetProperties,
            shadowNode,
            eventEmitter,
            loginId,
            ownerToken,
        ),
    )

    public constructor() : this(null)

    internal val fragmentType: Type?
        get() = liveDependencies?.fragmentType

    internal val widgetProperties: OwnIdWidget.Properties?
        get() = liveDependencies?.widgetProperties

    internal val ownerToken: String?
        get() = liveDependencies?.ownerToken

    public enum class Type(internal val viewModelClass: Class<out OwnIdBaseViewModel>) {
        REGISTER(OwnIdRegisterViewModel::class.java),
        LOGIN(OwnIdLoginViewModel::class.java)
    }

    private var coordinatorClaim: OwnIdActivityFlowCoordinator.Claim? = null
    private var currentLoginId: String? = liveDependencies?.loginId

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (liveDependencies == null) {
            parentFragmentManager.beginTransaction()
                .remove(this)
                .commitAllowingStateLoss()
            return
        }

        val dependencies = liveDependencies
        val activity = requireActivity() as FragmentActivity
        when (val result = OwnIdActivityFlowCoordinator.claim(
            activity = activity,
            ownIdInstance = dependencies.ownIdInstance,
            renderer = OwnIdActivityFlowCoordinator.Renderer.PAPER,
            widget = dependencies.widgetProperties.widgetType.toCoordinatorWidget(),
            flow = dependencies.fragmentType.toCoordinatorFlow(),
            claimant = this,
            ownerToken = dependencies.ownerToken,
        )) {
            is OwnIdActivityFlowCoordinator.ClaimResult.Success -> coordinatorClaim = result.claim
            is OwnIdActivityFlowCoordinator.ClaimResult.Failure -> emitCoordinatorError(dependencies, result.error)
        }
    }

    public override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View? {
        val dependencies = liveDependencies ?: return null
        return when (dependencies.widgetProperties.widgetType) {
            OwnIdWidget.Type.OwnIdButton -> OwnIdButtonReact(requireContext(), dependencies.widgetProperties, dependencies.shadowNode)
            OwnIdWidget.Type.OwnIdAuthButton -> OwnIdAuthButtonReact(requireContext(), dependencies.widgetProperties, dependencies.shadowNode)
        }
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val dependencies = liveDependencies ?: return
        val claim = coordinatorClaim ?: return
        claim.observeEvents(viewLifecycleOwner, dependencies.eventEmitter, dependencies.ownerToken) { isBusy ->
            (this.view as? AbstractOwnIdWidget)?.onBusy(isBusy)
        }

        setViewModel()
        // view.postDelayed(::setViewModel, 500)
    }

    override fun onDestroyView() {
        view?.removeCallbacks(::setViewModel)
        super.onDestroyView()
    }

    override fun onDestroy() {
        coordinatorClaim?.release(permanently = activity?.isChangingConfigurations != true)
        coordinatorClaim = null
        super.onDestroy()
    }

    public fun register(loginId: String, params: RegistrationParameters? = null) {
        if (liveDependencies == null) return
        val vm = coordinatorClaim?.viewModel ?: return
        when (vm) {
            is OwnIdLoginViewModel -> throw OwnIdException("Cannot call register for login")
            is OwnIdRegisterViewModel -> vm.register(loginId, params)
        }
    }

    private fun setViewModel() {
        if (liveDependencies == null) return
        val claim = coordinatorClaim ?: return
        val vm = claim.viewModel
        (view as? AbstractOwnIdWidget)?.let { widget ->
            when (vm) {
                is OwnIdLoginViewModel -> vm.attachToView(widget, viewLifecycleOwner)
                is OwnIdRegisterViewModel -> vm.attachToView(widget, viewLifecycleOwner)
            }
            widget.setLoginId(currentLoginId)
            widget.onLocaleUpdated()
            if (claim.isBusy) widget.onBusy(true)
        }
    }

    internal fun setLoginId(loginId: String?) {
        currentLoginId = loginId
        (view as? AbstractOwnIdWidget)?.setLoginId(loginId)
    }

    internal fun updateWidgetProperties(properties: OwnIdWidget.Properties) {
        val dependencies = liveDependencies ?: return
        dependencies.widgetProperties = properties
        when (val widget = view) {
            is OwnIdButtonReact -> widget.updateProperties(properties)
            is OwnIdAuthButtonReact -> widget.updateProperties(properties)
        }
    }

    internal val currentLoginIdValue: String?
        get() = currentLoginId

    internal fun releaseCoordinatorClaim(permanently: Boolean = true) {
        coordinatorClaim?.release(permanently)
        coordinatorClaim = null
    }

    private fun emitCoordinatorError(dependencies: LiveDependencies, error: OwnIdException) {
        OwnIdInternalLogger.logW(this, "onCreate", error.message)
        when (dependencies.fragmentType) {
            Type.LOGIN -> if (dependencies.ownIdInstance.ownIdIntegration == null) {
                OwnIdLoginFlow.Error(error).emitToReact(dependencies.eventEmitter, dependencies.ownerToken)
            } else {
                OwnIdLoginEvent.Error(error).emitToReact(dependencies.eventEmitter, dependencies.ownerToken)
            }

            Type.REGISTER -> if (dependencies.ownIdInstance.ownIdIntegration == null) {
                OwnIdRegisterFlow.Error(error).emitToReact(dependencies.eventEmitter, dependencies.ownerToken)
            } else {
                OwnIdRegisterEvent.Error(error).emitToReact(dependencies.eventEmitter, dependencies.ownerToken)
            }
        }
    }

    private fun OwnIdWidget.Type.toCoordinatorWidget(): OwnIdActivityFlowCoordinator.Widget = when (this) {
        OwnIdWidget.Type.OwnIdButton -> OwnIdActivityFlowCoordinator.Widget.BUTTON
        OwnIdWidget.Type.OwnIdAuthButton -> OwnIdActivityFlowCoordinator.Widget.AUTH_BUTTON
    }

    private fun Type.toCoordinatorFlow(): OwnIdActivityFlowCoordinator.Flow = when (this) {
        Type.LOGIN -> OwnIdActivityFlowCoordinator.Flow.LOGIN
        Type.REGISTER -> OwnIdActivityFlowCoordinator.Flow.REGISTER
    }
}
