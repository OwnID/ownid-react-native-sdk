
import React, { useEffect, useRef } from 'react';
import { Appearance, ColorSchemeName, UIManager, findNodeHandle, DeviceEventEmitter, NativeEventEmitter, NativeModules, Platform, EmitterSubscription, View, DimensionValue } from 'react-native';
import { OwnIdNativeViewManager, OwnIdButtonType, OwnIdResponse, OwnIdError, _setViewId } from './common';
import { OwnIdWidgetType, OwnIdReactEventName, OwnIdFlowEvent, OwnIdLoginFlow, OwnIdIntegrationEvent, OwnIdLoginEvent, parsePayload } from './internal';

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

    const ref = useRef(null);

    const flowEventsSubscription = useRef<EmitterSubscription | null>(null);
    const integrationEventsSubscription = useRef<EmitterSubscription | null>(null);

    const type = OwnIdButtonType.Login;

    useEffect(() => {
        const onOwnIdFlowEvent = (flowEvent: OwnIdFlowEvent) => {
            switch (flowEvent.eventType) {
                case OwnIdLoginFlow.Busy:
                    onBusy(flowEvent.isBusy);
                    break;
                case OwnIdLoginFlow.Response:
                    const { loginId, payload, authType } = flowEvent;
                    onLogin(parsePayload(loginId, payload, authType));
                    break;
                case OwnIdLoginFlow.Error:
                    onError(flowEvent.error);
                    break;
            }
        };

        const onOwnIdIntegrationEvent = (integrationEvent: OwnIdIntegrationEvent) => {
            switch (integrationEvent.eventType) {
                case OwnIdLoginEvent.Busy:
                    onBusy(integrationEvent.isBusy);
                    break;
                case OwnIdLoginEvent.LoggedIn:
                    onLogin({ authType: integrationEvent.authType });
                    break;
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
                widgetType={OwnIdWidgetType.OwnIdAuthButton}
                style={styles}
                buttonTextColor={textColor}
                buttonBackgroundColor={backgroundColor}
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