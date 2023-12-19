import React, { useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from "react-native";
import { StackActions, useTheme } from '@react-navigation/native';

import auth from '../services/auth.custom.service';
import styles from '../styles';

import { OwnIdButton, OwnIdButtonType } from '@ownid/react-native-core';

export const LoginPage = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();

    setError('');

    if (email === "" || password === "") {
      setError('Please, fill in the fields');
      return;
    }

    const resp = await auth.login(email, password);

    if (resp.error) {
      setError(resp.error.message);
      return;
    }

    setEmail('');
    setPassword('');
    navigation.dispatch(StackActions.replace('Account'));
  }

  const processError = () => {
    if (!error) return null;
    return (<Text style={styles.errors}>{error}</Text>);
  }

  const onOwnIdEvent = (event) => {
    console.log("onOwnIdEvent:", event);

    switch (event.eventType) {
      case 'OwnIdLoginEvent.Busy':
        setLoading(event.isBusy);
        break;
      case 'OwnIdLoginEvent.LoggedIn':
        navigation.dispatch(StackActions.replace('Account'));
        break;
      case 'OwnIdLoginEvent.Error':
        setError(event.cause.message);
        break;
    }
  };

  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <View style={{ ...styles.content, backgroundColor: colors.contentBackground }}>

        <View style={styles.ownNavTabs}>
          <TouchableOpacity style={{ ...styles.ownNavLink, ...styles.ownNavLinkActive }}>
            <Text style={styles.ownNavLinkActive}>Log in</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.dispatch(StackActions.replace('Register'))} style={styles.ownNavLink}>
            <Text style={{ ...styles.ownNavLinkNonActive, color: colors.linkNonActive }}>Create Account</Text>
          </TouchableOpacity>
        </View>

        <View>
          <TextInput style={{ ...styles.ownInput, backgroundColor: colors.background }} value={email} onChangeText={setEmail} placeholder="Email" keyboardType="email-address" />

          <View style={styles.row}>
            <OwnIdButton type={OwnIdButtonType.Login} loginId={email} onOwnIdEvent={onOwnIdEvent} />
            <TextInput style={{ ...styles.ownInput, marginStart: 8, backgroundColor: colors.background, flex: 1 }} value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry={true} />
          </View>

          <TouchableOpacity onPress={onSubmit} style={styles.buttonContainer}>
            <Text style={styles.buttonText}>Log In</Text>
          </TouchableOpacity>

          {
            loading && <View style={styles.loader}><ActivityIndicator size="large" color="#0070F2" /></View>
          }

          {processError()}
        </View>
      </View>
    </View>
  );
};