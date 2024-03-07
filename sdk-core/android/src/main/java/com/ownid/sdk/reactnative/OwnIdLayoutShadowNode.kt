package com.ownid.sdk.reactnative

import android.view.View
import androidx.annotation.WorkerThread
import com.facebook.react.uimanager.LayoutShadowNode
import com.facebook.yoga.YogaMeasureFunction
import com.facebook.yoga.YogaMeasureMode
import com.facebook.yoga.YogaMeasureOutput
import com.facebook.yoga.YogaNode
import java.util.*

public class OwnIdLayoutShadowNode : LayoutShadowNode(), YogaMeasureFunction {
    private var requestedWidth: Float = 0f
    private var requestedWidthMode: YogaMeasureMode = YogaMeasureMode.UNDEFINED
    private var requestedHeight: Float = 0f
    private var requestedHeightMode: YogaMeasureMode = YogaMeasureMode.UNDEFINED

    private var measuredWidth: Int = 0
    private var measuredHeight: Int = 0

    internal interface MeasureListener {
        @WorkerThread
        public fun onMeasure() // Don't forget to call updateSize() after native view measurements
    }

    private val measureListenerSet = Collections.synchronizedSet(mutableSetOf<MeasureListener>())

    internal fun registerMeasureListener(listener: MeasureListener) {
        measureListenerSet.add(listener)
    }

    internal fun unregisterMeasureListener(listener: MeasureListener) {
        measureListenerSet.remove(listener)
    }

    init {
        setMeasureFunction(this)
    }

    override fun measure(node: YogaNode, width: Float, widthMode: YogaMeasureMode, height: Float, heightMode: YogaMeasureMode): Long {
        requestedWidth = width
        requestedWidthMode = widthMode
        requestedHeight = height
        requestedHeightMode = heightMode

        measureListenerSet.forEach { listener -> listener.onMeasure() }

        return YogaMeasureOutput.make(measuredWidth, measuredHeight)
    }

    internal fun setSize(index: Int, value: Float) {
        if (index == 0) {
            requestedWidth = value
            requestedWidthMode = YogaMeasureMode.EXACTLY
        }
        if (index == 1) {
            requestedHeight = value
            requestedHeightMode = YogaMeasureMode.EXACTLY
        }
    }

    internal fun updateSize(width: Int, height: Int) {
        measuredWidth = width
        measuredHeight = height
        dirty()
    }

    internal fun getProposedWidthMeasureSpec(): Int = when (requestedWidthMode) {
        YogaMeasureMode.UNDEFINED ->
            View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED)
        YogaMeasureMode.EXACTLY ->
            View.MeasureSpec.makeMeasureSpec(requestedWidth.toInt(), View.MeasureSpec.EXACTLY)
        YogaMeasureMode.AT_MOST ->
            View.MeasureSpec.makeMeasureSpec(requestedWidth.toInt(), View.MeasureSpec.AT_MOST)
    }

    internal fun getProposedHeightMeasureSpec(): Int = when (requestedHeightMode) {
        YogaMeasureMode.UNDEFINED ->
            View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED)
        YogaMeasureMode.EXACTLY ->
            View.MeasureSpec.makeMeasureSpec(requestedHeight.toInt(), View.MeasureSpec.EXACTLY)
        YogaMeasureMode.AT_MOST ->
            View.MeasureSpec.makeMeasureSpec(requestedHeight.toInt(), View.MeasureSpec.AT_MOST)
    }
}