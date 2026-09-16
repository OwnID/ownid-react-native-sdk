import { useCallback, useEffect, useRef } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';

import { OwnIDEliteView } from '@ownid/react-native-core';
import type { AuthResult, LoginPayload, OwnIDEliteErrorDetails } from '@ownid/react-native-core';
import { configuration } from '../configuration';
import { createBritaSession } from '../identity/britaSession';
import type { BritaSession } from '../identity/britaSession';

type EliteScreenProps = Readonly<{
  origin: string;
  onDismiss: () => void;
  onSessionEstablished: (session: BritaSession) => void;
  onTerminalError: (message: string) => void;
}>;

export function EliteScreen({ origin, onDismiss, onSessionEstablished, onTerminalError }: EliteScreenProps) {
  const controllerRef = useRef<AbortController | null>(null);

  const createSession = useCallback(
    async (payload: LoginPayload): Promise<AuthResult> => {
      const controller = controllerRef.current;
      if (controller === null || controller.signal.aborted) {
        return { status: 'fail', reason: 'Brita session creation was cancelled.' };
      }

      try {
        const nextSession = await createBritaSession(payload, configuration.currentUserUrl, controller.signal);
        if (controller.signal.aborted) return { status: 'fail', reason: 'Brita session creation was cancelled.' };
        onSessionEstablished(nextSession);
        return { status: 'logged-in' };
      } catch (error) {
        if (controller.signal.aborted) return { status: 'fail', reason: 'Brita session creation was cancelled.' };
        const reason = error instanceof Error ? error.message : 'Brita session creation failed.';
        return { status: 'fail', reason };
      }
    },
    [onSessionEstablished]
  );

  const handleFinish = useCallback(async (): Promise<void> => {
    onDismiss();
  }, [onDismiss]);

  const handleError = useCallback(
    async (message: string, details: OwnIDEliteErrorDetails): Promise<void> => {
      if (details.terminal) {
        onTerminalError(message);
        onDismiss();
      }
    },
    [onDismiss, onTerminalError]
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

  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;

    return () => {
      controller.abort();
      if (controllerRef.current === controller) controllerRef.current = null;
    };
  }, []);

  return (
    <View style={styles.screen}>
      <OwnIDEliteView
        options={{ origin }}
        events={{ onFinish: handleFinish, onError: handleError, onClose: handleClose }}
        providers={{ session: { create: createSession } }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#FFFFFF', flex: 1 },
});
