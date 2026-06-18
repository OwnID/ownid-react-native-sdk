#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>
#import <React/RCTDefines.h>

#if RCT_NEW_ARCH_ENABLED

#import "OwnIdButtonComponentView.h"
#import <React/RCTBridgeModule.h>
#import <React/RCTComponentViewFactory.h>
#import <React/RCTViewManager.h>
#import <React/RCTUtils.h>
#import <objc/message.h>
#import <react/renderer/components/OwnIdCoreSpec/EventEmitters.h>
#import <react/renderer/components/OwnIdCoreSpec/ComponentDescriptors.h>
#import <react/renderer/componentregistry/ComponentDescriptorProviderRegistry.h>
#import <react/renderer/components/OwnIdCoreSpec/Props.h>
#import <react/renderer/components/OwnIdCoreSpec/ShadowNodes.h>
#import <react/renderer/core/ShadowNodeTraits.h>
#import <react/renderer/core/LayoutConstraints.h>
#import <react/renderer/core/LayoutContext.h>
#import <react/renderer/graphics/Color.h>
#import <React/RCTConversions.h>
#if __has_include(<SDKCore/SDKCore-Swift.h>)
#import <SDKCore/SDKCore-Swift.h>
#else
#import "SDKCore-Swift.h"
#endif

using namespace facebook::react;

// Short alias for generated emitter namespaced types
using Emitter = facebook::react::OwnIdButtonEventEmitter;

static NSString *_Nonnull RCTOwnIdNSStringFromStdString(const std::string &value)
{
  if (value.empty()) {
    return @"";
  }
  return [NSString stringWithUTF8String:value.c_str()];
}

static NSString *_Nonnull RCTOwnIdNSStringFromWidgetType(OwnIdButtonWidgetType type)
{
  switch (type) {
    case OwnIdButtonWidgetType::OwnIdButton:
      return @"OwnIdButton";
    case OwnIdButtonWidgetType::OwnIdAuthButton:
      return @"OwnIdAuthButton";
  }
}

static NSString *_Nonnull RCTOwnIdNSStringFromWidgetPosition(OwnIdButtonWidgetPosition position)
{
  switch (position) {
    case OwnIdButtonWidgetPosition::Start:
      return @"start";
    case OwnIdButtonWidgetPosition::End:
      return @"end";
  }
}

static NSString *_Nonnull RCTOwnIdNSStringFromButtonType(OwnIdButtonType type)
{
  switch (type) {
    case OwnIdButtonType::Login:
      return @"login";
    case OwnIdButtonType::Register:
      return @"register";
  }
}

static NSString *_Nonnull RCTOwnIdHexStringFromColor(SharedColor const &sharedColor)
{
  if (!sharedColor) {
    return @"";
  }

  auto components = colorComponentsFromColor(sharedColor);
  NSInteger r = (NSInteger)lround(components.red * 255.0);
  NSInteger g = (NSInteger)lround(components.green * 255.0);
  NSInteger b = (NSInteger)lround(components.blue * 255.0);
  NSInteger a = (NSInteger)lround(components.alpha * 255.0);

  if (a < 255) {
    return [NSString stringWithFormat:@"#%02lX%02lX%02lX%02lX", (long)r, (long)g, (long)b, (long)a];
  }

  return [NSString stringWithFormat:@"#%02lX%02lX%02lX", (long)r, (long)g, (long)b];
}

static std::string RCTOwnIdStdStringFromNSObject(id _Nullable obj)
{
  if (!obj || obj == (id)kCFNull) {
    return std::string();
  }
  if ([obj isKindOfClass:[NSString class]]) {
    NSString *s = (NSString *)obj;
    return std::string([s UTF8String] ?: "");
  }
  if ([obj isKindOfClass:[NSNumber class]]) {
    NSNumber *n = (NSNumber *)obj;
    NSString *s = [n stringValue];
    return std::string([s UTF8String] ?: "");
  }
  if ([obj isKindOfClass:[NSData class]]) {
    NSData *d = (NSData *)obj;
    NSString *b64 = [d base64EncodedStringWithOptions:0];
    return std::string([b64 UTF8String] ?: "");
  }
  if ([obj isKindOfClass:[NSDictionary class]] || [obj isKindOfClass:[NSArray class]]) {
    id jsonObj = obj;
    if (![NSJSONSerialization isValidJSONObject:jsonObj]) {
      NSString *desc = [jsonObj description];
      return std::string([desc UTF8String] ?: "");
    }
    NSError *err = nil;
    NSData *data = [NSJSONSerialization dataWithJSONObject:jsonObj options:0 error:&err];
    if (data && !err) {
      NSString *json = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
      return std::string([json UTF8String] ?: "");
    }
    return std::string();
  }
  NSString *desc = [obj description];
  return std::string([desc UTF8String] ?: "");
}

