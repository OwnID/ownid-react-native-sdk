package com.ownid.sdk.reactnative.fabric

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.events.Event

internal class ContentSizeChangeEvent(surfaceId: Int, viewTag: Int, private val width: Int, private val height: Int) :
    Event<ContentSizeChangeEvent>(surfaceId, viewTag) {

    companion object {
        const val EVENT_NAME = "topContentSizeChange"
    }

    override fun getEventName(): String = EVENT_NAME

    override fun canCoalesce(): Boolean = false

    override fun getCoalescingKey(): Short = 0

    override fun getEventData(): WritableMap = Arguments.createMap().apply {
        putInt("width", width)
        putInt("height", height)
    }
}
