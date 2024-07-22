package com.ownid.sdk.reactnative

import android.annotation.SuppressLint
import android.content.Context
import android.content.res.ColorStateList
import android.view.ViewGroup
import androidx.annotation.RestrictTo
import androidx.annotation.WorkerThread
import com.ownid.sdk.InternalOwnIdAPI
import com.ownid.sdk.view.OwnIdAuthButton

@SuppressLint("ViewConstructor")
@OptIn(InternalOwnIdAPI::class)
@RestrictTo(RestrictTo.Scope.LIBRARY_GROUP)
public class OwnIdAuthButtonReact(
    context: Context,
    private val properties: OwnIdWidget.Properties,
    private val shadowNode: OwnIdLayoutShadowNode,
) : OwnIdAuthButton(context) {

    private val measureListener = object : OwnIdLayoutShadowNode.MeasureListener {
        @WorkerThread
        override fun onMeasure() {
            post { reMeasureAndLayout() }
        }
    }

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
        shadowNode.registerMeasureListener(measureListener)
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        shadowNode.unregisterMeasureListener(measureListener)
    }

    public override fun onBusy(isBusy: Boolean) {
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
}