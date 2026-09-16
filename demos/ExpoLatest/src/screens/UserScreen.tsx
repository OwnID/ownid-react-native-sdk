import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { BritaSession } from '../identity/britaSession';
import type { DemoPalette } from './HomeScreen';

// Metro resolves the matching density variant at bundle time.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ownIDLogo = require('../../assets/ownid-logo.png') as number;

type UserScreenProps = Readonly<{
  onLogout: () => void;
  palette: DemoPalette;
  session: BritaSession;
}>;

export function UserScreen({ onLogout, palette, session }: UserScreenProps) {
  const displayName = [session.user.firstName, session.user.lastName]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(' ');

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} style={{ backgroundColor: palette.background }}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: palette.text }]}>Current User</Text>
          <Image accessible={false} resizeMode="contain" source={ownIDLogo} style={[styles.logo, { tintColor: palette.text }]} />
        </View>

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text selectable style={[styles.cardTitle, { color: palette.text }]}>
            {displayName || session.user.email}
          </Text>
          {displayName ? (
            <Text selectable style={[styles.body, { color: palette.text }]}>
              {session.user.email}
            </Text>
          ) : null}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={onLogout}
          style={({ pressed }) => [styles.logoutButton, { backgroundColor: palette.primary, opacity: pressed ? 0.72 : 1 }]}
        >
          <Text style={[styles.logoutButtonText, { color: palette.onPrimary }]}>Logout</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1 },
  content: {
    alignSelf: 'center',
    gap: 20,
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
  title: { fontSize: 25, fontWeight: '400' },
  logo: { height: 34, marginLeft: 12, width: 132 },
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
    padding: 20,
  },
  cardTitle: { fontSize: 22, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 24 },
  logoutButton: {
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: 24,
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 160,
    paddingHorizontal: 24,
  },
  logoutButtonText: { fontSize: 17, fontWeight: '600' },
});
