import 'react-native-gesture-handler';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar, Text, Image, View, useColorScheme } from 'react-native';

import { SplashPage } from './screens/splash';
import { LoginPage } from './screens/login';
import { RegistrationPage } from './screens/registration';
import { AccountPage } from './screens/account';

const Stack = createStackNavigator();

const App = () => () => {
  const AppLightTheme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: '#F5F6F7', textColor: '#354A5F', contentBackground: '#FFFFFF', linkNonActive: '#5B738B' } };
  const AppDarkTheme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: '#18191B', textColor: '#CED1CC', contentBackground: '#222325', linkNonActive: '#CED1CC' } };

  const scheme = useColorScheme();

  return (
    <SafeAreaProvider>
      <StatusBar backgroundColor='#354A5F' />

      <View style={{ backgroundColor: '#354A5F', height: 140 }}>
        <Image style={{ alignSelf: 'center', position: 'absolute', bottom: 24 }} source={require('./ownid_logo.png')} />
      </View>

      <NavigationContainer theme={scheme === 'dark' ? AppDarkTheme : AppLightTheme}>
        <Stack.Navigator initialRouteName='Splash' screenOptions={{ headerShown: false }}>
          <Stack.Screen name='Splash' component={SplashPage} />
          <Stack.Screen name='Login' component={LoginPage} />
          <Stack.Screen name='Register' component={RegistrationPage} />
          <Stack.Screen name='Account' component={AccountPage} />
        </Stack.Navigator>
      </NavigationContainer>

      <View>
        <Text style={{
          padding: 8, textAlign: 'center',
          color: scheme === 'dark' ? AppDarkTheme.colors.textColor : AppLightTheme.colors.textColor,
          backgroundColor: scheme === 'dark' ? AppDarkTheme.colors.background : AppLightTheme.colors.background
        }}>This app is only for demoing purposes to showcase how the OwnID functions.</Text>
      </View>

    </SafeAreaProvider>
  );
};

export default App;