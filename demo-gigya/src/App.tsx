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

import OwnIdGigya from '@ownid/react-native-gigya';

OwnIdGigya.init({ app_id: "l16tzgmvvyf5qn", redirection_uri_ios: 'com.ownid.demo.react://ios' });

const Stack = createStackNavigator();

const App = () => {
  const AppLightTheme = {
    ...DefaultTheme, colors: {
      ...DefaultTheme.colors,
      background: '#F5F6F7', textColor: '#354A5F', contentBackground: '#FFFFFF', linkNonActive: '#5B738B'
    }
  };
  const AppDarkTheme = {
    ...DarkTheme, colors: {
      ...DarkTheme.colors,
      background: '#18191B', textColor: '#CED1CC', contentBackground: '#222325', linkNonActive: '#CED1CC'
    }
  };
  const scheme = useColorScheme();

  return (
    <SafeAreaProvider>
      <StatusBar backgroundColor="#354A5F" />

      <View style={{ backgroundColor: "#354A5F", height: 140 }}>
        <Image style={{ alignSelf: 'center', position: 'absolute', bottom: 24 }} source={require('./ownid_logo.png')} />
      </View>

      <NavigationContainer theme={scheme === 'dark' ? AppDarkTheme : AppLightTheme}>
        <Stack.Navigator initialRouteName="Splash" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Splash" component={SplashPage}></Stack.Screen>
          <Stack.Screen name="Login" component={LoginPage}></Stack.Screen>
          <Stack.Screen name="Register" component={RegistrationPage}></Stack.Screen>
          <Stack.Screen name="Account" component={AccountPage}></Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>

      <View>
        <Text style={{
          padding: 8, textAlign: 'center',
          color: scheme === 'dark' ? AppDarkTheme.colors.textColor : AppLightTheme.colors.textColor,
          backgroundColor: scheme === 'dark' ? AppDarkTheme.colors.background : AppLightTheme.colors.background
        }}>This app is only for demoing purposes to showcase how the OwnID widget functions.</Text>
      </View>

    </SafeAreaProvider>
  );
};

export default App;