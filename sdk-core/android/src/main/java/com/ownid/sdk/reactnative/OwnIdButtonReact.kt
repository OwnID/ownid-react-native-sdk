package com.ownid.sdk.reactnative

import android.annotation.SuppressLint
import android.content.Context
import android.content.res.ColorStateList
import android.view.ViewGroup
import androidx.annotation.RestrictTo
import androidx.annotation.WorkerThread
import com.ownid.sdk.InternalOwnIdAPI
import com.ownid.sdk.view.OwnIdButton
import com.ownid.sdk.view.popup.tooltip.Tooltip

@SuppressLint("ViewConstructor")
@OptIn(InternalOwnIdAPI::class)
@RestrictTo(RestrictTo.Scope.LIBRARY_GROUP)
public class OwnIdButtonReact(
    context: Context,
    private val properties: OwnIdWidget.Properties,
    private val shadowNode: OwnIdLayoutShadowNode,
) : OwnIdButton(context) {

    private val measureListener = object : OwnIdLayoutShadowNode.MeasureListener {
        @WorkerThread
        override fun onMeasure() {
            // post { reMeasureAndLayout() }
            postDelayed({ onMeasureDone() }, 150)
        }
    }

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

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val heightMeasureSpecExactly = MeasureSpec.makeMeasureSpec(MeasureSpec.getSize(heightMeasureSpec), MeasureSpec.EXACTLY)
        super.onMeasure(widthMeasureSpec, heightMeasureSpecExactly)
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        if (isInEditMode) return
        shadowNode.registerMeasureListener(measureListener)
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        shadowNode.unregisterMeasureListener(measureListener)
    }

    override fun onBusy(isBusy: Boolean) {
        super.onBusy(isBusy)
        reMeasureAndLayout(true)
    }

    override fun setStrings() {
        super.setStrings()
        reMeasureAndLayout(true)
    }

    private var currentWidthMeasureSpec: Int? = null
    private var currentHeightMeasureSpec: Int? = null
    private var currentMeasuredWidth: Int? = null
    private var currentMeasuredHeight: Int? = null

    private fun reMeasureAndLayout(forceMeasure: Boolean = false) {
        val proposedWidthMeasureSpec = shadowNode.getProposedWidthMeasureSpec()
        val proposedHeightMeasureSpec = shadowNode.getProposedHeightMeasureSpec()
        if (forceMeasure || currentWidthMeasureSpec != proposedWidthMeasureSpec || currentHeightMeasureSpec != proposedHeightMeasureSpec) {
            currentWidthMeasureSpec = proposedWidthMeasureSpec
            currentHeightMeasureSpec = proposedHeightMeasureSpec
            measure(proposedWidthMeasureSpec, proposedHeightMeasureSpec)
        }

        if (currentMeasuredWidth != measuredWidth || currentMeasuredHeight != measuredHeight) {
            currentMeasuredWidth = measuredWidth
            currentMeasuredHeight = measuredHeight
            shadowNode.updateSize(measuredWidth, measuredHeight)
        }

        layout(0, 0, measuredWidth, measuredHeight)
    }

    private fun onMeasureDone() {
        if (properties.tooltipPosition == null) return
        tooltipProperties = Tooltip.Properties(
            null, properties.tooltipTextColor, properties.tooltipBackgroundColor, properties.tooltipBorderColor, properties.tooltipPosition
        )
        if (ownIdViewModel != null) createTooltip()
    }
}