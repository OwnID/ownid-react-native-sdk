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
    private val properties: Properties,
    private val shadowNode: OwnIdLayoutShadowNode,
) : OwnIdButton(context) {

    @InternalOwnIdAPI
    public data class Properties(
        internal val variant: IconVariant = IconVariant.FINGERPRINT,
        internal val widgetPosition: Position = Position.START,
        internal val backgroundColor: Int? = null,
        internal val borderColor: Int? = null,
        internal val iconColor: Int? = null,
        internal val tooltipBackgroundColor: Int? = null,
        internal val tooltipBorderColor: Int? = null,
        internal val tooltipPosition: TooltipPosition? = null, // None
        internal val showOr: Boolean = true
    )

    private val measureListener = object : OwnIdLayoutShadowNode.MeasureListener {
        override fun onMeasure() {
            postDelayed({ onMeasureDone() }, 250)
        }
    }

    init {
        position = properties.widgetPosition

        bOwnId.setIconVariant(properties.variant)

        tvOr.visibility = if (properties.showOr) View.VISIBLE else View.GONE

        if (properties.backgroundColor != null || properties.borderColor != null || properties.iconColor != null)
            bOwnId.setColors(
                properties.backgroundColor?.let { ColorStateList.valueOf(it) },
                properties.borderColor?.let { ColorStateList.valueOf(it) },
                properties.iconColor?.let { ColorStateList.valueOf(it) }
            )

        properties.tooltipBackgroundColor?.let { this.tooltipBackgroundColor = it }
        properties.tooltipBorderColor?.let { this.tooltipBorderColor = it }
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
        if (properties.tooltipPosition == null) return
        tooltipPosition = properties.tooltipPosition
        createTooltip()
    }
}