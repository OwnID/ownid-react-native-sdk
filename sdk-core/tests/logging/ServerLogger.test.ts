import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { OwnIDLogLevel } from '../../src/logging';
import {
  configuration,
  createSenderRuntime,
  createServerLoggerHarness as createHarness,
  flush,
  metadata,
  readBody,
} from './serverLoggerHarness';

describe('ServerLogger wire contract', () => {
  test('initialization and lower levels do no platform or network work; warnings/errors dispatch asynchronously', async () => {
    const h = createHarness();
    try {
      for (const level of [OwnIDLogLevel.Verbose, OwnIDLogLevel.Debug, OwnIDLogLevel.Info, OwnIDLogLevel.Off]) {
        h.logger.log(level as never, 'Source', 'ignored');
      }
      assert.equal(h.platformReads(), 0);
      assert.equal(h.timers.size, 0);
      h.logger.log(OwnIDLogLevel.Warn, 'OwnIDEliteView.startup', 'loading fallback');
      const error = new Error('bootstrap failed');
      const originalStack = error.stack;
      h.logger.log(OwnIDLogLevel.Error, 'OwnIDEliteView.bootstrap', 'initialization failed', error);
      error.stack = 'changed after emission';
      h.advanceTime();
      assert.equal(h.requests.length, 0);
      assert.equal(h.platformReads(), 0);
      await flush();
      assert.equal(h.requests.length, 2);
      assert.equal(h.platformReads(), 1);
      const warning = readBody(h.requests[0]);
      assert.deepEqual(Object.keys(warning), ['component', 'level', 'codeInitiator', 'message', 'userAgent', 'sourceTimestamp']);
      assert.equal(warning.component, 'AndroidSdk');
      assert.equal(warning.level, 'Warning');
      assert.equal(warning.codeInitiator, 'OwnIDEliteView.startup');
      assert.equal(warning.message, 'OwnIDEliteView.startup => loading fallback');
      assert.equal(warning.userAgent, `OwnIDReactNativeCore/${metadata.version} (Linux; Android 15; Phone Test)`);
      assert.equal(warning.sourceTimestamp, '10000');
      const failure = readBody(h.requests[1]);
      assert.equal(failure.level, 'Error');
      assert.equal(failure.exception, originalStack);
      assert.equal(Object.hasOwn(failure, 'metadata'), false);
      assert.equal(Object.hasOwn(failure, 'version'), false);
      assert.deepEqual(Object.fromEntries(Object.entries(h.requests[0]?.init.headers ?? {})), {
        'Accept': 'application/json',
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-OwnID-AppUrl': 'App123.server.ownid.com',
        'User-Agent': warning.userAgent,
      });
      assert.equal(h.requests[0]?.init.method, 'POST');
      h.requests.forEach((request) => request.resolve());
      await flush();
      assert.equal(h.timers.size, 0);
    } finally {
      h.logger.dispose();
    }
  });

  test('events use configured environment/region and never a hosted document origin', async () => {
    for (const env of ['prod', 'uat', 'dev'] as const) {
      for (const region of ['us', 'eu'] as const) {
        const h = createHarness({ appId: 'Other456', env, region });
        try {
          h.logger.log(OwnIDLogLevel.Error, 'Source', 'failure');
          await flush();
          const host = `Other456.server${env === 'prod' ? '' : `.${env}`}.ownid${region === 'us' ? '' : '-eu'}.com`;
          assert.equal(h.requests[0]?.url, `https://${host}/events`);
          assert.equal((h.requests[0]?.init.headers as Record<string, string>)['X-OwnID-AppUrl'], host);
          h.requests[0]?.resolve();
          await flush();
        } finally {
          h.logger.dispose();
        }
      }
    }
  });

  test('iOS includes available OS version; unsupported platforms make no request', async () => {
    for (const platform of ['ios', 'windows'] as const) {
      const h = createHarness(configuration, platform);
      try {
        h.logger.log(OwnIDLogLevel.Warn, 'Source', 'failure');
        await flush();
        if (platform === 'ios') {
          const body = readBody(h.requests[0]);
          assert.equal(body.component, 'IosSdk');
          assert.equal(body.userAgent, `OwnIDReactNativeCore/${metadata.version} (iOS 18.4)`);
          h.requests[0]?.resolve();
          await flush();
        } else {
          assert.equal(h.requests.length, 0);
          assert.equal(h.timers.size, 0);
        }
      } finally {
        h.logger.dispose();
      }
    }
  });

  test('exception extraction is contained and arbitrary provider/page objects are never serialized', async () => {
    const h = createHarness();
    try {
      const error = new Error('readable message');
      Object.defineProperty(error, 'stack', {
        get: () => {
          throw new Error('stack unavailable');
        },
      });
      let secretReads = 0;
      const opaque = {
        get accessToken() {
          secretReads++;
          return 'secret';
        },
      };
      const hostile = new Proxy(
        {},
        {
          getPrototypeOf() {
            throw new Error('opaque cause');
          },
        }
      );
      h.logger.log(OwnIDLogLevel.Error, 'Source', 'first', error);
      h.logger.log(OwnIDLogLevel.Error, 'Source', 'second', opaque);
      h.logger.log(OwnIDLogLevel.Error, 'Source', 'third', hostile);
      await flush();
      assert.equal(h.requests.length, 3);
      assert.equal(readBody(h.requests[0]).exception, 'readable message');
      assert.equal(Object.hasOwn(readBody(h.requests[1]), 'exception'), false);
      assert.equal(Object.hasOwn(readBody(h.requests[2]), 'exception'), false);
      assert.equal(secretReads, 0);
      h.requests.forEach((request) => request.resolve());
      await flush();
    } finally {
      h.logger.dispose();
    }
  });
});

