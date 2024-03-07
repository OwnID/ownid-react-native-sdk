@import React;

@interface RCT_EXTERN_MODULE (OwnIdGigyaModule, RCTViewManager)

RCT_EXTERN_METHOD(createInstance:(NSDictionary *)params resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(register:(NSString *)loginId registrationParameters:(NSDictionary *)params resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)

@end
