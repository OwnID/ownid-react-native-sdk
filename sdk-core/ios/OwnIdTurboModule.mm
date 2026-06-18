#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>
#import <React/RCTDefines.h>

#if RCT_NEW_ARCH_ENABLED

#import <React/RCTViewManager.h>
#if __has_include(<SDKCore/SDKCore-Swift.h>)
#import <SDKCore/SDKCore-Swift.h>
#else
#import "SDKCore-Swift.h"
#endif
#import <ReactCodegen/OwnIdCoreSpec/OwnIdCoreSpec.h>

@interface OwnIdTurboModule : NSObject <NativeOwnIdModuleSpec>
@end

@implementation OwnIdTurboModule

RCT_EXPORT_MODULE(OwnIdModule)

static NSDictionary *OwnId_Config_ToNSDictionary(JS::NativeOwnIdModule::OwnIdConfiguration &cfg) {
    NSMutableDictionary *d = [NSMutableDictionary new];
    d[@"appId"] = cfg.appId();
    if (auto env = cfg.env()) {
        d[@"env"] = env;
    }
    if (auto region = cfg.region()) {
        d[@"region"] = region;
    }
    if (auto uri = cfg.redirectionUri()) {
        d[@"redirectionUri"] = uri;
    }
    if (auto uriA = cfg.redirectionUriAndroid()) {
        d[@"redirectionUriAndroid"] = uriA;
    }
    if (auto uriI = cfg.redirectionUriIos()) {
        d[@"redirectionUriIos"] = uriI;
    }
    return d;
}

- (void)createInstance:(JS::NativeOwnIdModule::OwnIdConfiguration &)configuration
           productName:(NSString *)productName
          instanceName:(NSString *_Nullable)instanceName
               resolve:(RCTPromiseResolveBlock)resolve
                reject:(RCTPromiseRejectBlock)reject {
    NSDictionary *cfg = OwnId_Config_ToNSDictionary(configuration);
    OwnIdCoreAdapter *adapter = [[OwnIdCoreAdapter alloc] init];
    void (^resolveBlock)(id _Nullable) = ^(id _Nullable result) {
      resolve(result);
    };
    void (^rejectBlock)(NSString *_Nullable code, NSString *_Nullable message, NSError *_Nullable error) =
        ^(NSString *_Nullable code, NSString *_Nullable message, NSError *_Nullable error) {
          reject(code ?: @"error", message ?: @"", error);
        };
    [adapter createInstance:cfg productName:productName instanceName:instanceName resolve:resolveBlock reject:rejectBlock];
}

- (void)setLocale:(NSString *_Nullable)locale resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
    OwnIdCoreAdapter *adapter = [[OwnIdCoreAdapter alloc] init];
    void (^resolveBlock)(id _Nullable) = ^(id _Nullable result) {
      resolve(result);
    };
    void (^rejectBlock)(NSString *_Nullable code, NSString *_Nullable message, NSError *_Nullable error) =
        ^(NSString *_Nullable code, NSString *_Nullable message, NSError *_Nullable error) {
          reject(code ?: @"error", message ?: @"", error);
        };
    [adapter setLocale:locale resolve:resolveBlock reject:rejectBlock];
}

- (void)enrollCredential:(NSString *)loginId
               authToken:(NSString *)authToken
                   force:(BOOL)force
            instanceName:(NSString *_Nullable)instanceName
                 resolve:(RCTPromiseResolveBlock)resolve
                 reject:(RCTPromiseRejectBlock)reject {
    OwnIdCoreAdapter *adapter = [[OwnIdCoreAdapter alloc] init];
    void (^resolveBlock)(id _Nullable) = ^(id _Nullable result) {
      resolve(result);
    };
    void (^rejectBlock)(NSString *_Nullable code, NSString *_Nullable message, NSError *_Nullable error) =
        ^(NSString *_Nullable code, NSString *_Nullable message, NSError *_Nullable error) {
          reject(code ?: @"error", message ?: @"", error);
        };
    [adapter enrollCredential:loginId authToken:authToken force:force instanceName:instanceName resolve:resolveBlock reject:rejectBlock];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeOwnIdModuleSpecJSI>(params);
}

@end

#endif
