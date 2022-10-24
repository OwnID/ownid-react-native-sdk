import React from 'react';
import { NativeModules } from "react-native";
import { OwnIdButton as OwnIdCoreButton } from '@ownid/react-native-core';
import { OwnIdConfiguration, OwnIdButtonType, OwnIdLoginEvent, OwnIdRegisterEvent, OwnIdButtonProps } from '@ownid/react-native-core';

export { OwnIdButtonType, OwnIdButtonVariant, OwnIdLoginEvent, OwnIdRegisterEvent, OwnIdTooltipPosition, OwnIdRegister } from '@ownid/react-native-core';
export type { OwnIdConfiguration, OwnIdEventCause, OwnIdEvent, OwnIdButtonProps, RegistrationParameters } from '@ownid/react-native-core';

const { OwnIdGigyaModule } = NativeModules;

interface OwnIdGigyaInterface {
    initPromise?: Promise<null>;
    init(configuration: OwnIdConfiguration): void;
}

const OwnIdGigya: OwnIdGigyaInterface = {
    init(configuration: OwnIdConfiguration) {
        this.initPromise = OwnIdGigyaModule.createInstance(configuration);
    }
}

export default OwnIdGigya;

export class OwnIdButton extends React.Component<OwnIdButtonProps, { initDone: boolean }> {
    constructor(props: OwnIdButtonProps) {
        super(props);
        this.state = { initDone: false };
    }

    componentDidMount(): void {
        const eventType = this.props.type === OwnIdButtonType.Login ? OwnIdLoginEvent.Error : OwnIdRegisterEvent.Error;

        if (OwnIdGigya.initPromise === undefined) {
            this.props.onOwnIdEvent?.({
                eventType,
                cause: { className: "@ownid/react-native-gigya", message: "OwnIdGigya has not been initialized. Call OwnIdGigya.init()", cause: null, stackTrace: "" }
            });
            return;
        }

        OwnIdGigya.initPromise
            .then(() => this.setState({ initDone: true }))
            .catch((cause) => this.props.onOwnIdEvent?.({ eventType, cause }));

    }

    render() {
        return this.state.initDone && <OwnIdCoreButton {...this.props} />;
    }
}
