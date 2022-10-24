package com.ownid.sdk.reactnative

import android.annotation.SuppressLint
import android.content.Context
import android.content.res.ColorStateList
import android.view.View
import com.ownid.sdk.InternalOwnIdAPI
import com.ownid.sdk.view.OwnIdButton
import com.ownid.sdk.view.tooltip.TooltipPosition

@SuppressLint("ViewConstructor")
@androidx.annotation.OptIn(InternalOwnIdAPI::class)
public class OwnIdButtonReact(
    context: Context,
    variant: IconVariant,
    backgroundColor: Int? = null,
    borderColor: Int? = null,
    iconColor: Int? = null,
    showOr: Boolean = true,
    tooltipBackgroundColor: Int? = null,
    tooltipBorderColor: Int? = null,
    private val tooltipPositionReact: TooltipPosition? = null,
    private val shadowNode: OwnIdLayoutShadowNode,
) : OwnIdButton(context) {

    private val measureListener = object : OwnIdLayoutShadowNode.MeasureListener {
        override fun onMeasure() {
            postDelayed({ onMeasureDone() }, 250)
        }
    }

    init {
        bOwnId.setIconVariant(variant)

        tvOr.visibility = if (showOr) View.VISIBLE else View.GONE

        if (backgroundColor != null || borderColor != null || iconColor != null)
            bOwnId.setColors(
                backgroundColor?.let { ColorStateList.valueOf(it) },
                borderColor?.let { ColorStateList.valueOf(it) },
                iconColor?.let { ColorStateList.valueOf(it) }
            )

        tooltipBackgroundColor?.let { this.tooltipBackgroundColor = it }
        tooltipBorderColor?.let { this.tooltipBorderColor = it }
        tooltipPosition = null
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        if (isInEditMode) return
        shadowNode.registerStringsSetListener(measureListener)
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        shadowNode.unregisterStringsSetListener(measureListener)
    }

    override fun setStrings() {
        super.setStrings()

        measure(shadowNode.getProposedWidthMeasureSpec(), shadowNode.getProposedHeightMeasureSpec())
        layout(0, 0, measuredWidth, measuredHeight)
        shadowNode.updateSize(measuredWidth, measuredHeight)
    }

    private fun onMeasureDone() {
        if (tooltipPositionReact == null) return
        tooltipPosition = tooltipPositionReact
        createTooltip()
    }
}