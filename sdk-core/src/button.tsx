import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Appearance, ColorSchemeName, UIManager, findNodeHandle, DeviceEventEmitter, NativeEventEmitter, NativeModules, Platform, EmitterSubscription, View, DimensionValue } from 'react-native';
import { getNativeOwnIdButton, OwnIdNativeManagerName, OwnIdButtonType, OwnIdResponse, OwnIdPayloadType, OwnIdError, _setViewId, isFabric, _onInitReady, _isInitReady } from './common';
import { OwnIdWidgetType, OwnIdReactEventName, OwnIdFlowEvent, OwnIdRegisterFlow, OwnIdLoginFlow, OwnIdIntegrationEvent, OwnIdRegisterEvent, OwnIdLoginEvent, parsePayload } from './internal';

export const OwnIdButtonColorSchemeLight = {
    iconColor: '#0070F2',
    backgroundColor: '#FFF',
    borderColor: '#D0D0D0',
    textColor: '#354A5F',
    tooltipBackgroundColor: '#FFF',
    tooltipBorderColor: '#D0D0D0',
    tooltipTextColor: '#354A5F',
    spinnerColor: '#ADADAD',
    spinnerBackgroundColor: '#DFDFDF',
};

export const OwnIdButtonColorSchemeDark = {
    iconColor: '#0070F2',
    backgroundColor: '#2A3743',
    borderColor: '#2A3743',
    textColor: '#CED1CC',
    tooltipBackgroundColor: '#2A3743',
    tooltipBorderColor: '#2A3743',
    tooltipTextColor: '#CED1CC',
    spinnerColor: '#BDBDBD',
    spinnerBackgroundColor: '#717171',
};

export enum OwnIdButtonPosition {
    Start = 'start',
    End = 'end',
}

export enum OwnIdTooltipPosition {
    None = 'none',
    Top = 'top',
    Bottom = 'bottom',
    Start = 'start',
    End = 'end',
}

export interface OwnIdButtonPropsCommon {
    buttonPosition?: OwnIdButtonPosition;
    loginId?: string;
    colorScheme?: ColorSchemeName;
    style?: {
        iconColor?: string;
        backgroundColor?: string;
        borderColor?: string;
        textColor?: string;
        tooltipPosition?: OwnIdTooltipPosition;
        tooltipBackgroundColor?: string;
        tooltipBorderColor?: string;
        tooltipTextColor?: string;
        spinnerColor?: string;
        spinnerBackgroundColor?: string;
        [key: string]: DimensionValue | string | number | undefined;
        width?: DimensionValue;
        height?: DimensionValue;
    };

    onLogin: (response: OwnIdResponse) => void;
    onError?: (error: OwnIdError) => void;
    onBusy?: (isBusy: boolean) => void;

    showOr?: boolean;
    showSpinner?: boolean;
}

export interface OwnIdButtonPropsLogin {
    type: OwnIdButtonType.Login;
}

export interface OwnIdButtonPropsRegister {
    type: OwnIdButtonType.Register;

    onRegister: (response: OwnIdResponse) => void;
    onUndo?: () => void;
}

export type OwnIdButtonProps = OwnIdButtonPropsCommon & (OwnIdButtonPropsLogin | OwnIdButtonPropsRegister);

