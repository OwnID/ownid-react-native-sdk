@import React;

@interface RCT_EXTERN_MODULE (PrefModule, NSObject)

RCT_EXTERN_METHOD(saveConfig:(NSString *)value resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN__BLOCKING_SYNCHRONOUS_METHOD(readConfig)
RCT_EXTERN_METHOD(clear:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(restart:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(runningConfig:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)

@end
