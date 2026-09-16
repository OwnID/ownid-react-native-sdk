import { createToken } from '../di';
import type { OwnIDConfigurationOptions, OwnIDEnv, OwnIDRegion } from './index';

type RuntimeEnv = OwnIDEnv | 'dev';

export type RuntimeConfiguration = Readonly<{
  appId: string;
  env: RuntimeEnv;
  region: OwnIDRegion;
}>;

type LanguageOverrideUpdate = readonly string[] | undefined;

export type PreparedInitialization = Readonly<{
  configuration: RuntimeConfiguration;
  languageOverrideUpdate: LanguageOverrideUpdate;
}>;

interface RuntimeLanguageProvider {
  snapshot(): readonly string[] | null;
}

export const RuntimeConfigurationToken = createToken<RuntimeConfiguration>('ownid.runtime.configuration');
export const RuntimeLanguageProviderToken = createToken<RuntimeLanguageProvider>('ownid.runtime.languages');

const APP_ID_PATTERN = /^[A-Za-z0-9]+$/;

export function prepareInitialization(configuration: OwnIDConfigurationOptions): PreparedInitialization {
  if (!isRecord(configuration)) {
    throw invalidOption('configuration', 'must be an object');
  }

  const appId = configuration.appId;
  if (typeof appId !== 'string' || !APP_ID_PATTERN.test(appId)) {
    throw invalidOption('appId', 'must be a non-empty alphanumeric string');
  }

  const env = configuration.env === undefined ? 'prod' : configuration.env;
  if (env !== 'prod' && env !== 'uat') {
    throw invalidOption('env', "must be either 'prod' or 'uat'");
  }

  const region = configuration.region === undefined ? 'us' : configuration.region;
  if (region !== 'us' && region !== 'eu') {
    throw invalidOption('region', "must be either 'us' or 'eu'");
  }

  const runtimeConfiguration = Object.freeze({ appId, env, region });

  return Object.freeze({
    configuration: runtimeConfiguration,
    languageOverrideUpdate: prepareLanguageOverrideUpdate(configuration.languages),
  });
}

export function prepareJsonInitialization(json: string): PreparedInitialization {
  if (typeof json !== 'string') {
    throw invalidOption('json', 'must be a string');
  }

  const parsed: unknown = JSON.parse(json);
  if (!isRecord(parsed)) {
    throw invalidOption('json', 'must contain an object');
  }

  const appId = parsed.appId === undefined || parsed.appId === null ? parsed.appID : parsed.appId;
  const env = prepareJsonEnum(parsed.env, 'env', ['prod', 'uat', 'dev'] as const, 'prod');
  const region = prepareJsonEnum(parsed.region, 'region', ['us', 'eu'] as const, 'us');
  if (typeof appId !== 'string' || !APP_ID_PATTERN.test(appId)) {
    throw invalidOption('appId', 'must be a non-empty alphanumeric string');
  }

  return Object.freeze({
    configuration: Object.freeze({ appId, env, region }),
    languageOverrideUpdate: prepareLanguageOverrideUpdate(parsed.languages),
  });
}

function prepareLanguageOverrideUpdate(languages: unknown): LanguageOverrideUpdate {
  if (languages === undefined || languages === null) {
    return undefined;
  }
  if (!Array.isArray(languages)) {
    throw invalidOption('languages', 'must be an array of strings or null');
  }

  const preparedLanguages = Array.from(languages, (language, index) => {
    if (typeof language !== 'string') {
      throw invalidOption(`languages[${index}]`, 'must be a string');
    }
    return language;
  });
  return Object.freeze(preparedLanguages);
}

function prepareJsonEnum<const Value extends string>(
  input: unknown,
  option: string,
  accepted: readonly Value[],
  defaultValue: Value
): Value {
  if (input === undefined || input === null) {
    return defaultValue;
  }
  if (typeof input !== 'string') {
    throw invalidOption(option, `must be one of ${accepted.map((value) => `'${value}'`).join(', ')}`);
  }

  const normalized = input.toLowerCase();
  const value = accepted.find((candidate) => candidate === normalized);
  if (value === undefined) {
    throw invalidOption(option, `must be one of ${accepted.map((candidate) => `'${candidate}'`).join(', ')}`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalidOption(option: string, expectation: string): TypeError {
  return new TypeError(`Invalid OwnID configuration option '${option}': ${expectation}.`);
}
