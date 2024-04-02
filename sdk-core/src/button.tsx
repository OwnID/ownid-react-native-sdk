
import React, { useEffect, useRef } from 'react';
import { Appearance, ColorSchemeName, UIManager, findNodeHandle, DeviceEventEmitter, NativeEventEmitter, NativeModules, Platform, EmitterSubscription, View, DimensionValue } from 'react-native';
import { OwnIdNativeViewManager, OwnIdButtonType, OwnIdResponse, OwnIdPayloadType, OwnIdError, _setViewId } from './common';
import { OwnIdWidgetType, OwnIdReactEventName, OwnIdFlowEvent, OwnIdRegisterFlow, OwnIdLoginFlow, OwnIdIntegrationEvent, OwnIdRegisterEvent, OwnIdLoginEvent } from './internal';

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

    const flowEventsSubscription = useRef<EmitterSubscription | null>(null);
    const integrationEventsSubscription = useRef<EmitterSubscription | null>(null);

    useEffect(() => {
        const onOwnIdFlowEvent = (flowEvent: OwnIdFlowEvent) => {
            switch (flowEvent.eventType) {
                case OwnIdRegisterFlow.Busy:
                case OwnIdLoginFlow.Busy:
                    onBusy(flowEvent.isBusy);
                    break;
                case OwnIdRegisterFlow.Response:
                    if (flowEvent.payload.type === OwnIdPayloadType.Registration) {
                        const { loginId, payload, authType } = flowEvent;
                        onRegister({ loginId, payload, authType });
                    }
                    if (flowEvent.payload.type === OwnIdPayloadType.Login) {
                        const { loginId, payload, authType } = flowEvent;
                        onLogin({ loginId, payload, authType });
                    }
                    break;
                case OwnIdLoginFlow.Response:
                    const { loginId, payload, authType } = flowEvent;
                    onLogin({ loginId, payload, authType });
                    break;
                case OwnIdRegisterFlow.Undo:
                    onUndo();
                    break;
                case OwnIdRegisterFlow.Error:
                case OwnIdLoginFlow.Error:
                    onError(flowEvent.error);
                    break;
            }
        };

        const onOwnIdIntegrationEvent = (integrationEvent: OwnIdIntegrationEvent) => {
            switch (integrationEvent.eventType) {
                case OwnIdRegisterEvent.Busy:
                case OwnIdLoginEvent.Busy:
                    onBusy(integrationEvent.isBusy);
                    break;
                case OwnIdRegisterEvent.ReadyToRegister:
                    onRegister({ loginId: integrationEvent.loginId, authType: integrationEvent.authType });
                    break;
                case OwnIdRegisterEvent.Undo:
                    onUndo();
                    break;
                case OwnIdRegisterEvent.LoggedIn:
                case OwnIdLoginEvent.LoggedIn:
                    onLogin({ authType: integrationEvent.authType });
                    break;
                case OwnIdRegisterEvent.Error:
                case OwnIdLoginEvent.Error:
                    onError(integrationEvent.error);
                    break;
            }
        };

        if (Platform.OS === 'android') {
            flowEventsSubscription.current = DeviceEventEmitter.addListener(OwnIdReactEventName.OwnIdFlowEvent, onOwnIdFlowEvent);
            integrationEventsSubscription.current = DeviceEventEmitter.addListener(OwnIdReactEventName.OwnIdIntegrationEvent, onOwnIdIntegrationEvent);

            const viewId = findNodeHandle(ref.current);
            _setViewId(type, viewId);
            // @ts-ignore
            UIManager.dispatchViewManagerCommand(viewId, UIManager.OwnIdButtonManager.Commands.create.toString(), [viewId]);
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
    }, []);

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
                {...restProps}
                ref={ref}
            />
        </View>
    );
};