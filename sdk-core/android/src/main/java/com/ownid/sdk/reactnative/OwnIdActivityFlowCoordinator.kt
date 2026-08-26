package com.ownid.sdk.reactnative

import android.util.Base64
import androidx.activity.result.ActivityResultRegistry
import androidx.annotation.MainThread
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LiveData
import androidx.lifecycle.Observer
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.createSavedStateHandle
import androidx.lifecycle.viewmodel.CreationExtras
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.ownid.sdk.InternalOwnIdAPI
import com.ownid.sdk.OwnIdInstance
import com.ownid.sdk.event.OwnIdEvent
import com.ownid.sdk.event.OwnIdLoginEvent
import com.ownid.sdk.event.OwnIdLoginFlow
import com.ownid.sdk.event.OwnIdRegisterEvent
import com.ownid.sdk.event.OwnIdRegisterFlow
import com.ownid.sdk.exception.OwnIdException
import com.ownid.sdk.exception.OwnIdFlowCanceled
import com.ownid.sdk.viewmodel.OwnIdBaseViewModel
import com.ownid.sdk.viewmodel.OwnIdLoginViewModel
import com.ownid.sdk.viewmodel.OwnIdRegisterViewModel
import java.lang.ref.WeakReference

@OptIn(InternalOwnIdAPI::class)
internal class OwnIdActivityFlowCoordinator private constructor(
    private val savedStateHandle: SavedStateHandle,
    private val ownIdInstance: OwnIdInstance,
    private val descriptor: Descriptor,
) : ViewModel() {

    internal enum class Renderer(internal val keyPart: String) {
        PAPER("paper"),
        FABRIC("fabric"),
    }

    internal enum class Widget(internal val keyPart: String) {
        BUTTON("button"),
        AUTH_BUTTON("auth_button"),
    }

    internal enum class Flow(internal val keyPart: String) {
        LOGIN("login"),
        REGISTER("register"),
    }

    private data class Descriptor(
        val storeKeyPrefix: String,
        val flow: Flow,
    )

    private data class EventStreams(
        val flow: LiveData<out OwnIdEvent>,
        val integration: LiveData<out OwnIdEvent>,
    )

    private data class SinkObservers(
        val streams: EventStreams,
        val flow: Observer<OwnIdEvent>,
        val integration: Observer<OwnIdEvent>,
    )

    internal class Slot(
        val index: Int,
        val viewModel: OwnIdBaseViewModel,
        var inFlight: Boolean,
        var busy: Boolean,
        var ownerToken: String?,
        var restoredOwner: Boolean,
        var terminalPending: Boolean,
        var continuationPending: Boolean,
        var quarantined: Boolean,
    ) {
        var claimant: Any? = null
        var observerGeneration: Int = 0
        var lastFlowEvent: OwnIdEvent? = null
        var lastIntegrationEvent: OwnIdEvent? = null
        var claimantInterruptionPending: Boolean = false
        // Process-local by design: a slot restored from SavedState must never qualify.
        var configurationRebindEligible: Boolean = false
    }

    internal sealed class ClaimResult {
        internal class Success(internal val claim: Claim) : ClaimResult()
        internal class Failure(internal val error: OwnIdException) : ClaimResult()
    }

    internal class Claim internal constructor(
        private val coordinator: OwnIdActivityFlowCoordinator,
        private val slot: Slot,
        private val claimant: Any,
    ) {
        internal val viewModel: OwnIdBaseViewModel
            get() = slot.viewModel

        internal val isBusy: Boolean
            get() = coordinator.isCurrentClaim(slot, claimant) && slot.busy

        @MainThread
        internal fun observeEvents(
            owner: LifecycleOwner,
            eventEmitter: DeviceEventManagerModule.RCTDeviceEventEmitter,
            ownerToken: String,
            onBusyChanged: (Boolean) -> Unit,
        ) {
            coordinator.observeEvents(slot, claimant, owner, eventEmitter, ownerToken, onBusyChanged)
        }

        @MainThread
        internal fun release(permanently: Boolean = true) {
            coordinator.release(slot, claimant, permanently)
        }

    }

    private val slots: Array<Slot?> = arrayOfNulls(MAX_SIMULTANEOUS_FLOWS_PER_COMPATIBILITY)
    private val sinkObservers: Array<SinkObservers?> = arrayOfNulls(MAX_SIMULTANEOUS_FLOWS_PER_COMPATIBILITY)
    private var currentRegistry: WeakReference<ActivityResultRegistry>? = null

    @MainThread
    private fun claim(activity: FragmentActivity, claimant: Any, ownerToken: String): ClaimResult {
        bindToActivity(activity)
        recycleTerminatedQuarantinedSlots()

        slots.firstOrNull { it?.claimant === claimant }?.let {
            return ClaimResult.Success(Claim(this, it, claimant))
        }

        slots.firstOrNull { slot ->
            slot != null && !slot.quarantined && slot.claimant == null && slot.ownerToken == ownerToken
        }?.let { slot ->
            slot.restoredOwner = false
            slot.claimant = claimant
            slot.configurationRebindEligible = false
            saveSlotState(slot)
            return ClaimResult.Success(Claim(this, slot, claimant))
        }

        val configurationRebindCandidates = slots.filterNotNull().filter { slot ->
            !slot.quarantined &&
                slot.claimant == null &&
                slot.configurationRebindEligible &&
                slot.restoredOwner &&
                slot.ownerToken != ownerToken &&
                slot.isOrphanedFlow()
        }
        if (configurationRebindCandidates.size == 1) {
            return adoptRestoredSlot(configurationRebindCandidates.single(), claimant, ownerToken)
        }

        if (configurationRebindCandidates.isEmpty()) {
            val processRebindCandidates = slots.filterNotNull().filter { slot ->
                !slot.quarantined &&
                    slot.claimant == null &&
                    !slot.configurationRebindEligible &&
                    slot.restoredOwner &&
                    slot.ownerToken != null &&
                    slot.ownerToken != ownerToken &&
                    slot.isOrphanedFlow()
            }
            if (processRebindCandidates.size == 1) {
                return adoptRestoredSlot(processRebindCandidates.single(), claimant, ownerToken)
            }
        }

        var claimantInterruptionPending = configurationRebindCandidates.size > 1
        if (claimantInterruptionPending) {
            configurationRebindCandidates.forEach(::quarantine)
        }

        val incompatibleRestoredSlots = slots.filterNotNull().filter { slot ->
            !slot.quarantined &&
                slot.claimant == null &&
                slot.restoredOwner &&
                slot.ownerToken != ownerToken &&
                slot.isOrphanedFlow()
        }
        if (incompatibleRestoredSlots.isNotEmpty()) {
            incompatibleRestoredSlots.forEach(::quarantine)
            claimantInterruptionPending = true
        }
        if (claimantInterruptionPending) recycleTerminatedQuarantinedSlots()

        val slot = slots.firstOrNull {
            it != null && !it.quarantined && it.claimant == null && !it.isOrphanedFlow()
        }
            ?: slots.indices.firstOrNull { slots[it] == null }?.let { createSlot(activity, it) }
            ?: return ClaimResult.Failure(
                if (claimantInterruptionPending) resultPendingError()
                else OwnIdException("No activity flow slot is available for this OwnID widget"),
            )

        slot.claimant = claimant
        slot.ownerToken = ownerToken
        slot.restoredOwner = false
        slot.claimantInterruptionPending = claimantInterruptionPending
        saveSlotState(slot)
        return ClaimResult.Success(Claim(this, slot, claimant))
    }

    @MainThread
    private fun adoptRestoredSlot(slot: Slot, claimant: Any, ownerToken: String): ClaimResult.Success {
        slot.claimant = claimant
        slot.ownerToken = ownerToken
        slot.restoredOwner = false
        slot.configurationRebindEligible = false
        saveSlotState(slot)
        return ClaimResult.Success(Claim(this, slot, claimant))
    }

    @MainThread
    private fun bindToActivity(activity: FragmentActivity) {
        slots.indices.forEach { index ->
            if (slots[index] == null && savedStateHandle.get<Boolean>(allocatedKey(index)) == true) {
                slots[index] = newSlot(activity, index, restoredOwner = true)
            }
        }

        slots.forEach { slot -> slot?.let(::ensureSinkObserver) }

        val registry = activity.activityResultRegistry
        val previousRegistry = currentRegistry?.get()
        if (previousRegistry === registry) return

        if (previousRegistry != null) {
            slots.filterNotNull()
                .filter { slot -> slot.claimant == null && slot.isOrphanedFlow() }
                .forEach { slot -> slot.restoredOwner = true }
        }

        slots.forEach { slot -> slot?.viewModel?.createResultLauncher(registry) }
        currentRegistry = WeakReference(registry)
    }

    @MainThread
    private fun createSlot(activity: FragmentActivity, index: Int): Slot {
        savedStateHandle[allocatedKey(index)] = true
        return newSlot(activity, index, restoredOwner = false).also { slot ->
            slots[index] = slot
            ensureSinkObserver(slot)
            slot.viewModel.createResultLauncher(activity.activityResultRegistry)
        }
    }

    @MainThread
    private fun newSlot(activity: FragmentActivity, index: Int, restoredOwner: Boolean): Slot {
        val viewModel = when (descriptor.flow) {
            Flow.LOGIN -> ViewModelProvider(
                activity.viewModelStore,
                OwnIdLoginViewModel.Factory(ownIdInstance),
                activity.defaultViewModelCreationExtras,
            ).get(nativeViewModelKey(index), OwnIdLoginViewModel::class.java)

            Flow.REGISTER -> ViewModelProvider(
                activity.viewModelStore,
                OwnIdRegisterViewModel.Factory(ownIdInstance),
                activity.defaultViewModelCreationExtras,
            ).get(nativeViewModelKey(index), OwnIdRegisterViewModel::class.java)
        }

        val restoredInFlight = savedStateHandle[inFlightKey(index)] ?: false
        val restoredBusy = savedStateHandle[busyKey(index)] ?: false
        val nativeBusy = viewModel.isBusy()
        return Slot(
            index = index,
            viewModel = viewModel,
            inFlight = restoredInFlight || nativeBusy,
            busy = restoredBusy || nativeBusy,
            ownerToken = savedStateHandle[ownerTokenKey(index)],
            restoredOwner = restoredOwner,
            terminalPending = savedStateHandle[terminalPendingKey(index)] ?: false,
            continuationPending = savedStateHandle[continuationPendingKey(index)] ?: false,
            quarantined = savedStateHandle[quarantinedKey(index)] ?: false,
        ).also(::saveSlotState)
    }

    @MainThread
    private fun ensureSinkObserver(slot: Slot) {
        if (sinkObservers[slot.index] != null) return
        val streams = slot.viewModel.eventStreams() ?: return
        val flowObserver = Observer<OwnIdEvent> { event ->
            event?.let { sinkEvent(slot, Stream.FLOW, it) }
        }
        val integrationObserver = Observer<OwnIdEvent> { event ->
            event?.let { sinkEvent(slot, Stream.INTEGRATION, it) }
        }
        streams.flow.observeForever(flowObserver)
        streams.integration.observeForever(integrationObserver)
        sinkObservers[slot.index] = SinkObservers(streams, flowObserver, integrationObserver)
    }

    @MainThread
    private fun sinkEvent(slot: Slot, stream: Stream, event: OwnIdEvent) {
        if (slot.quarantined) {
            slot.busy = false
            if (event is OwnIdRegisterEvent.ReadyToRegister) {
                slot.inFlight = true
                slot.continuationPending = true
                slot.terminalPending = false
            } else if (event.isTerminalForRetirement()) {
                slot.setLastDeliveredEvent(stream, event)
                slot.inFlight = false
                slot.continuationPending = false
                slot.terminalPending = true
            }
            saveSlotState(slot)
            return
        }

        updateSlotState(slot, event)
        if (event.isTerminal() && event !== slot.lastDeliveredEvent(stream)) {
            slot.terminalPending = true
            saveSlotState(slot)
        }
    }

    @MainThread
    private fun observeEvents(
        slot: Slot,
        claimant: Any,
        owner: LifecycleOwner,
        eventEmitter: DeviceEventManagerModule.RCTDeviceEventEmitter,
        ownerToken: String,
        onBusyChanged: (Boolean) -> Unit,
    ) {
        if (!isCurrentClaim(slot, claimant) || slot.ownerToken != ownerToken) return
        val observerGeneration = ++slot.observerGeneration
        val streams = slot.viewModel.eventStreams() ?: return
        val flowSnapshot = streams.flow.value
        val integrationSnapshot = streams.integration.value
        emitClaimantInterruptionIfNeeded(
            slot,
            claimant,
            observerGeneration,
            eventEmitter,
            ownerToken,
            onBusyChanged,
        )
        emitPendingInterruptionIfNeeded(
            slot,
            claimant,
            observerGeneration,
            flowSnapshot,
            integrationSnapshot,
            eventEmitter,
            ownerToken,
            onBusyChanged,
        )
        emitRestoredBusyIfNeeded(
            slot,
            claimant,
            observerGeneration,
            flowSnapshot,
            integrationSnapshot,
            eventEmitter,
            ownerToken,
        )
        observeStream(
            slot,
            claimant,
            observerGeneration,
            owner,
            streams.flow,
            flowSnapshot,
            Stream.FLOW,
            eventEmitter,
            ownerToken,
            onBusyChanged,
        )
        observeStream(
            slot,
            claimant,
            observerGeneration,
            owner,
            streams.integration,
            integrationSnapshot,
            Stream.INTEGRATION,
            eventEmitter,
            ownerToken,
            onBusyChanged,
        )
    }

    @MainThread
    private fun emitClaimantInterruptionIfNeeded(
        slot: Slot,
        claimant: Any,
        observerGeneration: Int,
        eventEmitter: DeviceEventManagerModule.RCTDeviceEventEmitter,
        ownerToken: String,
        onBusyChanged: (Boolean) -> Unit,
    ) {
        if (!slot.claimantInterruptionPending ||
            !isCurrentObserver(slot, claimant, observerGeneration)
        ) return

        slot.claimantInterruptionPending = false
        onBusyChanged(false)
        resultPendingEvent().emitToReact(eventEmitter, ownerToken)
    }

    @MainThread
    private fun observeStream(
        slot: Slot,
        claimant: Any,
        observerGeneration: Int,
        owner: LifecycleOwner,
        events: LiveData<out OwnIdEvent>,
        snapshot: OwnIdEvent?,
        stream: Stream,
        eventEmitter: DeviceEventManagerModule.RCTDeviceEventEmitter,
        ownerToken: String,
        onBusyChanged: (Boolean) -> Unit,
    ) {
        var suppressInitialReplay = snapshot != null &&
            snapshot.isTerminal() &&
            snapshot === slot.lastDeliveredEvent(stream)

        events.observe(owner) { event ->
            if (!isCurrentObserver(slot, claimant, observerGeneration)) return@observe

            val shouldSuppress = suppressInitialReplay && event === snapshot && event.isTerminal()
            suppressInitialReplay = false
            updateSlotState(slot, event)
            when (event) {
                is OwnIdLoginFlow.Busy -> onBusyChanged(event.isBusy)
                is OwnIdLoginEvent.Busy -> onBusyChanged(event.isBusy)
                is OwnIdRegisterFlow.Busy -> onBusyChanged(event.isBusy)
                is OwnIdRegisterEvent.Busy -> onBusyChanged(event.isBusy)
                else -> if (event.isTerminal()) onBusyChanged(false)
            }
            if (shouldSuppress) return@observe

            event.emitToReact(eventEmitter, ownerToken)
            slot.setLastDeliveredEvent(stream, event)
            if (event.isTerminal()) acknowledgeTerminal(slot)
        }
    }

    @MainThread
    private fun emitPendingInterruptionIfNeeded(
        slot: Slot,
        claimant: Any,
        observerGeneration: Int,
        flowSnapshot: OwnIdEvent?,
        integrationSnapshot: OwnIdEvent?,
        eventEmitter: DeviceEventManagerModule.RCTDeviceEventEmitter,
        ownerToken: String,
        onBusyChanged: (Boolean) -> Unit,
    ) {
        if ((!slot.terminalPending && !slot.continuationPending) ||
            !isCurrentObserver(slot, claimant, observerGeneration)
        ) return

        if (slot.continuationPending) {
            val hasNativeContinuation = (slot.viewModel as? OwnIdRegisterViewModel)?.isReadyToRegister == true
            if (hasNativeContinuation) return
        } else if (flowSnapshot?.isTerminal() == true || integrationSnapshot?.isTerminal() == true) {
            return
        }

        val event = resultPendingEvent()
        onBusyChanged(false)
        event.emitToReact(eventEmitter, ownerToken)
        slot.inFlight = false
        slot.busy = false
        slot.continuationPending = false
        acknowledgeTerminal(slot)
    }

    private fun resultPendingError(): OwnIdFlowCanceled =
        OwnIdFlowCanceled(OwnIdFlowCanceled.RESULT_PENDING)

    private fun resultPendingEvent(): OwnIdEvent {
        val interruption = resultPendingError()
        return when (descriptor.flow) {
            Flow.LOGIN -> if (ownIdInstance.ownIdIntegration == null) {
                OwnIdLoginFlow.Error(interruption)
            } else {
                OwnIdLoginEvent.Error(interruption)
            }

            Flow.REGISTER -> if (ownIdInstance.ownIdIntegration == null) {
                OwnIdRegisterFlow.Error(interruption)
            } else {
                OwnIdRegisterEvent.Error(interruption)
            }
        }
    }

    @MainThread
    private fun emitRestoredBusyIfNeeded(
        slot: Slot,
        claimant: Any,
        observerGeneration: Int,
        flowSnapshot: OwnIdEvent?,
        integrationSnapshot: OwnIdEvent?,
        eventEmitter: DeviceEventManagerModule.RCTDeviceEventEmitter,
        ownerToken: String,
    ) {
        if (!slot.inFlight || !slot.busy || !isCurrentObserver(slot, claimant, observerGeneration)) return

        if (slot.viewModel.isBusy()) return

        val currentEvent = if (ownIdInstance.ownIdIntegration == null) flowSnapshot else integrationSnapshot
        if (currentEvent != null) return

        val event: OwnIdEvent = when (descriptor.flow) {
            Flow.LOGIN -> if (ownIdInstance.ownIdIntegration == null) OwnIdLoginFlow.Busy(true) else OwnIdLoginEvent.Busy(true)
            Flow.REGISTER -> if (ownIdInstance.ownIdIntegration == null) OwnIdRegisterFlow.Busy(true) else OwnIdRegisterEvent.Busy(true)
        }
        event.emitToReact(eventEmitter, ownerToken)
        slot.setLastDeliveredEvent(if (ownIdInstance.ownIdIntegration == null) Stream.FLOW else Stream.INTEGRATION, event)
    }

    private fun updateSlotState(slot: Slot, event: OwnIdEvent) {
        when (event) {
            is OwnIdLoginFlow.Busy -> updateBusyState(slot, event.isBusy)
            is OwnIdLoginEvent.Busy -> updateBusyState(slot, event.isBusy)
            is OwnIdRegisterFlow.Busy -> updateBusyState(slot, event.isBusy)
            is OwnIdRegisterEvent.Busy -> updateBusyState(slot, event.isBusy)
            is OwnIdRegisterEvent.ReadyToRegister -> {
                slot.inFlight = true
                slot.busy = false
                slot.continuationPending = true
            }
            else -> {
                slot.inFlight = false
                slot.busy = false
                slot.continuationPending = false
            }
        }
        saveSlotState(slot)
    }

    private fun updateBusyState(slot: Slot, busy: Boolean) {
        slot.busy = busy
        if (busy) slot.inFlight = true
    }

    private fun saveSlotState(slot: Slot) {
        savedStateHandle[inFlightKey(slot.index)] = slot.inFlight
        savedStateHandle[busyKey(slot.index)] = slot.busy
        savedStateHandle[terminalPendingKey(slot.index)] = slot.terminalPending
        savedStateHandle[continuationPendingKey(slot.index)] = slot.continuationPending
        savedStateHandle[quarantinedKey(slot.index)] = slot.quarantined
        slot.ownerToken?.let { savedStateHandle[ownerTokenKey(slot.index)] = it }
            ?: savedStateHandle.remove<String>(ownerTokenKey(slot.index))
    }

    private fun Slot.hasUndeliveredTerminal(): Boolean {
        if (terminalPending) return true
        val streams = viewModel.eventStreams() ?: return false
        return streams.flow.value.isUndeliveredTerminal(lastFlowEvent) ||
            streams.integration.value.isUndeliveredTerminal(lastIntegrationEvent)
    }

    private fun OwnIdBaseViewModel.eventStreams(): EventStreams? = when (this) {
        is OwnIdLoginViewModel -> EventStreams(flowEvents, integrationEvents)
        is OwnIdRegisterViewModel -> EventStreams(flowEvents, integrationEvents)
        else -> null
    }

    private fun OwnIdBaseViewModel.isBusy(): Boolean = when (this) {
        is OwnIdLoginViewModel -> busyFlow.value
        is OwnIdRegisterViewModel -> busyFlow.value
        else -> false
    }

    private fun OwnIdEvent?.isUndeliveredTerminal(lastDelivered: OwnIdEvent?): Boolean =
        this != null && isTerminal() && this !== lastDelivered

    private fun OwnIdEvent.isTerminal(): Boolean = when (this) {
        is OwnIdLoginFlow.Busy,
        is OwnIdLoginEvent.Busy,
        is OwnIdRegisterFlow.Busy,
        is OwnIdRegisterEvent.Busy -> false
        else -> true
    }

    private fun Slot.lastDeliveredEvent(stream: Stream): OwnIdEvent? = when (stream) {
        Stream.FLOW -> lastFlowEvent
        Stream.INTEGRATION -> lastIntegrationEvent
    }

    private fun Slot.setLastDeliveredEvent(stream: Stream, event: OwnIdEvent) {
        when (stream) {
            Stream.FLOW -> lastFlowEvent = event
            Stream.INTEGRATION -> lastIntegrationEvent = event
        }
    }

    private fun acknowledgeTerminal(slot: Slot) {
        slot.terminalPending = false
        slot.restoredOwner = false
        saveSlotState(slot)
    }

    private fun Slot.isOrphanedFlow(): Boolean = inFlight || continuationPending || hasUndeliveredTerminal()

    @MainThread
    private fun quarantine(slot: Slot) {
        slot.observerGeneration++
        slot.claimant = null
        slot.ownerToken = null
        slot.restoredOwner = false
        slot.busy = false
        slot.quarantined = true
        slot.configurationRebindEligible = false
        saveSlotState(slot)

        if (slot.hasTerminalSnapshotForRetirement()) {
            val streams = slot.viewModel.eventStreams()
            streams?.flow?.value?.takeIf { it.isTerminalForRetirement() }?.let { slot.lastFlowEvent = it }
            streams?.integration?.value?.takeIf { it.isTerminalForRetirement() }?.let { slot.lastIntegrationEvent = it }
            slot.inFlight = false
            slot.continuationPending = false
            slot.terminalPending = true
            saveSlotState(slot)
        }
    }

    private fun Slot.hasTerminalSnapshotForRetirement(): Boolean {
        val streams = viewModel.eventStreams() ?: return false
        return streams.flow.value?.isTerminalForRetirement() == true ||
            streams.integration.value?.isTerminalForRetirement() == true
    }

    private fun OwnIdEvent.isTerminalForRetirement(): Boolean =
        isTerminal() && this !is OwnIdRegisterEvent.ReadyToRegister

    @MainThread
    private fun recycleTerminatedQuarantinedSlots() {
        slots.filterNotNull()
            .filter { it.quarantined && it.terminalPending && it.hasTerminalSnapshotForRetirement() }
            .forEach(::retireQuarantined)
    }

    @MainThread
    private fun retireQuarantined(slot: Slot) {
        if (!slot.quarantined) return
        val streams = slot.viewModel.eventStreams()
        streams?.flow?.value?.takeIf { it.isTerminalForRetirement() }?.let { slot.lastFlowEvent = it }
        streams?.integration?.value?.takeIf { it.isTerminalForRetirement() }?.let { slot.lastIntegrationEvent = it }
        slot.inFlight = false
        slot.busy = false
        slot.ownerToken = null
        slot.restoredOwner = false
        slot.terminalPending = false
        slot.continuationPending = false
        slot.quarantined = false
        slot.configurationRebindEligible = false
        saveSlotState(slot)
    }

    private fun isCurrentClaim(slot: Slot, claimant: Any): Boolean =
        slots[slot.index] === slot && slot.claimant === claimant

    private fun isCurrentObserver(slot: Slot, claimant: Any, observerGeneration: Int): Boolean =
        isCurrentClaim(slot, claimant) && slot.observerGeneration == observerGeneration

    @MainThread
    private fun release(slot: Slot, claimant: Any, permanently: Boolean) {
        if (isCurrentClaim(slot, claimant)) {
            slot.observerGeneration++
            slot.claimant = null
            if (permanently) {
                if (slot.isOrphanedFlow()) quarantine(slot) else retireQuiescent(slot)
            } else {
                slot.configurationRebindEligible = slot.isOrphanedFlow()
            }
        }
    }

    @MainThread
    private fun retireQuiescent(slot: Slot) {
        slot.ownerToken = null
        slot.restoredOwner = false
        slot.claimantInterruptionPending = false
        slot.configurationRebindEligible = false
        saveSlotState(slot)
    }

    private fun allocatedKey(index: Int): String = "$SAVED_ALLOCATED_PREFIX$index"

    private fun inFlightKey(index: Int): String = "$SAVED_IN_FLIGHT_PREFIX$index"

    private fun busyKey(index: Int): String = "$SAVED_BUSY_PREFIX$index"

    private fun ownerTokenKey(index: Int): String = "$SAVED_OWNER_TOKEN_PREFIX$index"

    private fun terminalPendingKey(index: Int): String = "$SAVED_TERMINAL_PENDING_PREFIX$index"

    private fun continuationPendingKey(index: Int): String = "$SAVED_CONTINUATION_PENDING_PREFIX$index"

    private fun quarantinedKey(index: Int): String = "$SAVED_QUARANTINED_PREFIX$index"

    private fun nativeViewModelKey(index: Int): String = "${descriptor.storeKeyPrefix}|$NATIVE_SLOT_PART$index"

    private enum class Stream { FLOW, INTEGRATION }

    override fun onCleared() {
        sinkObservers.filterNotNull().forEach { observers ->
            observers.streams.flow.removeObserver(observers.flow)
            observers.streams.integration.removeObserver(observers.integration)
        }
        sinkObservers.fill(null)
        super.onCleared()
    }

    internal companion object {
        private const val MAX_SIMULTANEOUS_FLOWS_PER_COMPATIBILITY: Int = 8
        private const val STORE_KEY_PREFIX: String = "com.ownid.sdk.reactnative.activity_flow.v1"
        private const val COORDINATOR_PART: String = "coordinator"
        private const val NATIVE_SLOT_PART: String = "native_slot:"
        private const val SAVED_ALLOCATED_PREFIX: String = "allocated_slot:"
        private const val SAVED_IN_FLIGHT_PREFIX: String = "in_flight_slot:"
        private const val SAVED_BUSY_PREFIX: String = "busy_slot:"
        private const val SAVED_OWNER_TOKEN_PREFIX: String = "owner_token_slot:"
        private const val SAVED_TERMINAL_PENDING_PREFIX: String = "terminal_pending_slot:"
        private const val SAVED_CONTINUATION_PENDING_PREFIX: String = "continuation_pending_slot:"
        private const val SAVED_QUARANTINED_PREFIX: String = "quarantined_slot:"

        @MainThread
        internal fun claim(
            activity: FragmentActivity,
            ownIdInstance: OwnIdInstance,
            renderer: Renderer,
            widget: Widget,
            flow: Flow,
            claimant: Any,
            ownerToken: String,
        ): ClaimResult {
            val instanceName = Base64.encodeToString(
                ownIdInstance.ownIdCore.instanceName.toString().toByteArray(Charsets.UTF_8),
                Base64.NO_PADDING or Base64.NO_WRAP or Base64.URL_SAFE,
            )
            val storeKeyPrefix = buildString {
                append(STORE_KEY_PREFIX)
                append("|instance:")
                append(instanceName)
                append("|renderer:")
                append(renderer.keyPart)
                append("|widget:")
                append(widget.keyPart)
                append("|flow:")
                append(flow.keyPart)
            }
            val descriptor = Descriptor(storeKeyPrefix, flow)
            val factory = Factory(ownIdInstance, descriptor)
            val coordinator = ViewModelProvider(
                activity.viewModelStore,
                factory,
                activity.defaultViewModelCreationExtras,
            ).get("$storeKeyPrefix|$COORDINATOR_PART", OwnIdActivityFlowCoordinator::class.java)
            return coordinator.claim(activity, claimant, ownerToken)
        }
    }

    private class Factory(
        private val ownIdInstance: OwnIdInstance,
        private val descriptor: Descriptor,
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>, extras: CreationExtras): T =
            OwnIdActivityFlowCoordinator(extras.createSavedStateHandle(), ownIdInstance, descriptor) as T

        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T =
            OwnIdActivityFlowCoordinator(SavedStateHandle(), ownIdInstance, descriptor) as T
    }
}
