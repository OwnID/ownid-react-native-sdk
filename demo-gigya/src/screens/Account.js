import React, { useEffect, useState } from 'react';
import { Text, View, TouchableOpacity } from "react-native";
import { StackActions } from '@react-navigation/native';

import auth from '../services/auth.gigya.service';
import styles from '../styles';

export const AccountPage = ({ navigation }) => {
  const [profile, setProfile] = useState({ name: '', email: '' });

  useEffect(() => {
    (async () => setProfile(await auth.getProfile()))();
  }, []);

  const onLogout = async () => {
    await auth.logout();
    navigation.dispatch(StackActions.replace('Login'));
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>

        <Text style={styles.profileTitle}>Welcome {profile.name}!</Text>
        <Text style={styles.profile}>Name: {profile.name}</Text>
        <Text style={styles.profile}>Email: {profile.email}</Text>

        <TouchableOpacity onPress={onLogout} style={{ ...styles.buttonContainer, marginTop: 16 }}>
          <Text style={styles.buttonText}>Log out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};