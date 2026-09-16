import { AuthMethod, ErrorCode } from '../../../src';
import type { ErrorDetails, OwnIDEliteErrorDetails, OwnIDEliteEvents, OwnIDEliteFinishParams } from '../../../src';

const activeError: OwnIDEliteErrorDetails = {
  code: ErrorCode.NETWORK,
  source: 'web.request',
  additionalDetails: 'Request failed',
  terminal: false,
};
const terminalError: OwnIDEliteErrorDetails = {
  code: ErrorCode.TIMEOUT,
  source: 'react-native.elite.startup',
  terminal: true,
};
const sharedDetails: ErrorDetails = activeError;
const finishParams: OwnIDEliteFinishParams = {
  loginId: 'user@example.com',
  authType: AuthMethod.PASSKEY,
  source: 'mobile',
};
const events: OwnIDEliteEvents = {
  onFinish: async (params) => void params.authToken,
  onError: async (message, details) => {
    void message;
    void details.terminal;
  },
  onClose: async () => undefined,
};
const noEvents: OwnIDEliteEvents = {};
const errorOnly: OwnIDEliteEvents = { onError: async () => undefined };

// @ts-expect-error Elite error details must state whether the current run was stopped before callback delivery.
const missingTerminal: OwnIDEliteErrorDetails = { code: ErrorCode.UNKNOWN, source: 'web.unknown' };
// @ts-expect-error Elite error details retain the required shared error code.
const missingCode: OwnIDEliteErrorDetails = { source: 'react-native.elite', terminal: true };
// @ts-expect-error Elite error codes use the shared ErrorCode enum rather than arbitrary strings.
const unsupportedCode: OwnIDEliteErrorDetails = { code: 'react-native-failure', source: 'react-native.elite', terminal: true };
// @ts-expect-error Elite error detail snapshots are readonly.
activeError.terminal = true;
// @ts-expect-error Elite error callbacks preserve the asynchronous Web callback contract.
const synchronousError: OwnIDEliteEvents = { onError: () => undefined };

void terminalError;
void sharedDetails;
void finishParams;
void events;
void noEvents;
void errorOnly;
void missingTerminal;
void missingCode;
void unsupportedCode;
void synchronousError;
