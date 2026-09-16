package com.ownid.sdk.reactnative.core;

import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewFeature;

import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.uimanager.ThemedReactContext;
import com.reactnativecommunity.webview.RNCWebView;
import com.reactnativecommunity.webview.RNCWebViewManager;
import com.reactnativecommunity.webview.RNCWebViewWrapper;

@ReactModule(name = WebAuthenticationWebViewManager.NAME)
final class WebAuthenticationWebViewManager extends RNCWebViewManager {
    static final String NAME = "OwnIDWebAuthenticationWebView";

    private final WebPermissionCoordinator permissionCoordinator = new WebPermissionCoordinator();

    @Override
    public String getName() {
        return NAME;
    }

    @Override
    protected RNCWebView createRNCWebViewInstance(ThemedReactContext context) {
        return new PermissionAwareWebView(context, permissionCoordinator);
    }

    @Override
    protected RNCWebViewWrapper createViewInstance(ThemedReactContext context) {
        RNCWebViewWrapper wrapper = super.createViewInstance(context);

        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_AUTHENTICATION)) {
            WebSettingsCompat.setWebAuthenticationSupport(
                    wrapper.getWebView().getSettings(),
                    WebSettingsCompat.WEB_AUTHENTICATION_SUPPORT_FOR_APP);
        }

        return wrapper;
    }
}
