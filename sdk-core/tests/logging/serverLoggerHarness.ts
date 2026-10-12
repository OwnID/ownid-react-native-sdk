import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, URL } from 'node:url';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

import type { RuntimeConfiguration } from '../../src/configuration/runtime';
import { OwnIDLogLevel } from '../../src/logging';
import type { ServerLogger } from '../../src/logging/ServerLogger';

const sourceFile = fileURLToPath(new URL('../../src/logging/impl/ServerLoggerImpl.ts', import.meta.url));
const sourceRequire = createRequire(sourceFile);
const sourceCode = ts.transpileModule(readFileSync(sourceFile, 'utf8'), {
  fileName: sourceFile,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
export const metadata = sourceRequire('@ownid/react-native-core/package.json') as { version: string };
export const configuration: RuntimeConfiguration = { appId: 'App123', env: 'prod', region: 'us' };

export interface Attempt {
  readonly url: string;
  readonly init: RequestInit;
  resolve(status?: number): void;
  reject(cause: unknown): void;
}

interface HarnessOptions {
  readonly platformFailure?: Error;
  readonly fetchFailure?: Error;
}

// Execute the actual sender with only the RN import and fetch/time boundaries replaced.
// Requests and deadlines never reach the process's real fetch or timers.
export function createSenderRuntime(platform: 'android' | 'ios' | 'windows' = 'android', options: HarnessOptions = {}) {
  const requests: Attempt[] = [];
  const timers = new Map<number, () => void>();
  const deadlineDelays: number[] = [];
  let nextTimer = 0;
  let platformReads = 0;
  let now = 10_000;
  const platformModule = {
    Platform: {
      OS: platform,
      Version: platform === 'ios' ? '18.4' : 35,
      constants: { Release: '15', Model: 'Phone (Test)' },
      select: (values: Record<string, string>) => {
        platformReads++;
        if (options.platformFailure !== undefined) throw options.platformFailure;
        return values[platform];
      },
    },
  };
  const output = { exports: {} as { ServerLoggerImpl: new (config: RuntimeConfiguration, signal: AbortSignal) => ServerLogger } };
  runInNewContext(
    sourceCode,
    {
      exports: output.exports,
      module: output,
      Error,
      Date: { now: () => now },
      AbortController,
      setTimeout(callback: () => void, delay: number) {
        const id = ++nextTimer;
        timers.set(id, callback);
        deadlineDelays.push(delay);
        return id;
      },
      clearTimeout(id: number) {
        timers.delete(id);
      },
      fetch(url: string, init: RequestInit) {
        if (options.fetchFailure !== undefined) throw options.fetchFailure;
        return new Promise<Response>((resolve, reject) => {
          requests.push({ url, init, resolve: (status = 204) => resolve({ status } as Response), reject });
        });
      },
      require(name: string) {
        if (name === '@ownid/react-native-core/package.json') return metadata;
        if (name === '../index') return { OwnIDLogLevel };
        if (name === 'react-native') return platformModule;
        throw new Error(`Unexpected sender import: ${name}`);
      },
    },
    { filename: sourceFile }
  );
  return {
    ServerLoggerImpl: output.exports.ServerLoggerImpl,
    requests,
    timers,
    deadlineDelays,
    platformReads: () => platformReads,
    advanceTime: () => (now += 10_000),
    expire() {
      for (const [id, callback] of [...timers]) {
        timers.delete(id);
        callback();
      }
    },
  };
}

export function createServerLoggerHarness(
  config: RuntimeConfiguration = configuration,
  platform: 'android' | 'ios' | 'windows' = 'android',
  options: HarnessOptions = {}
) {
  const runtime = createSenderRuntime(platform, options);
  const instance = new AbortController();
  const logger = new runtime.ServerLoggerImpl(config, instance.signal);
  return { ...runtime, logger, instance };
}

export const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
export const readBody = (request: Attempt | undefined): Record<string, unknown> => {
  assert.ok(request);
  assert.equal(typeof request.init.body, 'string');
  return JSON.parse(request.init.body as string) as Record<string, unknown>;
};
