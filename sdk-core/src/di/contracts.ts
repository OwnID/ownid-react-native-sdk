import type { Container } from './Container';
import type { Token, TokenRef } from './token';

type SyncFactoryResult<T> = [Extract<T, PromiseLike<unknown>>] extends [never] ? T : never;

export interface FactoryRegistration<T> {
  readonly requiredDependencies: readonly TokenRef[];
  readonly create: (requester: FactoryResolver) => SyncFactoryResult<T>;
}

export interface DependencyPathItem {
  readonly token: string;
  readonly bindingScope?: string;
}

export type DependencyGraphIssue =
  | { readonly kind: 'missing'; readonly path: readonly DependencyPathItem[] }
  | { readonly kind: 'cycle'; readonly path: readonly DependencyPathItem[] };

export interface DependencyGraphInspection {
  readonly resolvable: boolean;
  readonly issues: readonly DependencyGraphIssue[];
}

export type DiErrorCode =
  | 'DI_MISSING_BINDING'
  | 'DI_CYCLE'
  | 'DI_FACTORY_FAILED'
  | 'DI_UNDEFINED_VALUE'
  | 'DI_UNDEFINED_FACTORY_RESULT'
  | 'DI_ASYNC_VALUE'
  | 'DI_ASYNC_FACTORY_RESULT';

export interface DiErrorInput {
  readonly code: DiErrorCode;
  readonly requestScope: string;
  readonly path: readonly DependencyPathItem[];
  readonly underlyingCause?: unknown;
}

export interface Resolver {
  readonly scopeName: string;
  resolve<T>(token: Token<T>): T;
  resolveOptional<T>(token: Token<T>): T | undefined;
  canResolve(token: TokenRef): boolean;
  inspect(token: TokenRef): DependencyGraphInspection;
}

export interface FactoryResolver extends Resolver {
  createChild(scopeName: string): Container;
}

export interface Registrar {
  registerValue<T>(token: Token<T>, value: T): void;
  registerFactory<T>(token: Token<T>, binding: FactoryRegistration<T>): void;
  removeLocal<T>(token: Token<T>): boolean;
}
