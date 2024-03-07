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
 */
export interface OwnIdResponse {
    authType: string;
    loginId?: string;
    payload?: OwnIdPayload;
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
 * @property {string} data - A string containing OwnID Data - the OwnID authentication data object.
 * @property {string} metadata - A string with information on how to use the [data]. Integration-specific.
 */
export interface OwnIdPayload {
    type: OwnIdPayloadType;
    data: string;
    metadata: string;
}

/**
 * Represents an OwnID error.
 * 
 * @property {string} className - The class name where the error occurred.
 * @property {string | null} code - The error code, or null if unavailable.
 * @property {string} message - A user-friendly localized text message describing the error if `code` is present, otherwise the error message.
 * @property {OwnIdError | null} cause - The original exception that is wrapped in, or null if none.
 * @property {string} stackTrace - The stack trace for the error.
 */
export interface OwnIdError {
    className: string;
    code: string | null;
    message: string;
    cause: OwnIdError | null;
    stackTrace: string;
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