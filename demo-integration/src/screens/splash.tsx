import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { StackActions } from '@react-navigation/native';

export const SplashPage = ({ navigation, route }: any) => {
    const [isLoggedIn, setLoggedIn] = useState<Boolean | null>(null);

    useEffect(() => {
        setLoggedIn(route.params.auth.isLoggedIn());
    }, []);

    if (isLoggedIn == true) {
        setTimeout(() => navigation.dispatch(StackActions.replace('Account', { auth: route.params.auth })), 300);
        return null;
    }

    if (isLoggedIn == false) {
        setTimeout(() => navigation.dispatch(StackActions.replace('Login', { auth: route.params.auth })), 300);
        return null;
    }

    return (<View />);
};