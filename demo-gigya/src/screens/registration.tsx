import React, { useState } from 'react';
import { GestureResponderEvent, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { StackActions, useTheme } from '@react-navigation/native';

import { Gigya } from '@sap_oss/gigya-react-native-plugin-for-sap-customer-data-cloud';

import styles from '../styles';

import { OwnIdButton, OwnIdButtonType, OwnIdRegister, OwnIdResponse, OwnIdError } from '@ownid/react-native-gigya';

export const RegistrationPage = ({ navigation }: any) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const [ownIdReadyToRegister, setOwnIdReadyToRegister] = useState(false);

  const onSubmit = async (event: GestureResponderEvent) => {
    event.preventDefault();

    setError('');

    if (ownIdReadyToRegister) {
      const profile = JSON.stringify({ firstName: name });
      OwnIdRegister(email, { profile });
      return;
    }

    if (email === '' || password === '') {
      setError('Please, fill in the fields');
      return;
    }

    const resp = await Gigya.register(email, password, { firstName: name });

    if (resp.error) {
      setError(resp.error.message);
      return;
    }

    setName('');
    setEmail('');
    setPassword('');
    navigation.dispatch(StackActions.replace('Account'));
  }

  const processError = () => {
    if (!error) return null;
    return (<Text style={styles.errors}>{error}</Text>);
  }

  const onLogin = (response: OwnIdResponse) => {
    setOwnIdReadyToRegister(false);
    navigation.dispatch(StackActions.replace('Account'));
  }

  const onRegister = (response: OwnIdResponse) => {
    setOwnIdReadyToRegister(true);
    setEmail(response.loginId!);
  }

  const onUndo = () => setOwnIdReadyToRegister(false);

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
          <TextInput style={{ ...styles.ownInput, backgroundColor: colors.background }} value={name} onChangeText={setName} placeholder='First Name' />

          <TextInput style={{ ...styles.ownInput, backgroundColor: colors.background }} value={email} onChangeText={setEmail} keyboardType='email-address' placeholder='Email' />

          <View style={styles.row}>
            <OwnIdButton type={OwnIdButtonType.Register} loginId={email} onRegister={onRegister} onLogin={onLogin} onUndo={onUndo} onError={onError} />
            <TextInput style={{ ...styles.ownInput, marginStart: 8, backgroundColor: colors.background, flex: 1 }} value={password} onChangeText={setPassword} placeholder='Password' secureTextEntry={true} />
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
