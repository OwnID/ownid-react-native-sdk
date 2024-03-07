import { OwnIdPayload, OwnIdError } from './common'

export enum OwnIdWidgetType {
    OwnIdAuthButton = 'OwnIdAuthButton',
    OwnIdButton = 'OwnIdButton',
}

export enum OwnIdReactEventName {
    OwnIdFlowEvent = 'OwnIdFlowEvent',
    OwnIdIntegrationEvent = 'OwnIdIntegrationEvent',
}

export enum OwnIdRegisterFlow {
    Busy = 'OwnIdRegisterFlow.Busy',
    Response = 'OwnIdRegisterFlow.Response',
    Undo = 'OwnIdRegisterFlow.Undo',
    Error = 'OwnIdRegisterFlow.Error',
}

export enum OwnIdLoginFlow {
    Busy = 'OwnIdLoginFlow.Busy',
    Response = 'OwnIdLoginFlow.Response',
    Error = 'OwnIdLoginFlow.Error',
}

export type OwnIdFlowEvent =
    {
        eventType: OwnIdRegisterFlow.Busy | OwnIdLoginFlow.Busy;
        isBusy: boolean;
    } |
    {
        eventType: OwnIdRegisterFlow.Error | OwnIdLoginFlow.Error;
        error: OwnIdError;
    } |
    {
        eventType: OwnIdRegisterFlow.Response | OwnIdLoginFlow.Response;
        loginId: string;
        payload: OwnIdPayload;
        authType: string;
    } |
    {
        eventType: OwnIdRegisterFlow.Undo;
    };

export enum OwnIdRegisterEvent {
    Busy = 'OwnIdRegisterEvent.Busy',
    ReadyToRegister = 'OwnIdRegisterEvent.ReadyToRegister',
    Undo = 'OwnIdRegisterEvent.Undo',
    LoggedIn = 'OwnIdRegisterEvent.LoggedIn',
    Error = 'OwnIdRegisterEvent.Error',
}

export enum OwnIdLoginEvent {
    Busy = 'OwnIdLoginEvent.Busy',
    LoggedIn = 'OwnIdLoginEvent.LoggedIn',
    Error = 'OwnIdLoginEvent.Error',
}

export type OwnIdIntegrationEvent =
    {
        eventType: OwnIdRegisterEvent.Busy | OwnIdLoginEvent.Busy;
        isBusy: boolean;
    } |
    {
        eventType: OwnIdRegisterEvent.Error | OwnIdLoginEvent.Error;
        error: OwnIdError;
    } |
    {
        eventType: OwnIdRegisterEvent.ReadyToRegister;
        loginId: string;
        authType: string;
    } |
    {
        eventType: OwnIdRegisterEvent.LoggedIn | OwnIdLoginEvent.LoggedIn;
        authType: string;
    } |
    {
        eventType: OwnIdRegisterEvent.Undo;
    };