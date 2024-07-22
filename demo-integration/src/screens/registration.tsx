import React, { useState } from 'react';
import { GestureResponderEvent, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { StackActions, useTheme } from '@react-navigation/native';

import styles from '../styles';

import OwnId, { OwnIdButton, OwnIdButtonType, OwnIdResponse, OwnIdError } from '@ownid/react-native-core';

export const RegistrationPage = ({ navigation, route }: any) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [ownIdData, setOwnIdData] = useState<any>(null);

  const [ownIdReadyToRegister, setOwnIdReadyToRegister] = useState(false);

  const loginWithToken = async (token: string) => {
    setName('');
    setEmail('');
    setPassword('');
    setOwnIdData(null);

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

    if (ownIdData !== '' && email === '') {
      setError('Please, fill in email field');
      return;
    }

    if (ownIdData === '' && email === '' && password === '') {
      setError('Please, fill in the fields');
      return;
    }

    try {
      const token = ownIdData ?
        await route.params.auth.register(email, OwnId.generatePassword(16), name, ownIdData)
        :
        await route.params.auth.register(email, password, name);

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
    await loginWithToken(response.payload!.data.token);
  }

  const onRegister = (response: OwnIdResponse) => {
    setEmail(response.loginId!);
    setOwnIdData(response.payload!.data);
  }

  const onUndo = () => setOwnIdData(null);

  const onError = (error: OwnIdError) => setError(error.message);

  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <View style={{ ...styles.content, backgroundColor: colors.contentBackground }}>

        <View style={styles.ownNavTabs}>
          <TouchableOpacity onPress={() => navigation.dispatch(StackActions.replace('Login'))} style={styles.ownNavLink}>
            <Text style={{ ...styles.ownNavLinkNonActive, color: colors.linkNonActive }}>Log in</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ ...styles.ownNavLink, ...styles.ownNavLinkActive }}>
            <Text style={styles.ownNavLinkActive}>Create Account</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.ownForm}>
          <TextInput style={{ ...styles.ownInput, backgroundColor: colors.background }} value={name} onChangeText={setName} placeholder="First Name" />

          <TextInput style={{ ...styles.ownInput, backgroundColor: colors.background }} value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="Email" />

          <View style={styles.row}>
            <OwnIdButton type={OwnIdButtonType.Register} loginId={email} onRegister={onRegister} onLogin={onLogin} onUndo={onUndo} onError={onError} />
            <TextInput style={{ ...styles.ownInput, marginStart: 8, backgroundColor: colors.background, flex: 1 }} value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry={true} />
          </View>

          <TouchableOpacity onPress={onSubmit} style={styles.buttonContainer}>
            <Text style={styles.buttonText}>Create Account</Text>
          </TouchableOpacity>

          {processError()}
        </View>
      </View>
    </View>
  );
};