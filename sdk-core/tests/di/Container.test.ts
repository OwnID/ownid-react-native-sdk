import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { Container, DiError, createToken } from '../../src/di';
import type { DiErrorCode, FactoryResolver, TokenRef } from '../../src/di';

function captureDiError(action: () => unknown, expectedCode: DiErrorCode): DiError {
  let failure: unknown;

  try {
    action();
  } catch (error) {
    failure = error;
  }

  assert.ok(failure instanceof DiError);
  assert.equal(failure.code, expectedCode);
  return failure;
}

describe('Container registration and scopes', () => {
  test('tokens use object-local symbol identity even when their names match', () => {
    const firstToken = createToken<{ readonly value: string }>('ownid.test.same');
    const secondToken = createToken<{ readonly value: string }>('ownid.test.same');
    const first = { value: 'first' };
    const second = { value: 'second' };
    const nullableToken = createToken<string | null>('ownid.test.nullable');
    const container = Container.createRoot('root');

    assert.notEqual(firstToken.key, secondToken.key);
    assert.equal(Object.isFrozen(firstToken), true);

    container.registerValue(firstToken, first);
    container.registerValue(secondToken, second);
    container.registerValue(nullableToken, null);

    assert.equal(container.resolve(firstToken), first);
    assert.equal(container.resolve(secondToken), second);
    assert.equal(container.resolve(nullableToken), null);
  });

  test('value replacement and transient factories follow the current local binding', () => {
    const token = createToken<{ readonly sequence: number }>('ownid.test.service');
    const container = Container.createRoot('root');
    const first = { sequence: 0 };
    const second = { sequence: 1 };
    let sequence = 1;

    container.registerValue(token, first);
    container.registerValue(token, second);
    assert.equal(container.resolve(token), second);

    container.registerFactory(token, {
      requiredDependencies: [],
      create: () => ({ sequence: ++sequence }),
    });

    const factoryFirst = container.resolve(token);
    const factorySecond = container.resolve(token);
    assert.deepEqual(factoryFirst, { sequence: 2 });
    assert.deepEqual(factorySecond, { sequence: 3 });
    assert.notEqual(factoryFirst, factorySecond);
  });

  test('a complete child value masks its parent while sibling services still inherit', () => {
    const contextToken = createToken<Readonly<Record<string, string>>>('ownid.test.context');
    const serviceToken = createToken<object>('ownid.test.service');
    const parentContext = { loginId: 'user@example.com' };
    const emptyContext = {};
    const service = {};
    const parent = Container.createRoot('parent');
    const child = parent.createChild('child');
    const sibling = parent.createChild('sibling');

    parent.registerValue(contextToken, parentContext);
    parent.registerValue(serviceToken, service);
    child.registerValue(contextToken, emptyContext);

    assert.equal(child.resolve(contextToken), emptyContext);
    assert.equal(child.resolve(serviceToken), service);
    assert.equal(sibling.resolve(contextToken), parentContext);
    assert.equal(parent.resolve(contextToken), parentContext);
    assert.equal(child.removeLocal(contextToken), true);
    assert.equal(child.removeLocal(contextToken), false);
    assert.equal(child.resolve(contextToken), parentContext);
  });

  test('an inherited factory resolves nested dependencies from the original requester', () => {
    const dependencyToken = createToken<{ readonly source: string }>('ownid.test.dependency');
    const productToken = createToken<{ readonly dependency: { readonly source: string } }>('ownid.test.product');
    const parent = Container.createRoot('parent');
    const child = parent.createChild('child');

    parent.registerValue(dependencyToken, { source: 'parent' });
    parent.registerFactory(productToken, {
      requiredDependencies: [dependencyToken],
      create: (requester) => ({ dependency: requester.resolve(dependencyToken) }),
    });
    child.registerValue(dependencyToken, { source: 'child' });

    assert.equal(parent.resolve(productToken).dependency.source, 'parent');
    assert.equal(child.resolve(productToken).dependency.source, 'child');
  });

  test('a factory can create a deliberate child override of its own token', () => {
    const token = createToken<string>('ownid.test.self-override');
    const root = Container.createRoot('root');

    root.registerFactory(token, {
      requiredDependencies: [],
      create: (requester) => {
        const child = requester.createChild('override');
        child.registerFactory(token, { requiredDependencies: [], create: () => 'child' });
        return child.resolve(token);
      },
    });

    assert.equal(root.resolve(token), 'child');
  });

  test('a fresh child that inherits the active factory still reports a cycle', () => {
    const token = createToken<string>('ownid.test.inherited-self');
    const root = Container.createRoot('root');

    root.registerFactory(token, {
      requiredDependencies: [],
      create: (requester) => requester.createChild('inheriting-child').resolve(token),
    });

    const failure = captureDiError(() => root.resolve(token), 'DI_CYCLE');
    assert.deepEqual(failure.path, [
      { token: 'ownid.test.inherited-self', bindingScope: 'root' },
      { token: 'ownid.test.inherited-self', bindingScope: 'root' },
    ]);
  });

  test('an operation captures context while its child API masks context and shares transport', () => {
    interface Context {
      readonly loginId: string | null;
    }

    interface Api {
      readonly context: Context;
      readonly transport: object;
    }

    interface Operation {
      readonly capturedContext: Context | undefined;
      readonly api: Api;
    }

    const contextToken = createToken<Context>('ownid.test.operation.context');
    const transportToken = createToken<object>('ownid.test.operation.transport');
    const apiToken = createToken<Api>('ownid.test.operation.api');
    const operationToken = createToken<Operation>('ownid.test.operation');
    const emptyContext: Context = { loginId: null };
    const firstContext: Context = { loginId: 'first@example.com' };
    const secondContext: Context = { loginId: 'second@example.com' };
    const transport = {};
    const container = Container.createRoot('instance');

    container.registerValue(contextToken, firstContext);
    container.registerValue(transportToken, transport);
    container.registerFactory(apiToken, {
      requiredDependencies: [contextToken, transportToken],
      create: (requester) => ({
        context: requester.resolve(contextToken),
        transport: requester.resolve(transportToken),
      }),
    });
    container.registerFactory(operationToken, {
      requiredDependencies: [apiToken],
      create: (requester) => {
        const capturedContext = requester.resolveOptional(contextToken);
        const apiScope = requester.createChild('operation-api');
        apiScope.registerValue(contextToken, emptyContext);
        return { capturedContext, api: apiScope.resolve(apiToken) };
      },
    });

    const firstOperation = container.resolve(operationToken);
    container.registerValue(contextToken, secondContext);
    const secondOperation = container.resolve(operationToken);

    assert.equal(firstOperation.capturedContext, firstContext);
    assert.equal(secondOperation.capturedContext, secondContext);
    assert.equal(firstOperation.api.context, emptyContext);
    assert.equal(secondOperation.api.context, emptyContext);
    assert.equal(firstOperation.api.transport, transport);
    assert.equal(secondOperation.api.transport, transport);
    assert.notEqual(firstOperation, secondOperation);
  });
});

