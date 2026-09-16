import { OwnIDLogLevel } from '../../src/logging';
import type { OwnIDLogEntry, OwnIDLoggingOptions } from '../../src/logging';

const debugOptions: OwnIDLoggingOptions = { level: OwnIDLogLevel.Debug };
const resetOptions: OwnIDLoggingOptions = {};
const errorLevel: OwnIDLogEntry['level'] = OwnIDLogLevel.Error;
const entry: OwnIDLogEntry = {
  level: OwnIDLogLevel.Warn,
  label: 'OwnID-SDK',
  source: 'TypeTest',
  message: 'Message',
  cause: { arbitrary: true },
};

// @ts-expect-error Callers use exported level constants rather than raw strings.
const rawLevel: OwnIDLoggingOptions = { level: 'debug' };
// @ts-expect-error Off is a threshold and cannot be emitted as an entry severity.
const offLevel: OwnIDLogEntry['level'] = OwnIDLogLevel.Off;
// @ts-expect-error Log entries are readonly snapshots.
entry.message = 'Changed';

void debugOptions;
void resetOptions;
void errorLevel;
void rawLevel;
void offLevel;
