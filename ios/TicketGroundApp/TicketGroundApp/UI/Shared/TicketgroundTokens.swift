import SwiftUI

enum TicketgroundColor {
    static let ink = Color(red: 26 / 255, green: 26 / 255, blue: 29 / 255)
    static let inkSecondary = Color(red: 41 / 255, green: 41 / 255, blue: 45 / 255)
    static let inkMuted = Color(red: 107 / 255, green: 107 / 255, blue: 112 / 255)
    static let surface = Color.white
    static let surfaceMuted = Color(red: 247 / 255, green: 247 / 255, blue: 248 / 255)
    static let surfaceRaised = Color(red: 243 / 255, green: 243 / 255, blue: 243 / 255)
    static let line = Color.black.opacity(0.08)
    static let lineStrong = Color.black.opacity(0.16)
    static let accent = Color(red: 255 / 255, green: 45 / 255, blue: 63 / 255)
    static let link = Color(red: 26 / 255, green: 71 / 255, blue: 255 / 255)
    static let success = Color(red: 31 / 255, green: 138 / 255, blue: 91 / 255)
    static let warning = Color(red: 196 / 255, green: 122 / 255, blue: 0 / 255)
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
