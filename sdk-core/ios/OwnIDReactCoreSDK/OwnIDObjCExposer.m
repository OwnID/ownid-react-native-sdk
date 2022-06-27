@import React;

@interface RCT_EXTERN_MODULE(ButtonEventsEventEmitter, RCTEventEmitter)

RCT_EXTERN_METHOD(supportedEvents)

@end

@interface RCT_EXTERN_REMAP_MODULE(OwnIdButtonManagerManager, OwnIDActionButtonManager, RCTViewManager)

RCT_EXPORT_VIEW_PROPERTY(showOr, NSNumber)
RCT_EXPORT_VIEW_PROPERTY(type, NSString)
RCT_EXPORT_VIEW_PROPERTY(loginId, NSString)
RCT_EXPORT_VIEW_PROPERTY(biometryIconColor, NSString)
RCT_EXPORT_VIEW_PROPERTY(buttonBackgroundColor, NSString)
RCT_EXPORT_VIEW_PROPERTY(buttonBorderColor, NSString)

@end

@interface RCT_EXTERN_MODULE (OwnIdNativeModule, RCTViewManager)

RCT_EXTERN_METHOD(register:(NSString *)loginId registrationParameters:(NSDictionary *)registrationParameters resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(undo:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)

@end
