import UIKit

extension UIView {
  func addSubviewWithConstraints(viewToAdd: UIView) {
    addSubview(viewToAdd)
    viewToAdd.translatesAutoresizingMaskIntoConstraints = false
    viewToAdd.centerXAnchor.constraint(equalTo: centerXAnchor).isActive = true
    viewToAdd.centerYAnchor.constraint(equalTo: centerYAnchor).isActive = true
    viewToAdd.widthAnchor.constraint(equalTo: widthAnchor).isActive = true
    viewToAdd.heightAnchor.constraint(equalTo: heightAnchor).isActive = true
  }
}
