import SwiftUI

enum TicketgroundColor {
    static let ink = adaptive(light: UIColor(red: 26 / 255, green: 26 / 255, blue: 29 / 255, alpha: 1), dark: UIColor(white: 0.96, alpha: 1))
    static let inkSecondary = adaptive(light: UIColor(red: 41 / 255, green: 41 / 255, blue: 45 / 255, alpha: 1), dark: UIColor(white: 0.84, alpha: 1))
    static let inkMuted = adaptive(light: UIColor(red: 107 / 255, green: 107 / 255, blue: 112 / 255, alpha: 1), dark: UIColor(white: 0.67, alpha: 1))
    static let surface = adaptive(light: .white, dark: UIColor(red: 29 / 255, green: 29 / 255, blue: 31 / 255, alpha: 1))
    static let surfaceMuted = adaptive(light: UIColor(red: 247 / 255, green: 247 / 255, blue: 248 / 255, alpha: 1), dark: UIColor(red: 39 / 255, green: 39 / 255, blue: 42 / 255, alpha: 1))
    static let surfaceRaised = adaptive(light: UIColor(red: 243 / 255, green: 243 / 255, blue: 243 / 255, alpha: 1), dark: UIColor(red: 46 / 255, green: 46 / 255, blue: 49 / 255, alpha: 1))
    static let line = adaptive(light: UIColor(white: 0, alpha: 0.08), dark: UIColor(white: 1, alpha: 0.12))
    static let lineStrong = adaptive(light: UIColor(white: 0, alpha: 0.16), dark: UIColor(white: 1, alpha: 0.24))
    static let accent = Color(red: 255 / 255, green: 45 / 255, blue: 63 / 255)
    static let link = Color(red: 26 / 255, green: 71 / 255, blue: 255 / 255)
    static let success = Color(red: 31 / 255, green: 138 / 255, blue: 91 / 255)
    static let warning = Color(red: 196 / 255, green: 122 / 255, blue: 0 / 255)

    private static func adaptive(light: UIColor, dark: UIColor) -> Color {
        Color(uiColor: UIColor { traitCollection in
            traitCollection.userInterfaceStyle == .dark ? dark : light
        })
    }
}

enum TicketgroundSpacing {
    static let xs: CGFloat = 4
    static let sm: CGFloat = 8
    static let md: CGFloat = 12
    static let lg: CGFloat = 16
    static let xl: CGFloat = 24
    static let xxl: CGFloat = 32
}

enum TicketgroundRadius {
    static let small: CGFloat = 8
    static let medium: CGFloat = 12
    static let large: CGFloat = 20
    static let pill: CGFloat = 100
}
