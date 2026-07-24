import Foundation

enum FixtureScenario: String {
    case happy
    case loading
    case malformed
    case offline
    case unauthorized
    case empty
    case mediaFallback

    var statusText: String {
        switch self {
        case .happy: return "상태: 준비됨"
        case .loading: return "상태: 불러오는 중"
        case .malformed: return "상태: 잘못된 링크"
        case .offline: return "상태: 오프라인"
        case .unauthorized: return "상태: 인증 필요"
        case .empty: return "상태: 데이터 없음"
        case .mediaFallback: return "상태: 미디어 없음"
        }
    }

    static var current: FixtureScenario {
        let arguments = ProcessInfo.processInfo.arguments
        guard let index = arguments.firstIndex(of: "-fixture-scenario"), arguments.indices.contains(index + 1) else {
            return .happy
        }
        return FixtureScenario(rawValue: arguments[index + 1]) ?? .malformed
    }

    static var isFixtureMode: Bool {
        guard let index = ProcessInfo.processInfo.arguments.firstIndex(of: "-api-mode"),
              ProcessInfo.processInfo.arguments.indices.contains(index + 1) else {
            return false
        }
        return ProcessInfo.processInfo.arguments[index + 1] == "fixture"
    }

    static var reduceMotionRequested: Bool {
        ProcessInfo.processInfo.arguments.contains("-reduce-motion")
    }
}
