import React, { useEffect, useState } from 'react';
import { View } from "react-native";
import { StackActions } from '@react-navigation/native';

import auth from '../services/auth.custom.service';

export const SplashPage = ({ navigation }) => {
    const [isLoggedIn, setLoggedIn] = useState(null);

    useEffect(() => {
        (async () => setLoggedIn(await auth.isLoggedIn()))();
    }, []);

    if (isLoggedIn == true) {
        setTimeout(() => navigation.dispatch(StackActions.replace('Account')));
        return null;
    }

    if (isLoggedIn == false) {
        setTimeout(() => navigation.dispatch(StackActions.replace('Login')));
        return null;
    }

    return (<View></View>);
};