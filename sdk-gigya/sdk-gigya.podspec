Pod::Spec.new do |s|
  s.name             = 'sdk-gigya'
  s.version          = '3.3.1'
  s.summary          = 'sdk-gigya'

  s.description      = <<-DESC
sdk-gigya pod library. Used in autolinking alongside of react libraries.
                       DESC

  s.homepage         = 'https://github.com/OwnID/ownid-react-native-sdk'
  s.license          = 'Apache 2.0'
  s.authors          = 'OwnID, Inc'
  s.source           = { :git => 'https://github.com/OwnID/ownid-react-native-sdk.git' }

  s.module_name   = 'SDKGigya'
  s.ios.deployment_target = '14.0'
  s.swift_version = '5.1.1'

  s.dependency 'sdk-core'
  s.dependency 'ownid-gigya-ios-sdk', '3.3.1'
  s.dependency 'Gigya'

  s.source_files = 'ios/**/*'
end