@implementation OwnIdButtonComponentView {
  CGFloat _lastLayoutWidth;
  CGFloat _lastLayoutHeight;
  BOOL _isAttached;
  OwnIDButtonViewController *_controller;
  BOOL _configured;
  CGFloat _measuredWidth;
  CGFloat _measuredHeight;
  CGFloat _preferredHeight;
  BOOL _isIconWidget;
}

+ (facebook::react::ComponentDescriptorProvider)componentDescriptorProvider
{
  return facebook::react::concreteComponentDescriptorProvider<facebook::react::OwnIdButtonComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    _controller = [OwnIDButtonViewController new];
    _isAttached = NO;
    _configured = NO;
    self.userInteractionEnabled = YES;
  }
  return self;
}

static UIViewController *OwnIdFindParentViewController(UIView *view) {
  UIResponder *responder = view;
  while (responder && ![responder isKindOfClass:[UIViewController class]]) {
    responder = responder.nextResponder;
  }
  if ([responder isKindOfClass:[UIViewController class]]) {
    return (UIViewController *)responder;
  }
  return RCTPresentedViewController();
}

- (void)attachControllerIfPossibleWithFrame:(CGRect)frame
{
  if (_isAttached || !_configured || !_controller) { return; }
  if (!self.window || frame.size.width <= 0 || frame.size.height <= 0) { return; }
  UIViewController *resolved = self.reactViewController ?: OwnIdFindParentViewController(self);
  if (!resolved) { return; }
  if (self.reactViewController && resolved != self.reactViewController) { return; }
  UIViewController *parent = resolved;
  _controller.view.translatesAutoresizingMaskIntoConstraints = YES;
  _controller.view.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
  [parent addChildViewController:_controller];
  [self addSubview:_controller.view];
  _controller.view.frame = frame;
  [_controller didMoveToParentViewController:parent];
  _controller.view.userInteractionEnabled = YES;
  @try {
    [_controller beginAppearanceTransition:YES animated:NO];
    [_controller endAppearanceTransition];
  } @catch (__unused id e) {}
  _isAttached = YES;
}

- (void)layoutSubviews
{
  [super layoutSubviews];
  if (_configured && !_isAttached) {
    [self attachControllerIfPossibleWithFrame:self.bounds];
  }
  if (_isAttached) {
    _controller.view.translatesAutoresizingMaskIntoConstraints = YES;
    _controller.view.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    _controller.view.frame = self.bounds;
  }
}

- (CGSize)sizeThatFitsMinimumSize:(CGSize)minimumSize maximumSize:(CGSize)maximumSize
{
  if (!_controller) { return {minimumSize.width, MAX(44.0, minimumSize.height)}; }

  NSNumber *ch = nil;
  if (_preferredHeight > 0) {
    ch = @(_preferredHeight);
  } else if (isfinite(maximumSize.height) && maximumSize.height > 0) {
    ch = @(maximumSize.height);
  }

  CGFloat maxW = (isfinite(maximumSize.width) && maximumSize.width > 0) ? maximumSize.width : CGFLOAT_MAX;

  CGSize result = CGSizeZero;

  CGSize intrinsic = [_controller bridge_measureWithConstrainedWidth:nil constrainedHeight:ch];

  CGSize underParent = intrinsic;
  if (maxW < CGFLOAT_MAX) {
    underParent = [_controller bridge_measureWithConstrainedWidth:@(maxW) constrainedHeight:ch];
  }

  if (!_isIconWidget) {
    result.width = MIN(underParent.width, maxW);
    result.height = underParent.height;
  } else {
    CGFloat candidate = (maxW < CGFLOAT_MAX) ? MIN(intrinsic.width, maxW) : intrinsic.width;
    result.width = candidate;
    result.height = intrinsic.height;
  }

  result.width = MAX(result.width, minimumSize.width);
  result.height = MAX(MAX(result.height, minimumSize.height), 44.0);
  if (isfinite(maximumSize.width)) { result.width = MIN(result.width, maximumSize.width); }
  if (isfinite(maximumSize.height)) { result.height = MIN(result.height, maximumSize.height); }

  if (result.width > 0 && result.height > 0) {
    _measuredWidth = result.width;
    _measuredHeight = result.height;
  } else if (_measuredWidth > 0 && _measuredHeight > 0) {
    result = CGSizeMake(_measuredWidth, _measuredHeight);
  }
  return result;
}

