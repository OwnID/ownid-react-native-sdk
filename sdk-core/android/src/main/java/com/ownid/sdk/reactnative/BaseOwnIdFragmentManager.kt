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
import com.ownid.sdk.OwnIdInstance
import com.ownid.sdk.event.OwnIdLoginEvent
import com.ownid.sdk.event.OwnIdLoginFlow
import com.ownid.sdk.event.OwnIdRegisterEvent
import com.ownid.sdk.event.OwnIdRegisterFlow
import com.ownid.sdk.exception.OwnIdException
import com.ownid.sdk.internal.OwnIdInternalLogger
import com.ownid.sdk.view.OwnIdButton
import com.ownid.sdk.view.popup.Popup
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

    private val viewFragmentMap: WeakHashMap<View, OwnIdFragment> = WeakHashMap()

    private lateinit var fragmentType: OwnIdFragment.Type

    private var widgetProperties = OwnIdWidget.Properties()

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
            else -> OwnIdInternalLogger.logW(this, "receiveCommand", "Unknown command: $commandId")
        }
    }

    @ReactProp(name = "widgetType")
    @Suppress("UNUSED_PARAMETER")
    public fun setWidgetType(view: View?, value: String?) {
        if (value == null) return
        val widgetType = OwnIdWidget.Type.entries.firstOrNull { it.name.equals(value, true) } ?: OwnIdWidget.Type.OwnIdButton
        widgetProperties = widgetProperties.copy(widgetType = widgetType)
    }

    @ReactProp(name = "instanceName")
    @Suppress("UNUSED_PARAMETER")
    public fun setInstanceName(view: View?, value: String?) {
        if (value != null) instanceName = InstanceName(value)
    }

    @ReactProp(name = "widgetPosition")
    @Suppress("UNUSED_PARAMETER")
    public fun setWidgetPosition(view: View?, value: String?) {
        if (value == null) return
        val widgetPosition = OwnIdButton.Position.entries.firstOrNull { it.name.equals(value, true) } ?: OwnIdButton.Position.START
        widgetProperties = widgetProperties.copy(widgetPosition = widgetPosition)
    }

    @ReactProp(name = "type")
    @Suppress("UNUSED_PARAMETER")
    public fun setType(view: View?, value: String?) {
        if (value != null) fragmentType = OwnIdFragment.Type.valueOf(value.uppercase(Locale.ENGLISH)) //IllegalArgumentException
    }

    @ReactPropGroup(names = ["width", "height"], customType = "Style")
    public fun setStyle(view: View?, index: Int, value: Int) {
        // shadowNode?.setSize(index, value * view!!.resources.displayMetrics.density)
    }

    @Suppress("UNUSED_PARAMETER")
    @ReactPropGroup(
        names = [
            "buttonTextColor", "iconColor", "buttonBackgroundColor", "buttonBorderColor",
            "tooltipTextColor", "tooltipBackgroundColor", "tooltipBorderColor",
            "spinnerColor", "spinnerBackgroundColor"
        ],
        customType = "Color"
    )
    public fun setColor(view: View?, index: Int, value: Int?) {
        if (index == 0) widgetProperties = widgetProperties.copy(textColor = value)
        if (index == 1) widgetProperties = widgetProperties.copy(iconColor = value)
        if (index == 2) widgetProperties = widgetProperties.copy(backgroundColor = value)
        if (index == 3) widgetProperties = widgetProperties.copy(borderColor = value)

        if (index == 4) widgetProperties = widgetProperties.copy(tooltipTextColor = value)
        if (index == 5) widgetProperties = widgetProperties.copy(tooltipBackgroundColor = value)
        if (index == 6) widgetProperties = widgetProperties.copy(tooltipBorderColor = value)

        if (index == 7) widgetProperties = widgetProperties.copy(spinnerColor = value)
        if (index == 8) widgetProperties = widgetProperties.copy(spinnerBackgroundColor = value)
    }

    @ReactProp(name = "showOr")
    @Suppress("UNUSED_PARAMETER")
    public fun setShowOr(view: View?, value: Boolean?) {
        if (value == null) return
        if (widgetProperties.showOr != value) widgetProperties = widgetProperties.copy(showOr = value)
    }

    @ReactProp(name = "showSpinner")
    @Suppress("UNUSED_PARAMETER")
    public fun setShowSpinner(view: View?, value: Boolean?) {
        if (value == null) return
        if (widgetProperties.showSpinner != value) widgetProperties = widgetProperties.copy(showSpinner = value)
    }

    @ReactProp(name = "tooltipPosition")
    @Suppress("UNUSED_PARAMETER")
    public fun setTooltipPosition(view: View?, value: String?) {
        if (value == null) return
        val valueUppercase = value.uppercase(Locale.ENGLISH)
        val tooltipPosition = Popup.Position.entries.firstOrNull { it.name == valueUppercase } // Null as None
        widgetProperties = widgetProperties.copy(tooltipPosition = tooltipPosition)
    }

    @ReactProp(name = "loginId")
    public fun setLoginId(view: View?, value: String?) {
        loginId = value
        viewFragmentMap[view]?.setLoginId(loginId)
    }

    private fun createFragment(view: FrameLayout, args: ReadableArray?) {
        val reactNativeViewId = args?.getInt(0) ?: View.NO_ID
        val eventEmitter = reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)

        val ownId = OwnId.getInstanceOrNull<OwnIdInstance>(instanceName)

        if (ownId == null) {
            val noInstanceError = OwnIdException("$instanceName has not been initialized")
            when (fragmentType) {
                OwnIdFragment.Type.REGISTER -> {
                    OwnIdRegisterFlow.Error(noInstanceError).emitToReact(eventEmitter)
                    OwnIdRegisterEvent.Error(noInstanceError).emitToReact(eventEmitter)
                }

                OwnIdFragment.Type.LOGIN -> {
                    OwnIdLoginFlow.Error(noInstanceError).emitToReact(eventEmitter)
                    OwnIdLoginEvent.Error(noInstanceError).emitToReact(eventEmitter)
                }
            }
            return
        }

        val ownIdFragment = OwnIdFragment(ownId, fragmentType, widgetProperties, shadowNode!!, eventEmitter, loginId)

        (reactContext.currentActivity as FragmentActivity).supportFragmentManager
            .beginTransaction()
            .replace(reactNativeViewId, ownIdFragment, reactNativeViewId.toString())
            .commit()

        viewFragmentMap[view] = ownIdFragment

        widgetProperties = OwnIdWidget.Properties()
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
}