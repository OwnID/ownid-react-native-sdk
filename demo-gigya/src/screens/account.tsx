import React, { useEffect, useState } from 'react';
import { Text, View, TouchableOpacity } from "react-native";
import { StackActions, useTheme } from '@react-navigation/native';

import styles from '../styles';

export const AccountPage = ({ navigation, route }: any) => {
  const [profile, setProfile] = useState({ name: '', email: '' });

  useEffect(() => {
    route.params.auth.getProfile().then((profile: any) => setProfile(profile));
  }, []);

  const onLogout = async () => {
    await route.params.auth.logout();
    navigation.dispatch(StackActions.replace('Login'));
  }

  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <View style={{ ...styles.content, backgroundColor: colors.contentBackground }}>

        <Text style={{ ...styles.profileTitle, color: colors.textColor }}>Welcome {profile.name}!</Text>
        <Text style={{ ...styles.profile, color: colors.textColor }}>Name: {profile.name}</Text>
        <Text style={{ ...styles.profile, color: colors.textColor }}>Email: {profile.email}</Text>

        <TouchableOpacity onPress={onLogout} style={{ ...styles.buttonContainer, marginTop: 16 }}>
          <Text style={styles.buttonText}>Log out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
