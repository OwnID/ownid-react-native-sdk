Pod::Spec.new do |s|
  s.name             = 'sdk-core'
  s.version          = '3.2.0'
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

  s.dependency 'ownid-core-ios-sdk', '3.2.0'
  s.dependency 'React'

  s.source_files = 'ios/**/*'
end
