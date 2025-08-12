import { requireNativeComponent } from 'react-native';

export let OwnIdNativeViewManager = requireNativeComponent('OwnIdButtonManager');

export function _setOwnIdNativeViewManager(value: any) {
    OwnIdNativeViewManager = value
}

/**
 * Represents the type of OwnID flow - Register or Login to be performed by a button.
 */
export enum OwnIdButtonType {
    Register = 'register',
    Login = 'login',
}

/**
 * Represents the OwnID response for Registration or Login flows.
 * 
 * @property {string} authType - Type of authentication used in the OwnID flow.
 * @property {string} loginId - (optional) User login ID used in the OwnID flow. Unavailable in `onLogin` callback for OwnID with Integration component.
 * @property {OwnIdPayload} payload - (optional) Result of the OwnID flow. Only available for OwnID without the Integration component.
 * @property {string} authToken - (optional) A token that can be used to refresh a session.
 */
export interface OwnIdResponse {
    authType: string;
    loginId?: string;
    payload?: OwnIdPayload;
    authToken?: string;
}

/**
 * Represents the type of OwnID Payload - Registration or Login.
 */
export enum OwnIdPayloadType {
    Registration = 'Registration',
    Login = 'Login',
}

/**
 * Represents the result of an OwnID flow.
 * 
 * @property {OwnIdPayloadType} type - The type of data in the `data` and `metadata` properties.
 * @property {any} data - OwnID Data (OwnID authentication data object) as a parsed JSON Object or a string.
 * @property {string} metadata - A string with information on how to use the [data]. Integration-specific.
 */
export interface OwnIdPayload {
    type: OwnIdPayloadType;
    data: any;
    metadata: string;
}

/**
 * Interface representing an error with additional metadata specific to OwnID.
 * 
 * @property {string} className - The class name where the error occurred.
 * @property {string | null} code - The error code, or null if unavailable.
 * @property {string} message - A user-friendly localized text message describing the error if `code` is present, otherwise the error message.
 * @property {IOwnIdError | null} cause - The original exception that is wrapped in, or null if none.
 * @property {string} stackTrace - The stack trace for the error.
 */
export interface IOwnIdError {
    className?: string;
    code?: string | null;
    message: string;
    cause?: IOwnIdError | null;
    stackTrace?: string;
}

/**
 * Represents an error with additional metadata specific to OwnID.
 */
export class OwnIdError implements IOwnIdError {
    className?: string;
    code?: string | null;
    message: string;
    cause?: IOwnIdError | null;
    stackTrace?: string;

    constructor({ className, code, message, cause, stackTrace }: IOwnIdError) {
        this.className = className;
        this.code = code;
        this.message = message;
        this.cause = cause;
        this.stackTrace = stackTrace;
    }
}

const ownIdButtonIds: { [index: string]: number | null } = {};

// Internal
export function _setViewId(buttonType: OwnIdButtonType, viewId: number | null) {
    ownIdButtonIds[buttonType] = viewId;
}

// Internal
export function _getViewId(buttonType: OwnIdButtonType) {
    return ownIdButtonIds[buttonType];
}