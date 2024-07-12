import React, { useEffect, useState } from 'react';
import { Text, View, TouchableOpacity } from 'react-native';
import { StackActions, useTheme } from '@react-navigation/native';

import { Gigya } from '@sap_oss/gigya-react-native-plugin-for-sap-customer-data-cloud';
import OwnId from '@ownid/react-native-core';

import styles from '../styles';

export const AccountPage = ({ navigation }: any) => {
  const [isLoggedIn, setIsLoggedIn] = useState(Gigya.isLoggedIn());
  const [profile, setProfile] = useState({ firstName: '', email: '' });

  const getAccount = async () => {
    try {
      const account = await Gigya.getAccount();
      setProfile(account.profile);
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => { if (isLoggedIn) getAccount(); }, [isLoggedIn]);

  const onLogout = async () => {
    await Gigya.logout();
    navigation.dispatch(StackActions.replace('Splash'));
  }

  const runEnrollment = async () => {
    try {
      const account = await Gigya.getAccount();
      const token = await Gigya.send("accounts.getJWT");
      await OwnId.enrollCredential(account.profile.email, token.id_token, true);
    } catch (error) {
      console.log("runEnrollment:" + error);
    };
  }

  const { colors } = useTheme();

  return (
    <View style={styles.container}>

      <View style={{ ...styles.content, backgroundColor: colors.contentBackground }}>

        <Text style={{ ...styles.profileTitle, color: colors.textColor }}>Welcome {profile.firstName}!</Text>
        <Text style={{ ...styles.profile, color: colors.textColor }}>Name: {profile.firstName}</Text>
        <Text style={{ ...styles.profile, color: colors.textColor }}>Email: {profile.email}</Text>

        <TouchableOpacity onPress={onLogout} style={{ ...styles.buttonContainer, marginTop: 16 }}>
          <Text style={styles.buttonText}>Log out</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={runEnrollment} style={{ ...styles.buttonContainer, marginTop: 16 }}>
          <Text style={styles.buttonText}>Trigger credential enrollment</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
