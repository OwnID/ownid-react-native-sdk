import 'react-native-gesture-handler';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { StatusBar, Text, Image, View, useColorScheme } from "react-native";

import { SplashPage } from "./screens/Splash";
import { LoginPage } from "./screens/Login";
import { RegistrationPage } from "./screens/Registration";
import { AccountPage } from "./screens/Account";
import styles from './styles';

const Stack = createStackNavigator();

const App = () => {
  const scheme = useColorScheme();
  const LightTheme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: '#F5F6F7' } };

  return (
    <SafeAreaProvider>
      <StatusBar backgroundColor="#354A5F" />

      <View style={{ backgroundColor: "#354A5F", height: 140 }}>
        <Image style={{ alignSelf: 'center', position: 'absolute', bottom: 24 }} source={require('./ownid_logo.png')} />
      </View>

      <NavigationContainer theme={scheme === 'dark' ? DarkTheme : LightTheme}>
        <Stack.Navigator initialRouteName="Splash" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Splash" component={SplashPage}></Stack.Screen>
          <Stack.Screen name="Login" component={LoginPage}></Stack.Screen>
          <Stack.Screen name="Register" component={RegistrationPage}></Stack.Screen>
          <Stack.Screen name="Account" component={AccountPage}></Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>

      <View>
        <Text style={styles.futterText}>This app is only for demoing purposes to showcase how the OwnID widget functions.</Text>
      </View>

    </SafeAreaProvider>
  );
};

export default App;