import React, { useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from "react-native";
import { StackActions } from '@react-navigation/native';

import auth from '../services/auth.gigya.service';
import styles from '../styles';

import { OwnIdButton, OwnIdRegister } from '@ownid/react-native-gigya';

export const RegistrationPage = ({ navigation }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [ownIdReadyToRegister, setOwnIdReadyToRegister] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();

    setError('');

    if (ownIdReadyToRegister) {
      const profile = JSON.stringify({ firstName: name });
      OwnIdRegister(email, { profile });
      return;
    }

    if (email === "" || password === "") {
      setError('Please, fill in the fields');
      return;
    }

    const resp = await auth.register({ name, email, password });

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

  const onOwnIdEvent = (event) => {
    console.log("onOwnIdEvent:", event);

    switch (event.eventType) {
      case 'OwnIdRegisterEvent.Busy':
        setLoading(event.isBusy);
        break;
      case 'OwnIdRegisterEvent.ReadyToRegister':
        setOwnIdReadyToRegister(true);
        setEmail(event.loginId);
        break;
      case 'OwnIdRegisterEvent.Undo':
        setOwnIdReadyToRegister(false);
        break;
      case 'OwnIdRegisterEvent.LoggedIn':
        setOwnIdReadyToRegister(false);
        navigation.dispatch(StackActions.replace('Account'));
        break;
      case 'OwnIdRegisterEvent.Error':
        setError(event.cause.message);
        break;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>

        <View style={styles.ownNavTabs}>
          <TouchableOpacity onPress={() => navigation.dispatch(StackActions.replace('Login'))} style={styles.ownNavLink}>
            <Text style={styles.ownNavLinkNonActive}>Log in</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ ...styles.ownNavLink, ...styles.ownNavLinkActive }}>
            <Text style={styles.ownNavLinkActive}>Create Account</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.ownForm}>
          <TextInput style={styles.ownInput} value={name} onChangeText={setName} placeholder="First Name" placeholderTextColor="#354A5F" />

          <TextInput style={styles.ownInput} value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="Email" placeholderTextColor="#354A5F" />

          <View style={styles.row}>
            <TextInput style={{ ...styles.ownInput, flex: 1 }} value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry={true} placeholderTextColor="#354A5F" />
            <OwnIdButton type="register" loginId={email} onOwnIdEvent={onOwnIdEvent} />
          </View>

          <TouchableOpacity onPress={onSubmit} style={styles.buttonContainer}>
            <Text style={styles.buttonText}>Create Account</Text>
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