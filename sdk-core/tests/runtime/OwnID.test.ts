import '../reactNativePlatform';

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { OwnIDLogLevel } from '../../src/logging';
import type { OwnIDLogEntry } from '../../src/logging';
import { OwnID } from '../../src/runtime/OwnID';

describe('OwnID facade', () => {
  test('initializes and destroys the private default instance with stable boundary logs', () => {
    const entries: OwnIDLogEntry[] = [];
    OwnID.configureLogging({ level: OwnIDLogLevel.Debug, onLog: (entry) => entries.push(entry) });

    try {
      OwnID.initialize({ appId: 'Facade123', languages: ['uk-UA', 'en-US'] });
      OwnID.destroy();

      assert.deepEqual(
        entries.map(({ level, source, message }) => ({ level, source, message })),
        [
          { level: OwnIDLogLevel.Debug, source: 'OwnID.initialize', message: 'OwnID initialized.' },
          { level: OwnIDLogLevel.Debug, source: 'OwnID.destroy', message: 'OwnID destroyed.' },
        ]
      );
    } finally {
      OwnID.destroy();
      OwnID.configureLogging();
    }
  });

  test('logs an initialization failure once with the exact cause and rethrows it', () => {
    const entries: OwnIDLogEntry[] = [];
    OwnID.configureLogging({ level: OwnIDLogLevel.Error, onLog: (entry) => entries.push(entry) });

    try {
      let thrown: unknown;
      try {
        OwnID.initialize({ appId: '' });
      } catch (error) {
        thrown = error;
      }

      assert.ok(thrown instanceof TypeError);
      assert.equal(entries.length, 1);
      assert.equal(entries[0]?.level, OwnIDLogLevel.Error);
      assert.equal(entries[0]?.source, 'OwnID.initialize');
      assert.equal(entries[0]?.message, 'OwnID initialization failed.');
      assert.equal(entries[0]?.cause, thrown);
    } finally {
      OwnID.destroy();
      OwnID.configureLogging();
    }
  });

  test('initializes the default instance from native-compatible DEV JSON', () => {
    const entries: OwnIDLogEntry[] = [];
    OwnID.configureLogging({ level: OwnIDLogLevel.Debug, onLog: (entry) => entries.push(entry) });

    try {
      OwnID.initializeFromJson('{"appID":"FacadeDev123","env":"DEV","region":"US"}');
      OwnID.destroy();

      assert.deepEqual(
        entries.map(({ source, message }) => ({ source, message })),
        [
          { source: 'OwnID.initializeFromJson', message: 'OwnID initialized.' },
          { source: 'OwnID.destroy', message: 'OwnID destroyed.' },
        ]
      );
    } finally {
      OwnID.destroy();
      OwnID.configureLogging();
    }
  });

  test('logs a JSON initialization failure with its original cause', () => {
    const entries: OwnIDLogEntry[] = [];
    OwnID.configureLogging({ level: OwnIDLogLevel.Error, onLog: (entry) => entries.push(entry) });

    try {
      let thrown: unknown;
      try {
        OwnID.initializeFromJson('{');
      } catch (error) {
        thrown = error;
      }

      assert.ok(thrown instanceof SyntaxError);
      assert.equal(entries.length, 1);
      assert.equal(entries[0]?.source, 'OwnID.initializeFromJson');
      assert.equal(entries[0]?.message, 'OwnID initialization failed.');
      assert.equal(entries[0]?.cause, thrown);
    } finally {
      OwnID.destroy();
      OwnID.configureLogging();
    }
  });

  test('scope APIs require initialization and the facade follows the current default instance', () => {
    OwnID.destroy();
    assert.throws(() => OwnID.flows, /not initialized/);
    assert.throws(() => OwnID.withContext({}), /not initialized/);
    assert.throws(() => OwnID.setProviders({}), /not initialized/);

    try {
      OwnID.initialize({ appId: 'ScopeFirst123' });
      const firstFlows = OwnID.flows;
      const current = OwnID.withProviders({});
      const scoped = OwnID.withContext({});

      assert.equal(current.flows, firstFlows);
      assert.notEqual(scoped.flows, firstFlows);
      OwnID.initialize({ appId: 'ScopeSecond123' });
      assert.notEqual(OwnID.flows, firstFlows);
    } finally {
      OwnID.destroy();
    }
  });
});
