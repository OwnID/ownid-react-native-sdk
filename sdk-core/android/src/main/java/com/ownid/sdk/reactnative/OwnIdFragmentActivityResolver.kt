package com.ownid.sdk.reactnative

import android.content.Context
import android.content.ContextWrapper
import android.view.View
import androidx.fragment.app.FragmentActivity
import java.util.Collections
import java.util.IdentityHashMap

internal object OwnIdFragmentActivityResolver {

    fun from(view: View): FragmentActivity? {
        val visited = Collections.newSetFromMap(IdentityHashMap<Context, Boolean>())
        var context: Context? = view.context
        while (context != null && visited.add(context)) {
            if (context is FragmentActivity) return context
            context = (context as? ContextWrapper)?.baseContext
        }
        return null
    }

    fun isReachableFrom(view: View, activity: FragmentActivity): Boolean =
        view.isAttachedToWindow && activity.findViewById<View>(view.id) === view
}
