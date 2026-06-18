import type { ViewProps } from 'react-native';
import codegenNativeComponent from 'react-native/Libraries/Utilities/codegenNativeComponent';
import type { WithDefault, Int32, DirectEventHandler, } from 'react-native/Libraries/Types/CodegenTypes';
import type { ColorValue } from 'react-native';

type ContentSize = Readonly<{
  width: Int32;
  height: Int32;
}>;

export type OwnIdWidgetType = WithDefault<'OwnIdButton' | 'OwnIdAuthButton', 'OwnIdButton'>;
export type OwnIdButtonPosition = WithDefault<'start' | 'end', 'start'>;
export type OwnIdTooltipPosition = WithDefault<'none' | 'top' | 'bottom' | 'start' | 'end', 'none'>;
export type OwnIdButtonType = WithDefault<'register' | 'login', 'login'>;

export interface NativeProps extends ViewProps {
  widgetType?: OwnIdWidgetType;
  widgetPosition?: OwnIdButtonPosition;
  showOr?: boolean;
  showSpinner?: boolean;

  buttonTextColor?: ColorValue;
  iconColor?: ColorValue;
  buttonBackgroundColor?: ColorValue;
  buttonBorderColor?: ColorValue;
  tooltipTextColor?: ColorValue;
  tooltipBackgroundColor?: ColorValue;
  tooltipBorderColor?: ColorValue;
  spinnerColor?: ColorValue;
  spinnerBackgroundColor?: ColorValue;

  type?: OwnIdButtonType;
  loginId?: string;

  preferredHeight?: Int32;

  onReset?: DirectEventHandler<{}>;
  onContentSizeChange?: DirectEventHandler<ContentSize>;
}

export default codegenNativeComponent<NativeProps>('OwnIdButton');
