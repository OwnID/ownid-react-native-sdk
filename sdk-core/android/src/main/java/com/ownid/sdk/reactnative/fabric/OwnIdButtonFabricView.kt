package com.ownid.sdk.reactnative.fabric

import android.annotation.SuppressLint
import android.content.Context
import android.content.res.ColorStateList
import android.view.ViewGroup
import androidx.annotation.RestrictTo
import com.facebook.react.uimanager.PixelUtil
import com.ownid.sdk.InternalOwnIdAPI
import com.ownid.sdk.reactnative.OwnIdWidget
import com.ownid.sdk.view.OwnIdButton
import com.ownid.sdk.view.popup.tooltip.Tooltip
import kotlin.math.roundToInt

@SuppressLint("ViewConstructor")
@OptIn(InternalOwnIdAPI::class)
@RestrictTo(RestrictTo.Scope.LIBRARY_GROUP)
internal class OwnIdButtonFabricView(
    context: Context,
    private val properties: OwnIdWidget.Properties,
    private val onMeasured: (width: Int, height: Int) -> Unit,
) : OwnIdButton(context) {

    init {
        layoutParams = LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.MATCH_PARENT)

        position = properties.widgetPosition
        showOr = properties.showOr
        showSpinner = properties.showSpinner

        setColors(
            properties.textColor?.let { ColorStateList.valueOf(it) },
            properties.backgroundColor?.let { ColorStateList.valueOf(it) },
            properties.borderColor?.let { ColorStateList.valueOf(it) },
            properties.iconColor?.let { ColorStateList.valueOf(it) },
            properties.spinnerColor,
            properties.spinnerBackgroundColor
        )

        tooltipProperties = Tooltip.Properties(
            null, properties.tooltipTextColor, properties.tooltipBackgroundColor, properties.tooltipBorderColor, null
        )
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        if (isInEditMode) return
        post { reMeasureAndLayout() }
    }

    override fun onBusy(isBusy: Boolean) {
        super.onBusy(isBusy)
        post { reMeasureAndLayout() }
    }

    override fun setStrings() {
        super.setStrings()
        post { reMeasureAndLayout() }
    }

    private fun reMeasureAndLayout() {
        val widthSpec = MeasureSpec.makeMeasureSpec(0, MeasureSpec.UNSPECIFIED)
        val parentHeight = (parent as? ViewGroup)?.height ?: PixelUtil.toPixelFromDIP(48.0).roundToInt()
        val heightSpec = MeasureSpec.makeMeasureSpec(parentHeight, MeasureSpec.EXACTLY)
        measure(widthSpec, heightSpec)
        layout(0, 0, measuredWidth, measuredHeight)
        onMeasured.invoke(measuredWidth, measuredHeight)
    }
}
