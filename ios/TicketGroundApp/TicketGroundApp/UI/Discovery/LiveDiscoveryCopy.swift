import Foundation

/// Centralized plain-language copy for LIVE discovery states (catalog
/// empty/not-found/unavailable, unsupported routes, degraded home state),
/// pulled out of the individual views as pure values/functions so they are
/// unit-testable without instantiating SwiftUI views.
///
/// These messages must never leak raw HTTP methods, API paths, or backend
/// implementation details (`GET /api/catalog`, `POST endpoint`,
/// `LiveBackendService`, `mutation`, `contract`, `route`, `backend
/// capability`, ...) to end users. A prior audit caught the genre listing's
/// empty state literally rendering "GET /api/catalog 결과에 표시할 공연이
/// 없습니다." on screen (tapping "스포츠" with no sports events live).
/// `LiveDiscoveryCopyTests` guards every string here against that class of
/// regression.
enum LiveDiscoveryCopy {
    static let catalogEmpty = "표시할 공연이 없습니다."
    static let catalogNotFound = "요청한 공연을 찾을 수 없습니다."
    static let catalogUnavailableReason = "확인되지 않은 공연 정보는 임의로 추정해 표시하지 않습니다."
    static let stateHomeConnectionLabel = "서비스 연결 상태"
    static let unsupportedRouteHeadline = "아직 준비 중인 화면입니다."

    /// The reason shown under an unsupported route's headline, e.g. when a
    /// user taps "회원가입" on the login screen (social login only - there is
    /// no separate signup flow) or lands on any other not-yet-built route.
    static func unsupportedReason(for route: AppRoute) -> String {
        switch route {
        case .signup:
            return "별도 회원가입 없이 구글, 카카오톡, 네이버 계정으로 바로 로그인할 수 있습니다."
        case .queue, .booking, .resale, .transfer, .cancel, .reservation:
            return "아직 준비 중인 기능이라 이용할 수 없습니다."
        case .artist:
            return "아티스트별 공연 정보는 아직 준비 중이라 확인할 수 없습니다."
        case .region:
            return "지역별 공연 정보는 아직 준비 중이라 확인할 수 없습니다."
        case .open:
            return "티켓오픈 캘린더 정보는 아직 준비 중이라 확인할 수 없습니다."
        default:
            return "아직 준비 중인 화면이라 이용할 수 없습니다."
        }
    }
}