- (void)updateProps:(const facebook::react::Props::Shared &)props
           oldProps:(const facebook::react::Props::Shared &)oldProps
{
  [super updateProps:props oldProps:oldProps];

  const auto &newProps = *std::static_pointer_cast<const OwnIdButtonProps>(props);

  NSString *widgetTypeStr = RCTOwnIdNSStringFromWidgetType(newProps.widgetType);
  _isIconWidget = (newProps.widgetType == OwnIdButtonWidgetType::OwnIdButton);
  NSString *widgetPosStr = RCTOwnIdNSStringFromWidgetPosition(newProps.widgetPosition);
  NSString *typeStr = RCTOwnIdNSStringFromButtonType(newProps.type);
  NSString *loginId = RCTOwnIdNSStringFromStdString(newProps.loginId);
  NSString *txt = RCTOwnIdHexStringFromColor(newProps.buttonTextColor);
  NSString *ico = RCTOwnIdHexStringFromColor(newProps.iconColor);
  NSString *bg = RCTOwnIdHexStringFromColor(newProps.buttonBackgroundColor);
  NSString *br = RCTOwnIdHexStringFromColor(newProps.buttonBorderColor);
  NSString *tt = RCTOwnIdHexStringFromColor(newProps.tooltipTextColor);
  NSString *tbg = RCTOwnIdHexStringFromColor(newProps.tooltipBackgroundColor);
  NSString *tbr = RCTOwnIdHexStringFromColor(newProps.tooltipBorderColor);
  NSString *sc = RCTOwnIdHexStringFromColor(newProps.spinnerColor);
  NSString *sbg = RCTOwnIdHexStringFromColor(newProps.spinnerBackgroundColor);
  NSNumber *prefH = (newProps.preferredHeight > 0) ? @(newProps.preferredHeight) : nil;
  _preferredHeight = prefH ? [prefH doubleValue] : 0;
  __weak __typeof(self) weakSelf = self;
  _controller.onNativeContentSize = ^(CGSize size, BOOL ignoreParent) {
    __strong __typeof(self) strongSelf = weakSelf;
    if (!strongSelf) { return; }
    if (!(size.width > 0 && size.height > 0)) {
      return;
    }
    strongSelf->_measuredWidth = size.width;
    strongSelf->_measuredHeight = size.height;
    [strongSelf invalidateIntrinsicContentSize];
    [strongSelf setNeedsLayout];
    const auto emitter = std::static_pointer_cast<const Emitter>(strongSelf->_eventEmitter);
    if (emitter) {
      facebook::react::OwnIdButtonEventEmitter::OnContentSizeChange contentSize{
        (int)MAX(0, (int)lround(size.width)),
        (int)MAX(0, (int)lround(size.height))
      };
      emitter->onContentSizeChange(contentSize);
    }
  };

  _controller.onNativeIntegration = nil;
  _controller.onNativeFlow = nil;
  _controller.onNativeReset = nil;

  [_controller bridge_configureWithType:typeStr
                            widgetType:widgetTypeStr
                         widgetPosition:widgetPosStr
                                  login:loginId
                                  showOr:@(newProps.showOr)
                              showSpinner:@(newProps.showSpinner)
                                iconColor:ico
                       buttonBorderColor:br
                   buttonBackgroundColor:bg
                         buttonTextColor:txt
                      tooltipPositionStr:@"none"
                       tooltipTextColor:tt
                tooltipBackgroundColor:tbg
                   tooltipBorderColor:tbr
                              spinnerColor:sc
                   spinnerBackgroundColor:sbg
                           preferredHeight:prefH];
  _configured = YES;

  [self attachControllerIfPossibleWithFrame:self.contentView.bounds];
  NSNumber *ch = prefH;
  CGSize m = [_controller bridge_measureWithConstrainedWidth:nil constrainedHeight:ch];
  if (m.width > 0 && m.height > 0) {
    _measuredWidth = m.width;
    _measuredHeight = m.height;
  }

  [self setNeedsLayout];

  if (m.width > 0 && m.height > 0) {
    @try {
      [_controller bridge_forceForwardLayout];
    } @catch (__unused id e) {}
  }
}

