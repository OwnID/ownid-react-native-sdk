package com.ownid.sdk.reactnative

import android.view.View
import android.widget.FrameLayout
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.uimanager.LayoutShadowNode
import com.facebook.react.uimanager.ThemedReactContext
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
import com.ownid.sdk.internal.component.OwnIdInternalLogger
import com.ownid.sdk.view.OwnIdButton
import com.ownid.sdk.view.popup.Popup
import java.util.ArrayDeque
import java.util.Locale
import java.util.WeakHashMap

@InternalOwnIdAPI
public open class BaseOwnIdFragmentManager(private val reactContext: ReactApplicationContext) : ViewGroupManager<FrameLayout>() {

    private companion object COMMAND {
        private const val CREATE: Int = 1
        private const val REGISTER: Int = 2
    }

    protected open var instanceName: InstanceName = InstanceName.DEFAULT

    protected open fun register(ownIdFragment: OwnIdFragment, args: ReadableArray?) {
        throw NotImplementedError("Use OwnID SDK with prebuilt integration")
    }

    private data class Binding(
        val ownerToken: String,
        val fragmentType: OwnIdFragment.Type,
        val instanceName: InstanceName,
        val widgetType: OwnIdWidget.Type,
    )

    private data class PendingCreate(
        val binding: Binding,
        val emitNoInstanceError: Boolean,
    )

    private data class PendingRegister(
        val args: ReadableArray?,
        val binding: Binding?,
    )

    private class ViewState(defaultInstanceName: InstanceName) {
        var instanceName: InstanceName = defaultInstanceName
        var fragmentType: OwnIdFragment.Type? = null
        var widgetProperties: OwnIdWidget.Properties = OwnIdWidget.Properties()
        var loginId: String? = null
        var ownerToken: String? = null
        var shadowNode: OwnIdLayoutShadowNode? = null
        var fragment: OwnIdFragment? = null
        var boundInstanceName: InstanceName? = null
        var pendingAttach: Runnable? = null
        var pendingFragment: OwnIdFragment? = null
        var pendingBinding: Binding? = null
        var pendingCreate: PendingCreate? = null
        var pendingCreateOwnerToken: String? = null
        var lastAttachErrorBinding: Binding? = null
        val pendingRegisters: ArrayDeque<PendingRegister> = ArrayDeque()
    }

    private val viewStateMap: WeakHashMap<View, ViewState> = WeakHashMap()

    private fun stateFor(view: View): ViewState = viewStateMap.getOrPut(view) { ViewState(instanceName) }

    override fun getName(): String = "OwnIdButtonManager"

    override fun createViewInstance(reactContext: ThemedReactContext): FrameLayout = FrameLayout(reactContext)

    override fun createShadowNodeInstance(): LayoutShadowNode = OwnIdLayoutShadowNode()

    override fun updateExtraData(root: FrameLayout, extraData: Any) {
        super.updateExtraData(root, extraData)
        val shadowNode = extraData as? OwnIdLayoutShadowNode ?: return
        val state = stateFor(root)
        state.shadowNode = shadowNode

        state.pendingCreateOwnerToken?.let { ownerToken ->
            state.pendingCreateOwnerToken = null
            requestCreate(root, ownerToken, emitNoInstanceError = true)
        }

        state.pendingCreate?.let { pendingCreate ->
            if (pendingCreate.binding == currentBinding(state)) {
                ensureBinding(root, state, pendingCreate.binding, pendingCreate.emitNoInstanceError)
            } else {
                state.pendingCreate = null
            }
        }
    }

    override fun getCommandsMap(): MutableMap<String, Int> =
        mapOf("create" to CREATE, "register" to REGISTER).toMutableMap()

    public override fun onAfterUpdateTransaction(view: FrameLayout) {
        super.onAfterUpdateTransaction(view)
        val state = viewStateMap[view] ?: return
        val binding = currentBinding(state) ?: return

        state.fragment
            ?.takeIf { fragment -> isSameBinding(state, fragment, binding) }
            ?.updateWidgetProperties(state.widgetProperties)
        state.pendingFragment
            ?.takeIf { state.pendingBinding == binding }
            ?.updateWidgetProperties(state.widgetProperties)
    }

