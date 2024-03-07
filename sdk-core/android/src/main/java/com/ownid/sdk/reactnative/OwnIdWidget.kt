package com.ownid.sdk.reactnative

import androidx.annotation.RestrictTo
import com.ownid.sdk.InternalOwnIdAPI
import com.ownid.sdk.view.OwnIdButton
import com.ownid.sdk.view.popup.Popup

@InternalOwnIdAPI
@RestrictTo(RestrictTo.Scope.LIBRARY_GROUP)
public interface OwnIdWidget {
    @InternalOwnIdAPI
    public enum class Type { OwnIdButton, OwnIdAuthButton }

    @InternalOwnIdAPI
    public data class Properties(
        internal val widgetType: Type = Type.OwnIdButton,
        internal val widgetPosition: OwnIdButton.Position = OwnIdButton.Position.START,
        internal val backgroundColor: Int? = null,
        internal val borderColor: Int? = null,
        internal val textColor: Int? = null,
        internal val iconColor: Int? = null,
        internal val tooltipTextColor: Int? = null,
        internal val tooltipBackgroundColor: Int? = null,
        internal val tooltipBorderColor: Int? = null,
        internal val tooltipPosition: Popup.Position? = null, // None
        internal val showOr: Boolean = true,
        internal val showSpinner: Boolean = true,
        internal val spinnerColor: Int? = null,
        internal val spinnerBackgroundColor: Int? = null
    )
}