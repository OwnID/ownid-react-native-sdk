import React, { useState } from 'react';
import { GestureResponderEvent, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { StackActions, useTheme } from '@react-navigation/native';

import styles from '../styles';

import { OwnIdButton, OwnIdButtonType, OwnIdResponse, OwnIdError } from '@ownid/react-native-core';

export const LoginPage = ({ navigation, route }: any) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const loginWithToken = async (token: string) => {
    setEmail('');
    setPassword('');

    try {
      await route.params.auth.getProfile(token);
      navigation.dispatch(StackActions.replace('Account', { auth: route.params.auth }));
    } catch (error) {
      setError(error.message);
      return;
    }
  }

  const onSubmit = async (event: GestureResponderEvent) => {
    event.preventDefault();

    setError('');

    if (email === '' || password === '') {
      setError('Please, fill in the fields');
      return;
    }

    try {
      const token = await route.params.auth.login(email, password);
      await loginWithToken(token);
    } catch (error) {
      setError(error.message);
      return;
    }
  }

  const processError = () => {
    if (!error) return null;
    return (<Text style={styles.errors}>{error}</Text>);
  }

  const onLogin = async (response: OwnIdResponse) => {
    setEmail(response.loginId!);
    await loginWithToken(JSON.parse(response.payload!.data).token);
  }

  const onError = (cause: OwnIdError) => setError(cause.message);

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
            <OwnIdButton type={OwnIdButtonType.Login} loginId={email} onLogin={onLogin} onError={onError} />
            <TextInput style={{ ...styles.ownInput, marginStart: 8, backgroundColor: colors.background, flex: 1 }} value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry={true} />
          </View>

          <TouchableOpacity onPress={onSubmit} style={styles.buttonContainer}>
            <Text style={styles.buttonText}>Log In</Text>
          </TouchableOpacity>

          {processError()}
        </View>
      </View>
    </View>
  );
};