export const OwnIdButton = (props: OwnIdButtonProps) => {
    let onRegister: (response: OwnIdResponse) => void = () => { };
    let onUndo: () => void = () => { };

    if (props.type === OwnIdButtonType.Register) {
        onRegister = props.onRegister;
        onUndo = props.onUndo ? props.onUndo : () => { };
    }

    const {
        buttonPosition: buttonPosition = OwnIdButtonPosition.Start,
        colorScheme = Appearance.getColorScheme(),
        style,
        showOr = true,
        showSpinner = true,
        type,

        onLogin = () => { },
        onError = () => { },
        onBusy = () => { },

        ...restProps
    } = props;

    const selectedColorScheme = colorScheme === 'dark' ? OwnIdButtonColorSchemeDark : OwnIdButtonColorSchemeLight;

    const {
        iconColor, backgroundColor, borderColor, textColor, tooltipPosition, tooltipBackgroundColor, tooltipBorderColor, tooltipTextColor, spinnerColor, spinnerBackgroundColor,
        width, height, ...styles
    }: OwnIdButtonProps['style'] = {
        height: 48, tooltipPosition: OwnIdTooltipPosition.None, ...selectedColorScheme, ...style
    }

    const ref = useRef(null);
    const [isReady, setIsReady] = useState<boolean>(_isInitReady());
    const [measuredWidth, setMeasuredWidth] = useState<number | undefined>(undefined);

    const flowEventsSubscription = useRef<EmitterSubscription | null>(null);
    const integrationEventsSubscription = useRef<EmitterSubscription | null>(null);

    const handleFlowEvent = useCallback((flowEvent: OwnIdFlowEvent) => {
        switch (flowEvent.eventType) {
            case OwnIdRegisterFlow.Busy:
            case OwnIdLoginFlow.Busy:
                onBusy(flowEvent.isBusy);
                return;
            case OwnIdRegisterFlow.Response: {
                const { loginId, payload, authType, authToken } = flowEvent;
                if (flowEvent.payload.type === OwnIdPayloadType.Registration) {
                    onRegister(parsePayload(loginId, payload, authType, authToken));
                    return;
                }
                if (flowEvent.payload.type === OwnIdPayloadType.Login) {
                    const { loginId, payload, authType, authToken } = flowEvent;
                    onLogin(parsePayload(loginId, payload, authType, authToken));
                    return;
                }
                return;
            }

            case OwnIdLoginFlow.Response: {
                const { loginId, payload, authType, authToken } = flowEvent;
                onLogin(parsePayload(loginId, payload, authType, authToken));
                return;
            }
            case OwnIdRegisterFlow.Error:
            case OwnIdLoginFlow.Error:
                onError(flowEvent.error);
                return;
            case OwnIdRegisterFlow.Undo:
                onUndo();
                return;
            default:
                return;
        }
    }, [onBusy, onError, onLogin, onRegister, type]);

    const handleIntegrationEvent = useCallback((integrationEvent: OwnIdIntegrationEvent) => {
        switch (integrationEvent.eventType) {
            case OwnIdRegisterEvent.Busy:
            case OwnIdLoginEvent.Busy:
                onBusy(integrationEvent.isBusy);
                return;
            case OwnIdRegisterEvent.ReadyToRegister:
                onRegister({ loginId: integrationEvent.loginId, authType: integrationEvent.authType });
                return;
            case OwnIdRegisterEvent.Undo:
                onUndo();
                return;
            case OwnIdRegisterEvent.LoggedIn:
            case OwnIdLoginEvent.LoggedIn:
                onLogin({ authType: integrationEvent.authType, authToken: integrationEvent.authToken });
                return;
            case OwnIdRegisterEvent.Error:
            case OwnIdLoginEvent.Error:
                onError(integrationEvent.error);
                return;
            default:
                return;
        }
    }, [onBusy, onError, onLogin, onRegister]);

    useEffect(() => {
        const unsubscribe = _onInitReady(() => setIsReady(true));
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!isReady) return;
        const onOwnIdFlowEvent = (flowEvent: OwnIdFlowEvent) => handleFlowEvent(flowEvent);
        const onOwnIdIntegrationEvent = (integrationEvent: OwnIdIntegrationEvent) => handleIntegrationEvent(integrationEvent);

        if (Platform.OS === 'android') {
            flowEventsSubscription.current = DeviceEventEmitter.addListener(OwnIdReactEventName.OwnIdFlowEvent, onOwnIdFlowEvent);
            integrationEventsSubscription.current = DeviceEventEmitter.addListener(OwnIdReactEventName.OwnIdIntegrationEvent, onOwnIdIntegrationEvent);

            const viewId = findNodeHandle(ref.current);
            _setViewId(type, viewId);
            if (!isFabric()) {
                // @ts-ignore
                UIManager.dispatchViewManagerCommand(viewId, UIManager[OwnIdNativeManagerName].Commands.create.toString(), [viewId]);
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
    }, [handleFlowEvent, handleIntegrationEvent, isReady, type]);

    if (!isReady) {
        return null;
    }

    const OwnIdNativeViewManager: any = getNativeOwnIdButton();
    if (isFabric()) {
        if (Platform.OS === 'android') {
            return (
                <View style={{ width: width ?? measuredWidth, height }}>
                    <OwnIdNativeViewManager
                        // @ts-ignore
                        widgetType={OwnIdWidgetType.OwnIdButton}
                        widgetPosition={buttonPosition}
                        style={[styles, { height }]}
                        showOr={showOr}
                        buttonTextColor={textColor}
                        iconColor={iconColor}
                        buttonBackgroundColor={backgroundColor}
                        buttonBorderColor={borderColor}
                        tooltipPosition={tooltipPosition}
                        tooltipTextColor={tooltipTextColor}
                        tooltipBackgroundColor={tooltipBackgroundColor}
                        tooltipBorderColor={tooltipBorderColor}
                        showSpinner={showSpinner}
                        spinnerColor={spinnerColor}
                        spinnerBackgroundColor={spinnerBackgroundColor}
                        type={type}
                        {...restProps}
                        onContentSizeChange={(e: any) => {
                            const w = e?.nativeEvent?.width;
                            if (typeof w === 'number' && w > 0) { setMeasuredWidth(w); }
                        }}
                        ref={ref}
                    />
                </View>
            );
        }

        if (Platform.OS === 'ios') {
            return (
                <View style={{ width: width ?? measuredWidth, height }}>
                    <OwnIdNativeViewManager
                        // @ts-ignore
                        widgetType={OwnIdWidgetType.OwnIdButton}
                        widgetPosition={buttonPosition}
                        style={[styles, { height }]}
                        showOr={showOr}
                        buttonTextColor={textColor}
                        iconColor={iconColor}
                        buttonBackgroundColor={backgroundColor}
                        buttonBorderColor={borderColor}
                        tooltipTextColor={tooltipTextColor}
                        tooltipBackgroundColor={tooltipBackgroundColor}
                        tooltipBorderColor={tooltipBorderColor}
                        showSpinner={showSpinner}
                        spinnerColor={spinnerColor}
                        spinnerBackgroundColor={spinnerBackgroundColor}
                        type={type}
                        preferredHeight={Math.max(48, Number(height))}
                        onContentSizeChange={(e: any) => {
                            const w = e?.nativeEvent?.width;
                            if (typeof w === 'number' && w > 0) { setMeasuredWidth(w); }
                        }}
                        {...restProps}
                        ref={ref}
                    />
                </View>
            );
        }
    }

    {
        return (
            <View style={{ width, height }}>
                <OwnIdNativeViewManager
                    // @ts-ignore
                    widgetType={OwnIdWidgetType.OwnIdButton}
                    widgetPosition={buttonPosition}
                    style={styles}
                    showOr={showOr}
                    buttonTextColor={textColor}
                    iconColor={iconColor}
                    buttonBackgroundColor={backgroundColor}
                    buttonBorderColor={borderColor}
                    tooltipPosition={tooltipPosition}
                    tooltipTextColor={tooltipTextColor}
                    tooltipBackgroundColor={tooltipBackgroundColor}
                    tooltipBorderColor={tooltipBorderColor}
                    showSpinner={showSpinner}
                    spinnerColor={spinnerColor}
                    spinnerBackgroundColor={spinnerBackgroundColor}
                    type={type}
                    {...(Platform.OS === 'ios' ? { preferredHeight: Math.max(48, Number(height)) } : {})}
                    onContentSizeChange={(e: any) => {
                        const w = e?.nativeEvent?.width;
                        if (typeof w === 'number' && w > 0) { setMeasuredWidth(w); }
                    }}
                    {...restProps}
                    ref={ref}
                />
            </View>
        );
    }
};
