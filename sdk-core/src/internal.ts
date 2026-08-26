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

/**
 * Identifies the mounted button that owns an event. This is intentionally
 * kept in the internal event contract and is never forwarded to callbacks.
 */
export type OwnIdInternalEvent = {
    ownerToken: string;
};

let ownerTokenSequence = 0;
const ownerTokenProcessId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

/**
 * Generates a process-local identity for one mounted native button.
 */
export function createOwnerToken(): string {
    ownerTokenSequence += 1;
    return `ownid-owner-${ownerTokenProcessId}-${ownerTokenSequence}`;
}

export function isOwnedEvent(event: OwnIdInternalEvent | null | undefined, ownerToken: string): boolean {
    return event?.ownerToken === ownerToken;
}

export type OwnIdFlowEvent = OwnIdInternalEvent & (
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
        authType?: string;
        authToken?: string;
    } |
    {
        eventType: OwnIdRegisterFlow.Undo;
    }
);

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

export type OwnIdIntegrationEvent = OwnIdInternalEvent & (
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
        authType?: string;
    } |
    {
        eventType: OwnIdRegisterEvent.LoggedIn | OwnIdLoginEvent.LoggedIn;
        authType?: string;
        authToken?: string;
    } |
    {
        eventType: OwnIdRegisterEvent.Undo;
    }
);

export function parsePayload(loginId: string, ownIdPayload: OwnIdPayload, authType?: string, authToken?: string) {
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

    validateNonNegativeSafeInteger(length, 'length');
    validateNonNegativeSafeInteger(numberCapitalised, 'numberCapitalised');
    validateNonNegativeSafeInteger(numberNumbers, 'numberNumbers');
    validateNonNegativeSafeInteger(numberSpecial, 'numberSpecial');

    const requestedCount = numberCapitalised + numberNumbers + numberSpecial;
    if (requestedCount > length) {
        throw new RangeError('Requested character counts must not exceed length');
    }

    const result: string[] = [];
    addGroup(result, possibleCapitalChars, numberCapitalised);
    addGroup(result, possibleNumberChars, numberNumbers);
    addGroup(result, possibleSpecialChars, numberSpecial);
    addGroup(result, possibleRegularChars, length - requestedCount);

    return shuffle(result).join('');
}

function validateNonNegativeSafeInteger(value: number, name: string): void {
    if (!Number.isFinite(value) || !Number.isSafeInteger(value) || value < 0) {
        throw new RangeError(`${name} must be a finite, non-negative safe integer`);
    }
}

function addGroup(arr: string[], possibleChars: string, count: number): void {
    for (let i = 0; i < count; i += 1) {
        const char = possibleChars[Math.floor(Math.random() * possibleChars.length)];
        arr.push(char);
    }
}

function shuffle(arr: string[]) {
    for (let i = arr.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        const x = arr[i];
        arr[i] = arr[j];
        arr[j] = x;
    }
    return arr;
}
