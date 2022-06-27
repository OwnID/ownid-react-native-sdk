import React

final class OwnIDButtonRCTShadowView: RCTShadowView {
  override func setLocalData(_ localData: NSObject!) {
    super.setLocalData(localData)
    let sizeInfo = localData as! SizeInfo
    intrinsicContentSize = sizeInfo.size

    dirtyLayout()
  }
}
