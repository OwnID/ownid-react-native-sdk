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
        authToken?: string;
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
        authToken?: string;
    } |
    {
        eventType: OwnIdRegisterEvent.Undo;
    };

export function parsePayload(loginId: string, ownIdPayload: OwnIdPayload, authType: string, authToken?: string) {
    let payload = { ...ownIdPayload };
    try {
        payload.data = JSON.parse(ownIdPayload.data);
    } catch { };
    return { loginId, payload, authType, authToken };
}

export function generatePassword(
    length: number,
    numberCapitalised = 1,
    numberNumbers = 1,
    numberSpecial = 1,
): string {
    const possibleRegularChars = 'abcdefghijklmnopqrstuvwxyz';
    const possibleCapitalChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const possibleNumberChars = '0123456789';
    const possibleSpecialChars = '@$%*&^!#_';

    let resArr: string[] = [];

    if (numberCapitalised) {
        resArr = addGroup(resArr, length, possibleCapitalChars, numberCapitalised);
    }
    if (numberNumbers) {
        resArr = addGroup(resArr, length, possibleNumberChars, numberNumbers);
    }
    if (numberSpecial) {
        resArr = addGroup(resArr, length, possibleSpecialChars, numberSpecial);
    }

    const arrLength = resArr.length;

    for (let i = length; i > arrLength; i--) {
        resArr.push(possibleRegularChars[Math.floor(Math.random() * possibleRegularChars.length)]);
    }

    resArr = shuffle(resArr);

    return resArr.join('');
}

function addGroup(arr: string[], length: number, possibleChars: string, number = 1) {
    for (let i = Math.floor(Math.random() * (length / 4 - number) + number); i--;) {
        const char = possibleChars[Math.floor(Math.random() * possibleChars.length)];
        arr.push(char);
    }
    return arr;
}

function shuffle(arr: string[]) {
    for (let i = arr.length - 1; i--;) {
        const j = Math.floor(Math.random() * (i + 1));
        const x = arr[i];
        arr[i] = arr[j];
        arr[j] = x;
    }
    return arr;
}