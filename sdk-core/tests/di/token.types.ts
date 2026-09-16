import { Container, createToken } from '../../src/di';
import type { FactoryRegistration, Token, TokenRef } from '../../src/di';

const stringToken = createToken<string>('ownid.test.string');
const unionToken = createToken<string | number>('ownid.test.union');
const nullableToken = createToken<string | null>('ownid.test.nullable');
const objectToken = createToken<{ readonly value: string }>('ownid.test.object');
const metadata: readonly TokenRef[] = [stringToken, nullableToken, objectToken];

const syncRegistration: FactoryRegistration<string> = {
  requiredDependencies: metadata,
  create: () => 'value',
};

const container = Container.createRoot('type-test');
container.registerValue(stringToken, 'value');
container.registerValue(nullableToken, null);
container.registerFactory(stringToken, syncRegistration);

// @ts-expect-error Tokens are invariant in their value type.
const widenedToken: Token<string | number> = stringToken;
// @ts-expect-error Token invariance also prevents narrowing the value type.
const narrowedToken: Token<string> = unionToken;
// @ts-expect-error The bound value must match the token type.
container.registerValue(stringToken, 1);
// @ts-expect-error Async factories do not satisfy a synchronous registration.
container.registerFactory(stringToken, { requiredDependencies: [], create: async () => 'value' });
// @ts-expect-error never cannot be used as a token value type.
createToken<never>('ownid.test.never');
// @ts-expect-error undefined is reserved for an absent binding.
createToken<string | undefined>('ownid.test.undefined');
// @ts-expect-error unknown includes undefined and cannot be used as a token value type.
createToken<unknown>('ownid.test.unknown');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExplicitAny = any;
// @ts-expect-error any cannot be used as a token value type.
createToken<ExplicitAny>('ownid.test.any');
// @ts-expect-error Promise-like values cannot be used as a token value type.
createToken<PromiseLike<string>>('ownid.test.promise');
// @ts-expect-error A union containing a Promise-like value cannot be a token value type.
createToken<string | PromiseLike<string>>('ownid.test.promise-union');

void widenedToken;
void narrowedToken;
