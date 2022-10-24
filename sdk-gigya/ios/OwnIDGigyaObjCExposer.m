@import React;

@interface RCT_EXTERN_MODULE (OwnIdGigyaModule, RCTViewManager)

RCT_EXTERN_METHOD(createInstance:(NSDictionary *)params resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)

@end
