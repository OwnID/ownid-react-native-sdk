package com.ownid.sdk.reactnative.fabric

import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.FragmentContainerView
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.uimanager.PixelUtil
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.ViewGroupManager
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.uimanager.annotations.ReactPropGroup
import com.ownid.sdk.InstanceName
import com.ownid.sdk.InternalOwnIdAPI
import com.ownid.sdk.OwnId
import com.ownid.sdk.OwnIdInstance
import com.ownid.sdk.event.OwnIdLoginFlow
import com.ownid.sdk.event.OwnIdRegisterFlow
import com.ownid.sdk.exception.OwnIdException
import com.ownid.sdk.reactnative.OwnIdFragmentActivityResolver
import com.ownid.sdk.reactnative.OwnIdWidget
import com.ownid.sdk.reactnative.emitToReact
import com.ownid.sdk.view.OwnIdButton
import java.util.Locale
import java.util.WeakHashMap

@OptIn(InternalOwnIdAPI::class)
public abstract class BaseOwnIdFabricManager(private val reactContext: ReactApplicationContext) :
    ViewGroupManager<FragmentContainerView>() {

    protected open var instanceName: InstanceName = InstanceName.DEFAULT

    protected open var fragmentType: OwnIdFragmentFabric.Type = OwnIdFragmentFabric.Type.LOGIN

    private data class Binding(
        val ownerToken: String,
        val fragmentType: OwnIdFragmentFabric.Type,
        val instanceName: InstanceName,
        val widgetType: OwnIdWidget.Type,
    )

    private class ViewState(defaultInstanceName: InstanceName) {
        var instanceName: InstanceName = defaultInstanceName
        var fragmentType: OwnIdFragmentFabric.Type = OwnIdFragmentFabric.Type.LOGIN
        var widgetProperties: OwnIdWidget.Properties = OwnIdWidget.Properties()
        var loginId: String? = null
        var preferredHeightDp: Int? = null
        var ownerToken: String? = null
        var listenersReadyOwnerToken: String? = null
        var fragment: OwnIdFragmentFabric? = null
        var boundInstanceName: InstanceName? = null
        var pendingAttach: Runnable? = null
        var pendingFragment: OwnIdFragmentFabric? = null
        var pendingInstanceName: InstanceName? = null
        var lastNoInstanceErrorBinding: Binding? = null
        var lastAttachErrorBinding: Binding? = null
    }

    private val viewStateMap: WeakHashMap<View, ViewState> = WeakHashMap()

    private fun stateFor(view: View): ViewState = viewStateMap.getOrPut(view) { ViewState(instanceName) }

    public override fun createViewInstance(reactContext: ThemedReactContext): FragmentContainerView {
        val view = FragmentContainerView(reactContext).apply {
            layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        }
        viewStateMap[view] = ViewState(instanceName)
        return view
    }

    @ReactProp(name = "widgetType")
    public fun setWidgetType(view: View?, value: String?) {
        if (view == null || value == null) return
        val widgetType = OwnIdWidget.Type.values().firstOrNull { it.name.equals(value, true) } ?: OwnIdWidget.Type.OwnIdButton
        val state = stateFor(view)
        state.widgetProperties = state.widgetProperties.copy(widgetType = widgetType)
    }

    @ReactProp(name = "instanceName")
    public fun setInstanceName(view: View?, value: String?) {
        if (view == null || value == null) return
        val newInstanceName = InstanceName(value)
        stateFor(view).instanceName = newInstanceName
    }

    @ReactProp(name = "widgetPosition")
    public fun setWidgetPosition(view: View?, value: String?) {
        if (view == null || value == null) return
        val widgetPosition = OwnIdButton.Position.values().firstOrNull { it.name.equals(value, true) } ?: OwnIdButton.Position.START
        val state = stateFor(view)
        state.widgetProperties = state.widgetProperties.copy(widgetPosition = widgetPosition)
    }

    @ReactProp(name = "type")
    public fun setType(view: View?, value: String?) {
        if (view == null || value == null) return
        val newFragmentType = OwnIdFragmentFabric.Type.valueOf(value.uppercase(Locale.ENGLISH)) // IllegalArgumentException
        stateFor(view).fragmentType = newFragmentType
    }

    @ReactPropGroup(names = ["width", "height"], customType = "Style")
    public fun setStyle(view: View?, index: Int, value: Int) {
        // width/height handled in JS and preferredHeight prop
    }

    @ReactProp(name = "preferredHeight")
    public fun setPreferredHeight(view: View?, value: Int?) {
        if (view == null) return
        stateFor(view).preferredHeightDp = value
    }

    @ReactPropGroup(
        names = [
            "buttonTextColor", "iconColor", "buttonBackgroundColor", "buttonBorderColor",
            "tooltipTextColor", "tooltipBackgroundColor", "tooltipBorderColor",
            "spinnerColor", "spinnerBackgroundColor"
        ], customType = "Color"
    )
    public fun setColor(view: View?, index: Int, value: Int?) {
        if (view == null) return
        val state = stateFor(view)
        state.widgetProperties = when (index) {
            0 -> state.widgetProperties.copy(textColor = value)
            1 -> state.widgetProperties.copy(iconColor = value)
            2 -> state.widgetProperties.copy(backgroundColor = value)
            3 -> state.widgetProperties.copy(borderColor = value)
            4 -> state.widgetProperties.copy(tooltipTextColor = value)
            5 -> state.widgetProperties.copy(tooltipBackgroundColor = value)
            6 -> state.widgetProperties.copy(tooltipBorderColor = value)
            7 -> state.widgetProperties.copy(spinnerColor = value)
            8 -> state.widgetProperties.copy(spinnerBackgroundColor = value)
            else -> state.widgetProperties
        }
    }

    @ReactProp(name = "showOr")
    public fun setShowOr(view: View?, value: Boolean?): Unit {
        if (view == null || value == null) return
        val state = stateFor(view)
        if (state.widgetProperties.showOr != value) state.widgetProperties = state.widgetProperties.copy(showOr = value)
    }

    @ReactProp(name = "showSpinner")
    public fun setShowSpinner(view: View?, value: Boolean?) {
        if (view == null || value == null) return
        val state = stateFor(view)
        if (state.widgetProperties.showSpinner != value) state.widgetProperties = state.widgetProperties.copy(showSpinner = value)
    }

    @ReactProp(name = "tooltipPosition")
    public fun setTooltipPosition(view: View?, value: String?) {
        if (view == null || value == null) return
        val valueUppercase = value.uppercase(Locale.ENGLISH)
        val tooltipPosition = com.ownid.sdk.view.popup.Popup.Position.values().firstOrNull { it.name == valueUppercase }
        val state = stateFor(view)
        state.widgetProperties = state.widgetProperties.copy(tooltipPosition = tooltipPosition)
    }

    @ReactProp(name = "loginId")
    public fun setLoginId(view: View?, value: String?) {
        if (view == null) return
        val state = stateFor(view)
        state.loginId = value
        state.fragment?.setLoginId(value)
        state.pendingFragment?.setLoginId(value)
    }

    @ReactProp(name = "ownerToken")
    public fun setOwnerToken(view: View?, value: String?) {
        if (view == null) return
        val state = stateFor(view)
        if (state.ownerToken != value) {
            cancelPendingAttach(view, state)
            retireBoundFragment(state)
            FabricFragmentRegistry.remove(view.id)
            if (state.listenersReadyOwnerToken != value) state.listenersReadyOwnerToken = null
        }
        state.ownerToken = value
    }

    public override fun receiveCommand(view: FragmentContainerView, commandId: String, args: ReadableArray?) {
        if (commandId != LISTENERS_READY_COMMAND) {
            super.receiveCommand(view, commandId, args)
            return
        }

        val ownerToken = args?.takeIf { it.size() > 0 }?.getString(0) ?: return
        val state = viewStateMap[view] ?: return
        if (state.ownerToken != null && state.ownerToken != ownerToken) return

        state.listenersReadyOwnerToken = ownerToken
        attachIfReady(view, state)
    }

    public override fun onAfterUpdateTransaction(view: FragmentContainerView) {
        super.onAfterUpdateTransaction(view)

        val state = viewStateMap[view] ?: return
        attachIfReady(view, state)
    }

    private fun attachIfReady(view: FragmentContainerView, state: ViewState) {
        val ownerToken = state.ownerToken ?: return
        if (state.listenersReadyOwnerToken != ownerToken) {
            cancelPendingAttach(view, state)
            retireBoundFragment(state)
            FabricFragmentRegistry.remove(view.id)
            return
        }
        val eventEmitter = reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        val bindingInstanceName = state.instanceName
        val bindingFragmentType = state.fragmentType
        val binding = Binding(ownerToken, bindingFragmentType, bindingInstanceName, state.widgetProperties.widgetType)
        val ownId = OwnId.getInstanceOrNull<OwnIdInstance>(bindingInstanceName)
        if (ownId != null) state.lastNoInstanceErrorBinding = null
        val existingFragment = state.fragment
        val pendingFragment = state.pendingFragment
        val hasSameBinding = existingFragment != null &&
            existingFragment.ownerToken == ownerToken &&
            existingFragment.fragmentType == state.fragmentType &&
            existingFragment.widgetProperties?.widgetType == state.widgetProperties.widgetType &&
            state.boundInstanceName == state.instanceName
        if (hasSameBinding) {
            if (ownId == null) {
                cancelPendingAttach(view, state)
                retireBoundFragment(state)
                FabricFragmentRegistry.remove(view.id)
                emitNoInstanceErrorOnce(eventEmitter, state, binding)
                return
            }
            val fragment = existingFragment ?: return
            fragment.setLoginId(state.loginId)
            if (fragment.widgetProperties != state.widgetProperties) {
                fragment.updateWidgetProperties(state.widgetProperties)
            }
            return
        }

        val hasSamePendingBinding = pendingFragment != null &&
            pendingFragment.ownerToken == ownerToken &&
            pendingFragment.fragmentType == state.fragmentType &&
            pendingFragment.widgetProperties?.widgetType == state.widgetProperties.widgetType &&
            pendingFragment.widgetProperties == state.widgetProperties &&
            state.pendingInstanceName == state.instanceName
        if (hasSamePendingBinding) {
            if (ownId == null) {
                cancelPendingAttach(view, state)
                retireBoundFragment(state)
                FabricFragmentRegistry.remove(view.id)
                emitNoInstanceErrorOnce(eventEmitter, state, binding)
                return
            }
            pendingFragment?.setLoginId(state.loginId)
            return
        }

        cancelPendingAttach(view, state)
        retireBoundFragment(state)
        FabricFragmentRegistry.remove(view.id)

        if (ownId == null) {
            emitNoInstanceErrorOnce(eventEmitter, state, binding)
            return
        }

        val dispatcher = UIManagerHelper.getEventDispatcherForReactTag(reactContext, view.id)

        val onMeasured: (Int, Int) -> Unit = { wPx, hPx ->
            val sid = UIManagerHelper.getSurfaceId(view)
            val wDp = PixelUtil.toDIPFromPixel(wPx.toFloat()).toInt()
            val hDp = PixelUtil.toDIPFromPixel(hPx.toFloat()).toInt()
            dispatcher?.dispatchEvent(ContentSizeChangeEvent(sid, view.id, wDp, hDp))
            view.requestLayout()
            view.invalidate()
        }

        val ownIdFragment = OwnIdFragmentFabric(
            ownId,
            bindingFragmentType,
            state.widgetProperties,
            onMeasured,
            eventEmitter,
            state.loginId,
            ownerToken,
        )

        lateinit var attachRunnable: Runnable
        attachRunnable = Runnable {
            val currentState = viewStateMap[view]
            val isCurrent = currentState === state &&
                state.pendingAttach === attachRunnable &&
                state.pendingFragment === ownIdFragment &&
                state.ownerToken == ownerToken &&
                state.listenersReadyOwnerToken == ownerToken &&
                state.instanceName == bindingInstanceName &&
                state.fragmentType == bindingFragmentType &&
                state.widgetProperties == ownIdFragment.widgetProperties
            if (isCurrent) {
                if (!view.isAttachedToWindow) {
                    view.post(attachRunnable)
                    return@Runnable
                }

                val activity = OwnIdFragmentActivityResolver.from(view)
                if (activity == null) {
                    state.pendingAttach = null
                    state.pendingFragment = null
                    state.pendingInstanceName = null
                    emitAttachErrorOnce(eventEmitter, state, binding)
                    return@Runnable
                }
                if (activity.isFinishing || activity.isDestroyed) {
                    state.pendingAttach = null
                    state.pendingFragment = null
                    state.pendingInstanceName = null
                    return@Runnable
                }
                if (!OwnIdFragmentActivityResolver.isReachableFrom(view, activity)) {
                    state.pendingAttach = null
                    state.pendingFragment = null
                    state.pendingInstanceName = null
                    emitAttachErrorOnce(eventEmitter, state, binding)
                    return@Runnable
                }

                state.pendingAttach = null
                state.pendingFragment = null
                state.pendingInstanceName = null

                val fragmentManager = activity.supportFragmentManager
                fragmentManager.beginTransaction()
                    .setReorderingAllowed(true)
                    .apply {
                        state.fragment?.takeIf { it !== ownIdFragment }?.let(::remove)
                        add(view.id, ownIdFragment, view.id.toString())
                    }
                    .commitNowAllowingStateLoss()

                state.fragment = ownIdFragment
                state.boundInstanceName = bindingInstanceName
                FabricFragmentRegistry.put(view.id, ownIdFragment)
            }
        }
        state.pendingAttach = attachRunnable
        state.pendingFragment = ownIdFragment
        state.pendingInstanceName = bindingInstanceName
        view.post(attachRunnable)
    }

    public override fun onDropViewInstance(view: FragmentContainerView): Unit {
        super.onDropViewInstance(view)
        val state = viewStateMap.remove(view)
        if (state != null) {
            cancelPendingAttach(view, state)
            retireBoundFragment(state)
        }
        FabricFragmentRegistry.remove(view.id)
    }

    private fun emitNoInstanceErrorOnce(
        eventEmitter: DeviceEventManagerModule.RCTDeviceEventEmitter,
        state: ViewState,
        binding: Binding,
    ) {
        if (state.lastNoInstanceErrorBinding == binding) return
        state.lastNoInstanceErrorBinding = binding
        emitTypedError(
            eventEmitter,
            binding.fragmentType,
            binding.ownerToken,
            OwnIdException("${binding.instanceName} has not been initialized"),
        )
    }

    private fun emitAttachErrorOnce(
        eventEmitter: DeviceEventManagerModule.RCTDeviceEventEmitter,
        state: ViewState,
        binding: Binding,
    ) {
        if (state.lastAttachErrorBinding == binding) return
        state.lastAttachErrorBinding = binding
        emitTypedError(
            eventEmitter,
            binding.fragmentType,
            binding.ownerToken,
            OwnIdException("OwnID widget could not be attached to its hosting FragmentActivity"),
        )
    }

    private fun emitTypedError(
        eventEmitter: DeviceEventManagerModule.RCTDeviceEventEmitter,
        fragmentType: OwnIdFragmentFabric.Type,
        ownerToken: String,
        error: OwnIdException,
    ) {
        when (fragmentType) {
            OwnIdFragmentFabric.Type.REGISTER -> OwnIdRegisterFlow.Error(error).emitToReact(eventEmitter, ownerToken)
            OwnIdFragmentFabric.Type.LOGIN -> OwnIdLoginFlow.Error(error).emitToReact(eventEmitter, ownerToken)
        }
    }

    private fun retireBoundFragment(state: ViewState) {
        val fragment = state.fragment ?: return
        state.fragment = null
        state.boundInstanceName = null
        fragment.releaseCoordinatorClaim(permanently = fragment.activity?.isChangingConfigurations != true)
        if (!fragment.isAdded) return
        fragment.parentFragmentManager
            .beginTransaction()
            .setReorderingAllowed(true)
            .remove(fragment)
            .commitAllowingStateLoss()
    }

    private fun cancelPendingAttach(view: View, state: ViewState) {
        state.pendingAttach?.let(view::removeCallbacks)
        state.pendingAttach = null
        state.pendingFragment = null
        state.pendingInstanceName = null
    }

    private companion object {
        const val LISTENERS_READY_COMMAND = "listenersReady"
    }
}
