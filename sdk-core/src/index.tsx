import React, { useEffect, useRef } from 'react';
import { UIManager, findNodeHandle, requireNativeComponent, DeviceEventEmitter, NativeEventEmitter, NativeModules, Platform, EmitterSubscription } from 'react-native';

const { ButtonEventsEventEmitter, OwnIdNativeModule } = NativeModules;

const OwnIdNativeViewManager = requireNativeComponent('OwnIdButtonManager');

const ownIdButtonIds: { [index: string]: number | null } = {};

function setViewId(buttonType: OwnIdButtonType, viewId: number | null) {
  ownIdButtonIds[buttonType] = viewId;
}

function getViewId(buttonType: OwnIdButtonType) {
  return ownIdButtonIds[buttonType];
}

export interface OwnIdConfiguration {
  app_id: string;
  env?: string;
  redirection_uri?: string;
  redirection_uri_ios?: string;
  redirection_uri_android?: string;
  enable_logging?: boolean;
}

export enum OwnIdButtonType {
  Register = 'register',
  Login = 'login',
}

export enum OwnIdButtonVariant {
  Fingerprint = 'fingerprint',
  FaceId = 'faceId',
}

export enum OwnIdLoginEvent {
  Busy = 'OwnIdLoginEvent.Busy',
  LoggedIn = 'OwnIdLoginEvent.LoggedIn',
  Error = 'OwnIdLoginEvent.Error',
}

export enum OwnIdRegisterEvent {
  Busy = 'OwnIdRegisterEvent.Busy',
  ReadyToRegister = 'OwnIdRegisterEvent.ReadyToRegister',
  Undo = 'OwnIdRegisterEvent.Undo',
  LoggedIn = 'OwnIdRegisterEvent.LoggedIn',
  Error = 'OwnIdRegisterEvent.Error',
}

export enum OwnIdWidgetPosition {
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

export interface OwnIdEventCause {
  className: string;
  message: string;
  cause: OwnIdEventCause | null;
  stackTrace: string;
}

export type OwnIdEvent =
  {
    eventType: OwnIdLoginEvent.Busy | OwnIdRegisterEvent.Busy;
    isBusy: boolean;
  } |
  {
    eventType: OwnIdLoginEvent.Error | OwnIdRegisterEvent.Error;
    cause: OwnIdEventCause;
  } |
  {
    eventType: OwnIdRegisterEvent.ReadyToRegister;
    loginId: string;
    authType: string;
  } |
  {
    eventType: OwnIdLoginEvent.LoggedIn | OwnIdRegisterEvent.LoggedIn;
    authType: string;
  } |
  {
    eventType: OwnIdRegisterEvent.Undo;
  };

export interface OwnIdButtonProps {
  type: OwnIdButtonType;
  variant?: OwnIdButtonVariant;
  widgetPosition?: OwnIdWidgetPosition;
  loginId?: string;
  style?: {
    iconColor?: string;
    backgroundColor?: string;
    borderColor?: string;
    tooltipPosition?: OwnIdTooltipPosition;
    tooltipBackgroundColor?: string;
    tooltipBorderColor?: string;
    [key: string]: string | undefined;
  };
  onOwnIdEvent?: (event: OwnIdEvent) => void;
  showOr?: boolean;
}

export const OwnIdButton = ({
  variant = OwnIdButtonVariant.Fingerprint, widgetPosition = OwnIdWidgetPosition.Start, style, onOwnIdEvent = () => { }, showOr = true, type, ...restProps
}: OwnIdButtonProps) => {
  const {
    iconColor, backgroundColor, borderColor, tooltipPosition, tooltipBackgroundColor, tooltipBorderColor, ...styles
  } = {
    height: 48, tooltipPosition: OwnIdTooltipPosition.Top, ...style
  }

  const ref = useRef(null);
  const subscription = useRef<EmitterSubscription | null>(null);

  useEffect(() => {
    if (Platform.OS === 'android') {
      subscription.current = DeviceEventEmitter.addListener('OwnIdEvent', onOwnIdEvent);
      const viewId = findNodeHandle(ref.current);
      setViewId(type, viewId);
      // @ts-ignore
      UIManager.dispatchViewManagerCommand(viewId, UIManager.OwnIdButtonManager.Commands.create.toString(), [viewId]);
    }
    if (Platform.OS === 'ios') {
      const emitter = new NativeEventEmitter(ButtonEventsEventEmitter);
      subscription.current = emitter.addListener('OwnIdEvent', onOwnIdEvent);
    }
    return () => {
      subscription.current!.remove();
    }
  }, []);

  return (
    <OwnIdNativeViewManager
      // @ts-ignore
      variant={variant}
      widgetPosition={widgetPosition}
      style={styles}
      showOr={showOr}
      iconColor={iconColor}
      buttonBackgroundColor={backgroundColor}
      buttonBorderColor={borderColor}
      tooltipPosition={tooltipPosition}
      tooltipBackgroundColor={tooltipBackgroundColor}
      tooltipBorderColor={tooltipBorderColor}
      type={type}
      {...restProps}
      ref={ref}
    />
  );
};

export type RegistrationParameters = any;

export const OwnIdRegister = (loginId: string, registrationParameters: RegistrationParameters) => {
  if (Platform.OS === 'android') {
    // @ts-ignore
    UIManager.dispatchViewManagerCommand(getViewId(OwnIdButtonType.Register), UIManager.OwnIdButtonManager.Commands.register.toString(), [loginId, registrationParameters]);
  }
  if (Platform.OS === 'ios') {
    OwnIdNativeModule.register(loginId, registrationParameters);
  }
};
