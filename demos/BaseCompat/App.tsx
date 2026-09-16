import { useCallback, useEffect, useState } from 'react';
import { StatusBar, StyleSheet, useColorScheme, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { OwnID, OwnIDLogLevel } from '@ownid/react-native-core';
import type { DemoConfiguration } from './src/configuration';
import type { DemoSession } from './src/identity/demoIdentity';
import { ELITE_BACKGROUND, EliteScreen } from './src/screens/EliteScreen';
import { getHomePalette, HomeScreen } from './src/screens/HomeScreen';
import { UserScreen } from './src/screens/UserScreen';

export default function App({ configuration }: Readonly<{ configuration: DemoConfiguration }>) {
  return (
    <SafeAreaProvider>
      <DemoScreen configuration={configuration} />
    </SafeAreaProvider>
  );
}

function DemoScreen({ configuration }: Readonly<{ configuration: DemoConfiguration }>) {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const palette = getHomePalette(colorScheme === 'dark');
  const { appId, environment } = configuration;
  const [initializationReady, setInitializationReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [eliteVisible, setEliteVisible] = useState(false);
  const [session, setSession] = useState<DemoSession | null>(null);

  const dismissElite = useCallback(() => {
    setEliteVisible(false);
  }, []);

  const failElite = useCallback(() => {
    setErrorMessage('Elite flow failed. Please try again.');
    setEliteVisible(false);
  }, []);

  const startElite = useCallback(() => {
    setErrorMessage(null);
    setEliteVisible(true);
  }, []);

  const logout = useCallback(() => {
    setSession(null);
    setErrorMessage(null);
  }, []);

  useEffect(() => {
    // Optional diagnostics for this demo.
    OwnID.configureLogging({ level: OwnIDLogLevel.Debug, label: 'OwnIDCompactDemo' });
    setInitializationReady(false);
    setErrorMessage(null);

    try {
      if (environment === 'dev') {
        OwnID.initializeFromJson(JSON.stringify({ appId, env: environment }));
      } else {
        OwnID.initialize({ appId, env: environment });
      }
      setInitializationReady(true);
    } catch {
      setErrorMessage('OwnID initialization failed. Restart the app to try again.');
    }
  }, [appId, environment]);

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
        <EliteScreen configuration={configuration} onDismiss={dismissElite} onSession={setSession} onTerminalError={failElite} />
      ) : session !== null ? (
        <UserScreen configuration={configuration} onLogout={logout} palette={palette} session={session} />
      ) : (
        <HomeScreen
          configuration={configuration}
          errorMessage={errorMessage}
          onStart={startElite}
          palette={palette}
          startEnabled={initializationReady}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
