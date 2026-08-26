import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Appearance, ColorSchemeName, UIManager, findNodeHandle, DeviceEventEmitter, NativeEventEmitter, NativeModules, Platform, EmitterSubscription, View, DimensionValue } from 'react-native';
import { getNativeOwnIdButton, OwnIdNativeManagerName, OwnIdButtonType, OwnIdResponse, OwnIdError, _setViewId, _notifyFabricListenersReady, isFabric, _onInitReady, _isInitReady } from './common';
import { OwnIdWidgetType, OwnIdReactEventName, OwnIdFlowEvent, OwnIdLoginFlow, OwnIdIntegrationEvent, OwnIdLoginEvent, createOwnerToken, isOwnedEvent, parsePayload } from './internal';
import { useButtonHeightResolution } from './buttonLayout';

export const OwnIdAuthButtonColorSchemeLight = {
    backgroundColor: '#0070F2',
    textColor: '#FFFFFF',
    spinnerColor: '#FFFFFF',
    spinnerBackgroundColor: '#FFFFFF80',
};

export const OwnIdAuthButtonColorSchemeDark = {
    backgroundColor: '#3771DF',
    textColor: '#FFFFFF',
    spinnerColor: '#FFFFFF',
    spinnerBackgroundColor: '#FFFFFF80',
};

export interface OwnIdAuthButtonProps {
    loginId?: string;
    colorScheme?: ColorSchemeName;
    style?: {
        backgroundColor?: string;
        textColor?: string;
        spinnerColor?: string;
        spinnerBackgroundColor?: string;
        [key: string]: DimensionValue | string | number | undefined;
        width?: DimensionValue;
        height?: DimensionValue;
    };
    showSpinner?: boolean;

    onLogin: (response: OwnIdResponse) => void;
    onError?: (error: OwnIdError) => void;
    onBusy?: (isBusy: boolean) => void;
}

