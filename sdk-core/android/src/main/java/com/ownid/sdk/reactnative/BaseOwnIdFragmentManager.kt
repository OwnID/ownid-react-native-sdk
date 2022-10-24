package com.ownid.sdk.reactnative

import android.view.View
import android.widget.FrameLayout
import androidx.fragment.app.FragmentActivity
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.uimanager.LayoutShadowNode
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewGroupManager
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.uimanager.annotations.ReactPropGroup
import com.ownid.sdk.InstanceName
import com.ownid.sdk.InternalOwnIdAPI
import com.ownid.sdk.OwnIdLogger
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

    private var variant: OwnIdButton.IconVariant = OwnIdButton.IconVariant.FINGERPRINT
    private var backgroundColor: Int? = null
    private var borderColor: Int? = null
    private var iconColor: Int? = null
    private var tooltipBackgroundColor: Int? = null
    private var tooltipBorderColor: Int? = null
    private var showOr: Boolean = true
    private var tooltipPosition: TooltipPosition? = null
    private var loginId: String? = null

    override fun getName(): String = "OwnIdButtonManager"

    override fun createViewInstance(reactContext: ThemedReactContext): FrameLayout = FrameLayout(reactContext)

    private var shadowNode: OwnIdLayoutShadowNode? = null

    override fun createShadowNodeInstance(): LayoutShadowNode = OwnIdLayoutShadowNode().also { shadowNode = it }

    override fun getCommandsMap(): MutableMap<String, Int> =
        mapOf("create" to CREATE, "register" to REGISTER).toMutableMap()

    override fun receiveCommand(root: FrameLayout, commandId: String, args: ReadableArray?) {
        when (commandId.toInt()) {
            CREATE -> createFragment(root, args)
            REGISTER -> register(viewFragmentMap[root]!!, args)
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
        variant = when (value) {
            "faceId" -> OwnIdButton.IconVariant.FACE_ID
            else -> OwnIdButton.IconVariant.FINGERPRINT
        }
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
        if (index == 0) backgroundColor = value
        if (index == 1) borderColor = value
        if (index == 2) iconColor = value
        if (index == 3) tooltipBackgroundColor = value
        if (index == 4) tooltipBorderColor = value
    }

    @ReactProp(name = "showOr")
    @Suppress("UNUSED_PARAMETER")
    public fun setShowOr(view: View?, value: Boolean) {
        if (showOr != value) showOr = value
    }

    @ReactProp(name = "tooltipPosition")
    @Suppress("UNUSED_PARAMETER")
    public fun setTooltipPosition(view: View?, value: String?) {
        if (value == null) return
        val valueUppercase = value.uppercase(Locale.ENGLISH)
        tooltipPosition = TooltipPosition.values().firstOrNull { it.name == valueUppercase }
    }

    @ReactProp(name = "loginId")
    public fun setLoginId(view: View?, value: String?) {
        loginId = value
        viewFragmentMap[view]?.loginId = loginId
    }

    private fun createFragment(root: FrameLayout, args: ReadableArray?) {
        val reactNativeViewId = args?.getInt(0) ?: View.NO_ID

        val ownIdFragment = OwnIdFragment(
            instanceName, fragmentType, shadowNode!!,
            variant, backgroundColor, borderColor, iconColor, tooltipBackgroundColor, tooltipBorderColor,
            showOr, tooltipPosition, loginId
        )
        (reactContext.currentActivity as FragmentActivity).supportFragmentManager
            .beginTransaction()
            .replace(reactNativeViewId, ownIdFragment, reactNativeViewId.toString())
            .commit()

        viewFragmentMap[root] = ownIdFragment

        shadowNode = null
        variant = OwnIdButton.IconVariant.FINGERPRINT
        backgroundColor = null
        borderColor = null
        iconColor = null
        tooltipBackgroundColor = null
        tooltipBorderColor = null
        showOr = true
        tooltipPosition = null
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