describe('ServerLogger best-effort lifecycle', () => {
  test('bounds active work, drops overflow without queuing, and frees slots after any HTTP result', async () => {
    const h = createHarness();
    try {
      for (let index = 0; index < 12; index++) h.logger.log(OwnIDLogLevel.Error, 'Source', String(index));
      await flush();
      assert.equal(h.requests.length, 4);
      h.requests[0]?.resolve(500);
      await flush();
      assert.equal(h.requests.length, 4);
      assert.equal(h.timers.size, 3);
      h.logger.log(OwnIDLogLevel.Warn, 'Source', 'new attempt');
      await flush();
      assert.equal(h.requests.length, 5);
      h.requests.forEach((request) => request.resolve());
      await flush();
      assert.equal(h.timers.size, 0);
    } finally {
      h.logger.dispose();
    }
  });

  test('deadline releases slots even when fetch ignores abort, with no retry or late-rejection leak', async () => {
    const h = createHarness();
    try {
      for (let index = 0; index < 4; index++) h.logger.log(OwnIDLogLevel.Warn, 'Source', 'failure');
      await flush();
      h.expire();
      await flush();
      assert.ok(h.requests.every((request) => request.init.signal?.aborted));
      assert.equal(h.timers.size, 0);
      h.logger.log(OwnIDLogLevel.Error, 'Source', 'after deadline');
      await flush();
      assert.equal(h.requests.length, 5);
      h.requests.slice(0, 4).forEach((request) => request.reject(new Error('late rejection')));
      h.requests[4]?.resolve();
      await flush();
      assert.equal(h.requests.length, 5);
      assert.equal(h.timers.size, 0);
    } finally {
      h.logger.dispose();
    }
  });

  test('instance abort cancels attempts and permanently prevents stale logging', async () => {
    const h = createHarness();
    h.logger.log(OwnIDLogLevel.Error, 'Source', 'failure');
    await flush();
    h.instance.abort();
    await flush();
    assert.ok(h.requests[0]?.init.signal?.aborted);
    assert.equal(h.timers.size, 0);
    h.logger.log(OwnIDLogLevel.Error, 'Source', 'stale');
    await flush();
    assert.equal(h.requests.length, 1);
    h.logger.dispose();
  });

  test('dispose before deferred preparation prevents platform/network work', async () => {
    const h = createHarness();
    h.logger.log(OwnIDLogLevel.Warn, 'Source', 'failure');
    h.logger.dispose();
    h.logger.dispose();
    await flush();
    assert.equal(h.platformReads(), 0);
    assert.equal(h.requests.length, 0);
    assert.equal(h.timers.size, 0);
  });

  test('instance abort before deferred dispatch prevents all platform/network work', async () => {
    const h = createHarness();
    h.logger.log(OwnIDLogLevel.Error, 'Source', 'failure');
    h.instance.abort();
    await flush();
    assert.equal(h.platformReads(), 0);
    assert.equal(h.requests.length, 0);
    assert.equal(h.timers.size, 0);
  });

  test('remote text is bounded without serializing arbitrary causes', async () => {
    const h = createHarness();
    try {
      const error = new Error('failure');
      error.stack = 'e'.repeat(30_000);
      h.logger.log(OwnIDLogLevel.Error, 's'.repeat(1000), 'm'.repeat(20_000), error);
      await flush();
      const body = readBody(h.requests[0]);
      assert.equal((body.codeInitiator as string).length, 256);
      assert.equal((body.message as string).length, 4096);
      assert.equal((body.exception as string).length, 16_384);
      h.requests[0]?.resolve();
      await flush();
    } finally {
      h.logger.dispose();
    }
  });

  test('preparation and synchronous/async fetch failures are contained without retries', async () => {
    for (const options of [{ platformFailure: new Error('platform unavailable') }, { fetchFailure: new Error('fetch threw') }, {}]) {
      const h = createHarness(configuration, 'android', options);
      try {
        assert.doesNotThrow(() => h.logger.log(OwnIDLogLevel.Error, 'Source', 'failure'));
        await flush();
        h.requests[0]?.reject(new Error('offline'));
        await flush();
        assert.equal(h.timers.size, 0);
        assert.equal(h.requests.length, Object.keys(options).length === 0 ? 1 : 0);
      } finally {
        h.logger.dispose();
      }
    }
  });
});