    override fun receiveCommand(view: FrameLayout, commandId: String, args: ReadableArray?) {
        when (commandId.toInt()) {
            CREATE -> createFragment(view, args)
            REGISTER -> {
                val state = stateFor(view)
                val fragment = state.fragment
                if (fragment != null && isAttached(fragment)) {
                    register(fragment, args)
                } else {
                    state.pendingRegisters.addLast(PendingRegister(args, currentBinding(state)))
                }
            }
            else -> OwnIdInternalLogger.logW(this, "receiveCommand", "Unknown command: $commandId")
        }
    }

    private fun currentBinding(state: ViewState): Binding? {
        val ownerToken = state.ownerToken ?: return null
        val fragmentType = state.fragmentType ?: return null
        return Binding(ownerToken, fragmentType, state.instanceName, state.widgetProperties.widgetType)
    }

    private fun isAttached(fragment: OwnIdFragment): Boolean = fragment.isAdded

    @ReactProp(name = "widgetType")
    public fun setWidgetType(view: View?, value: String?) {
        if (view == null || value == null) return
        val state = stateFor(view)
        val previousBinding = currentBinding(state)
        val widgetType = OwnIdWidget.Type.values().firstOrNull { it.name.equals(value, true) } ?: OwnIdWidget.Type.OwnIdButton
        state.widgetProperties = state.widgetProperties.copy(widgetType = widgetType)
        handleIdentityChange(view, state, previousBinding)
    }

    @ReactProp(name = "instanceName")
    public fun setInstanceName(view: View?, value: String?) {
        if (view == null || value == null) return
        val state = stateFor(view)
        val previousBinding = currentBinding(state)
        state.instanceName = InstanceName(value)
        handleIdentityChange(view, state, previousBinding)
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
        val state = stateFor(view)
        val previousBinding = currentBinding(state)
        state.fragmentType = OwnIdFragment.Type.valueOf(value.uppercase(Locale.ENGLISH)) // IllegalArgumentException
        handleIdentityChange(view, state, previousBinding)
        state.pendingCreateOwnerToken?.let { ownerToken ->
            state.pendingCreateOwnerToken = null
            requestCreate(view, ownerToken, emitNoInstanceError = true)
        }
    }

    @ReactPropGroup(names = ["width", "height"], customType = "Style")
    public fun setStyle(view: View?, index: Int, value: Int) {
        // shadowNode?.setSize(index, value * view!!.resources.displayMetrics.density)
    }

