package com.ownid.sdk.reactnative.core;

import android.graphics.Bitmap;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;

import com.facebook.react.uimanager.ThemedReactContext;
import com.reactnativecommunity.webview.RNCWebChromeClient;
import com.reactnativecommunity.webview.RNCWebView;

final class PermissionAwareWebView extends RNCWebView {
    private final WebPermissionCoordinator permissionCoordinator;
    private final PermissionChromeClient permissionClient;
    private boolean destroying;

    PermissionAwareWebView(ThemedReactContext context, WebPermissionCoordinator permissionCoordinator) {
        super(context);
        this.permissionCoordinator = permissionCoordinator;
        permissionClient = new PermissionChromeClient(this, permissionCoordinator);
        permissionClient.setHasOnOpenWindowEvent(true);
        super.setWebChromeClient(permissionClient);
    }

    @Override
    public void setWebChromeClient(WebChromeClient client) {
        if (permissionClient == null || client == permissionClient || (destroying && client == null)) {
            super.setWebChromeClient(client);
            return;
        }

        // RNWV recreates its client while applying some props. Keep this instance so an active
        // permission request cannot lose its browser callback.
        super.setWebChromeClient(permissionClient);
    }

    @Override
    public void destroy() {
        if (!destroying) {
            destroying = true;
            permissionCoordinator.cancelOwner(this);
        }
        super.destroy();
    }

    private static final class PermissionChromeClient extends RNCWebChromeClient {
        private final PermissionAwareWebView webView;
        private final WebPermissionCoordinator permissionCoordinator;

        PermissionChromeClient(PermissionAwareWebView webView, WebPermissionCoordinator permissionCoordinator) {
            super(webView);
            this.webView = webView;
            this.permissionCoordinator = permissionCoordinator;
        }

        @Override
        public Bitmap getDefaultVideoPoster() {
            return Bitmap.createBitmap(50, 50, Bitmap.Config.ARGB_8888);
        }

        @Override
        public void onPermissionRequest(PermissionRequest request) {
            for (String resource : request.getResources()) {
                if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) {
                    permissionCoordinator.requestCamera(webView, request);
                    return;
                }
            }

            request.deny();
        }

        @Override
        public void onPermissionRequestCanceled(PermissionRequest request) {
            permissionCoordinator.cancelCamera(webView, request);
        }

        @Override
        public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
            permissionCoordinator.requestLocation(webView, origin, callback);
        }

        @Override
        public void onGeolocationPermissionsHidePrompt() {
            permissionCoordinator.cancelLocation(webView);
        }
    }
}
