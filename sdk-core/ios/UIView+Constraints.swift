import UIKit

public extension UIView {
    func addSubviewWithConstraints(viewToAdd: UIView, shouldDisableParentAutoresizing: Bool = true) {
      translatesAutoresizingMaskIntoConstraints = !shouldDisableParentAutoresizing
    addSubview(viewToAdd)
    viewToAdd.translatesAutoresizingMaskIntoConstraints = false
    viewToAdd.centerXAnchor.constraint(equalTo: centerXAnchor).isActive = true
    viewToAdd.centerYAnchor.constraint(equalTo: centerYAnchor).isActive = true
    viewToAdd.widthAnchor.constraint(equalTo: widthAnchor).isActive = true
    viewToAdd.heightAnchor.constraint(equalTo: heightAnchor).isActive = true
  }
}