describe('Container metadata inspection', () => {
  test('inspection uses copied metadata and never invokes factories', () => {
    const dependencyToken = createToken<object>('ownid.test.dependency');
    const replacementToken = createToken<object>('ownid.test.replacement');
    const productToken = createToken<object>('ownid.test.product');
    const dependencies: TokenRef[] = [dependencyToken];
    const container = Container.createRoot('root');
    let invocations = 0;

    container.registerValue(dependencyToken, {});
    container.registerFactory(productToken, {
      requiredDependencies: dependencies,
      create: () => {
        invocations += 1;
        return {};
      },
    });
    dependencies[0] = replacementToken;

    assert.deepEqual(container.inspect(productToken), { resolvable: true, issues: [] });
    assert.equal(container.canResolve(productToken), true);
    assert.equal(invocations, 0);
  });

  test('inspection reports every distinct same-label missing token by identity', () => {
    const firstMissing = createToken<object>('ownid.test.missing');
    const secondMissing = createToken<object>('ownid.test.missing');
    const productToken = createToken<object>('ownid.test.product');
    const container = Container.createRoot('request');

    container.registerFactory(productToken, {
      requiredDependencies: [firstMissing, firstMissing, secondMissing],
      create: () => ({}),
    });

    const inspection = container.inspect(productToken);
    assert.equal(inspection.resolvable, false);
    assert.equal(container.canResolve(productToken), false);
    assert.equal(inspection.issues.length, 2);
    assert.deepEqual(
      inspection.issues.map((issue) => issue.kind),
      ['missing', 'missing']
    );
    assert.deepEqual(inspection.issues[0]?.path, [
      { token: 'ownid.test.product', bindingScope: 'request' },
      { token: 'ownid.test.missing' },
    ]);
    assert.deepEqual(container.resolve(productToken), {});
  });

  test('inspection preserves distinct dependency paths to the same missing token', () => {
    const missingToken = createToken<object>('ownid.test.missing');
    const leftToken = createToken<object>('ownid.test.left');
    const rightToken = createToken<object>('ownid.test.right');
    const productToken = createToken<object>('ownid.test.product');
    const container = Container.createRoot('root');

    container.registerFactory(leftToken, { requiredDependencies: [missingToken], create: () => ({}) });
    container.registerFactory(rightToken, { requiredDependencies: [missingToken], create: () => ({}) });
    container.registerFactory(productToken, { requiredDependencies: [leftToken, rightToken], create: () => ({}) });

    assert.deepEqual(container.inspect(productToken).issues, [
      {
        kind: 'missing',
        path: [
          { token: 'ownid.test.product', bindingScope: 'root' },
          { token: 'ownid.test.left', bindingScope: 'root' },
          { token: 'ownid.test.missing' },
        ],
      },
      {
        kind: 'missing',
        path: [
          { token: 'ownid.test.product', bindingScope: 'root' },
          { token: 'ownid.test.right', bindingScope: 'root' },
          { token: 'ownid.test.missing' },
        ],
      },
    ]);
  });

  test('declared cycles deduplicate repeated dependency metadata, close their paths, and respect visible child overrides', () => {
    const firstToken = createToken<object>('ownid.test.first');
    const secondToken = createToken<object>('ownid.test.second');
    const root = Container.createRoot('root');

    root.registerFactory(firstToken, {
      requiredDependencies: [secondToken, secondToken],
      create: () => ({}),
    });
    root.registerFactory(secondToken, {
      requiredDependencies: [firstToken],
      create: () => ({}),
    });

    assert.deepEqual(root.inspect(firstToken), {
      resolvable: false,
      issues: [
        {
          kind: 'cycle',
          path: [
            { token: 'ownid.test.first', bindingScope: 'root' },
            { token: 'ownid.test.second', bindingScope: 'root' },
            { token: 'ownid.test.first', bindingScope: 'root' },
          ],
        },
      ],
    });

    const child = root.createChild('child');
    child.registerValue(firstToken, {});
    assert.deepEqual(child.inspect(firstToken), { resolvable: true, issues: [] });
  });
});

