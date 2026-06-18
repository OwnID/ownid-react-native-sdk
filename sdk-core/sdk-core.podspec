Pod::Spec.new do |s|
  s.name             = 'sdk-core'
  s.version          = '3.10.0'
  s.summary          = 'sdk-core'

  s.description      = <<-DESC
sdk-core pod library. Used in autolinking alongside of react libraries.
                       DESC

  s.homepage         = 'https://github.com/OwnID/ownid-react-native-sdk'
  s.license          = 'Apache 2.0'
  s.authors          = 'OwnID, Inc'
  s.source           = { :git => 'https://github.com/OwnID/ownid-react-native-sdk.git' }

  s.module_name   = 'SDKCore'
  s.ios.deployment_target = '14.0'
  s.swift_version = '5.1.1'

  s.dependency 'ownid-core-ios-sdk', '3.10.0'
  s.dependency 'React'

  xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'CLANG_CXX_LANGUAGE_STANDARD' => 'c++20',
    'OTHER_CPLUSPLUSFLAGS' => '$(inherited) -DFOLLY_NO_CONFIG -DFOLLY_MOBILE=1 -DFOLLY_USE_LIBCPP=1 -DFOLLY_CFG_NO_COROUTINES=1 -DFOLLY_HAVE_CLOCK_GETTIME=1',
    'HEADER_SEARCH_PATHS' => '$(inherited) "$(PODS_ROOT)/boost" "$(PODS_ROOT)/DoubleConversion" "$(PODS_ROOT)/fast_float/include" "$(PODS_ROOT)/fmt/include" "$(PODS_ROOT)/RCT-Folly"'
  }
  s.pod_target_xcconfig = xcconfig

  if defined?(install_modules_dependencies) && defined?(NewArchitectureHelper) && NewArchitectureHelper.new_arch_enabled
    install_modules_dependencies(s)
  elsif ENV['RCT_NEW_ARCH_ENABLED'] == '1'
    s.dependency 'React-Fabric'
    s.dependency 'React-RCTFabric'
    s.dependency 'Yoga'
    s.dependency 'ReactCodegen'
    xcconfig['OTHER_CFLAGS'] = '$(inherited) -DRCT_NEW_ARCH_ENABLED=1'
    xcconfig['OTHER_CPLUSPLUSFLAGS'] = "#{xcconfig['OTHER_CPLUSPLUSFLAGS']} -DRCT_NEW_ARCH_ENABLED=1"
    xcconfig['SWIFT_ACTIVE_COMPILATION_CONDITIONS'] = '$(inherited) RCT_NEW_ARCH_ENABLED'
    # Fabric pulls <yoga/style/Style.h> from the private Yoga headers; make them visible to this pod target.
    xcconfig['HEADER_SEARCH_PATHS'] = "#{xcconfig['HEADER_SEARCH_PATHS']} \"$(PODS_ROOT)/Headers/Private/Yoga\""
    s.pod_target_xcconfig = xcconfig
  end

  s.source_files = 'ios/**/*'
end
