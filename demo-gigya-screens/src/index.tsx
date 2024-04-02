import React, { useEffect, useState } from 'react';
import { StatusBar, Text, View, Image, Platform, Appearance, TouchableOpacity } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { Gigya } from '@sap_oss/gigya-react-native-plugin-for-sap-customer-data-cloud';

import styles from './styles';

const App = (): React.ReactElement => {
  const textColor = Appearance.getColorScheme() === 'dark' ? '#CED1CC' : '#354A5F';

  const [isLoggedIn, setIsLoggedIn] = useState(Gigya.isLoggedIn());
  const [error, setError] = useState<any>(null);
  const [profile, setProfile] = useState({ firstName: '', email: '' });

  const showScreenSet = () => {
    Gigya.showScreenSet("Default-RegistrationLogin", (event, data) => {
      if (event == "onLogin") {
        setIsLoggedIn(Gigya.isLoggedIn())
      }
    })
  };

  const getAccount = async () => {
    try {
      const account = await Gigya.getAccount();
      setProfile(account.profile);
    } catch (error) {
      setError(error);
    }
  };

  useEffect(() => { if (isLoggedIn) getAccount(); }, [isLoggedIn]);

  const onLogout = async () => {
    try {
      await Gigya.logout();
      setIsLoggedIn(Gigya.isLoggedIn())
    } catch (error) {
      setError(error);
    }
  }

  const processError = () => {
    if (!error) return null;
    return (<Text style={styles.errors}>{error}</Text>);
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar backgroundColor="#354A5F" />

        <View style={{ height: Platform.OS === 'ios' ? 200 : 140, backgroundColor: "#354A5F" }}>
          <Image style={{ alignSelf: 'center', position: 'absolute', bottom: 48 }} source={require('./ownid_logo.png')} />
        </View>

        <View style={{ flex: 1 }}>
          {isLoggedIn ? (
            <View>
              <Text style={{ padding: 8, textAlign: 'center', color: textColor, fontSize: 20, }}>Logged in as {profile.firstName} {"\n"} {profile.email}</Text>
              <TouchableOpacity onPress={onLogout} style={styles.buttonContainer}>
                <Text style={styles.buttonText}>LogOut</Text>
              </TouchableOpacity>
            </View>

          ) : (
            <View>
              <Text style={{ padding: 8, textAlign: 'center', color: textColor, fontSize: 20, }}>Not Logged in</Text>
              <TouchableOpacity onPress={showScreenSet} style={styles.buttonContainer}>
                <Text style={styles.buttonText}>Open ScreenSet</Text>
              </TouchableOpacity>
            </View>
          )
          }

          {processError()}
        </View>

        <Text style={{ padding: 8, textAlign: 'center', color: textColor }}>This app is only for demoing purposes to showcase how the OwnID functions.</Text>
      </SafeAreaView>
    </SafeAreaProvider>
  );
};

export default App;