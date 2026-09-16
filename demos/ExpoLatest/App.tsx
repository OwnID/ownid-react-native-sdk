import { useCallback, useEffect, useState } from 'react';
import { StatusBar, StyleSheet, useColorScheme, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { OwnID, OwnIDLogLevel } from '@ownid/react-native-core';
import { configuration } from './src/configuration';
import type { BritaSession } from './src/identity/britaSession';
import { EliteScreen } from './src/screens/EliteScreen';
import { getHomePalette, HomeScreen } from './src/screens/HomeScreen';
import { UserScreen } from './src/screens/UserScreen';

const ELITE_BACKGROUND = '#FFFFFF';

type InitializationState = Readonly<{
  ready: boolean;
  message: string;
}>;

export default function App() {
  return (
    <SafeAreaProvider>
      <DemoScreen />
    </SafeAreaProvider>
  );
}

function DemoScreen() {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const palette = getHomePalette(colorScheme);
  const [initialization, setInitialization] = useState<InitializationState>({ ready: false, message: 'Initializing…' });
  const [eliteVisible, setEliteVisible] = useState(false);
  const [session, setSession] = useState<BritaSession | null>(null);

  const dismissElite = useCallback(() => {
    setEliteVisible(false);
  }, []);

  const establishSession = useCallback((nextSession: BritaSession) => {
    setSession(nextSession);
  }, []);

  const reportEliteError = useCallback((message: string) => {
    setInitialization((current) => ({ ...current, message: `Elite failed: ${message}` }));
  }, []);

  const logout = useCallback(() => {
    setSession(null);
  }, []);

  const startElite = useCallback(() => {
    setEliteVisible(true);
  }, []);

  useEffect(() => {
    // Optional diagnostics for this demo.
    OwnID.configureLogging({ level: OwnIDLogLevel.Debug });

    try {
      OwnID.initialize({ appId: configuration.appId, env: 'uat' });
      setInitialization({ ready: true, message: 'OwnID initialized successfully.' });
    } catch (error) {
      setInitialization({
        ready: false,
        message: error instanceof Error ? `Initialization failed: ${error.message}` : 'Initialization failed.',
      });
    }
  }, []);

  const backgroundColor = eliteVisible ? ELITE_BACKGROUND : palette.background;

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor,
          paddingTop: insets.top,
          paddingRight: insets.right,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
        },
      ]}
    >
      <StatusBar barStyle={eliteVisible || colorScheme !== 'dark' ? 'dark-content' : 'light-content'} backgroundColor={backgroundColor} />
      {eliteVisible ? (
        <EliteScreen
          onDismiss={dismissElite}
          onSessionEstablished={establishSession}
          onTerminalError={reportEliteError}
          origin={configuration.eliteOrigin}
        />
      ) : session !== null ? (
        <UserScreen onLogout={logout} palette={palette} session={session} />
      ) : (
        <HomeScreen
          initializationMessage={initialization.message}
          initializationReady={initialization.ready}
          onStartElite={startElite}
          palette={palette}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
