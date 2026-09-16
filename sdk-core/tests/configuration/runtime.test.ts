import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { prepareInitialization, prepareJsonInitialization } from '../../src/configuration/runtime';
import type { OwnIDConfigurationOptions } from '../../src/configuration';

function prepareRuntimeInput(input: unknown) {
  return prepareInitialization(input as OwnIDConfigurationOptions);
}

describe('OwnID runtime configuration preparation', () => {
  test('applies defaults and snapshots accepted input', () => {
    const languages = ['uk-UA', 'en-US', 'uk-UA', ''];
    const result = prepareInitialization({ appId: 'App123', languages, unknown: true } as OwnIDConfigurationOptions & {
      unknown: boolean;
    });

    languages[0] = 'changed';

    assert.deepEqual(result.configuration, {
      appId: 'App123',
      env: 'prod',
      region: 'us',
    });
    assert.deepEqual(result.languageOverrideUpdate, ['uk-UA', 'en-US', 'uk-UA', '']);
    assert.equal(Object.isFrozen(result), true);
    assert.equal(Object.isFrozen(result.configuration), true);
    assert.equal(Object.isFrozen(result.languageOverrideUpdate), true);
  });

  test('preserves the three language update states', () => {
    assert.equal(prepareInitialization({ appId: 'App123' }).languageOverrideUpdate, undefined);
    assert.equal(prepareInitialization({ appId: 'App123', languages: null }).languageOverrideUpdate, undefined);
    assert.deepEqual(prepareInitialization({ appId: 'App123', languages: [] }).languageOverrideUpdate, []);
    assert.deepEqual(prepareInitialization({ appId: 'App123', languages: ['iw', 'invalid tag'] }).languageOverrideUpdate, [
      'iw',
      'invalid tag',
    ]);
  });

  test('rejects invalid option objects and app IDs', () => {
    for (const input of [undefined, null, [], 'App123']) {
      assert.throws(() => prepareRuntimeInput(input), TypeError);
    }
    for (const appId of ['', 'Tenant-1', 'Tenant_1', 'Tenant 1', 'Tenant.example', 123]) {
      assert.throws(() => prepareRuntimeInput({ appId }), /appId/);
    }
  });

  test('rejects invalid environments and regions instead of treating null as omission', () => {
    for (const env of [null, 'DEV', 'dev', 'UAT', 1]) {
      assert.throws(() => prepareRuntimeInput({ appId: 'App123', env }), /env/);
    }
    for (const region of [null, 'US', 'ap', 1]) {
      assert.throws(() => prepareRuntimeInput({ appId: 'App123', region }), /region/);
    }
  });

  test('rejects non-array languages and non-string elements', () => {
    for (const languages of ['en-US', 7, true, {}]) {
      assert.throws(() => prepareRuntimeInput({ appId: 'App123', languages }), /languages/);
    }
    for (const language of [7, true, null, {}, []]) {
      assert.throws(() => prepareRuntimeInput({ appId: 'App123', languages: ['en-US', language] }), /languages\[1\]/);
    }

    assert.throws(() => prepareRuntimeInput({ appId: 'App123', languages: new Array<string>(1) }), /languages\[0\]/);
  });
});

describe('OwnID JSON runtime configuration preparation', () => {
  test('normalizes the native SDK JSON shape and preserves language semantics', () => {
    assert.deepEqual(prepareJsonInitialization('{"appID":"Dev123","env":"DEV","region":"eu","languages":["uk-UA"]}'), {
      configuration: { appId: 'Dev123', env: 'dev', region: 'eu' },
      languageOverrideUpdate: ['uk-UA'],
    });
    assert.deepEqual(prepareJsonInitialization('{"appId":"Default123","env":null,"region":null,"languages":null}'), {
      configuration: { appId: 'Default123', env: 'prod', region: 'us' },
      languageOverrideUpdate: undefined,
    });
  });

  test('prefers a non-null canonical appId and ignores unknown native fields', () => {
    assert.deepEqual(
      prepareJsonInitialization('{"appId":"Canonical123","appID":"Alias123","rootUrl":"https://ignored.example","future":{"enabled":true}}')
        .configuration,
      { appId: 'Canonical123', env: 'prod', region: 'us' }
    );
    assert.equal(prepareJsonInitialization('{"appId":null,"appID":"Alias123"}').configuration.appId, 'Alias123');
  });

  test('rejects malformed JSON, non-objects, and invalid known fields', () => {
    assert.throws(() => prepareJsonInitialization('{'), SyntaxError);
    for (const json of ['null', '[]', '"App123"']) {
      assert.throws(() => prepareJsonInitialization(json), /json/);
    }
    for (const json of [
      '{}',
      '{"appId":null}',
      '{"appId":7}',
      '{"appId":"App-123"}',
      '{"appId":"App123","env":"stage"}',
      '{"appId":"App123","region":"ap"}',
      '{"appId":"App123","languages":["en",7]}',
    ]) {
      assert.throws(() => prepareJsonInitialization(json), TypeError);
    }
  });
});
