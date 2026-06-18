#import <React/RCTDefines.h>
#import <UIKit/UIKit.h>
#if RCT_NEW_ARCH_ENABLED
#import <React/RCTViewComponentView.h>
@interface OwnIdButtonComponentView : RCTViewComponentView
@end
#else
@interface OwnIdButtonComponentView : UIView
@end
#endif
