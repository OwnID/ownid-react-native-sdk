import { NativeModules } from "react-native";
import { OwnIdConfiguration } from "@ownid/react-native-core";

const { OwnIdGigyaModule } = NativeModules;

export default {
    init(configuration: OwnIdConfiguration) {
        OwnIdGigyaModule.createInstance(configuration);
    }
}

export * from "@ownid/react-native-core";