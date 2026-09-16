import type {
  DependencyGraphInspection,
  DependencyGraphIssue,
  DependencyPathItem,
  FactoryRegistration,
  FactoryResolver,
  Registrar,
} from './contracts';
import { DiError } from './errors';
import type { Token, TokenRef } from './token';

interface ValueBindingRecord {
  readonly kind: 'value';
  readonly token: TokenRef;
  readonly bindingScope: string;
  readonly value: unknown;
}

interface FactoryBindingRecord {
  readonly kind: 'factory';
  readonly token: TokenRef;
  readonly bindingScope: string;
  readonly requiredDependencies: readonly TokenRef[];
  readonly create: (requester: FactoryResolver) => unknown;
}

type BindingRecord = ValueBindingRecord | FactoryBindingRecord;

interface ActiveFactoryFrame {
  readonly record: FactoryBindingRecord;
  readonly pathItem: DependencyPathItem;
}

const activeFactoryStack: ActiveFactoryFrame[] = [];

function isThenable(value: unknown): boolean {
  const canHaveProperties = (typeof value === 'object' && value !== null) || typeof value === 'function';

  return canHaveProperties && typeof (value as { readonly then?: unknown }).then === 'function';
}

function formatPath(path: readonly DependencyPathItem[]): string {
  return path.map((item) => (item.bindingScope === undefined ? item.token : `${item.bindingScope}:${item.token}`)).join(' -> ');
}

export class Container implements FactoryResolver, Registrar {
  readonly scopeName: string;

  private readonly parent?: Container;
  private readonly bindings = new Map<symbol, BindingRecord>();

  static createRoot(scopeName: string): Container {
    return new Container(scopeName);
  }

  private constructor(scopeName: string, parent?: Container) {
    this.scopeName = scopeName;
    this.parent = parent;
  }

  createChild(scopeName: string): Container {
    return new Container(scopeName, this);
  }

  resolve<T>(token: Token<T>): T {
    const binding = this.findVisibleBinding(token);

    if (binding === undefined) {
      const path = [...activeFactoryStack.map((frame) => frame.pathItem), this.pathItem(token)];
      throw new DiError(`No binding for ${token.debugName} while resolving ${formatPath(path)}`, {
        code: 'DI_MISSING_BINDING',
        requestScope: this.scopeName,
        path,
      });
    }

    if (binding.kind === 'value') {
      return binding.value as T;
    }

    const pathItem = this.pathItem(binding.token, binding.bindingScope);
    if (activeFactoryStack.some((frame) => frame.record === binding)) {
      const path = [...activeFactoryStack.map((frame) => frame.pathItem), pathItem];
      throw new DiError(`Dependency cycle detected: ${formatPath(path)}`, {
        code: 'DI_CYCLE',
        requestScope: this.scopeName,
        path,
      });
    }

    activeFactoryStack.push({ record: binding, pathItem });
    try {
      const result = binding.create(this);

      if (result === undefined) {
        const path = activeFactoryStack.map((frame) => frame.pathItem);
        throw new DiError(`Factory returned undefined while resolving ${formatPath(path)}`, {
          code: 'DI_UNDEFINED_FACTORY_RESULT',
          requestScope: this.scopeName,
          path,
        });
      }

      if (isThenable(result)) {
        const path = activeFactoryStack.map((frame) => frame.pathItem);
        throw new DiError(`Factory returned a thenable while resolving ${formatPath(path)}`, {
          code: 'DI_ASYNC_FACTORY_RESULT',
          requestScope: this.scopeName,
          path,
        });
      }

      return result as T;
    } catch (cause) {
      if (cause instanceof DiError) {
        throw cause;
      }

      const path = activeFactoryStack.map((frame) => frame.pathItem);
      throw new DiError(`Factory failed while resolving ${formatPath(path)}`, {
        code: 'DI_FACTORY_FAILED',
        requestScope: this.scopeName,
        path,
        underlyingCause: cause,
      });
    } finally {
      activeFactoryStack.pop();
    }
  }

  resolveOptional<T>(token: Token<T>): T | undefined {
    if (this.findVisibleBinding(token) === undefined) {
      return undefined;
    }

    return this.resolve(token);
  }

  canResolve(token: TokenRef): boolean {
    return this.inspect(token).resolvable;
  }

  inspect(token: TokenRef): DependencyGraphInspection {
    const issues: DependencyGraphIssue[] = [];

    const visit = (dependency: TokenRef, path: readonly DependencyPathItem[], activeBindings: readonly FactoryBindingRecord[]): void => {
      const binding = this.findVisibleBinding(dependency);
      if (binding === undefined) {
        issues.push({ kind: 'missing', path: [...path, this.pathItem(dependency)] });
        return;
      }

      const pathItem = this.pathItem(binding.token, binding.bindingScope);

      if (binding.kind === 'value') {
        return;
      }

      if (activeBindings.includes(binding)) {
        issues.push({ kind: 'cycle', path: [...path, pathItem] });
        return;
      }

      const nextPath = [...path, pathItem];
      const nextActiveBindings = [...activeBindings, binding];
      const visitedRequiredDependencies = new Set<symbol>();

      for (const requiredDependency of binding.requiredDependencies) {
        if (visitedRequiredDependencies.has(requiredDependency.key)) {
          continue;
        }

        visitedRequiredDependencies.add(requiredDependency.key);
        visit(requiredDependency, nextPath, nextActiveBindings);
      }
    };

    visit(token, [], []);
    return { resolvable: issues.length === 0, issues };
  }

  registerValue<T>(token: Token<T>, value: T): void {
    const path = [this.pathItem(token, this.scopeName)];

    if (value === undefined) {
      throw new DiError(`Cannot bind undefined to ${token.debugName}`, {
        code: 'DI_UNDEFINED_VALUE',
        requestScope: this.scopeName,
        path,
      });
    }

    if (isThenable(value)) {
      throw new DiError(`Cannot bind a thenable to ${token.debugName}`, {
        code: 'DI_ASYNC_VALUE',
        requestScope: this.scopeName,
        path,
      });
    }

    this.bindings.set(token.key, {
      kind: 'value',
      token,
      bindingScope: this.scopeName,
      value,
    });
  }

  registerFactory<T>(token: Token<T>, binding: FactoryRegistration<T>): void {
    const create = binding.create;
    this.bindings.set(token.key, {
      kind: 'factory',
      token,
      bindingScope: this.scopeName,
      requiredDependencies: [...binding.requiredDependencies],
      create: (requester) => create(requester),
    });
  }

  removeLocal<T>(token: Token<T>): boolean {
    return this.bindings.delete(token.key);
  }

  private findVisibleBinding(token: TokenRef): BindingRecord | undefined {
    const binding = this.bindings.get(token.key);
    if (binding !== undefined) {
      return binding;
    }

    return this.parent?.findVisibleBinding(token);
  }

  private pathItem(token: TokenRef, bindingScope?: string): DependencyPathItem {
    return bindingScope === undefined ? { token: token.debugName } : { token: token.debugName, bindingScope };
  }
}
