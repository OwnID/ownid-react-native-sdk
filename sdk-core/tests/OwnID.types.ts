import { OwnID, OwnIDLogLevel } from '../src';
import type {
  AuthResult,
  LoginPayload,
  OwnIDConfigurationOptions,
  OwnIDContext,
  OwnIDEliteNamespace,
  OwnIDEnv,
  OwnIDFlows,
  OwnIDInstance,
} from '../src';

OwnID.configureLogging({ level: OwnIDLogLevel.Debug, onLog: (entry) => void entry.message });
const env: OwnIDEnv = 'uat';
const configuration: OwnIDConfigurationOptions = { appId: 'App123', env, region: 'eu', languages: ['uk-UA'] };
OwnID.initialize(configuration);
OwnID.initializeFromJson('{"appId":"App123","env":"dev"}');
const context: OwnIDContext = { loginId: 'user@example.com' };
const createSession = async (payload: LoginPayload): Promise<AuthResult> => {
  void payload;
  return { status: 'logged-in' };
};
const scoped: OwnIDInstance = OwnID.withContext(context).withProviders({ session: { create: createSession } });
const flows: OwnIDFlows = scoped.flows.withContext({}).withProviders({});
const elite: OwnIDEliteNamespace = flows.elite;
void elite;
// @ts-expect-error Resolved runtime configuration is not part of the current public instance contract.
void scoped.configuration;
OwnID.setContext({ loginId: null }).setProviders({});
OwnID.clearContext();
OwnID.destroy();

// @ts-expect-error Public initialization has no named-instance parameter.
OwnID.initialize('CUSTOM', { appId: 'App123' });
// @ts-expect-error DEV stays outside the public environment type.
OwnID.initialize({ appId: 'App123', env: 'dev' });
// @ts-expect-error Custom server roots are not part of the current public initialization contract.
OwnID.initialize({ appId: 'App123', rootUrl: 'https://server.example' });
// @ts-expect-error Named instance lifecycle remains source-private.
OwnID.destroy('CUSTOM');
// @ts-expect-error JSON initialization accepts one string argument.
OwnID.initializeFromJson({ appId: 'App123' });
// @ts-expect-error Only the approved loginId Context field is currently supported.
OwnID.withContext({ accessToken: 'token' });
// @ts-expect-error Flow namespaces cannot mutate their bound scope.
OwnID.flows.setContext({ loginId: 'user@example.com' });
// @ts-expect-error Elite is a leaf namespace; scope flows before selecting it.
OwnID.flows.elite.withContext({ loginId: 'user@example.com' });
// @ts-expect-error Provider create must use the shared asynchronous AuthResult contract.
OwnID.setProviders({ session: { create: () => ({ status: 'logged-in' }) } });