- (void)updateLayoutMetrics:(const facebook::react::LayoutMetrics &)layoutMetrics
           oldLayoutMetrics:(const facebook::react::LayoutMetrics &)oldLayoutMetrics
{
  [super updateLayoutMetrics:layoutMetrics oldLayoutMetrics:oldLayoutMetrics];
  _lastLayoutWidth = layoutMetrics.frame.size.width;
  _lastLayoutHeight = layoutMetrics.frame.size.height;
  // (no wrapper) just size controller view
  if (!_configured) {
    // Wait until props arrive to attach
    return;
  }
  CGRect contentFrame = RCTCGRectFromRect(layoutMetrics.getContentFrame());
  if (_isAttached && _controller.parentViewController && _controller.parentViewController != OwnIdFindParentViewController(self)) {
    // detach to avoid hierarchy assert; reattach below
    [self prepareForRecycle];
  }
  [self attachControllerIfPossibleWithFrame:contentFrame];
  if (_isAttached) {
    _controller.view.frame = contentFrame;
  }

  // For auth button variant, notify JS of content size using resolved contentFrame.
  if (!_isIconWidget) {
    if (contentFrame.size.width > 0 && contentFrame.size.height > 0) {
      _measuredWidth = contentFrame.size.width;
      _measuredHeight = contentFrame.size.height;
      const auto emitter = std::static_pointer_cast<const Emitter>(self->_eventEmitter);
      if (emitter) {
        facebook::react::OwnIdButtonEventEmitter::OnContentSizeChange payload{
          (int)lround(contentFrame.size.width),
          (int)lround(contentFrame.size.height)
        };
        emitter->onContentSizeChange(payload);
      }
    }
  }
}

- (void)updateEventEmitter:(const facebook::react::EventEmitter::Shared &)eventEmitter
{
  [super updateEventEmitter:eventEmitter];
  if (eventEmitter && _measuredWidth > 0 && _measuredHeight > 0) {
    const auto typed = std::static_pointer_cast<const Emitter>(eventEmitter);
    if (typed) {
      facebook::react::OwnIdButtonEventEmitter::OnContentSizeChange payload{
        (int)lround(_measuredWidth),
        (int)lround(_measuredHeight)
      };
      typed->onContentSizeChange(payload);
    }
  }
}

- (void)prepareForRecycle
{
  // Fabric lifecycle hook: ensure native state is reset when the view is recycled.
  @try {
    if (_configured && _controller) {
      [_controller bridge_commandReset];
      if (_isAttached) {
        [_controller willMoveToParentViewController:nil];
        [_controller removeFromParentViewController];
        [_controller.view removeFromSuperview];
        _isAttached = NO;
      }
    }
  } @catch (__unused id e) {
  }
  [super prepareForRecycle];
}

- (void)willMoveToSuperview:(UIView *)newSuperview
{
  [super willMoveToSuperview:newSuperview];
  if (!_configured || !_controller) { return; }
  UIViewController *targetVC = newSuperview ? [newSuperview reactViewController] : nil;
  if (targetVC && _isAttached && _controller.parentViewController && _controller.parentViewController != targetVC) {
    [_controller willMoveToParentViewController:nil];
    [_controller removeFromParentViewController];
    [_controller.view removeFromSuperview];
    _isAttached = NO;
    [self attachControllerIfPossibleWithFrame:self.bounds];
  }
}

- (void)willMoveToWindow:(UIWindow *)newWindow
{
  [super willMoveToWindow:newWindow];
  if (!_configured || !_controller) { return; }
  if (newWindow == nil && _isAttached) {
    [_controller willMoveToParentViewController:nil];
    [_controller removeFromParentViewController];
    [_controller.view removeFromSuperview];
    _isAttached = NO;
  }
}

- (void)handleCommand:(const NSString *)commandName args:(id)args
{
  if ([commandName isEqualToString:@"auth"]) {
    NSNumber *onlyReturning = ([args isKindOfClass:[NSArray class]] && [args count] > 0) ? [args objectAtIndex:0] : nil;
    [_controller bridge_commandAuth:onlyReturning];
    return;
  }
  if ([commandName isEqualToString:@"reset"]) {
    [_controller bridge_commandReset];
    return;
  }
  if ([commandName isEqualToString:@"register"]) {
    NSDictionary *dict = nil; NSString *login = nil;
    if ([args isKindOfClass:[NSArray class]]) {
      if ([(NSArray *)args count] > 0) { dict = [(NSArray *)args objectAtIndex:0]; }
      if ([(NSArray *)args count] > 1) { login = [(NSArray *)args objectAtIndex:1]; }
    }
    [_controller bridge_commandRegister:dict login:login];
    return;
  }
}

@end

#endif
