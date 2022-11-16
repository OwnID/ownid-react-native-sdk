package com.ownid.sdk.reactnative

import android.view.View
import android.widget.FrameLayout
import androidx.fragment.app.FragmentActivity
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
import com.ownid.sdk.OwnIdCore
import com.ownid.sdk.OwnIdLogger
import com.ownid.sdk.event.OwnIdLoginEvent
import com.ownid.sdk.event.OwnIdRegisterEvent
import com.ownid.sdk.exception.OwnIdException
import com.ownid.sdk.view.OwnIdButton
import com.ownid.sdk.view.tooltip.TooltipPosition
import java.util.*

@InternalOwnIdAPI
public abstract class BaseOwnIdFragmentManager(private val reactContext: ReactApplicationContext) : ViewGroupManager<FrameLayout>() {

    private companion object COMMAND {
        private const val CREATE: Int = 1
        private const val REGISTER: Int = 2
    }

    protected abstract var instanceName: InstanceName

    private val viewFragmentMap: WeakHashMap<View, OwnIdFragment> = WeakHashMap()

    private lateinit var fragmentType: OwnIdFragment.Type

    private var buttonProperties = OwnIdButtonReact.Properties()
    private var loginId: String? = null
    private var shadowNode: OwnIdLayoutShadowNode? = null

    override fun getName(): String = "OwnIdButtonManager"

    override fun createViewInstance(reactContext: ThemedReactContext): FrameLayout = FrameLayout(reactContext)

    override fun createShadowNodeInstance(): LayoutShadowNode = OwnIdLayoutShadowNode().also { shadowNode = it }

    override fun getCommandsMap(): MutableMap<String, Int> =
        mapOf("create" to CREATE, "register" to REGISTER).toMutableMap()

    override fun receiveCommand(view: FrameLayout, commandId: String, args: ReadableArray?) {
        when (commandId.toInt()) {
            CREATE -> createFragment(view, args)
            REGISTER -> register(viewFragmentMap[view]!!, args)
            else -> OwnIdLogger.e("OwnIdFragmentManager", "Unknown command: $commandId")
        }
    }

    @ReactProp(name = "instanceName")
    @Suppress("UNUSED_PARAMETER")
    public fun setInstanceName(view: View?, value: String?) {
        if (value != null) instanceName = InstanceName(value)
    }

    @ReactProp(name = "variant")
    @Suppress("UNUSED_PARAMETER")
    public fun setVariant(view: View?, value: String?) {
        if (value == null) return
        val valueUppercase = value.uppercase(Locale.ENGLISH)
        val variant = OwnIdButton.IconVariant.values().firstOrNull { it.name == valueUppercase } ?: OwnIdButton.IconVariant.FINGERPRINT
        buttonProperties = buttonProperties.copy(variant = variant)
    }

    @ReactProp(name = "widgetPosition")
    @Suppress("UNUSED_PARAMETER")
    public fun setWidgetPosition(view: View?, value: String?) {
        if (value == null) return
        val valueUppercase = value.uppercase(Locale.ENGLISH)
        val widgetPosition = OwnIdButton.Position.values().firstOrNull { it.name == valueUppercase } ?: OwnIdButton.Position.START
        buttonProperties = buttonProperties.copy(widgetPosition = widgetPosition)
    }

    @ReactProp(name = "type")
    @Suppress("UNUSED_PARAMETER")
    public fun setType(view: View?, value: String?) {
        if (value != null) fragmentType = OwnIdFragment.Type.valueOf(value.uppercase(Locale.ENGLISH)) //IllegalArgumentException
    }

    @ReactPropGroup(names = ["width", "height"], customType = "Style")
    public fun setStyle(view: View?, index: Int, value: Int) {
        shadowNode?.setSize(index, value * view!!.resources.displayMetrics.density)
    }

    @Suppress("UNUSED_PARAMETER")
    @ReactPropGroup(
        names = ["buttonBackgroundColor", "buttonBorderColor", "iconColor", "tooltipBackgroundColor", "tooltipBorderColor"],
        customType = "Color"
    )
    public fun setColor(view: View?, index: Int, value: Int?) {
        if (index == 0) buttonProperties = buttonProperties.copy(backgroundColor = value)
        if (index == 1) buttonProperties = buttonProperties.copy(borderColor = value)
        if (index == 2) buttonProperties = buttonProperties.copy(iconColor = value)
        if (index == 3) buttonProperties = buttonProperties.copy(tooltipBackgroundColor = value)
        if (index == 4) buttonProperties = buttonProperties.copy(tooltipBorderColor = value)
    }

    @ReactProp(name = "showOr")
    @Suppress("UNUSED_PARAMETER")
    public fun setShowOr(view: View?, value: Boolean?) {
        if (value == null) return
        if (buttonProperties.showOr != value) buttonProperties = buttonProperties.copy(showOr = value)
    }

    @ReactProp(name = "tooltipPosition")
    @Suppress("UNUSED_PARAMETER")
    public fun setTooltipPosition(view: View?, value: String?) {
        if (value == null) return
        val valueUppercase = value.uppercase(Locale.ENGLISH)
        val tooltipPosition = TooltipPosition.values().firstOrNull { it.name == valueUppercase } // Null as None
        buttonProperties = buttonProperties.copy(tooltipPosition = tooltipPosition)
    }

    @ReactProp(name = "loginId")
    public fun setLoginId(view: View?, value: String?) {
        loginId = value
        viewFragmentMap[view]?.loginId = loginId
    }

    private fun createFragment(view: FrameLayout, args: ReadableArray?) {
        val reactNativeViewId = args?.getInt(0) ?: View.NO_ID
        val eventEmitter = reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)

        val ownId = OwnId.getInstanceOrNull<OwnIdCore>(instanceName)

        if (ownId == null) {
            val noInstanceError = OwnIdException("${instanceName.value} has not been initialized")
            when (fragmentType) {
                OwnIdFragment.Type.REGISTER ->
                    eventEmitter.emit("OwnIdEvent", OwnIdRegisterEvent.Error(noInstanceError).toWritableMap())

                OwnIdFragment.Type.LOGIN ->
                    eventEmitter.emit("OwnIdEvent", OwnIdLoginEvent.Error(noInstanceError).toWritableMap())
            }
            return
        }

        val ownIdFragment = OwnIdFragment(ownId, fragmentType, buttonProperties, shadowNode!!, eventEmitter, loginId)

        (reactContext.currentActivity as FragmentActivity).supportFragmentManager
            .beginTransaction()
            .replace(reactNativeViewId, ownIdFragment, reactNativeViewId.toString())
            .commit()

        viewFragmentMap[view] = ownIdFragment

        buttonProperties = OwnIdButtonReact.Properties()
        shadowNode = null
        loginId = null
    }

    override fun onDropViewInstance(view: FrameLayout) {
        super.onDropViewInstance(view)
        viewFragmentMap.remove(view)?.let {
            (reactContext.currentActivity as FragmentActivity).supportFragmentManager
                .beginTransaction()
                .remove(it)
                .commit()
        }
    }

    protected abstract fun register(ownIdFragment: OwnIdFragment, args: ReadableArray?)
}