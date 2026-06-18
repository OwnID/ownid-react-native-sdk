package com.ownid.sdk.reactnative.fabric

import androidx.collection.SparseArrayCompat
import java.util.concurrent.locks.ReentrantReadWriteLock
import kotlin.concurrent.read
import kotlin.concurrent.write

public object FabricFragmentRegistry {
    private val map = SparseArrayCompat<OwnIdFragmentFabric>()
    private val lock = ReentrantReadWriteLock()

    public fun put(viewTag: Int, fragment: OwnIdFragmentFabric): Unit = lock.write { map.put(viewTag, fragment) }
    public fun get(viewTag: Int): OwnIdFragmentFabric? = lock.read { map.get(viewTag) }
    public fun remove(viewTag: Int): Unit = lock.write { map.remove(viewTag) }
}
