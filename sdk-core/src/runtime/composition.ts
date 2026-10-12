import type { Container } from '../di';
import { RuntimeConfigurationToken } from '../configuration/runtime';
import type { RuntimeConfiguration } from '../configuration/runtime';
import { createInstanceNamespace } from '../namespace/InstanceNamespace';
import type { OwnIDInstance } from '../namespace/InstanceNamespace';
import { OwnIdLoggerDiToken, OwnIdLogRouterDiToken, ServerLoggerDiToken } from '../logging';
import { OwnIdLogRouterImpl } from '../logging/impl/OwnIdLogRouterImpl';
import { ServerLoggerImpl } from '../logging/impl/ServerLoggerImpl';

export interface RuntimeComposition {
  composeRoot(root: Container): void;
  composeInstance(
    scope: Container,
    configuration: RuntimeConfiguration,
    signal: AbortSignal,
    isCurrent: () => boolean
  ): Readonly<{
    namespace: OwnIDInstance;
    dispose: () => void;
  }>;
}

export const defaultRuntimeComposition: RuntimeComposition = Object.freeze({
  composeRoot(root: Container): void {
    void root;
  },

  composeInstance(scope: Container, configuration: RuntimeConfiguration, signal: AbortSignal, isCurrent: () => boolean) {
    scope.registerValue(RuntimeConfigurationToken, configuration);
    const serverLogger = new ServerLoggerImpl(configuration, signal);
    scope.registerValue(ServerLoggerDiToken, serverLogger);
    scope.registerValue(
      OwnIdLogRouterDiToken,
      new OwnIdLogRouterImpl(
        () => scope.resolveOptional(OwnIdLoggerDiToken),
        () => scope.resolveOptional(ServerLoggerDiToken)
      )
    );
    return Object.freeze({
      namespace: createInstanceNamespace(scope, signal, isCurrent),
      dispose: () => serverLogger.dispose(),
    });
  },
});
