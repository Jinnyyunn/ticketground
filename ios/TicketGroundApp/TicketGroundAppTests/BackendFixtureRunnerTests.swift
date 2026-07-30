import Foundation
import XCTest

final class BackendFixtureRunnerTests: XCTestCase {
    private struct APIEnvironment: Decodable {
        let runID: String
        let publicBaseURL: String
        let adminBaseURL: String
        let fixedClock: String
        let publicPort: Int
        let adminPort: Int
    }

    func testFreshDatabaseAndCleanup() async throws {
        let environment = try readEnvironment()
        XCTAssertFalse(environment.runID.isEmpty)
        XCTAssertFalse(environment.adminBaseURL.isEmpty)
        XCTAssertEqual(environment.fixedClock, "2026-07-13T00:00:00Z")
        XCTAssertNotEqual(environment.publicPort, environment.adminPort)

        let url = try XCTUnwrap(URL(string: "\(environment.publicBaseURL)/api/state"))
        let (data, response) = try await URLSession.shared.data(from: url)
        let httpResponse = try XCTUnwrap(response as? HTTPURLResponse)
        XCTAssertEqual(httpResponse.statusCode, 200)
        let body = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        XCTAssertEqual(body["ok"] as? Bool, true)
    }

    private func readEnvironment() throws -> APIEnvironment {
        let processEnvironment = ProcessInfo.processInfo.environment
        let data: Data
        if let json = processEnvironment["TICKETGROUND_API_ENVIRONMENT_JSON"] {
            data = Data(json.utf8)
        } else {
            let path = try XCTUnwrap(processEnvironment["TICKETGROUND_API_ENVIRONMENT_FILE"])
            data = try Data(contentsOf: URL(fileURLWithPath: path))
        }
        return try JSONDecoder().decode(APIEnvironment.self, from: data)
    }
}
