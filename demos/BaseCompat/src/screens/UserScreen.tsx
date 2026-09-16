import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { DemoConfiguration } from '../configuration';
import { loadProfile } from '../identity/demoIdentity';
import type { DemoSession, DemoUser } from '../identity/demoIdentity';
import type { DemoPalette } from './HomeScreen';

// Metro resolves the matching density variant at bundle time.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ownIDLogo = require('../../assets/ownid-logo.png') as number;

type ProfileState =
  Readonly<{ type: 'loading' }> | Readonly<{ type: 'loaded'; user: DemoUser }> | Readonly<{ type: 'error'; message: string }>;

type UserScreenProps = Readonly<{
  configuration: DemoConfiguration;
  onLogout: () => void;
  palette: DemoPalette;
  session: DemoSession;
}>;

export function UserScreen({ configuration, onLogout, palette, session }: UserScreenProps) {
  const [profile, setProfile] = useState<ProfileState>({ type: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    setProfile({ type: 'loading' });

    void loadProfile(configuration.demoIdentityBaseUrl, session, controller.signal).then(
      (user) => {
        if (!controller.signal.aborted) setProfile({ type: 'loaded', user });
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setProfile({
            type: 'error',
            message: error instanceof Error ? error.message : 'Demo Identity profile request failed.',
          });
        }
      }
    );

    return () => controller.abort();
  }, [configuration.demoIdentityBaseUrl, session]);

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} style={{ backgroundColor: palette.background }}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: palette.text }]}>Current User</Text>
          <Image accessible={false} resizeMode="contain" source={ownIDLogo} style={[styles.logo, { tintColor: palette.text }]} />
        </View>

        {profile.type === 'loading' ? (
          <ActivityIndicator
            accessibilityLabel="Loading current user"
            accessibilityRole="progressbar"
            color={palette.primary}
            size="large"
          />
        ) : profile.type === 'loaded' ? (
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.cardTitle, { color: palette.text }]}>Current User</Text>
            {profile.user.name === null ? null : (
              <Text selectable style={[styles.body, { color: palette.text }]}>
                Name: {profile.user.name}
              </Text>
            )}
            <Text selectable style={[styles.body, { color: palette.text }]}>
              Email: {profile.user.email}
            </Text>
          </View>
        ) : (
          <Text accessibilityLiveRegion="polite" selectable style={[styles.body, { color: palette.error }]}>
            {profile.message}
          </Text>
        )}

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
