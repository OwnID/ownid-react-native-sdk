import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ColorSchemeName } from 'react-native';

// Metro resolves the matching density variant at bundle time.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ownIDLogo = require('../../assets/ownid-logo.png') as number;

const colors = {
  light: {
    background: '#F3F0E6',
    border: '#DCE2EB',
    card: '#FFFFFF',
    onPrimary: '#FFFFFF',
    primary: '#000000',
    text: '#000000',
  },
  dark: {
    background: '#000000',
    border: '#4B5568',
    card: '#10141B',
    onPrimary: '#12203C',
    primary: '#9BAFCE',
    text: '#E7EBF2',
  },
} as const;

export type DemoPalette = (typeof colors)[keyof typeof colors];

type HomeScreenProps = Readonly<{
  initializationMessage: string;
  initializationReady: boolean;
  palette: DemoPalette;
  onStartElite: () => void;
}>;

export function getHomePalette(colorScheme: ColorSchemeName): DemoPalette {
  return colorScheme === 'dark' ? colors.dark : colors.light;
}

export function HomeScreen({ initializationMessage, initializationReady, palette, onStartElite }: HomeScreenProps) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent} style={{ backgroundColor: palette.background }}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text numberOfLines={1} style={[styles.title, { color: palette.text }]}>
            UAT: Demo Expo
          </Text>
          <Image accessible={false} resizeMode="contain" source={ownIDLogo} style={[styles.logo, { tintColor: palette.text }]} />
        </View>

        <View style={styles.homeContent}>
          <Text accessibilityLiveRegion="polite" selectable style={[styles.status, { color: palette.text }]}>
            {initializationMessage}
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={!initializationReady}
            onPress={onStartElite}
            style={({ pressed }) => [
              styles.startButton,
              {
                backgroundColor: palette.primary,
                opacity: !initializationReady ? 0.4 : pressed ? 0.72 : 1,
              },
            ]}
          >
            <Text style={[styles.startButtonText, { color: palette.onPrimary }]}>Start Elite Flow</Text>
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
