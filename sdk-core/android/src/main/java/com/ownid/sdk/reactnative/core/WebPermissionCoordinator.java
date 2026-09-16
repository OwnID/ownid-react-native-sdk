package com.ownid.sdk.reactnative.core;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;

import androidx.annotation.Nullable;

import com.facebook.react.modules.core.PermissionAwareActivity;
import com.facebook.react.modules.core.PermissionListener;
import com.reactnativecommunity.webview.RNCWebView;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Iterator;
import java.util.function.Predicate;

final class WebPermissionCoordinator {
    private static final int FIRST_REQUEST_CODE = 0x4F00;
    private static final int LAST_REQUEST_CODE = 0x4FFF;

    private final Deque<Operation> pending = new ArrayDeque<>();
    private final PermissionListener permissionListener = this::onRequestPermissionsResult;

    @Nullable private Operation active;
    @Nullable private Activity activeActivity;
    private int activeRequestCode;
    private int nextRequestCode = FIRST_REQUEST_CODE;
    private boolean draining;

    void requestCamera(RNCWebView owner, PermissionRequest request) {
        enqueue(new CameraOperation(owner, request));
    }

    void cancelCamera(RNCWebView owner, PermissionRequest request) {
        cancelMatching(operation -> operation.isCameraRequest(owner, request));
    }

    void requestLocation(RNCWebView owner, String origin, GeolocationPermissions.Callback callback) {
        cancelLocation(owner);
        enqueue(new LocationOperation(owner, origin, callback));
    }

    void cancelLocation(RNCWebView owner) {
        cancelMatching(operation -> operation.isLocationRequest(owner));
    }

    void cancelOwner(RNCWebView owner) {
        cancelMatching(operation -> operation.owner == owner);
    }

    private void enqueue(Operation operation) {
        discardRequestFromDestroyedActivity();
        if (operation.isGranted()) {
            operation.respond(true);
            drain();
            return;
        }

        pending.addLast(operation);
        drain();
    }

    private void cancelMatching(Predicate<Operation> matcher) {
        for (Iterator<Operation> iterator = pending.iterator(); iterator.hasNext(); ) {
            Operation operation = iterator.next();
            if (matcher.test(operation)) {
                iterator.remove();
            }
        }

        if (active != null && matcher.test(active)) {
            // The system dialog cannot be dismissed. Keep its slot occupied until Android returns.
            active.cancel();
        }

        discardRequestFromDestroyedActivity();
        drain();
    }

    private void drain() {
        if (draining) return;
        draining = true;

        try {
            discardRequestFromDestroyedActivity();
            while (active == null && !pending.isEmpty()) {
                Operation operation = pending.removeFirst();
                if (operation.isGranted()) {
                    operation.respond(true);
                    continue;
                }

                Activity activity = operation.owner.getThemedReactContext().getCurrentActivity();
                if (!(activity instanceof PermissionAwareActivity) || activity.isDestroyed()) {
                    operation.respond(false);
                    continue;
                }

                active = operation;
                activeActivity = activity;
                activeRequestCode = takeRequestCode();
                try {
                    ((PermissionAwareActivity) activity).requestPermissions(operation.permissions(), activeRequestCode, permissionListener);
                } catch (RuntimeException exception) {
                    active = null;
                    activeActivity = null;
                    if (!operation.canceled) operation.respond(false);
                }
            }
        } finally {
            draining = false;
        }
    }

    private boolean onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        Operation expected = active;
        discardRequestFromDestroyedActivity();
        if (expected != null && active != expected) {
            drain();
            return true;
        }
        if (active == null) return true;
        if (requestCode != activeRequestCode) return false;

        Operation completed = active;
        Activity completedActivity = activeActivity;
        active = null;
        activeActivity = null;

        if (!completed.canceled) completed.respond(completed.isGranted());
        drain();

        // ReactActivityDelegate clears a listener that returns true. Preserve it only when drain()
        // registered the next request with this same Activity and delegate.
        return active == null || activeActivity != completedActivity;
    }

    private void discardRequestFromDestroyedActivity() {
        if (active == null || activeActivity == null || !activeActivity.isDestroyed()) return;
        active.cancel();
        active = null;
        activeActivity = null;
    }

    private int takeRequestCode() {
        int requestCode = nextRequestCode;
        nextRequestCode = requestCode == LAST_REQUEST_CODE ? FIRST_REQUEST_CODE : requestCode + 1;
        return requestCode;
    }

    private abstract static class Operation {
        final RNCWebView owner;
        boolean canceled;

        Operation(RNCWebView owner) {
            this.owner = owner;
        }

        abstract String[] permissions();

        abstract boolean isGranted();

        abstract void respond(boolean granted);

        boolean isCameraRequest(RNCWebView candidateOwner, PermissionRequest request) {
            return false;
        }

        boolean isLocationRequest(RNCWebView candidateOwner) {
            return false;
        }

        void cancel() {
            canceled = true;
        }

        final boolean hasPermission(String permission) {
            return owner.getThemedReactContext().checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED;
        }
    }

    private static final class CameraOperation extends Operation {
        private static final String[] PERMISSIONS = {Manifest.permission.CAMERA};
        private static final String[] GRANTED_RESOURCES = {PermissionRequest.RESOURCE_VIDEO_CAPTURE};

        private final PermissionRequest request;

        CameraOperation(RNCWebView owner, PermissionRequest request) {
            super(owner);
            this.request = request;
        }

        @Override
        String[] permissions() {
            return PERMISSIONS;
        }

        @Override
        boolean isGranted() {
            return hasPermission(Manifest.permission.CAMERA);
        }

        @Override
        void respond(boolean granted) {
            if (granted) request.grant(GRANTED_RESOURCES);
            else request.deny();
        }

        @Override
        boolean isCameraRequest(RNCWebView candidateOwner, PermissionRequest candidateRequest) {
            return owner == candidateOwner && request == candidateRequest;
        }
    }

    private static final class LocationOperation extends Operation {
        private static final String[] PERMISSIONS = {
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
        };

        private final String origin;
        private final GeolocationPermissions.Callback callback;

        LocationOperation(RNCWebView owner, String origin, GeolocationPermissions.Callback callback) {
            super(owner);
            this.origin = origin;
            this.callback = callback;
        }

        @Override
        String[] permissions() {
            return PERMISSIONS;
        }

        @Override
        boolean isGranted() {
            return hasPermission(Manifest.permission.ACCESS_FINE_LOCATION)
                    || hasPermission(Manifest.permission.ACCESS_COARSE_LOCATION);
        }

        @Override
        void respond(boolean granted) {
            callback.invoke(origin, granted, false);
        }

        @Override
        boolean isLocationRequest(RNCWebView candidateOwner) {
            return owner == candidateOwner;
        }
    }
}