export const OwnIdAuthButton = (props: OwnIdAuthButtonProps) => {
    const {
        colorScheme = Appearance.getColorScheme(),
        style,
        showSpinner = true,

        onLogin = () => { },
        onError = () => { },
        onBusy = () => { },

        ...restProps
    } = props;

    const selectedColorScheme = colorScheme === 'dark' ? OwnIdAuthButtonColorSchemeDark : OwnIdAuthButtonColorSchemeLight;

    const {
        backgroundColor, textColor, spinnerColor, spinnerBackgroundColor, width, height, ...styles
    }: OwnIdAuthButtonProps['style'] = {
        width: '100%', height: 48, ...selectedColorScheme, ...style
    }

    const { nativeHeight, preferredHeight, onLayout } = useButtonHeightResolution(height);

    const ref = useRef(null);
    const ownerTokenRef = useRef<string | null>(null);
    const ownerToken = ownerTokenRef.current ?? createOwnerToken();
    ownerTokenRef.current = ownerToken;
    const [isReady, setIsReady] = useState<boolean>(_isInitReady());
    const [measuredWidth, setMeasuredWidth] = useState<number | undefined>(undefined);

    const flowEventsSubscription = useRef<EmitterSubscription | null>(null);
    const integrationEventsSubscription = useRef<EmitterSubscription | null>(null);

    const type = OwnIdButtonType.Login;
    const onLoginRef = useRef(onLogin);
    const onErrorRef = useRef(onError);
    const onBusyRef = useRef(onBusy);

    onLoginRef.current = onLogin;
    onErrorRef.current = onError;
    onBusyRef.current = onBusy;

    const handleFlow = useCallback((flowEvent: OwnIdFlowEvent) => {
        switch (flowEvent.eventType) {
            case OwnIdLoginFlow.Busy:
                onBusyRef.current(flowEvent.isBusy);
                break;
            case OwnIdLoginFlow.Response: {
                const { loginId, payload, authType, authToken } = flowEvent;
                onLoginRef.current(parsePayload(loginId, payload, authType, authToken));
                break;
            }
            case OwnIdLoginFlow.Error:
                onErrorRef.current(flowEvent.error);
                break;
        }
    }, []);

    const handleIntegration = useCallback((integrationEvent: OwnIdIntegrationEvent) => {
        switch (integrationEvent.eventType) {
            case OwnIdLoginEvent.Busy:
                onBusyRef.current(integrationEvent.isBusy);
                break;
            case OwnIdLoginEvent.LoggedIn:
                onLoginRef.current({ authType: integrationEvent.authType, authToken: integrationEvent.authToken });
                break;
            case OwnIdLoginEvent.Error:
                onErrorRef.current(integrationEvent.error);
                break;
        }
    }, []);

    useEffect(() => {
        const unsubscribe = _onInitReady(() => setIsReady(true));
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!isReady) return;
        const onOwnIdFlowEvent = (flowEvent: OwnIdFlowEvent) => {
            if (!isOwnedEvent(flowEvent, ownerToken)) return;
            handleFlow(flowEvent);
        };

        const onOwnIdIntegrationEvent = (integrationEvent: OwnIdIntegrationEvent) => {
            if (!isOwnedEvent(integrationEvent, ownerToken)) return;
            handleIntegration(integrationEvent);
        };

        if (Platform.OS === 'android') {
            flowEventsSubscription.current = DeviceEventEmitter.addListener(OwnIdReactEventName.OwnIdFlowEvent, onOwnIdFlowEvent);
            integrationEventsSubscription.current = DeviceEventEmitter.addListener(OwnIdReactEventName.OwnIdIntegrationEvent, onOwnIdIntegrationEvent);

            const viewId = findNodeHandle(ref.current);
            _setViewId(type, viewId);
            if (isFabric()) {
                _notifyFabricListenersReady(ref.current, ownerToken);
            } else {
                // @ts-ignore
                UIManager.dispatchViewManagerCommand(viewId, UIManager[OwnIdNativeManagerName].Commands.create.toString(), [viewId, ownerToken]);
            }
        }
        if (Platform.OS === 'ios') {
            const flowEventsEmitter = new NativeEventEmitter(NativeModules.ButtonEventsEventEmitter);
            flowEventsSubscription.current = flowEventsEmitter.addListener(OwnIdReactEventName.OwnIdFlowEvent, onOwnIdFlowEvent);

            const integrationEventsEmitter = new NativeEventEmitter(NativeModules.ButtonEventsEventEmitter);
            integrationEventsSubscription.current = integrationEventsEmitter.addListener(OwnIdReactEventName.OwnIdIntegrationEvent, onOwnIdIntegrationEvent);
        }
        return () => {
            flowEventsSubscription.current!.remove();
            integrationEventsSubscription.current!.remove();
        }
    }, [handleFlow, handleIntegration, isReady, ownerToken, type]);

    if (!isReady) {
        return null;
    }

    const OwnIdNativeViewManager: any = getNativeOwnIdButton();
    if (Platform.OS === 'android' && isFabric()) {
        return (
            <View style={{ width: (width as number | undefined) ?? measuredWidth, height }} onLayout={onLayout}>
                <OwnIdNativeViewManager
                    // @ts-ignore
                    widgetType={OwnIdWidgetType.OwnIdAuthButton}
                    style={[styles, { height: nativeHeight }]}
                    buttonTextColor={textColor}
                    buttonBackgroundColor={backgroundColor}
                    showSpinner={showSpinner}
                    spinnerColor={spinnerColor}
                    spinnerBackgroundColor={spinnerBackgroundColor}
                    type={type}
                    {...restProps}
                    ownerToken={ownerToken}
                    onContentSizeChange={(e: any) => {
                        const w = e?.nativeEvent?.width;
                        if (typeof w === 'number' && w > 0) { setMeasuredWidth(w); }
                    }}
                    ref={ref}
                />
            </View>
        );
    }

    if (Platform.OS === 'ios' && isFabric()) {
        return (
            <View style={{ width: (width as number | undefined) ?? measuredWidth, height }} onLayout={onLayout}>
                <OwnIdNativeViewManager
                    // @ts-ignore
                    widgetType={OwnIdWidgetType.OwnIdAuthButton}
                    style={[styles, { height: nativeHeight }]}
                    preferredHeight={preferredHeight}
                    buttonTextColor={textColor}
                    buttonBackgroundColor={backgroundColor}
                    showSpinner={showSpinner}
                    spinnerColor={spinnerColor}
                    spinnerBackgroundColor={spinnerBackgroundColor}
                    type={type}
                    {...restProps}
                    ownerToken={ownerToken}
                    onContentSizeChange={(e: any) => {
                        const w = e?.nativeEvent?.width;
                        if (typeof w === 'number' && w > 0) { setMeasuredWidth(w); }
                    }}
                    ref={ref}
                />
            </View>
        );
    }
    {
        const containerWidth = (width as DimensionValue | undefined) ?? (measuredWidth as number | undefined);
        return (
            <View style={{ width, height }} onLayout={onLayout}>
                <OwnIdNativeViewManager
                    // @ts-ignore
                    widgetType={OwnIdWidgetType.OwnIdAuthButton}
                    style={styles}
                    buttonTextColor={textColor}
                    buttonBackgroundColor={backgroundColor}
                    showSpinner={showSpinner}
                    spinnerColor={spinnerColor}
                    spinnerBackgroundColor={spinnerBackgroundColor}
                    type={type}
                    {...(Platform.OS === 'ios' ? { preferredHeight } : {})}
                    onContentSizeChange={(e: any) => {
                        const w = e?.nativeEvent?.width;
                        if (typeof w === 'number' && w > 0) { setMeasuredWidth(w); }
                    }}
                    {...restProps}
                    ownerToken={ownerToken}
                    ref={ref}
                />
            </View>
        );
    }
};
