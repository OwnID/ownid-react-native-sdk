import Foundation
import UIKit

extension String {
    var hexToUIColor: UIColor {
        let r, g, b, a: CGFloat
        
        var hexString: String = self.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()

        if (hexString.hasPrefix("#")) {
            hexString.remove(at: hexString.startIndex)
        }

        var rgbValue: UInt64 = 0
        Scanner(string: hexString).scanHexInt64(&rgbValue)
        
        switch hexString.count {
        case 3:
            r = CGFloat((rgbValue & 0xF00) >> 8) / 15.0
            g = CGFloat((rgbValue & 0x0F0) >> 4) / 15.0
            b = CGFloat(rgbValue & 0x00F) / 15.0
            a = 1.0
        case 4:
            r = CGFloat((rgbValue & 0xF000) >> 12) / 15.0
            g = CGFloat((rgbValue & 0x0F00) >> 8) / 15.0
            b = CGFloat((rgbValue & 0x00F0) >> 4) / 15.0
            a = CGFloat(rgbValue & 0x000F) / 15.0
        case 6:
            r = CGFloat((rgbValue & 0xFF0000) >> 16) / 255.0
            g = CGFloat((rgbValue & 0x00FF00) >> 8) / 255.0
            b = CGFloat(rgbValue & 0x0000FF) / 255.0
            a = 1.0
        case 8:
            r = CGFloat((rgbValue & 0xFF000000) >> 24) / 255
            g = CGFloat((rgbValue & 0x00FF0000) >> 16) / 255
            b = CGFloat((rgbValue & 0x0000FF00) >> 8) / 255
            a = CGFloat(rgbValue & 0x000000FF) / 255
        default:
            return .gray
        }
        
        return UIColor(red: r, green: g, blue: b, alpha: a)
    }
}
