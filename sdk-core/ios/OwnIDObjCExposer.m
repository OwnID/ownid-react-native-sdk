@import React;

@interface RCT_EXTERN_MODULE(ButtonEventsEventEmitter, RCTEventEmitter)

RCT_EXTERN_METHOD(supportedEvents)

@end

@interface RCT_EXTERN_REMAP_MODULE(OwnIdButtonManagerManager, OwnIDActionButtonManager, RCTViewManager)

RCT_EXPORT_VIEW_PROPERTY(showOr, NSNumber)
RCT_EXPORT_VIEW_PROPERTY(type, NSString)
RCT_EXPORT_VIEW_PROPERTY(loginId, NSString)
RCT_EXPORT_VIEW_PROPERTY(iconColor, NSString)
RCT_EXPORT_VIEW_PROPERTY(widgetType, NSString)
RCT_EXPORT_VIEW_PROPERTY(buttonBackgroundColor, NSString)
RCT_EXPORT_VIEW_PROPERTY(buttonBorderColor, NSString)
RCT_EXPORT_VIEW_PROPERTY(buttonTextColor, NSString)

RCT_EXPORT_VIEW_PROPERTY(tooltipPosition, NSString)
RCT_EXPORT_VIEW_PROPERTY(tooltipBackgroundColor, NSString)
RCT_EXPORT_VIEW_PROPERTY(tooltipBorderColor, NSString)
RCT_EXPORT_VIEW_PROPERTY(tooltipTextColor, NSString)

RCT_EXPORT_VIEW_PROPERTY(widgetPosition, NSString)

RCT_EXPORT_VIEW_PROPERTY(showSpinner, NSNumber)
RCT_EXPORT_VIEW_PROPERTY(spinnerColor, NSString)
RCT_EXPORT_VIEW_PROPERTY(spinnerBackgroundColor, NSString)

@end

@interface RCT_EXTERN_MODULE (OwnIdModule, RCTViewManager)

RCT_EXTERN_METHOD(createInstance:(NSDictionary *)config productName:(NSString *)productName instanceName:(NSString *)instanceName resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(setLocale:(NSString *)locale resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(enrollCredential:(NSString *)loginId authToken:(NSString *)authToken force:(BOOL)force instanceName:(NSString *)instanceName resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)

@end
