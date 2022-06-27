import React, { useEffect, useRef } from 'react';
import {
  UIManager,
  findNodeHandle,
  requireNativeComponent,
  DeviceEventEmitter,
  NativeEventEmitter,
  NativeModules,
  Platform, EmitterSubscription
} from 'react-native';

const { ButtonEventsEventEmitter, OwnIdNativeModule } = NativeModules;

const OwnIdNativeViewManager = requireNativeComponent('OwnIdButtonManager');

let ownIdButtonIds = {};

function setViewId(buttonType: OwnIdButtonType, viewId: number | null) {
  ownIdButtonIds[buttonType] = viewId;
}

function getViewId(buttonType: OwnIdButtonType) {
  return ownIdButtonIds[buttonType];
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

export interface OwnIdEventCause {
  className: string;
  message: string;
  cause: OwnIdEventCause | null;
  stackTrace: string;
}

export interface OwnIdEvent {
  eventType: OwnIdLoginEvent | OwnIdRegisterEvent;
  isBusy?: boolean;
  loginId?: string;
  cause?: OwnIdEventCause;
}

export interface OwnIdButtonProps {
  style: {
    biometryIconColor: string;
    backgroundColor: string;
    borderColor: string;
    [key: string]: string;
  };
  onOwnIdEvent: (event: OwnIdEvent) => void;
  showOr?: boolean;
  type: OwnIdButtonType;
}

export const OwnIdButton = ({ style, onOwnIdEvent = () => { }, showOr = true, type, ...restProps }: OwnIdButtonProps) => {

  const { biometryIconColor, backgroundColor, borderColor, ...styles } = { height: 48, marginStart: 10, ...style }

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
      subscription.current = new NativeEventEmitter(ButtonEventsEventEmitter).addListener('OwnIdEvent', onOwnIdEvent);
    }
    return () => {
      subscription.current!.remove();
    }
  }, []);

  return (
    <OwnIdNativeViewManager
      // @ts-ignore
      style={styles}
      showOr={showOr}
      biometryIconColor={biometryIconColor}
      buttonBackgroundColor={backgroundColor}
      buttonBorderColor={borderColor}
      type={type}
      {...restProps}
      ref={ref}
    />
  );
};

export type OwnIdButtonType = 'register' | 'login';

export const OwnIdRegister = (loginId: string, registrationParameters: RegistrationOptions) => {
  if (Platform.OS === 'android') {
    // @ts-ignore
    UIManager.dispatchViewManagerCommand(getViewId('register'), UIManager.OwnIdButtonManager.Commands.register.toString(), [loginId, registrationParameters]);
  }
  if (Platform.OS === 'ios') {
    OwnIdNativeModule.register(loginId, registrationParameters);
  }
};
