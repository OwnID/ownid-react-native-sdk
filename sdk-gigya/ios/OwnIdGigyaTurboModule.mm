#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>
#import <React/RCTDefines.h>

#if RCT_NEW_ARCH_ENABLED
#import <ReactCodegen/OwnIdGigyaSpec/OwnIdGigyaSpec.h>
#import <SDKGigya/SDKGigya-Swift.h>

@interface OwnIdGigyaTurboModule : NSObject <NativeOwnIdGigyaModuleSpec>
@end

@implementation OwnIdGigyaTurboModule

RCT_EXPORT_MODULE(OwnIdGigyaModule)

- (void)createInstance:(NSDictionary *)configuration resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
    OwnIdGigyaModule *module = [OwnIdGigyaModule new];
    [module createInstance:configuration resolve:resolve reject:reject];
}

- (void)registerUser:(NSString *)loginId
              params:(NSDictionary *_Nullable)params
             resolve:(RCTPromiseResolveBlock)resolve
              reject:(RCTPromiseRejectBlock)reject {
    OwnIdGigyaModule *module = [OwnIdGigyaModule new];
  [module register:loginId registrationParameters:params ?: @{} resolve:resolve reject:reject];
}

- (void)registerAtViewTag:(double)viewTag loginId:(NSString *)loginId params:(NSDictionary *_Nullable)params {
  // no-op on iOS
}

// Install TurboModule for bridgeless/NA
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeOwnIdGigyaModuleSpecJSI>(params);
}

@end

#endif
