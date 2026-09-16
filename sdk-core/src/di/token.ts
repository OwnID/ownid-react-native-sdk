const tokenKind: unique symbol = Symbol('ownid.di.token');
const tokenType: unique symbol = Symbol('ownid.di.token.type');

export interface TokenRef {
  readonly key: symbol;
  readonly debugName: string;
  readonly [tokenKind]: true;
}

export interface Token<T> extends TokenRef {
  // This phantom function property makes the token invariant under strictFunctionTypes.
  readonly [tokenType]: (value: T) => T;
}

// Static guards reject visible Promise-like types; runtime checks still reject thenables hidden by assertions or broad types such as object.
type TokenTypeGuard<T> = [T] extends [never]
  ? [invalid_token_type: never]
  : [undefined] extends [T]
    ? [token_must_exclude_undefined: never]
    : [Extract<T, PromiseLike<unknown>>] extends [never]
      ? []
      : [token_must_exclude_promise_like: never];

export function createToken<T>(debugName: string, ..._invalid: TokenTypeGuard<T>): Token<T> {
  void _invalid;
  return Object.freeze({
    key: Symbol(debugName),
    debugName,
    [tokenKind]: true as const,
    [tokenType]: (value: T) => value,
  });
}
