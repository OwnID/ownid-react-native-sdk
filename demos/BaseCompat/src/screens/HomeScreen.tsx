import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { DemoConfiguration } from '../configuration';

// Metro resolves the matching density variant at bundle time.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ownIDLogo = require('../../assets/ownid-logo.png') as number;

export type DemoPalette = Readonly<{
  background: string;
  border: string;
  card: string;
  error: string;
  onPrimary: string;
  primary: string;
  text: string;
}>;

const palettes: Readonly<Record<'light' | 'dark', DemoPalette>> = {
  light: {
    background: '#F3F0E6',
    border: '#DCE2EB',
    card: '#FFFFFF',
    error: '#B3261E',
    onPrimary: '#FFFFFF',
    primary: '#000000',
    text: '#000000',
  },
  dark: {
    background: '#000000',
    border: '#4B5568',
    card: '#10141B',
    error: '#F2B8B5',
    onPrimary: '#12203C',
    primary: '#9BAFCE',
    text: '#E7EBF2',
  },
};

export function getHomePalette(darkMode: boolean): DemoPalette {
  return darkMode ? palettes.dark : palettes.light;
}

type HomeScreenProps = Readonly<{
  configuration: DemoConfiguration;
  errorMessage: string | null;
  onStart: () => void;
  palette: DemoPalette;
  startEnabled: boolean;
}>;

export function HomeScreen(props: HomeScreenProps) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent} style={{ backgroundColor: props.palette.background }}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text numberOfLines={1} style={[styles.title, { color: props.palette.text }]}>
            {props.configuration.environment.toUpperCase()}: Demo Compat
          </Text>
          <Image accessible={false} resizeMode="contain" source={ownIDLogo} style={[styles.logo, { tintColor: props.palette.text }]} />
        </View>

        <View style={styles.homeContent}>
          {props.errorMessage === null ? null : (
            <Text accessibilityLiveRegion="polite" selectable style={[styles.status, { color: props.palette.error }]}>
              {props.errorMessage}
            </Text>
          )}
          <Pressable
            accessibilityRole="button"
            disabled={!props.startEnabled}
            onPress={props.onStart}
            style={({ pressed }) => [
              styles.startButton,
              {
                backgroundColor: props.palette.primary,
                opacity: !props.startEnabled ? 0.4 : pressed ? 0.72 : 1,
              },
            ]}
          >
            <Text style={[styles.startButtonText, { color: props.palette.onPrimary }]}>Start Elite Flow</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1 },
  content: {
    alignSelf: 'center',
    gap: 48,
    maxWidth: 560,
    paddingBottom: 32,
    paddingHorizontal: 16,
    paddingTop: 24,
    width: '100%',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: { flexShrink: 1, fontSize: 25, fontWeight: '400' },
  logo: { height: 34, marginLeft: 12, width: 132 },
  homeContent: { gap: 12 },
  status: { fontSize: 17, lineHeight: 24 },
  startButton: {
    alignItems: 'center',
    borderRadius: 12,
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 52,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  startButtonText: { fontSize: 17, fontWeight: '600' },
});
