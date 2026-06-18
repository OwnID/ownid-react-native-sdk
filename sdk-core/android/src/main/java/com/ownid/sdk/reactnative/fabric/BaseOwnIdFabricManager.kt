package com.ownid.sdk.reactnative.fabric

import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.FragmentActivity
import androidx.fragment.app.FragmentContainerView
import com.facebook.react.bridge.ReactApplicationContext
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
import com.ownid.sdk.event.OwnIdLoginEvent
import com.ownid.sdk.event.OwnIdLoginFlow
import com.ownid.sdk.event.OwnIdRegisterEvent
import com.ownid.sdk.event.OwnIdRegisterFlow
import com.ownid.sdk.exception.OwnIdException
import com.ownid.sdk.reactnative.OwnIdWidget
import com.ownid.sdk.reactnative.emitToReact
import com.ownid.sdk.view.OwnIdButton

@OptIn(InternalOwnIdAPI::class)
public abstract class BaseOwnIdFabricManager(private val reactContext: ReactApplicationContext) :
    ViewGroupManager<FragmentContainerView>() {

    protected open var instanceName: InstanceName = InstanceName.DEFAULT

    protected open lateinit var fragmentType: OwnIdFragmentFabric.Type

    private var widgetProperties = OwnIdWidget.Properties()
    private var loginId: String? = null
    private var preferredHeightDp: Int? = null

    private val viewFragmentMap = mutableMapOf<View, OwnIdFragmentFabric>()

    public override fun createViewInstance(reactContext: ThemedReactContext): FragmentContainerView =
        FragmentContainerView(reactContext).apply {
            layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        }

    @ReactProp(name = "widgetType")
    public fun setWidgetType(view: View?, value: String?) {
        if (value == null) return
        val widgetType = OwnIdWidget.Type.values().firstOrNull { it.name.equals(value, true) } ?: OwnIdWidget.Type.OwnIdButton
        widgetProperties = widgetProperties.copy(widgetType = widgetType)
    }

    @ReactProp(name = "instanceName")
    public fun setInstanceName(view: View?, value: String?) {
        if (value != null) instanceName = InstanceName(value)
    }

    @ReactProp(name = "widgetPosition")
    public fun setWidgetPosition(view: View?, value: String?) {
        if (value == null) return
        val widgetPosition = OwnIdButton.Position.values().firstOrNull { it.name.equals(value, true) } ?: OwnIdButton.Position.START
        widgetProperties = widgetProperties.copy(widgetPosition = widgetPosition)
    }

    @ReactProp(name = "type")
    public fun setType(view: View?, value: String?) {
        if (value == null) return
        fragmentType = OwnIdFragmentFabric.Type.valueOf(value.uppercase()) // IllegalArgumentException
    }

    @ReactPropGroup(names = ["width", "height"], customType = "Style")
    public fun setStyle(view: View?, index: Int, value: Int) {
        // width/height handled in JS and preferredHeight prop
    }

    @ReactProp(name = "preferredHeight")
    public fun setPreferredHeight(view: View?, value: Int?) {
        preferredHeightDp = value
    }

    @ReactPropGroup(
        names = [
            "buttonTextColor", "iconColor", "buttonBackgroundColor", "buttonBorderColor",
            "tooltipTextColor", "tooltipBackgroundColor", "tooltipBorderColor",
            "spinnerColor", "spinnerBackgroundColor"
        ], customType = "Color"
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
    public fun setShowOr(view: View?, value: Boolean?): Unit {
        if (value != null && widgetProperties.showOr != value) widgetProperties = widgetProperties.copy(showOr = value)
    }

    @ReactProp(name = "showSpinner")
    public fun setShowSpinner(view: View?, value: Boolean?) {
        if (value != null && widgetProperties.showSpinner != value) widgetProperties = widgetProperties.copy(showSpinner = value)
    }

    @ReactProp(name = "tooltipPosition")
    public fun setTooltipPosition(view: View?, value: String?) {
        if (value == null) return
        val valueUppercase = value.uppercase()
        val tooltipPosition = com.ownid.sdk.view.popup.Popup.Position.values().firstOrNull { it.name == valueUppercase }
        widgetProperties = widgetProperties.copy(tooltipPosition = tooltipPosition)
    }

    @ReactProp(name = "loginId")
    public fun setLoginId(view: View?, value: String?) {
        loginId = value
        viewFragmentMap[view]?.setLoginId(loginId)
    }

    public override fun onAfterUpdateTransaction(view: FragmentContainerView) {
        super.onAfterUpdateTransaction(view)

        val existingFragment = viewFragmentMap[view]
        val propsAreDefault = widgetProperties == OwnIdWidget.Properties()
        if (existingFragment != null && propsAreDefault && preferredHeightDp == null) {
            return
        }

        val eventEmitter = reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        val ownId = OwnId.getInstanceOrNull<OwnIdInstance>(instanceName)

        if (ownId == null) {
            val noInstanceError = OwnIdException("$instanceName has not been initialized")
            when (fragmentType) {
                OwnIdFragmentFabric.Type.REGISTER -> {
                    OwnIdRegisterFlow.Error(noInstanceError).emitToReact(eventEmitter)
                    OwnIdRegisterEvent.Error(noInstanceError).emitToReact(eventEmitter)
                }

                OwnIdFragmentFabric.Type.LOGIN -> {
                    OwnIdLoginFlow.Error(noInstanceError).emitToReact(eventEmitter)
                    OwnIdLoginEvent.Error(noInstanceError).emitToReact(eventEmitter)
                }
            }
            return
        }

        val dispatcher = UIManagerHelper.getEventDispatcher(reactContext, view.id)

        val onMeasured: (Int, Int) -> Unit = { wPx, hPx ->
            val sid = UIManagerHelper.getSurfaceId(view)
            val wDp = PixelUtil.toDIPFromPixel(wPx.toFloat()).toInt()
            val hDp = PixelUtil.toDIPFromPixel(hPx.toFloat()).toInt()
            dispatcher?.dispatchEvent(ContentSizeChangeEvent(sid, view.id, wDp, hDp))
            view.requestLayout()
            view.invalidate()
        }

        val ownIdFragment = OwnIdFragmentFabric(ownId, fragmentType, widgetProperties, onMeasured, eventEmitter, loginId)

        view.post {
            val activity = reactContext.currentActivity
            if (activity == null || activity.isFinishing || activity.isDestroyed) return@post

            (activity as FragmentActivity).supportFragmentManager
                .beginTransaction()
                .replace(view.id, ownIdFragment, view.id.toString())
                .commitNowAllowingStateLoss()

            viewFragmentMap[view] = ownIdFragment
            FabricFragmentRegistry.put(view.id, ownIdFragment)
        }

        widgetProperties = OwnIdWidget.Properties()
        loginId = null
        preferredHeightDp = null
    }

    public override fun onDropViewInstance(view: FragmentContainerView): Unit {
        super.onDropViewInstance(view)
        viewFragmentMap.remove(view)
        FabricFragmentRegistry.remove(view.id)
    }
}