describe('Container resolution failures', () => {
  test('optional resolution returns undefined only for an absent visible binding', () => {
    const missingToken = createToken<object>('ownid.test.missing');
    const failingToken = createToken<object>('ownid.test.failing');
    const cause = new Error('expected');
    const container = Container.createRoot('root');

    assert.equal(container.resolveOptional(missingToken), undefined);

    container.registerFactory(failingToken, {
      requiredDependencies: [],
      create: () => {
        throw cause;
      },
    });

    const failure = captureDiError(() => container.resolveOptional(failingToken), 'DI_FACTORY_FAILED');
    assert.equal(failure.underlyingCause, cause);
  });

  test('a nested missing binding reports its full path and requester scope', () => {
    const missingToken = createToken<object>('ownid.test.missing');
    const productToken = createToken<object>('ownid.test.product');
    const root = Container.createRoot('root');
    const child = root.createChild('child');

    root.registerFactory(productToken, {
      requiredDependencies: [missingToken],
      create: (requester) => requester.resolve(missingToken),
    });

    const failure = captureDiError(() => child.resolve(productToken), 'DI_MISSING_BINDING');
    assert.equal(failure.requestScope, 'child');
    assert.deepEqual(failure.path, [{ token: 'ownid.test.product', bindingScope: 'root' }, { token: 'ownid.test.missing' }]);
  });

  test('runtime cycles are detected from actual factory execution and the stack recovers', () => {
    const firstToken = createToken<object>('ownid.test.first');
    const secondToken = createToken<object>('ownid.test.second');
    const safeToken = createToken<string>('ownid.test.safe');
    const missingAfterCycleToken = createToken<string>('ownid.test.missing-after-cycle');
    const container = Container.createRoot('root');

    container.registerFactory(firstToken, {
      requiredDependencies: [],
      create: (requester) => requester.resolve(secondToken),
    });
    container.registerFactory(secondToken, {
      requiredDependencies: [],
      create: (requester) => requester.resolve(firstToken),
    });

    assert.deepEqual(container.inspect(firstToken), { resolvable: true, issues: [] });

    const failure = captureDiError(() => container.resolve(firstToken), 'DI_CYCLE');
    assert.deepEqual(failure.path, [
      { token: 'ownid.test.first', bindingScope: 'root' },
      { token: 'ownid.test.second', bindingScope: 'root' },
      { token: 'ownid.test.first', bindingScope: 'root' },
    ]);

    container.registerValue(safeToken, 'safe');
    assert.equal(container.resolve(safeToken), 'safe');
    assert.deepEqual(captureDiError(() => container.resolve(missingAfterCycleToken), 'DI_MISSING_BINDING').path, [
      { token: 'ownid.test.missing-after-cycle' },
    ]);
  });

  test('a retained requester starts a fresh resolution chain', () => {
    const retainingToken = createToken<object>('ownid.test.retaining');
    const laterToken = createToken<string>('ownid.test.later');
    const container = Container.createRoot('root');
    let retained: FactoryResolver | undefined;

    container.registerFactory(retainingToken, {
      requiredDependencies: [laterToken],
      create: (requester) => {
        retained = requester;
        return {};
      },
    });
    container.resolve(retainingToken);
    container.registerValue(laterToken, 'later');

    assert.equal(retained?.resolve(laterToken), 'later');
  });

  test('factory exceptions are wrapped while an existing DiError propagates unchanged', () => {
    const wrappedToken = createToken<object>('ownid.test.wrapped');
    const propagatedToken = createToken<object>('ownid.test.propagated');
    const cause = { reason: 'expected' };
    const original = new DiError('original', {
      code: 'DI_MISSING_BINDING',
      requestScope: 'original',
      path: [{ token: 'ownid.test.original' }],
    });
    const container = Container.createRoot('root');

    container.registerFactory(wrappedToken, {
      requiredDependencies: [],
      create: () => {
        throw cause;
      },
    });
    container.registerFactory(propagatedToken, {
      requiredDependencies: [],
      create: () => {
        throw original;
      },
    });

    const wrapped = captureDiError(() => container.resolve(wrappedToken), 'DI_FACTORY_FAILED');
    assert.equal(wrapped.underlyingCause, cause);
    assert.throws(
      () => container.resolveOptional(propagatedToken),
      (error) => error === original
    );
    assert.throws(
      () => container.resolve(propagatedToken),
      (error) => error === original
    );
  });

  test('invalid value bindings are rejected before replacing the current binding', () => {
    const token = createToken<string>('ownid.test.value');
    const broadToken = createToken<object>('ownid.test.broad-value');
    const container = Container.createRoot('root');
    const getterFailure = new Error('then getter failed');
    const throwingThen = Object.defineProperty({}, 'then', {
      get: () => {
        throw getterFailure;
      },
    });

    container.registerValue(token, 'current');
    captureDiError(() => container.registerValue(token, undefined as unknown as string), 'DI_UNDEFINED_VALUE');
    assert.equal(container.resolve(token), 'current');

    captureDiError(() => container.registerValue(token, Promise.resolve('next') as unknown as string), 'DI_ASYNC_VALUE');
    assert.equal(container.resolve(token), 'current');

    captureDiError(() => container.registerValue(broadToken, Promise.resolve({})), 'DI_ASYNC_VALUE');
    assert.equal(container.resolveOptional(broadToken), undefined);

    assert.throws(
      () => container.registerValue(token, throwingThen as unknown as string),
      (error) => error === getterFailure
    );
    assert.equal(container.resolve(token), 'current');
  });

  test('undefined and thenable factory results use distinct error categories', () => {
    const undefinedToken = createToken<object>('ownid.test.undefined-result');
    const asyncToken = createToken<object>('ownid.test.async-result');
    const container = Container.createRoot('root');

    container.registerFactory(undefinedToken, {
      requiredDependencies: [],
      create: (() => undefined) as unknown as () => object,
    });
    container.registerFactory(asyncToken, {
      requiredDependencies: [],
      create: () => Promise.resolve({}),
    });

    captureDiError(() => container.resolve(undefinedToken), 'DI_UNDEFINED_FACTORY_RESULT');
    captureDiError(() => container.resolve(asyncToken), 'DI_ASYNC_FACTORY_RESULT');
  });
});
