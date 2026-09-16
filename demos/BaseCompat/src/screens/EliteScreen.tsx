import { useCallback, useEffect } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';

import { OwnIDEliteView } from '@ownid/react-native-core';
import type { AuthResult, LoginPayload, OwnIDEliteErrorDetails } from '@ownid/react-native-core';
import type { DemoConfiguration } from '../configuration';
import { sessionFromLoginPayload } from '../identity/demoIdentity';
import type { DemoSession } from '../identity/demoIdentity';

export const ELITE_BACKGROUND = '#FFFFFF';

type EliteScreenProps = Readonly<{
  configuration: DemoConfiguration;
  onDismiss: () => void;
  onSession: (session: DemoSession) => void;
  onTerminalError: (message: string) => void;
}>;

export function EliteScreen({ configuration, onDismiss, onSession, onTerminalError }: EliteScreenProps) {
  const createSession = useCallback(
    async (payload: LoginPayload): Promise<AuthResult> => {
      try {
        const nextSession = sessionFromLoginPayload(payload);
        onSession(nextSession);
        return { status: 'logged-in' };
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Demo Identity returned an invalid session.';
        return { status: 'fail', reason };
      }
    },
    [onSession]
  );

  const handleFinish = useCallback(async (): Promise<void> => {
    onDismiss();
  }, [onDismiss]);

  const handleError = useCallback(
    async (message: string, details: OwnIDEliteErrorDetails): Promise<void> => {
      if (details.terminal) onTerminalError(message);
    },
    [onTerminalError]
  );

  const handleClose = useCallback(async (): Promise<void> => {
    onDismiss();
  }, [onDismiss]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onDismiss();
      return true;
    });
    return () => subscription.remove();
  }, [onDismiss]);

  return (
    <View style={styles.screen}>
      <OwnIDEliteView
        options={{ origin: configuration.eliteOrigin }}
        events={{ onFinish: handleFinish, onError: handleError, onClose: handleClose }}
        providers={{ session: { create: createSession } }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: ELITE_BACKGROUND, flex: 1 },
});