describe('ServerLogger preparation boundaries', () => {
  test('unsupported and failed platform metadata is cached across subsequent attempts without retained slots', async () => {
    for (const kind of ['unsupported', 'failed'] as const) {
      const h = createHarness(configuration, kind === 'unsupported' ? 'windows' : 'android', {
        ...(kind === 'failed' ? { platformFailure: new Error('platform unavailable') } : {}),
      });
      try {
        for (let index = 0; index < 8; index++) {
          h.logger.log(OwnIDLogLevel.Error, 'Sequential', String(index));
          await flush();
          assert.equal(h.platformReads(), 1);
          assert.equal(h.requests.length, 0);
          assert.equal(h.timers.size, 0);
        }
      } finally {
        h.logger.dispose();
      }
    }
  });

  test('each sender caches its own metadata and cancellation leaves the other sender active', async () => {
    const runtime = createSenderRuntime();
    const firstSignal = new AbortController();
    const secondSignal = new AbortController();
    const first = new runtime.ServerLoggerImpl(configuration, firstSignal.signal);
    const second = new runtime.ServerLoggerImpl({ appId: 'Other456', env: 'uat', region: 'eu' }, secondSignal.signal);
    try {
      first.log(OwnIDLogLevel.Error, 'First', 'first attempt');
      await flush();
      assert.equal(runtime.platformReads(), 1);
      second.log(OwnIDLogLevel.Warn, 'Second', 'second attempt');
      await flush();
      assert.equal(runtime.platformReads(), 2);
      first.log(OwnIDLogLevel.Warn, 'First', 'cached');
      await flush();
      assert.equal(runtime.platformReads(), 2);
      assert.equal(runtime.requests.length, 3);
      assert.equal(runtime.requests[0]?.url, 'https://App123.server.ownid.com/events');
      assert.equal(runtime.requests[1]?.url, 'https://Other456.server.uat.ownid-eu.com/events');
      firstSignal.abort();
      await flush();
      assert.equal(runtime.requests[0]?.init.signal?.aborted, true);
      assert.equal(runtime.requests[2]?.init.signal?.aborted, true);
      assert.equal(runtime.requests[1]?.init.signal?.aborted, false);
      assert.equal(runtime.timers.size, 1);
      second.log(OwnIDLogLevel.Error, 'Second', 'still active');
      await flush();
      assert.equal(runtime.platformReads(), 2);
      assert.equal(runtime.requests.length, 4);
      runtime.requests.forEach((request) => request.resolve());
      await flush();
      assert.equal(runtime.timers.size, 0);
    } finally {
      first.dispose();
      second.dispose();
    }
  });

  test('construction with an already-aborted signal does no preparation, deadline, or network work', async () => {
    const runtime = createSenderRuntime();
    const instance = new AbortController();
    instance.abort();
    const logger = new runtime.ServerLoggerImpl(configuration, instance.signal);
    logger.log(OwnIDLogLevel.Error, 'Stale', 'ignored');
    logger.dispose();
    logger.dispose();
    await flush();
    assert.equal(runtime.platformReads(), 0);
    assert.equal(runtime.requests.length, 0);
    assert.equal(runtime.timers.size, 0);
    assert.deepEqual(runtime.deadlineDelays, []);
  });

  test('empty and non-string Error stacks fall back to the message, and an unreadable message is omitted', async () => {
    const h = createHarness();
    try {
      const emptyStack = new Error('empty stack message');
      emptyStack.stack = '';
      const nonStringStack = new Error('non-string stack message');
      Object.defineProperty(nonStringStack, 'stack', { value: 12 });
      const unreadable = new Error();
      unreadable.stack = '';
      Object.defineProperty(unreadable, 'message', {
        get: () => {
          throw new Error('message unavailable');
        },
      });
      h.logger.log(OwnIDLogLevel.Error, 'Error', 'empty stack', emptyStack);
      h.logger.log(OwnIDLogLevel.Error, 'Error', 'non-string stack', nonStringStack);
      h.logger.log(OwnIDLogLevel.Error, 'Error', 'unreadable message', unreadable);
      await flush();
      assert.equal(readBody(h.requests[0]).exception, 'empty stack message');
      assert.equal(readBody(h.requests[1]).exception, 'non-string stack message');
      assert.equal(Object.hasOwn(readBody(h.requests[2]), 'exception'), false);
      h.requests.forEach((request) => request.resolve());
      await flush();
      assert.equal(h.timers.size, 0);
    } finally {
      h.logger.dispose();
    }
  });
});
