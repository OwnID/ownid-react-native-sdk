package com.ownid.sdk.reactnative

import android.util.Log
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
import java.util.*

@InternalOwnIdAPI
public abstract class BaseOwnIdFragmentManager(
    private val reactContext: ReactApplicationContext
) : ViewGroupManager<FrameLayout>() {

    private companion object COMMAND {
        private const val CREATE: Int = 1
        private const val REGISTER: Int = 2
    }

    protected abstract var instanceName: InstanceName

    private val viewFragmentMap: WeakHashMap<View, OwnIdFragment> = WeakHashMap()
    private lateinit var fragmentType: OwnIdFragment.Type

    private var backgroundColor: Int? = null
    private var borderColor: Int? = null
    private var biometryIconColor: Int? = null
    private var showOr: Boolean = true
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
            else -> Log.e("OwnIdFragmentManager", "Unknown command: $commandId")
        }
    }

    @ReactProp(name = "instanceName")
    public fun setInstanceName(view: View?, value: String?) {
        if (value != null) instanceName = InstanceName(value)
    }

    @ReactProp(name = "type")
    public fun setType(view: View?, value: String?) {
        if (value != null) fragmentType = OwnIdFragment.Type.valueOf(value.uppercase(Locale.getDefault()))
    }

    @ReactPropGroup(names = ["width", "height"], customType = "Style")
    public fun setStyle(view: View?, index: Int, value: Int) {
        shadowNode?.setSize(index, value * view!!.resources.displayMetrics.density)
    }

    @ReactPropGroup(names = ["buttonBackgroundColor", "buttonBorderColor", "biometryIconColor"], customType = "Color")
    public fun setColor(view: View?, index: Int, value: Int?) {
        if (index == 0) backgroundColor = value
        if (index == 1) borderColor = value
        if (index == 2) biometryIconColor = value
    }

    @ReactProp(name = "showOr")
    public fun setShowOr(view: View?, value: Boolean) {
        if (showOr != value) showOr = value
    }

    @ReactProp(name = "loginId")
    public fun setLoginId(view: View?, value: String?) {
        loginId = value
        viewFragmentMap[view]?.loginId = loginId
    }

    private fun createFragment(root: FrameLayout, args: ReadableArray?) {
        val reactNativeViewId = args?.getInt(0) ?: -1

        val ownIdFragment = OwnIdFragment(
            instanceName, fragmentType, shadowNode!!,
            backgroundColor, borderColor, biometryIconColor, showOr, loginId
        )
        (reactContext.currentActivity as FragmentActivity).supportFragmentManager
            .beginTransaction()
            .replace(reactNativeViewId, ownIdFragment, reactNativeViewId.toString())
            .commit()

        viewFragmentMap[root] = ownIdFragment

        shadowNode = null
        backgroundColor = null
        borderColor = null
        biometryIconColor = null
        showOr = true
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