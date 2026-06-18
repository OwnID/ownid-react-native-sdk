package com.ownid.sdk.reactnative.fabric

import android.annotation.SuppressLint
import android.content.Context
import android.content.res.ColorStateList
import android.view.ViewGroup
import androidx.annotation.RestrictTo
import com.facebook.react.uimanager.PixelUtil
import com.ownid.sdk.InternalOwnIdAPI
import com.ownid.sdk.reactnative.OwnIdWidget
import com.ownid.sdk.view.OwnIdAuthButton
import kotlin.math.roundToInt

@SuppressLint("ViewConstructor")
@OptIn(InternalOwnIdAPI::class)
@RestrictTo(RestrictTo.Scope.LIBRARY_GROUP)
internal class OwnIdAuthButtonFabricView(
    context: Context,
    private val properties: OwnIdWidget.Properties,
    private val onMeasured: (width: Int, height: Int) -> Unit,
) : OwnIdAuthButton(context) {

    init {
        layoutParams = LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        setColors(
            properties.textColor?.let { ColorStateList.valueOf(it) },
            properties.backgroundColor?.let { ColorStateList.valueOf(it) },
            properties.spinnerColor,
            properties.spinnerBackgroundColor
        )
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        if (isInEditMode) return
        post { measureAndReport() }
    }

    override fun onBusy(isBusy: Boolean) {
        super.onBusy(isBusy)
        post { measureAndReport() }
    }

    override fun setStrings() {
        super.setStrings()
        post { measureAndReport() }
    }

    private fun measureAndReport() {
        val parentWidth = (parent as? ViewGroup)?.width ?: 0
        val widthSpec = if (parentWidth > 0)
            MeasureSpec.makeMeasureSpec(parentWidth, MeasureSpec.EXACTLY)
        else
            MeasureSpec.makeMeasureSpec(0, MeasureSpec.UNSPECIFIED)
        val parentHeight = (parent as? ViewGroup)?.height ?: PixelUtil.toPixelFromDIP(48.0).roundToInt()
        val heightSpec = MeasureSpec.makeMeasureSpec(parentHeight, MeasureSpec.EXACTLY)
        measure(widthSpec, heightSpec)
        layout(0, 0, measuredWidth, measuredHeight)
        onMeasured.invoke(measuredWidth, measuredHeight)
    }
}