    @ReactPropGroup(
        names = [
            "buttonTextColor", "iconColor", "buttonBackgroundColor", "buttonBorderColor",
            "tooltipTextColor", "tooltipBackgroundColor", "tooltipBorderColor",
            "spinnerColor", "spinnerBackgroundColor"
        ],
        customType = "Color"
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
    public fun setShowOr(view: View?, value: Boolean?) {
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
        val tooltipPosition = Popup.Position.values().firstOrNull { it.name == valueUppercase } // Null as None
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
        val hadPendingFragment = state.pendingFragment != null
        val hadPendingCreate = state.pendingCreate != null
        val hadBoundFragment = state.fragment != null
        if (state.ownerToken != value) {
            cancelPendingAttach(view, state)
            state.pendingCreate = null
            state.pendingCreateOwnerToken = null
            state.pendingRegisters.clear()
        }
        state.ownerToken = value
        if (value != null && (hadBoundFragment || hadPendingCreate || hadPendingFragment)) {
            requestCreate(view, value, emitNoInstanceError = false)
        }
    }

    private fun handleIdentityChange(view: View, state: ViewState, previousBinding: Binding?) {
        val currentBinding = currentBinding(state)
        if (previousBinding == currentBinding) return

        val hadPendingFragment = state.pendingFragment != null
        cancelPendingAttach(view, state)
        if (previousBinding != null) state.pendingRegisters.clear()

        val hadBoundFragment = state.fragment != null || state.pendingCreate != null || hadPendingFragment
        state.pendingCreate = null
        if (hadBoundFragment) {
            currentBinding?.let { requestCreate(view, it.ownerToken, emitNoInstanceError = false) }
        }
    }

    private fun createFragment(view: FrameLayout, args: ReadableArray?) {
        val reactNativeViewId = if (args != null && args.size() > 0) args.getInt(0) else View.NO_ID
        val commandOwnerToken = if (args != null && args.size() > 1) args.getString(1) else null
        if (commandOwnerToken == null) {
            OwnIdInternalLogger.logW(this, "createFragment", "Ignoring create command without an owner token")
            return
        }
        if (reactNativeViewId != View.NO_ID && reactNativeViewId != view.id) {
            OwnIdInternalLogger.logW(this, "createFragment", "Ignoring create command for a different view")
            return
        }
        requestCreate(view, commandOwnerToken, emitNoInstanceError = true)
    }

    private fun requestCreate(view: View, ownerToken: String, emitNoInstanceError: Boolean) {
        val state = stateFor(view)
        if (state.ownerToken != ownerToken) {
            cancelPendingAttach(view, state)
            state.pendingCreate = null
            state.pendingRegisters.clear()
            state.ownerToken = ownerToken
        }

        val binding = currentBinding(state)
        if (binding == null) {
            state.pendingCreateOwnerToken = ownerToken
            return
        }
        state.pendingCreateOwnerToken = null
        ensureBinding(view, state, binding, emitNoInstanceError)
    }

    private fun ensureBinding(view: View, state: ViewState, binding: Binding, emitNoInstanceError: Boolean) {
        val existingFragment = state.fragment
        if (existingFragment != null && isSameBinding(state, existingFragment, binding)) {
            if (OwnId.getInstanceOrNull<OwnIdInstance>(binding.instanceName) == null) {
                retireBoundFragment(state)
                emitNoInstanceError(state, binding, emitNoInstanceError)
                return
            }
            existingFragment.setLoginId(state.loginId ?: existingFragment.currentLoginIdValue)
            existingFragment.updateWidgetProperties(state.widgetProperties)
            return
        }

        if (state.pendingFragment != null && state.pendingBinding == binding) {
            state.pendingFragment?.setLoginId(state.loginId ?: state.pendingFragment?.currentLoginIdValue)
            state.pendingFragment?.updateWidgetProperties(state.widgetProperties)
            return
        }

        cancelPendingAttach(view, state)
        state.pendingCreate = PendingCreate(binding, emitNoInstanceError)

        val ownId = OwnId.getInstanceOrNull<OwnIdInstance>(binding.instanceName)
        if (ownId == null) {
            state.pendingCreate = null
            retireBoundFragment(state)
            emitNoInstanceError(state, binding, emitNoInstanceError)
            return
        }

        // Retire the old binding before waiting for extra data or posting the new attach.
        if (existingFragment != null) retireBoundFragment(state)

        val shadowNode = state.shadowNode
        if (shadowNode == null) {
            OwnIdInternalLogger.logW(this, "createFragment", "Waiting for a shadow node before attaching the fragment")
            return
        }

        state.pendingCreate = null
        val eventEmitter = reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        val ownIdFragment = OwnIdFragment(
            ownId,
            binding.fragmentType,
            state.widgetProperties,
            shadowNode,
            eventEmitter,
            state.loginId,
            binding.ownerToken,
        )
        queueAttach(view, state, ownIdFragment, binding, shadowNode)
    }

    private fun isSameBinding(state: ViewState, fragment: OwnIdFragment, binding: Binding): Boolean =
        fragment.ownerToken == binding.ownerToken &&
            fragment.fragmentType == binding.fragmentType &&
            fragment.widgetProperties?.widgetType == binding.widgetType &&
            state.boundInstanceName == binding.instanceName

    private fun emitNoInstanceError(state: ViewState, binding: Binding, shouldEmit: Boolean) {
        if (!shouldEmit) return
        emitTypedError(binding, OwnIdException("${binding.instanceName} has not been initialized"))
    }

    private fun emitAttachErrorOnce(state: ViewState, binding: Binding) {
        if (state.lastAttachErrorBinding == binding) return
        state.lastAttachErrorBinding = binding
        emitTypedError(binding, OwnIdException("OwnID widget could not be attached to its hosting FragmentActivity"))
    }

    private fun emitTypedError(binding: Binding, error: OwnIdException) {
        val eventEmitter = reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        when (binding.fragmentType) {
            OwnIdFragment.Type.REGISTER -> OwnIdRegisterFlow.Error(error).emitToReact(eventEmitter, binding.ownerToken)
            OwnIdFragment.Type.LOGIN -> OwnIdLoginFlow.Error(error).emitToReact(eventEmitter, binding.ownerToken)
        }
    }

    private fun queueAttach(
        view: View,
        state: ViewState,
        fragment: OwnIdFragment,
        binding: Binding,
        shadowNode: OwnIdLayoutShadowNode,
    ) {
        lateinit var attachRunnable: Runnable
        attachRunnable = Runnable {
            val isCurrent = viewStateMap[view] === state &&
                state.pendingAttach === attachRunnable &&
                state.pendingFragment === fragment &&
                state.pendingBinding == binding &&
                state.ownerToken == binding.ownerToken &&
                state.fragmentType == binding.fragmentType &&
                state.instanceName == binding.instanceName &&
                state.widgetProperties.widgetType == binding.widgetType &&
                state.shadowNode === shadowNode
            if (isCurrent) {
                if (!view.isAttachedToWindow) {
                    view.post(attachRunnable)
                    return@Runnable
                }

                val activity = OwnIdFragmentActivityResolver.from(view)
                if (activity == null) {
                    state.pendingAttach = null
                    state.pendingFragment = null
                    state.pendingBinding = null
                    emitAttachErrorOnce(state, binding)
                    return@Runnable
                }
                if (activity.isFinishing || activity.isDestroyed) {
                    state.pendingAttach = null
                    state.pendingFragment = null
                    state.pendingBinding = null
                    return@Runnable
                }
                if (!OwnIdFragmentActivityResolver.isReachableFrom(view, activity)) {
                    state.pendingAttach = null
                    state.pendingFragment = null
                    state.pendingBinding = null
                    emitAttachErrorOnce(state, binding)
                    return@Runnable
                }

                state.pendingAttach = null
                state.pendingFragment = null
                state.pendingBinding = null

                activity.supportFragmentManager
                    .beginTransaction()
                    .setReorderingAllowed(true)
                    .replace(view.id, fragment, view.id.toString())
                    .commitNowAllowingStateLoss()

                state.fragment = fragment
                state.boundInstanceName = binding.instanceName
                drainPendingRegisters(state, fragment, binding)
            } else if (state.pendingAttach === attachRunnable) {
                state.pendingAttach = null
                state.pendingFragment = null
                state.pendingBinding = null
            }
        }
        state.pendingAttach = attachRunnable
        state.pendingFragment = fragment
        state.pendingBinding = binding
        view.post(attachRunnable)
    }

    private fun drainPendingRegisters(state: ViewState, fragment: OwnIdFragment, binding: Binding) {
        val pendingRegisters = state.pendingRegisters.toList()
        state.pendingRegisters.clear()
        pendingRegisters.forEach { pendingRegister ->
            if (pendingRegister.binding == null || pendingRegister.binding == binding) {
                register(fragment, pendingRegister.args)
            }
        }
    }

    private fun cancelPendingAttach(view: View, state: ViewState) {
        state.pendingAttach?.let(view::removeCallbacks)
        state.pendingAttach = null
        state.pendingFragment = null
        state.pendingBinding = null
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

    override fun onDropViewInstance(view: FrameLayout) {
        super.onDropViewInstance(view)
        val state = viewStateMap.remove(view) ?: return
        cancelPendingAttach(view, state)
        state.pendingCreate = null
        state.pendingCreateOwnerToken = null
        state.pendingRegisters.clear()
        retireBoundFragment(state)
    }
}
