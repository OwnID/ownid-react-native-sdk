import React from 'react';
import { View } from 'react-native';
import { StackActions } from '@react-navigation/native';

import { Gigya } from '@sap_oss/gigya-react-native-plugin-for-sap-customer-data-cloud';

export const SplashPage = ({ navigation }: any) => {
    if (Gigya.isLoggedIn()) {
        setTimeout(() => navigation.dispatch(StackActions.replace('Account')), 300);
    } else {
        setTimeout(() => navigation.dispatch(StackActions.replace('Login')), 300);
    }

    return (<View />);
};