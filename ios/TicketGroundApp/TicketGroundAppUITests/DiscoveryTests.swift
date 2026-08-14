import XCTest

final class DiscoveryTests: XCTestCase {
    func testHomeRankingAndOpenCalendar() {
        let app = UITestBootstrap.fixtureApp(scenario: .happy)
        app.launch()

        XCTAssertTrue(app.staticTexts["콘서트"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["뮤지컬"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["전시"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["IU 2026 WORLD TOUR"].waitForExistence(timeout: 10))
        let heroTitle = app.staticTexts["discovery-featured-title"]
        XCTAssertTrue(heroTitle.waitForExistence(timeout: 10))
        XCTAssertGreaterThan(heroTitle.frame.height, 60)
        let homeCategory = app.buttons["discovery-category-home"]
        let concertCategory = app.buttons["discovery-category-concert"]
        XCTAssertEqual(homeCategory.value as? String, "selected")
        XCTAssertEqual(concertCategory.value as? String, "default")
        homeCategory.tap()
        XCTAssertTrue(app.staticTexts["discovery-featured-title"].exists)
        XCTAssertFalse(app.staticTexts["이 화면은 다음 discovery 단계에서 콘텐츠를 연결합니다."].exists)
        XCTAssertTrue(app.buttons["discovery-featured-cta"].waitForExistence(timeout: 10))
        let heroIndicator = app.staticTexts["discovery-hero-page-indicator"]
        XCTAssertTrue(heroIndicator.waitForExistence(timeout: 10))
        XCTAssertEqual(heroIndicator.label, "1 / 2")
        let nextHero = app.buttons["discovery-hero-next"]
        XCTAssertTrue(nextHero.isHittable)
        nextHero.tap()
        XCTAssertEqual(heroIndicator.label, "2 / 2")
        XCTAssertNotEqual(heroTitle.label, "IU 2026 WORLD TOUR")
        app.buttons["discovery-hero-previous"].tap()
        XCTAssertEqual(heroIndicator.label, "1 / 2")
        XCTAssertEqual(heroTitle.label, "IU 2026 WORLD TOUR")
        XCTAssertTrue(app.staticTexts["실시간 예매 랭킹 TOP10"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["티켓오픈 예정"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["바로가기"].waitForExistence(timeout: 10))
        assertDiscoverable(app.buttons["discovery-featured-cta"])
        assertDiscoverable(app.buttons["discovery-ranking-more"])
        assertDiscoverable(app.buttons["discovery-open-calendar"])
        assertDiscoverable(app.buttons["shortcut-open-calendar"])
        assertWithinHomeBounds(app)

        app.buttons["discovery-ranking-more"].tap()
        XCTAssertTrue(app.staticTexts["route-ranking"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["BackButton"].waitForExistence(timeout: 10))
        app.buttons["BackButton"].tap()
        XCTAssertTrue(app.staticTexts["실시간 예매 랭킹 TOP10"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["tab-home"].isSelected)

        app.buttons["discovery-open-calendar"].tap()
        XCTAssertTrue(app.staticTexts["2026년 7월 월별 캘린더"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["오픈 임박"].exists)
    }

    func testEmptyDiscoveryFixture() {
        let app = UITestBootstrap.fixtureApp(scenario: .empty)
        app.launch()

        XCTAssertTrue(app.staticTexts["티켓오픈 일정이 없습니다."].waitForExistence(timeout: 10))
        assertDiscoverable(app.buttons["discovery-empty-action"])
        XCTAssertTrue(app.buttons["discovery-empty-action"].label.contains("홈"))
    }

    func testHeaderSearchNavigatesToFixtureSearch() {
        let app = UITestBootstrap.fixtureApp(scenario: .happy)
        app.launch()
        XCTAssertTrue(app.buttons["header-search"].waitForExistence(timeout: 10))
        app.buttons["header-search"].tap()
        XCTAssertTrue(app.staticTexts["search-screen-title"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.textFields["search-input"].exists)
        app.textFields["search-input"].tap()
        app.textFields["search-input"].typeText("IU")
        XCTAssertTrue(app.staticTexts["IU 2026 WORLD TOUR"].waitForExistence(timeout: 10))
    }

    func testHeaderLoginShowsExternalOAuthGateWithoutCreatingAnAccount() {
        let app = UITestBootstrap.fixtureApp(scenario: .happy)
        app.launch()
        XCTAssertTrue(app.buttons["header-login"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["header-login"].isHittable)
        app.buttons["header-login"].tap()
        XCTAssertTrue(app.staticTexts["login-screen-title"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["login-google"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["login-kakao"].exists)
        XCTAssertTrue(app.buttons["login-naver"].exists)
        app.buttons["login-google"].tap()
        let externalGate = app.buttons.matching(identifier: "login-provider-external-gate").element(boundBy: 1)
        XCTAssertTrue(externalGate.waitForExistence(timeout: 10))
        externalGate.tap()
        XCTAssertTrue(app.staticTexts["login-provider-external-state"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.staticTexts["login-success"].exists)
        XCTAssertTrue(app.staticTexts["Google 로그인은 HTTPS API와 외부 OAuth 인증 단계(E3) 연결이 모두 필요합니다. 현재 앱은 인증 정보를 수집하거나 계정을 만들지 않습니다."].exists)
        recordScreenshot(named: "google-ui-test-gate", app: app)
    }

    func testProviderLoginCancellationDoesNotCreateASession() {
        let app = UITestBootstrap.fixtureApp(scenario: .happy)
        app.launch()
        app.buttons["header-login"].tap()
        XCTAssertTrue(app.buttons["login-kakao"].waitForExistence(timeout: 10))
        app.buttons["login-kakao"].tap()
        let cancel = app.buttons.matching(identifier: "login-provider-cancel").element(boundBy: 1)
        XCTAssertTrue(cancel.waitForExistence(timeout: 10))
        cancel.tap()
        XCTAssertTrue(app.staticTexts["login-provider-external-state"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.staticTexts["login-success"].exists)
        XCTAssertTrue(app.staticTexts["카카오톡 인증을 취소했습니다.\n로그인 상태는 그대로입니다."].exists)
        recordScreenshot(named: "kakao-ui-test-cancel", app: app)
    }

    func testNaverLoginKeepsDeterministicExternalGateDuringUITests() {
        let app = UITestBootstrap.fixtureApp(scenario: .happy)
        app.launch()
        app.buttons["header-login"].tap()
        XCTAssertTrue(app.buttons["login-naver"].waitForExistence(timeout: 10))

        app.buttons["login-naver"].tap()

        let externalGate = app.buttons.matching(identifier: "login-provider-external-gate").element(boundBy: 1)
        XCTAssertTrue(externalGate.waitForExistence(timeout: 10))
        externalGate.tap()
        XCTAssertTrue(app.staticTexts["login-provider-external-state"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["네이버 로그인은 HTTPS API와 외부 OAuth 인증 단계(E3) 연결이 모두 필요합니다. 현재 앱은 인증 정보를 수집하거나 계정을 만들지 않습니다."].exists)
        XCTAssertFalse(app.staticTexts["login-success"].exists)
        app.scrollViews.firstMatch.swipeDown(velocity: .fast)
        XCTAssertTrue(app.staticTexts["login-screen-title"].isHittable)
        recordScreenshot(named: "naver-ui-test-gate", app: app)
    }

    private func recordScreenshot(named name: String, app: XCUIApplication) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    func testHeaderMenuNavigatesToFixtureMenu() {
        let app = UITestBootstrap.fixtureApp(scenario: .happy)
        app.launch()
        XCTAssertTrue(app.buttons["header-menu"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["header-menu"].isHittable)
        app.buttons["header-menu"].tap()
        XCTAssertTrue(app.staticTexts["menu-screen-title"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["menu-login"].exists)
        XCTAssertTrue(app.buttons["menu-signup"].exists)
        XCTAssertFalse(app.switches["menu-theme-toggle"].exists)
        XCTAssertTrue(app.buttons["menu-category-concert"].exists)
        XCTAssertTrue(app.buttons["menu-category-musical"].exists)
        XCTAssertTrue(app.buttons["menu-calendar"].exists)
        XCTAssertTrue(app.buttons["menu-help"].exists)
        XCTAssertTrue(app.buttons["menu-inquiry"].exists)
        XCTAssertTrue(app.buttons["menu-kakao-channel"].exists)
        XCTAssertTrue(app.buttons["menu-kakao-channel-add"].exists)
        app.buttons["menu-login"].tap()
        XCTAssertTrue(app.staticTexts["login-screen-title"].waitForExistence(timeout: 10))
    }

    func testMenuOpensCapabilityLedgerWithoutClaimingUnavailableFunctionsAreLive() {
        let app = UITestBootstrap.fixtureApp(scenario: .happy)
        app.launch()

        XCTAssertTrue(app.buttons["header-menu"].waitForExistence(timeout: 10))
        app.buttons["header-menu"].tap()
        XCTAssertTrue(app.buttons["menu-capability-ledger"].waitForExistence(timeout: 10))
        app.buttons["menu-capability-ledger"].tap()

        XCTAssertTrue(app.staticTexts["capability-ledger-title"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["공개 공연 및 좌석 조회"].exists)
        XCTAssertTrue(app.staticTexts["공개 미디어 원본"].exists)
        XCTAssertTrue(app.staticTexts["로그인과 내 정보"].exists)
        XCTAssertTrue(app.buttons["capability-ledger-home"].exists)
        XCTAssertTrue(app.buttons["capability-ledger-login"].exists)
    }

    func testBottomSearchTabNavigatesToFixtureSearch() {
        let app = UITestBootstrap.fixtureApp(scenario: .happy)
        app.launch()
        XCTAssertTrue(app.buttons["tab-search"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["tab-search"].isHittable)
        app.buttons["tab-search"].tap()
        XCTAssertTrue(app.staticTexts["search-screen-title"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.textFields["search-input"].exists)
    }

    func testLiveHomeShowsPublicStateWhenCatalogRouteIsUnconfirmed() {
        let app = liveApp()
        app.launch()

        XCTAssertTrue(anyElement(app, identifier: "live-state-home").waitForExistence(timeout: 20))
        XCTAssertTrue(app.staticTexts["공개 상태 조회"].exists)
        XCTAssertTrue(app.staticTexts["공연 목록, 검색, 상세와 좌석도는 아직 사용할 수 없습니다."].exists)
        XCTAssertFalse(app.buttons["discovery-featured-cta"].exists)
        XCTAssertFalse(app.buttons["live-seat-map-link"].exists)
    }

    func testLiveStateOnlyHomeCanRetryCatalogAdmission() {
        let app = liveApp(homeScenario: "recovering")
        app.launch()

        XCTAssertTrue(anyElement(app, identifier: "live-state-home").waitForExistence(timeout: 10))
        let retry = app.buttons["live-state-home-retry"]
        XCTAssertTrue(retry.exists)
        retry.tap()

        XCTAssertTrue(app.staticTexts["LIVE BACKEND"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["Neon Stage"].exists)
        XCTAssertFalse(anyElement(app, identifier: "live-state-home").exists)
    }

    func testLiveHomeShowsAdmittedCatalogContent() {
        let app = liveApp(homeScenario: "catalog")
        app.launch()

        XCTAssertTrue(app.staticTexts["LIVE BACKEND"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["Neon Stage"].exists)
        XCTAssertTrue(app.buttons["discovery-featured-cta"].exists)
        XCTAssertFalse(anyElement(app, identifier: "live-state-home").exists)
        XCTAssertFalse(anyElement(app, identifier: "state-error").exists)
    }

    func testLiveHomeShowsEmptyStateForAnAdmittedEmptyCatalog() {
        let app = liveApp(homeScenario: "empty")
        app.launch()

        XCTAssertTrue(anyElement(app, identifier: "state-empty").waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["표시할 공연이 없습니다."].exists)
        XCTAssertTrue(app.buttons["state-empty-action"].exists)
    }

    func testLiveHomeShowsRetryForOfflineCatalogLoad() {
        let app = liveApp(homeScenario: "offline")
        app.launch()

        XCTAssertTrue(anyElement(app, identifier: "state-error").waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["state-error-action"].exists)
        XCTAssertEqual(anyElement(app, identifier: "state-error").value as? String, "콘텐츠 요청 1회")
    }

    func testLiveHomeShowsSafeRateLimitAndIncompatibleContractReasons() {
        let rateLimited = liveApp(homeScenario: "rateLimited")
        rateLimited.launch()
        XCTAssertTrue(rateLimited.staticTexts["요청이 많습니다"].waitForExistence(timeout: 10))
        XCTAssertTrue(rateLimited.staticTexts["잠시 후 다시 시도해 주세요."].exists)

        let incompatible = liveApp(homeScenario: "incompatible")
        incompatible.launch()
        XCTAssertTrue(incompatible.staticTexts["공연 정보 연결 확인 필요"].waitForExistence(timeout: 10))
        XCTAssertTrue(incompatible.staticTexts["서버 응답 형식이 앱과 달라 공연 정보를 안전하게 표시할 수 없습니다."].exists)
    }

    func testLiveCatalogRoutesUseOneUnavailableSurface() {
        let app = liveApp(homeScenario: "unavailable")
        app.launch()
        XCTAssertTrue(app.buttons["header-search"].waitForExistence(timeout: 10))
        app.buttons["header-search"].tap()

        XCTAssertTrue(anyElement(app, identifier: "live-catalog-unavailable").waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["공연 목록, 검색, 상세와 좌석도는 아직 사용할 수 없습니다."].exists)
        XCTAssertTrue(app.buttons["live-catalog-unavailable-retry"].exists)
        XCTAssertTrue(app.buttons["live-catalog-unavailable-home"].exists)
        XCTAssertFalse(app.textFields["live-search-input"].exists)
    }

    func testLiveCatalogRouteShowsResolvedNetworkFailure() {
        let app = liveApp(homeScenario: "offline")
        app.launch()
        XCTAssertTrue(app.buttons["header-search"].waitForExistence(timeout: 10))
        app.buttons["header-search"].tap()

        XCTAssertTrue(app.staticTexts["네트워크 연결 확인"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["인터넷 연결을 확인한 뒤 다시 시도해 주세요."].exists)
        XCTAssertFalse(app.staticTexts["공연 정보 형식 오류"].exists)
    }

    func testAdmittedLiveCatalogEnablesSearchRankingGenreAndGoods() {
        let search = liveApp(homeScenario: "catalog")
        search.launch()
        XCTAssertTrue(search.buttons["header-search"].waitForExistence(timeout: 10))
        search.buttons["header-search"].tap()
        XCTAssertTrue(search.textFields["live-search-input"].waitForExistence(timeout: 10))
        search.textFields["live-search-input"].tap()
        search.textFields["live-search-input"].typeText("Neon")
        search.textFields["live-search-input"].typeText("\n")
        XCTAssertTrue(search.staticTexts["Neon Stage"].waitForExistence(timeout: 10))
        XCTAssertFalse(anyElement(search, identifier: "live-catalog-unavailable").exists)
        search.buttons["live-catalog-event-link-live-neon"].tap()
        XCTAssertTrue(search.buttons["live-seat-map-link"].waitForExistence(timeout: 10))
        XCTAssertFalse(anyElement(search, identifier: "live-seat-map").exists)

        let ranking = liveApp(homeScenario: "catalog")
        ranking.launch()
        ranking.buttons["header-menu"].tap()
        XCTAssertTrue(ranking.buttons["live-menu-ranking"].waitForExistence(timeout: 10))
        ranking.buttons["live-menu-ranking"].tap()
        XCTAssertTrue(ranking.staticTexts["LIVE catalog · 1개"].waitForExistence(timeout: 10))

        let account = liveApp(homeScenario: "catalog")
        account.launch()
        XCTAssertTrue(account.buttons["tab-mypage"].waitForExistence(timeout: 10))
        account.buttons["tab-mypage"].tap()
        XCTAssertTrue(anyElement(account, identifier: "live-account-https-required").waitForExistence(timeout: 10))
        XCTAssertFalse(account.staticTexts["live-menu-screen-title"].exists)

        let genre = liveApp(homeScenario: "catalog")
        genre.launch()
        XCTAssertTrue(genre.buttons["discovery-category-concert"].waitForExistence(timeout: 10))
        genre.buttons["discovery-category-concert"].tap()
        XCTAssertTrue(genre.staticTexts["Neon Stage"].waitForExistence(timeout: 10))

        let goods = liveApp(homeScenario: "catalog")
        goods.launch()
        XCTAssertTrue(goods.buttons["discovery-featured-cta"].waitForExistence(timeout: 10))
        goods.buttons["discovery-featured-cta"].tap()
        XCTAssertTrue(goods.staticTexts["Neon Stage"].waitForExistence(timeout: 10))
    }

    func testAdmittedLiveCatalogSelectsSeatOnGraphicalMap() {
        let app = liveApp(homeScenario: "catalog")
        app.launch()
        XCTAssertTrue(app.buttons["discovery-featured-cta"].waitForExistence(timeout: 10))
        app.buttons["discovery-featured-cta"].tap()
        XCTAssertTrue(app.buttons["live-seat-map-link"].waitForExistence(timeout: 10))
        app.buttons["live-seat-map-link"].tap()
        XCTAssertTrue(anyElement(app, identifier: "live-seat-map").waitForExistence(timeout: 10))
        let marker = app.buttons["live-seat-marker-R-1"]
        XCTAssertTrue(marker.waitForExistence(timeout: 10))
        XCTAssertEqual(marker.value as? String, "선택 가능")
        XCTAssertTrue(app.buttons["live-seat-marker-R-4"].exists)
        recordScreenshot(named: "graphical-seat-selection-before", app: app)

        let submit = app.buttons["live-seat-booking-submit"]
        XCTAssertTrue(submit.waitForExistence(timeout: 10))
        XCTAssertFalse(submit.isEnabled)
        marker.tap()
        XCTAssertEqual(marker.value as? String, "선택됨")
        XCTAssertTrue(submit.isEnabled)
        app.buttons["live-seat-marker-R-4"].tap()
        XCTAssertEqual(app.buttons["live-seat-marker-R-4"].value as? String, "선택됨")
        XCTAssertEqual(marker.value as? String, "선택 가능")
        recordScreenshot(named: "graphical-seat-selection-signed-out", app: app)
        submit.tap()
        XCTAssertTrue(app.staticTexts["login-screen-title"].waitForExistence(timeout: 10))
    }

    func testAuthenticatedSeatSelectionEntersCheckoutAfterQueueAdmission() {
        let app = liveApp(homeScenario: "bookingAuthenticated")
        app.launch()
        XCTAssertTrue(app.buttons["discovery-featured-cta"].waitForExistence(timeout: 10))
        app.buttons["discovery-featured-cta"].tap()
        XCTAssertTrue(app.buttons["live-seat-map-link"].waitForExistence(timeout: 10))
        app.buttons["live-seat-map-link"].tap()

        let errorSurface = anyElement(app, identifier: "state-error")
        if errorSurface.waitForExistence(timeout: 2) {
            XCTFail("좌석도 로드 실패: \(errorSurface.label)")
        }
        let marker = app.buttons["live-seat-marker-R-1"]
        XCTAssertTrue(marker.waitForExistence(timeout: 10))
        marker.tap()
        recordScreenshot(named: "graphical-seat-selection-authenticated", app: app)
        app.buttons["live-seat-booking-submit"].tap()

        XCTAssertTrue(app.staticTexts["live-checkout"].waitForExistence(timeout: 10))
        let checkoutAmount = anyElement(app, identifier: "live-checkout-amount")
        XCTAssertTrue(checkoutAmount.waitForExistence(timeout: 10))
        XCTAssertTrue(checkoutAmount.label.contains("R-1"))
        XCTAssertTrue(checkoutAmount.label.contains("88"))
        XCTAssertTrue(checkoutAmount.label.contains("원"))

        app.buttons["BackButton"].tap()
        let replacementMarker = app.buttons["live-seat-marker-R-2"]
        XCTAssertTrue(replacementMarker.waitForExistence(timeout: 10))
        replacementMarker.tap()
        let replacementSubmit = app.buttons["live-seat-booking-submit"]
        XCTAssertTrue(replacementSubmit.waitForExistence(timeout: 10))
        XCTAssertTrue(replacementSubmit.isEnabled)
        replacementSubmit.tap()
        let replacementAmount = anyElement(app, identifier: "live-checkout-amount")
        XCTAssertTrue(replacementAmount.waitForExistence(timeout: 10))
        XCTAssertTrue(replacementAmount.label.contains("R-2"))
    }

    func testExpiredSeatHoldCanBeRetriedWithANewAttemptKey() {
        let app = liveApp(homeScenario: "bookingExpiredRetry")
        app.launch()
        XCTAssertTrue(app.buttons["discovery-featured-cta"].waitForExistence(timeout: 10))
        app.buttons["discovery-featured-cta"].tap()
        XCTAssertTrue(app.buttons["live-seat-map-link"].waitForExistence(timeout: 10))
        app.buttons["live-seat-map-link"].tap()
        let marker = app.buttons["live-seat-marker-R-1"]
        XCTAssertTrue(marker.waitForExistence(timeout: 10))
        marker.tap()
        let submit = app.buttons["live-seat-booking-submit"]
        submit.tap()
        XCTAssertTrue(anyElement(app, identifier: "live-seat-booking-error").waitForExistence(timeout: 10))
        submit.tap()
        XCTAssertTrue(anyElement(app, identifier: "live-checkout-amount").waitForExistence(timeout: 10))
    }

    func testLiveDiscoveryCardLoadsApprovedPoster() {
        let app = liveApp(homeScenario: "catalog")
        app.launch()
        app.buttons["header-menu"].tap()
        app.buttons["live-menu-region"].tap()

        XCTAssertTrue(
            anyElement(app, identifier: "media-poster-live-discovery-live-neon")
                .waitForExistence(timeout: 15)
        )
    }

    func testLiveDiscoveryCardUsesPosterFallback() {
        let app = liveApp(homeScenario: "catalogMediaFallback")
        app.launch()
        app.buttons["header-menu"].tap()
        app.buttons["live-menu-region"].tap()

        XCTAssertTrue(
            anyElement(app, identifier: "media-fallback-poster-live-discovery-live-neon")
                .waitForExistence(timeout: 15)
        )
    }

    func testLiveCatalogImageFailuresKeepDiscoverySurfacesAccessible() {
        let app = liveApp(homeScenario: "catalogMediaFallback")
        app.launch()

        XCTAssertTrue(anyElement(app, identifier: "media-fallback-featured-home-featured").waitForExistence(timeout: 15))
        XCTAssertTrue(anyElement(app, identifier: "media-fallback-poster-home-ranking-1").waitForExistence(timeout: 15))
        XCTAssertTrue(app.staticTexts["Neon Stage"].waitForExistence(timeout: 10))

        app.buttons["discovery-featured-cta"].tap()
        XCTAssertTrue(anyElement(app, identifier: "media-fallback-poster-live-detail").waitForExistence(timeout: 15))
        XCTAssertTrue(app.staticTexts["live-catalog-event"].waitForExistence(timeout: 10))
        XCTAssertEqual(app.staticTexts["live-catalog-event"].label, "Neon Stage")
        XCTAssertTrue(app.buttons["live-seat-map-link"].waitForExistence(timeout: 10))

        app.buttons["live-seat-map-link"].tap()
        XCTAssertTrue(anyElement(app, identifier: "media-fallback-seat-map-live-seat-booking").waitForExistence(timeout: 15))
        XCTAssertTrue(app.staticTexts["좌석 등급"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["live-seat-marker-R-1"].waitForExistence(timeout: 10))
    }

    func testAdmittedLiveCatalogExposesVersionedDiscoveryRoutes() {
        let region = liveApp(homeScenario: "catalog")
        region.launch()
        XCTAssertTrue(region.buttons["header-menu"].waitForExistence(timeout: 10))
        region.buttons["header-menu"].tap()
        XCTAssertTrue(region.buttons["live-menu-region"].waitForExistence(timeout: 10))
        region.buttons["live-menu-region"].tap()
        XCTAssertTrue(anyElement(region, identifier: "live-discovery-region-seoul").waitForExistence(timeout: 10))
        XCTAssertTrue(region.staticTexts["Neon Stage"].exists)

        let calendar = liveApp(homeScenario: "catalog")
        calendar.launch()
        XCTAssertTrue(calendar.buttons["header-menu"].waitForExistence(timeout: 10))
        calendar.buttons["header-menu"].tap()
        XCTAssertTrue(calendar.buttons["live-menu-open-calendar"].waitForExistence(timeout: 10))
        calendar.buttons["live-menu-open-calendar"].tap()
        XCTAssertTrue(anyElement(calendar, identifier: "live-discovery-open-live-neon").waitForExistence(timeout: 10))

        let artist = liveApp(homeScenario: "catalog")
        artist.launch()
        XCTAssertTrue(artist.buttons["discovery-featured-cta"].waitForExistence(timeout: 10))
        artist.buttons["discovery-featured-cta"].tap()
        XCTAssertTrue(artist.buttons["live-artist-link"].waitForExistence(timeout: 10))
        artist.buttons["live-artist-link"].tap()
        XCTAssertTrue(artist.staticTexts["Neon Artist"].waitForExistence(timeout: 10))
    }

    func testLiveDiscoverySeparatesEmptyNotFoundAndServerErrorStates() {
        let empty = liveApp(homeScenario: "empty")
        empty.launch()
        XCTAssertTrue(empty.buttons["header-menu"].waitForExistence(timeout: 10))
        empty.buttons["header-menu"].tap()
        XCTAssertTrue(empty.buttons["live-menu-region"].waitForExistence(timeout: 10))
        empty.buttons["live-menu-region"].tap()
        XCTAssertTrue(empty.staticTexts["현재 공개된 지역별 공연이 없습니다."].waitForExistence(timeout: 10))

        let notFound = liveApp(homeScenario: "discoveryNotFound")
        notFound.launch()
        XCTAssertTrue(notFound.buttons["discovery-featured-cta"].waitForExistence(timeout: 10))
        notFound.buttons["discovery-featured-cta"].tap()
        XCTAssertTrue(notFound.buttons["live-artist-link"].waitForExistence(timeout: 10))
        notFound.buttons["live-artist-link"].tap()
        XCTAssertTrue(notFound.staticTexts["아티스트를 찾을 수 없습니다"].waitForExistence(timeout: 10))

        let routeNotFound = liveApp(homeScenario: "discoveryRouteNotFound")
        routeNotFound.launch()
        XCTAssertTrue(routeNotFound.buttons["header-menu"].waitForExistence(timeout: 10))
        routeNotFound.buttons["header-menu"].tap()
        XCTAssertTrue(routeNotFound.buttons["live-menu-region"].waitForExistence(timeout: 10))
        routeNotFound.buttons["live-menu-region"].tap()
        XCTAssertTrue(routeNotFound.staticTexts["공연 정보를 불러올 수 없습니다"].waitForExistence(timeout: 10))

        let failure = liveApp(homeScenario: "discoveryFailure")
        failure.launch()
        XCTAssertTrue(failure.buttons["header-menu"].waitForExistence(timeout: 10))
        failure.buttons["header-menu"].tap()
        XCTAssertTrue(failure.buttons["live-menu-region"].waitForExistence(timeout: 10))
        failure.buttons["live-menu-region"].tap()
        XCTAssertTrue(failure.staticTexts["공연 정보를 불러올 수 없습니다"].waitForExistence(timeout: 10))
    }

    func testLiveLoginDoesNotCreateFixtureUser() {
        let app = liveApp()
        app.launch()
        XCTAssertTrue(app.buttons["header-login"].waitForExistence(timeout: 10))
        app.buttons["header-login"].tap()
        XCTAssertTrue(app.staticTexts["login-screen-title"].waitForExistence(timeout: 10))

        app.buttons["login-google"].tap()
        let externalGate = app.buttons.matching(identifier: "login-provider-external-gate").element(boundBy: 1)
        XCTAssertTrue(externalGate.waitForExistence(timeout: 10))
        externalGate.tap()
        XCTAssertTrue(anyElement(app, identifier: "login-provider-external-state").waitForExistence(timeout: 10))
        XCTAssertFalse(anyElement(app, identifier: "login-success").exists)
    }

    func testLiveDeferredRouteIsExplicit() {
        let app = liveApp()
        app.launch()
        XCTAssertTrue(app.buttons["header-login"].waitForExistence(timeout: 10))
        app.buttons["header-login"].tap()
        XCTAssertTrue(app.buttons["login-signup"].waitForExistence(timeout: 10))
        app.buttons["login-signup"].tap()

        XCTAssertTrue(anyElement(app, identifier: "live-unsupported-capability").waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["live-unsupported-home"].exists)
        XCTAssertTrue(app.buttons["live-unsupported-capability-ledger"].exists)
        XCTAssertFalse(app.staticTexts["이 화면은 다음 discovery 단계에서 콘텐츠를 연결합니다."].exists)
    }

    func testLiveAccountRouteExposesWatchlistAndSupportState() {
        let app = liveApp()
        app.launch()
        XCTAssertTrue(app.buttons["header-menu"].waitForExistence(timeout: 10))
        app.buttons["header-menu"].tap()
        XCTAssertTrue(app.staticTexts["live-menu-screen-title"].waitForExistence(timeout: 10))
        app.buttons["live-menu-account"].tap()
        XCTAssertTrue(anyElement(app, identifier: "live-account").waitForExistence(timeout: 20))
        XCTAssertTrue(app.buttons["tab-mypage"].isSelected)
        XCTAssertTrue(app.buttons["live-mypage-watchlist"].exists)
        XCTAssertTrue(app.buttons["live-mypage-notifications"].exists)
        XCTAssertTrue(app.buttons["live-mypage-support"].exists)
        XCTAssertTrue(app.buttons["live-mypage-kakao-channel"].exists)

        app.buttons["live-mypage-support"].tap()
        XCTAssertTrue(anyElement(app, identifier: "live-support").waitForExistence(timeout: 20))
        XCTAssertTrue(anyElement(app, identifier: "live-support-login-required").exists
                      || anyElement(app, identifier: "live-support-https-required").exists
                      || anyElement(app, identifier: "live-support-public-loading").exists
                      || anyElement(app, identifier: "live-support-public").exists
                      || anyElement(app, identifier: "live-support-public-error").exists
                      || anyElement(app, identifier: "live-support-retry").exists
                      || anyElement(app, identifier: "live-support-unsupported").exists
                      || anyElement(app, identifier: "live-support-help").exists
                      || anyElementWithIdentifierPrefix(app, prefix: "live-support-thread-").exists
                      || anyElement(app, identifier: "live-support-empty").exists
                      || anyElement(app, identifier: "live-support-error").exists)

        let watchlistApp = liveApp()
        watchlistApp.launch()
        XCTAssertTrue(watchlistApp.buttons["header-menu"].waitForExistence(timeout: 10))
        watchlistApp.buttons["header-menu"].tap()
        XCTAssertTrue(watchlistApp.staticTexts["live-menu-screen-title"].waitForExistence(timeout: 10))
        watchlistApp.buttons["live-menu-account"].tap()
        XCTAssertTrue(watchlistApp.buttons["live-mypage-watchlist"].waitForExistence(timeout: 20))
        watchlistApp.buttons["live-mypage-watchlist"].tap()
        XCTAssertTrue(anyElement(watchlistApp, identifier: "live-watchlist").waitForExistence(timeout: 20))
        XCTAssertTrue(anyElement(watchlistApp, identifier: "live-watchlist-login-required").exists
                      || anyElement(watchlistApp, identifier: "live-watchlist-https-required").exists
                      || anyElement(watchlistApp, identifier: "live-watchlist-loading").exists
                      || anyElement(watchlistApp, identifier: "live-watchlist-retry").exists
                      || anyElement(watchlistApp, identifier: "live-watchlist-unsupported").exists
                      || anyElement(watchlistApp, identifier: "live-watchlist-help").exists
                      || anyElement(watchlistApp, identifier: "live-watchlist-empty").exists
                      || anyElement(watchlistApp, identifier: "live-watchlist-items").exists)
    }

    func testLiveAccountShowsProfileReservationAndEmptyState() {
        let loadedApp = liveApp(accountScenario: "loaded")
        loadedApp.launch()
        loadedApp.buttons["header-mypage"].tap()
        XCTAssertTrue(loadedApp.staticTexts["live-menu-screen-title"].waitForExistence(timeout: 10))
        loadedApp.buttons["live-menu-account"].tap()
        XCTAssertTrue(loadedApp.staticTexts["live-account-name"].waitForExistence(timeout: 10))
        XCTAssertEqual(loadedApp.staticTexts["live-account-name"].label, "김민서")
        XCTAssertTrue(anyElement(loadedApp, identifier: "live-account-reservation-ticket-1").exists)
        attachScreenshot(loadedApp, name: "account-loaded")

        let emptyApp = liveApp(accountScenario: "empty")
        emptyApp.launch()
        emptyApp.buttons["header-mypage"].tap()
        XCTAssertTrue(emptyApp.staticTexts["live-menu-screen-title"].waitForExistence(timeout: 10))
        emptyApp.buttons["live-menu-account"].tap()
        XCTAssertTrue(anyElement(emptyApp, identifier: "live-account-reservations-empty").waitForExistence(timeout: 10))
        attachScreenshot(emptyApp, name: "account-empty")
    }

    func testLiveAccountSaveFailurePreservesDraft() {
        let app = liveApp(accountScenario: "save-failure")
        app.launch()
        app.buttons["header-mypage"].tap()
        XCTAssertTrue(app.staticTexts["live-menu-screen-title"].waitForExistence(timeout: 10))
        app.buttons["live-menu-account"].tap()
        XCTAssertTrue(app.buttons["live-account-edit"].waitForExistence(timeout: 10))
        app.buttons["live-account-edit"].tap()
        let input = app.textFields["live-account-name-input"]
        XCTAssertTrue(input.waitForExistence(timeout: 10))
        input.tap()
        input.typeText("박하늘")
        app.buttons["live-account-save"].tap()
        XCTAssertTrue(app.staticTexts["live-account-save-error"].waitForExistence(timeout: 10))
        XCTAssertEqual(input.value as? String, "김민서박하늘")
        attachScreenshot(app, name: "account-save-failure")
    }

    func testLiveWatchlistOptimisticFailureRollsBackAndEmptyStateRenders() {
        let failureApp = liveApp(watchlistScenario: "mutation-failure")
        failureApp.launch()
        failureApp.buttons["header-mypage"].tap()
        XCTAssertTrue(failureApp.staticTexts["live-menu-screen-title"].waitForExistence(timeout: 10))
        failureApp.buttons["live-menu-watchlist"].tap()
        let notification = failureApp.buttons["live-watchlist-notification-event-1"]
        XCTAssertTrue(notification.waitForExistence(timeout: 10))
        XCTAssertEqual(notification.label, "알림 켜짐")
        notification.tap()
        XCTAssertTrue(failureApp.staticTexts["live-watchlist-mutation-error"].waitForExistence(timeout: 10))
        XCTAssertEqual(notification.label, "알림 켜짐")
        failureApp.buttons["live-watchlist-remove-event-1"].tap()
        XCTAssertTrue(anyElement(failureApp, identifier: "live-watchlist-item-watch-1").waitForExistence(timeout: 10))
        attachScreenshot(failureApp, name: "watchlist-rollback")

        let emptyApp = liveApp(watchlistScenario: "empty")
        emptyApp.launch()
        emptyApp.buttons["header-mypage"].tap()
        XCTAssertTrue(emptyApp.staticTexts["live-menu-screen-title"].waitForExistence(timeout: 10))
        emptyApp.buttons["live-menu-watchlist"].tap()
        XCTAssertTrue(anyElement(emptyApp, identifier: "live-watchlist-empty").waitForExistence(timeout: 10))
        attachScreenshot(emptyApp, name: "watchlist-empty")
    }

    func testLiveBookingCreatesOnlyAPrePaymentDraft() {
        let app = liveApp(bookingScenario: "loaded")
        app.launch()
        XCTAssertTrue(anyElement(app, identifier: "live-booking").waitForExistence(timeout: 10))
        let seat = app.buttons["live-booking-seat-ticket-1"]
        XCTAssertTrue(seat.waitForExistence(timeout: 10))
        seat.tap()
        XCTAssertTrue(app.buttons["live-booking-create-draft"].waitForExistence(timeout: 10))
        app.buttons["live-booking-create-draft"].tap()
        XCTAssertTrue(app.staticTexts["live-booking-draft"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.staticTexts["결제 완료"].exists)
        attachScreenshot(app, name: "booking-prepayment-draft")
    }

    func testLiveBookingConflictExpiryAndReconnectStates() {
        let conflictApp = liveApp(bookingScenario: "conflict")
        conflictApp.launch()
        let seat = conflictApp.buttons["live-booking-seat-ticket-1"]
        XCTAssertTrue(seat.waitForExistence(timeout: 10))
        seat.tap()
        XCTAssertTrue(conflictApp.staticTexts["live-booking-conflict"].waitForExistence(timeout: 10))
        attachScreenshot(conflictApp, name: "booking-conflict")

        let expiredApp = liveApp(bookingScenario: "expired")
        expiredApp.launch()
        XCTAssertTrue(anyElement(expiredApp, identifier: "live-booking-expired").waitForExistence(timeout: 10))
        attachScreenshot(expiredApp, name: "booking-expired")

        let reconnectApp = liveApp(bookingScenario: "reconnect")
        reconnectApp.launch()
        XCTAssertTrue(reconnectApp.staticTexts["live-booking-reconnected"].waitForExistence(timeout: 10))
        attachScreenshot(reconnectApp, name: "booking-reconnect")
    }

    func testLiveNotificationDeviceRegistrationAndRevocation() {
        let app = liveApp(accountScenario: "loaded", notificationScenario: "allowed")
        app.launch()
        app.buttons["header-mypage"].tap()
        XCTAssertTrue(app.staticTexts["live-menu-screen-title"].waitForExistence(timeout: 10))
        app.buttons["live-menu-account"].tap()
        XCTAssertTrue(app.buttons["live-mypage-notifications"].waitForExistence(timeout: 10))
        app.buttons["live-mypage-notifications"].tap()
        XCTAssertTrue(anyElement(app, identifier: "live-notifications-no-device").waitForExistence(timeout: 10))
        app.buttons["live-notifications-register"].tap()
        XCTAssertTrue(app.staticTexts["live-notifications-ready"].waitForExistence(timeout: 10))
        attachScreenshot(app, name: "notifications-device-ready")
        app.buttons["live-notifications-revoke"].tap()
        XCTAssertTrue(anyElement(app, identifier: "live-notifications-no-device").waitForExistence(timeout: 10))
    }

    func testLiveNotificationPermissionAndRegistrationFailuresAreDistinct() {
        let denied = liveApp(accountScenario: "loaded", notificationScenario: "denied")
        denied.launch()
        denied.buttons["header-mypage"].tap()
        XCTAssertTrue(denied.staticTexts["live-menu-screen-title"].waitForExistence(timeout: 10))
        denied.buttons["live-menu-account"].tap()
        denied.buttons["live-mypage-notifications"].tap()
        XCTAssertTrue(anyElement(denied, identifier: "live-notifications-denied").waitForExistence(timeout: 10))

        let failed = liveApp(accountScenario: "loaded", notificationScenario: "registration-failure")
        failed.launch()
        failed.buttons["header-mypage"].tap()
        XCTAssertTrue(failed.staticTexts["live-menu-screen-title"].waitForExistence(timeout: 10))
        failed.buttons["live-menu-account"].tap()
        failed.buttons["live-mypage-notifications"].tap()
        failed.buttons["live-notifications-register"].tap()
        XCTAssertTrue(anyElement(failed, identifier: "live-notifications-registration-error").waitForExistence(timeout: 10))
        attachScreenshot(failed, name: "notifications-registration-failure")
    }

    func testLiveMobileTicketShowsShortLivedPrivateQR() {
        let app = liveApp(accountScenario: "loaded", mobileTicketScenario: "valid")
        app.launch()
        app.buttons["header-mypage"].tap()
        XCTAssertTrue(app.staticTexts["live-menu-screen-title"].waitForExistence(timeout: 10))
        app.buttons["live-menu-account"].tap()
        XCTAssertTrue(app.buttons["live-account-mobile-ticket"].waitForExistence(timeout: 10))
        app.buttons["live-account-mobile-ticket"].tap()
        XCTAssertTrue(anyElement(app, identifier: "live-mobile-ticket-qr").waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["live-mobile-ticket-valid"].exists)
        XCTAssertFalse(app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "token")).firstMatch.exists)
        attachScreenshot(app, name: "mobile-ticket-valid")
    }

    func testLiveMobileTicketDistinguishesExpiredUsedCanceledAndOffline() {
        for (scenario, identifier) in [
            ("expired", "live-mobile-ticket-expired"),
            ("used", "live-mobile-ticket-used"),
            ("canceled", "live-mobile-ticket-canceled"),
            ("offline", "live-mobile-ticket-offline")
        ] {
            let app = liveApp(accountScenario: "loaded", mobileTicketScenario: scenario)
            app.launch()
            app.buttons["header-mypage"].tap()
            XCTAssertTrue(app.staticTexts["live-menu-screen-title"].waitForExistence(timeout: 10))
            app.buttons["live-menu-account"].tap()
            app.buttons["live-account-mobile-ticket"].tap()
            XCTAssertTrue(anyElement(app, identifier: identifier).waitForExistence(timeout: 10), scenario)
        }
    }

    func testLiveAccountRoutesBlockHTTPBeforeProtectedRequests() {
        let accountApp = liveApp()
        accountApp.launch()
        XCTAssertTrue(accountApp.buttons["header-menu"].waitForExistence(timeout: 10))
        accountApp.buttons["header-menu"].tap()
        XCTAssertTrue(accountApp.staticTexts["live-menu-screen-title"].waitForExistence(timeout: 10))
        accountApp.buttons["live-menu-account"].tap()
        XCTAssertTrue(anyElement(accountApp, identifier: "live-account-https-required").waitForExistence(timeout: 10))
        XCTAssertFalse(anyElement(accountApp, identifier: "live-account-error").exists)

        let watchlistApp = liveApp()
        watchlistApp.launch()
        XCTAssertTrue(watchlistApp.buttons["header-menu"].waitForExistence(timeout: 10))
        watchlistApp.buttons["header-menu"].tap()
        XCTAssertTrue(watchlistApp.staticTexts["live-menu-screen-title"].waitForExistence(timeout: 10))
        watchlistApp.buttons["live-menu-watchlist"].tap()
        XCTAssertTrue(anyElement(watchlistApp, identifier: "live-watchlist-https-required").waitForExistence(timeout: 10))
        XCTAssertFalse(anyElement(watchlistApp, identifier: "live-watchlist-error").exists)

        let supportApp = liveApp()
        supportApp.launch()
        XCTAssertTrue(supportApp.buttons["header-menu"].waitForExistence(timeout: 10))
        supportApp.buttons["header-menu"].tap()
        XCTAssertTrue(supportApp.staticTexts["live-menu-screen-title"].waitForExistence(timeout: 10))
        supportApp.buttons["live-menu-inquiry"].tap()
        XCTAssertTrue(anyElement(supportApp, identifier: "live-support-https-required").waitForExistence(timeout: 10))
        XCTAssertFalse(anyElement(supportApp, identifier: "live-support-error").exists)
    }

    func testLiveSupportShowsPublicHelpAndCreatesAnInquiry() {
        let helpApp = liveApp(supportScenario: "loaded")
        helpApp.launch()
        XCTAssertTrue(helpApp.buttons["header-mypage"].waitForExistence(timeout: 10))
        helpApp.buttons["header-mypage"].tap()
        helpApp.buttons["live-menu-help"].tap()

        XCTAssertTrue(anyElement(helpApp, identifier: "live-support-public").waitForExistence(timeout: 10))
        XCTAssertTrue(helpApp.staticTexts["예매내역은 어디에서 확인하나요?"].exists)
        XCTAssertTrue(helpApp.staticTexts["고객센터 운영시간 안내"].exists)
        attachScreenshot(helpApp, name: "support-help")

        let inquiryApp = liveApp(supportScenario: "loaded")
        inquiryApp.launch()
        XCTAssertTrue(inquiryApp.buttons["header-mypage"].waitForExistence(timeout: 10))
        inquiryApp.buttons["header-mypage"].tap()
        inquiryApp.buttons["live-menu-inquiry"].tap()

        XCTAssertTrue(anyElement(inquiryApp, identifier: "live-support-composer").waitForExistence(timeout: 10))
        inquiryApp.textFields["문의 제목"].tap()
        inquiryApp.textFields["문의 제목"].typeText("좌석 확인 문의")
        let inquiryMessage = anyElement(inquiryApp, identifier: "live-support-message")
        inquiryMessage.tap()
        inquiryMessage.typeText("예매 좌석을 확인해 주세요.")
        inquiryApp.buttons["live-support-submit"].tap()

        XCTAssertTrue(anyElement(inquiryApp, identifier: "live-support-submit-success").waitForExistence(timeout: 10))
        XCTAssertTrue(inquiryApp.staticTexts["좌석 확인 문의"].exists)
        attachScreenshot(inquiryApp, name: "support-inquiry-success")
    }

    func testLiveSupportSubmissionFailureKeepsTheDraft() {
        let app = liveApp(supportScenario: "submission-failure")
        app.launch()
        XCTAssertTrue(app.buttons["header-mypage"].waitForExistence(timeout: 10))
        app.buttons["header-mypage"].tap()
        app.buttons["live-menu-inquiry"].tap()
        XCTAssertTrue(anyElement(app, identifier: "live-support-composer").waitForExistence(timeout: 10))

        app.textFields["문의 제목"].tap()
        app.textFields["문의 제목"].typeText("재시도 문의")
        let message = anyElement(app, identifier: "live-support-message")
        message.tap()
        message.typeText("작성 내용 유지")
        app.buttons["live-support-submit"].tap()

        XCTAssertTrue(anyElement(app, identifier: "live-support-submit-error").waitForExistence(timeout: 10))
        XCTAssertEqual(app.textFields["문의 제목"].value as? String, "재시도 문의")
        XCTAssertEqual(message.value as? String, "작성 내용 유지")
        attachScreenshot(app, name: "support-inquiry-failure")
    }

    func testLiveSupportReplySuccessAndFailurePreserveDraft() {
        let successApp = liveApp(supportScenario: "loaded")
        successApp.launch()
        XCTAssertTrue(successApp.buttons["header-mypage"].waitForExistence(timeout: 10))
        successApp.buttons["header-mypage"].tap()
        successApp.buttons["live-menu-inquiry"].tap()
        let successField = anyElementWithIdentifierPrefix(successApp, prefix: "live-support-reply-")
        XCTAssertTrue(successField.waitForExistence(timeout: 10))
        successField.tap()
        successField.typeText("추가 확인 부탁드립니다.")
        anyElementWithIdentifierPrefix(successApp, prefix: "live-support-reply-submit-").tap()
        XCTAssertTrue(anyElementWithIdentifierPrefix(successApp, prefix: "live-support-reply-success-").waitForExistence(timeout: 10))
        XCTAssertTrue(successApp.staticTexts["추가 확인 부탁드립니다."].exists)
        attachScreenshot(successApp, name: "support-reply-success")

        let failureApp = liveApp(supportScenario: "reply-failure")
        failureApp.launch()
        XCTAssertTrue(failureApp.buttons["header-mypage"].waitForExistence(timeout: 10))
        failureApp.buttons["header-mypage"].tap()
        failureApp.buttons["live-menu-inquiry"].tap()
        let failureField = anyElementWithIdentifierPrefix(failureApp, prefix: "live-support-reply-")
        XCTAssertTrue(failureField.waitForExistence(timeout: 10))
        failureField.tap()
        failureField.typeText("초안 유지 확인")
        anyElementWithIdentifierPrefix(failureApp, prefix: "live-support-reply-submit-").tap()
        XCTAssertTrue(anyElementWithIdentifierPrefix(failureApp, prefix: "live-support-reply-error-").waitForExistence(timeout: 10))
        XCTAssertEqual(failureField.value as? String, "초안 유지 확인")
        attachScreenshot(failureApp, name: "support-reply-failure")
    }

    func testLiveSupportLoadingStatesAreVisibleAndAccessible() {
        let publicLoadingApp = liveApp(supportScenario: "public-loading")
        publicLoadingApp.launch()
        XCTAssertTrue(publicLoadingApp.buttons["header-mypage"].waitForExistence(timeout: 10))
        publicLoadingApp.buttons["header-mypage"].tap()
        publicLoadingApp.buttons["live-menu-help"].tap()
        XCTAssertTrue(anyElement(publicLoadingApp, identifier: "live-support-public-loading").waitForExistence(timeout: 10))
        attachScreenshot(publicLoadingApp, name: "support-public-loading")

        let inquiryLoadingApp = liveApp(supportScenario: "inquiry-loading")
        inquiryLoadingApp.launch()
        XCTAssertTrue(inquiryLoadingApp.buttons["header-mypage"].waitForExistence(timeout: 10))
        inquiryLoadingApp.buttons["header-mypage"].tap()
        inquiryLoadingApp.buttons["live-menu-inquiry"].tap()
        XCTAssertTrue(anyElement(inquiryLoadingApp, identifier: "live-support-public").waitForExistence(timeout: 10))
        XCTAssertTrue(anyElement(inquiryLoadingApp, identifier: "live-support-inquiry-loading").exists)
        attachScreenshot(inquiryLoadingApp, name: "support-inquiry-loading")

        let submissionApp = liveApp(supportScenario: "submission-loading")
        submissionApp.launch()
        XCTAssertTrue(submissionApp.buttons["header-mypage"].waitForExistence(timeout: 10))
        submissionApp.buttons["header-mypage"].tap()
        submissionApp.buttons["live-menu-inquiry"].tap()
        XCTAssertTrue(anyElement(submissionApp, identifier: "live-support-composer").waitForExistence(timeout: 10))
        submissionApp.textFields["문의 제목"].tap()
        submissionApp.textFields["문의 제목"].typeText("전송 중 확인")
        let submissionMessage = anyElement(submissionApp, identifier: "live-support-message")
        submissionMessage.tap()
        submissionMessage.typeText("문의 전송 상태")
        submissionApp.buttons["live-support-submit"].tap()
        XCTAssertTrue(submissionApp.buttons["전송 중"].waitForExistence(timeout: 10))
        XCTAssertFalse(submissionApp.buttons["전송 중"].isEnabled)
        attachScreenshot(submissionApp, name: "support-submission-loading")

        let replyApp = liveApp(supportScenario: "reply-loading")
        replyApp.launch()
        XCTAssertTrue(replyApp.buttons["header-mypage"].waitForExistence(timeout: 10))
        replyApp.buttons["header-mypage"].tap()
        replyApp.buttons["live-menu-inquiry"].tap()
        let replyField = anyElementWithIdentifierPrefix(replyApp, prefix: "live-support-reply-")
        XCTAssertTrue(replyField.waitForExistence(timeout: 10))
        replyField.tap()
        replyField.typeText("답글 전송 상태")
        anyElementWithIdentifierPrefix(replyApp, prefix: "live-support-reply-submit-").tap()
        XCTAssertTrue(replyApp.buttons["전송 중"].waitForExistence(timeout: 10))
        XCTAssertFalse(replyApp.buttons["전송 중"].isEnabled)
        attachScreenshot(replyApp, name: "support-reply-loading")
    }

    func testLiveAccountCapabilityRendersLoginRequiredSurface() {
        let app = liveApp(capabilityState: "login-required")
        app.launch()
        XCTAssertTrue(app.buttons["header-menu"].waitForExistence(timeout: 10))
        app.buttons["header-menu"].tap()
        XCTAssertTrue(app.staticTexts["live-menu-screen-title"].waitForExistence(timeout: 10))
        app.buttons["live-menu-account"].tap()
        XCTAssertTrue(anyElement(app, identifier: "live-account-login-required").waitForExistence(timeout: 10))
        XCTAssertFalse(anyElement(app, identifier: "live-account-error").exists)
    }

    func testLiveAccountCapabilityRendersHTTPSRequiredSurface() {
        let app = liveApp(capabilityState: "https-required")
        app.launch()
        XCTAssertTrue(app.buttons["header-menu"].waitForExistence(timeout: 10))
        app.buttons["header-menu"].tap()
        XCTAssertTrue(app.staticTexts["live-menu-screen-title"].waitForExistence(timeout: 10))
        app.buttons["live-menu-account"].tap()
        XCTAssertTrue(anyElement(app, identifier: "live-account-https-required").waitForExistence(timeout: 10))
        XCTAssertFalse(anyElement(app, identifier: "live-account-error").exists)
    }

    func testLiveAccountCapabilityRendersUnsupportedSurface() {
        let app = liveApp(capabilityState: "unsupported")
        app.launch()
        XCTAssertTrue(app.buttons["header-menu"].waitForExistence(timeout: 10))
        app.buttons["header-menu"].tap()
        XCTAssertTrue(app.staticTexts["live-menu-screen-title"].waitForExistence(timeout: 10))
        app.buttons["live-menu-account"].tap()
        XCTAssertTrue(anyElement(app, identifier: "live-account-unsupported").waitForExistence(timeout: 10))
        XCTAssertFalse(anyElement(app, identifier: "live-account-error").exists)
    }

    func testLiveAccountCapabilityRendersRetrySurface() {
        let app = liveApp(capabilityState: "retry")
        app.launch()
        XCTAssertTrue(app.buttons["header-menu"].waitForExistence(timeout: 10))
        app.buttons["header-menu"].tap()
        XCTAssertTrue(app.staticTexts["live-menu-screen-title"].waitForExistence(timeout: 10))
        app.buttons["live-menu-account"].tap()
        XCTAssertTrue(anyElement(app, identifier: "live-account-retry").waitForExistence(timeout: 10))
        XCTAssertFalse(anyElement(app, identifier: "live-account-error").exists)
    }

    func testLiveAccountCapabilityRendersHelpSurface() {
        let app = liveApp(capabilityState: "help")
        app.launch()
        XCTAssertTrue(app.buttons["header-menu"].waitForExistence(timeout: 10))
        app.buttons["header-menu"].tap()
        XCTAssertTrue(app.staticTexts["live-menu-screen-title"].waitForExistence(timeout: 10))
        app.buttons["live-menu-account"].tap()
        XCTAssertTrue(anyElement(app, identifier: "live-account-help").waitForExistence(timeout: 10))
        XCTAssertFalse(anyElement(app, identifier: "live-account-error").exists)
    }

    func testLiveHamburgerMenuProvidesWebLikeLinksAndLiveAccountEntry() {
        let app = liveApp()
        app.launch()
        XCTAssertTrue(app.buttons["header-menu"].waitForExistence(timeout: 10))
        app.buttons["header-menu"].tap()

        XCTAssertTrue(app.staticTexts["live-menu-screen-title"].waitForExistence(timeout: 10))
        for identifier in [
            "live-menu-login",
            "live-menu-watchlist",
            "live-menu-search",
            "live-menu-ranking",
            "live-menu-region",
            "live-menu-open-calendar",
            "live-menu-help",
            "live-menu-inquiry",
            "live-menu-kakao-channel",
            "live-menu-category-concert",
            "live-menu-category-musical"
        ] {
            XCTAssertTrue(app.buttons[identifier].exists, identifier)
        }
        XCTAssertFalse(app.staticTexts["fixture-state-happy"].exists)
        XCTAssertFalse(app.staticTexts["fixture"].exists)

        app.buttons["live-menu-account"].tap()
        XCTAssertTrue(anyElement(app, identifier: "live-account").waitForExistence(timeout: 20))

        let supportApp = liveApp(homeScenario: "support")
        supportApp.launch()
        XCTAssertTrue(supportApp.buttons["header-menu"].waitForExistence(timeout: 10))
        supportApp.buttons["header-menu"].tap()
        XCTAssertTrue(supportApp.staticTexts["live-menu-screen-title"].waitForExistence(timeout: 10))
        supportApp.buttons["live-menu-help"].tap()
        XCTAssertTrue(anyElement(supportApp, identifier: "live-support").waitForExistence(timeout: 20))
        XCTAssertTrue(anyElement(supportApp, identifier: "live-support-public").waitForExistence(timeout: 20))
        XCTAssertTrue(anyElement(supportApp, identifier: "live-support-kakao-channel").exists)
        XCTAssertTrue(anyElement(supportApp, identifier: "live-support-kakao-channel-add").exists)
        XCTAssertTrue(supportApp.staticTexts["자주 묻는 질문"].exists)
        XCTAssertTrue(supportApp.staticTexts["공지사항"].exists)
        XCTAssertTrue(supportApp.staticTexts["안전한 1:1 문의"].exists)
        XCTAssertTrue(anyElement(supportApp, identifier: "live-support-login-required").exists)

        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = "issue-99-support-ci-fixture"
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    func testConfiguredLiveSupportRendersPublicContentAndLoginGate() {
        let app = liveApp()
        app.launch()
        XCTAssertTrue(app.buttons["header-menu"].waitForExistence(timeout: 10))
        app.buttons["header-menu"].tap()
        XCTAssertTrue(app.staticTexts["live-menu-screen-title"].waitForExistence(timeout: 10))
        app.buttons["live-menu-help"].tap()
        XCTAssertTrue(anyElement(app, identifier: "live-support").waitForExistence(timeout: 20))
        XCTAssertTrue(anyElement(app, identifier: "live-support-public").waitForExistence(timeout: 20))
        XCTAssertTrue(app.staticTexts["자주 묻는 질문"].exists)
        XCTAssertTrue(app.staticTexts["공지사항"].exists)
        XCTAssertTrue(app.staticTexts["안전한 1:1 문의"].exists)
        XCTAssertTrue(anyElement(app, identifier: "live-support-login-required").exists)

        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = "issue-99-live-support-cloudflare"
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    func testAuthenticatedSupportProtectsDraftsAndExpiredSessions() {
        let app = liveApp(homeScenario: "supportAuthenticated")
        app.launch()
        XCTAssertTrue(app.buttons["header-menu"].waitForExistence(timeout: 10))
        app.buttons["header-menu"].tap()
        XCTAssertTrue(app.staticTexts["live-menu-screen-title"].waitForExistence(timeout: 10))
        app.buttons["live-menu-help"].tap()

        let subject = app.textFields["live-support-subject"]
        XCTAssertTrue(subject.waitForExistence(timeout: 20))
        subject.tap()
        subject.typeText(String(repeating: "😀", count: 41))
        let message = app.textFields["live-support-message"]
        message.tap()
        message.typeText("body")
        XCTAssertFalse(app.buttons["live-support-submit"].isEnabled)
        XCTAssertTrue(app.staticTexts["제목 82/80 · 내용 4/1,000"].exists)
        XCTAssertTrue(app.staticTexts["live-support-subject-limit"].exists)
        XCTAssertTrue(app.staticTexts["live-support-subject-limit"].isHittable)

        let composerAttachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        composerAttachment.name = "issue-99-authenticated-composer-limit"
        composerAttachment.lifetime = .keepAlways
        add(composerAttachment)

        let thread = anyElement(app, identifier: "live-support-thread-support-ui")
        XCTAssertTrue(thread.waitForExistence(timeout: 10))
        thread.tap()
        XCTAssertTrue(anyElement(app, identifier: "live-support-detail").waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["발신자 확인 중"].exists)

        let detailAttachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        detailAttachment.name = "issue-99-authenticated-unknown-sender"
        detailAttachment.lifetime = .keepAlways
        add(detailAttachment)

        let reply = app.textFields["live-support-reply"]
        reply.tap()
        reply.typeText("추가 문의")
        app.buttons["live-support-reply-submit"].tap()
        XCTAssertTrue(app.staticTexts["추가 문의"].waitForExistence(timeout: 10))
        app.navigationBars.buttons.element(boundBy: 0).tap()
        XCTAssertTrue(anyElement(app, identifier: "live-support-thread-support-ui").waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["추가 문의"].exists)
        XCTAssertLessThan(
            anyElement(app, identifier: "live-support-thread-support-ui").frame.minY,
            anyElement(app, identifier: "live-support-thread-support-newer").frame.minY
        )

        anyElement(app, identifier: "live-support-thread-support-ui").tap()
        XCTAssertTrue(anyElement(app, identifier: "live-support-detail").waitForExistence(timeout: 10))
        let expiredReply = app.textFields["live-support-reply"]
        expiredReply.tap()
        expiredReply.typeText("세션 만료")
        app.buttons["live-support-reply-submit"].tap()
        XCTAssertFalse(anyElement(app, identifier: "live-support-detail").waitForExistence(timeout: 3))
        XCTAssertFalse(anyElement(app, identifier: "live-support-thread-support-ui").exists)
        XCTAssertFalse(anyElement(app, identifier: "live-support-thread-support-newer").exists)
        XCTAssertTrue(anyElement(app, identifier: "live-support-login-required").waitForExistence(timeout: 10))
    }

    func testAuthenticatedWatchlistSynchronizesDetailPreferencesAndRollback() {
        let app = liveApp(homeScenario: "watchlistAuthenticated")
        app.launch()

        XCTAssertTrue(app.buttons["discovery-featured-cta"].waitForExistence(timeout: 10))
        app.buttons["discovery-featured-cta"].tap()
        let detailToggle = app.buttons["live-watchlist-cta-toggle"]
        XCTAssertTrue(detailToggle.waitForExistence(timeout: 20))
        XCTAssertEqual(detailToggle.label, "관심공연 추가")
        detailToggle.tap()
        XCTAssertTrue(app.buttons["관심공연 해제"].waitForExistence(timeout: 10))

        app.navigationBars.buttons.element(boundBy: 0).tap()
        app.buttons["header-menu"].tap()
        XCTAssertTrue(app.buttons["live-menu-watchlist"].waitForExistence(timeout: 10))
        app.buttons["live-menu-watchlist"].tap()
        XCTAssertTrue(anyElement(app, identifier: "live-watchlist-items").waitForExistence(timeout: 20))

        let notification = app.buttons["live-watchlist-notification-live-neon"]
        XCTAssertTrue(notification.waitForExistence(timeout: 10))
        XCTAssertEqual(notification.label, "오픈 알림 끄기")
        notification.tap()
        XCTAssertFalse(notification.isEnabled)
        XCTAssertTrue(anyElement(app, identifier: "live-watchlist-mutation-error").waitForExistence(timeout: 10))
        XCTAssertEqual(notification.label, "오픈 알림 끄기")

        notification.tap()
        XCTAssertTrue(app.buttons["오픈 알림 켜기"].waitForExistence(timeout: 10))

        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = "issue-101-watchlist-synchronized"
        attachment.lifetime = .keepAlways
        add(attachment)

        app.buttons["live-watchlist-delete-live-neon"].tap()
        XCTAssertTrue(anyElement(app, identifier: "live-watchlist-empty").waitForExistence(timeout: 10))
    }

    func testAccountMenusShowOnlyCenteredSpinnerWhileLoading() {
        let cases = [
            ("live-menu-account", "live-account-loading", "세션과 티켓을 불러오는 중입니다."),
            ("live-menu-watchlist", "live-watchlist-loading", "계정에 저장된 관심공연을 불러오는 중입니다."),
            ("live-menu-help", "live-support-loading", "고객센터 정보를 불러오는 중입니다.")
        ]

        for (menuIdentifier, loadingIdentifier, legacyMessage) in cases {
            let app = liveApp(homeScenario: "routeLoading")
            app.launch()
            XCTAssertTrue(app.buttons["header-menu"].waitForExistence(timeout: 10))
            app.buttons["header-menu"].tap()
            XCTAssertTrue(app.buttons[menuIdentifier].waitForExistence(timeout: 10))
            app.buttons[menuIdentifier].tap()

            XCTAssertTrue(anyElement(app, identifier: loadingIdentifier).waitForExistence(timeout: 10))
            XCTAssertTrue(anyElement(app, identifier: "state-loading-progress").exists)
            XCTAssertFalse(app.staticTexts[legacyMessage].exists)
            recordScreenshot(named: "route-loading-\(menuIdentifier)", app: app)
        }
    }

    func testWatchlistPreferenceReconcilesCommittedServerStateAfterResponseLoss() {
        let app = liveApp(homeScenario: "watchlistCommittedResponseLost")
        app.launch()

        XCTAssertTrue(app.buttons["header-menu"].waitForExistence(timeout: 10))
        app.buttons["header-menu"].tap()
        XCTAssertTrue(app.buttons["live-menu-watchlist"].waitForExistence(timeout: 10))
        app.buttons["live-menu-watchlist"].tap()
        XCTAssertTrue(anyElement(app, identifier: "live-watchlist-items").waitForExistence(timeout: 20))

        let notification = app.buttons["live-watchlist-notification-live-neon"]
        XCTAssertEqual(notification.label, "오픈 알림 끄기")
        notification.tap()

        XCTAssertTrue(app.buttons["오픈 알림 켜기"].waitForExistence(timeout: 10))
        XCTAssertTrue(anyElement(app, identifier: "live-watchlist-mutation-error").waitForExistence(timeout: 10))

        app.buttons["live-watchlist-delete-live-neon"].tap()
        XCTAssertTrue(anyElement(app, identifier: "live-watchlist-empty").waitForExistence(timeout: 10))
    }

    func testWatchlistDetailReconcilesCommittedServerStateAfterResponseLoss() {
        let app = liveApp(homeScenario: "watchlistCTALost")
        app.launch()

        XCTAssertTrue(app.buttons["discovery-featured-cta"].waitForExistence(timeout: 10))
        app.buttons["discovery-featured-cta"].tap()
        let detailToggle = app.buttons["live-watchlist-cta-toggle"]
        XCTAssertTrue(detailToggle.waitForExistence(timeout: 20))
        XCTAssertEqual(detailToggle.label, "관심공연 추가")
        detailToggle.tap()

        XCTAssertTrue(app.buttons["관심공연 해제"].waitForExistence(timeout: 10))
        XCTAssertTrue(anyElement(app, identifier: "live-watchlist-cta-error").waitForExistence(timeout: 10))
    }

    func testWatchlistPublicProbeUnauthorizedPreservesNativeSession() {
        let app = liveApp(homeScenario: "watchlistProbeUnauthorized")
        app.launch()

        XCTAssertTrue(app.buttons["discovery-featured-cta"].waitForExistence(timeout: 10))
        app.buttons["discovery-featured-cta"].tap()
        XCTAssertTrue(anyElement(app, identifier: "live-watchlist-cta-retry").waitForExistence(timeout: 20))

        app.navigationBars.buttons.element(boundBy: 0).tap()
        app.buttons["header-menu"].tap()
        XCTAssertTrue(app.buttons["live-menu-watchlist"].waitForExistence(timeout: 10))
        app.buttons["live-menu-watchlist"].tap()
        XCTAssertTrue(anyElement(app, identifier: "live-watchlist-retry").waitForExistence(timeout: 20))
        XCTAssertFalse(anyElement(app, identifier: "live-watchlist-login-required").exists)
    }

    func testWatchlistDetailRetryReloadsServerState() {
        let app = liveApp(homeScenario: "watchlistRetry")
        app.launch()

        XCTAssertTrue(app.buttons["discovery-featured-cta"].waitForExistence(timeout: 10))
        app.buttons["discovery-featured-cta"].tap()
        XCTAssertTrue(anyElement(app, identifier: "live-watchlist-cta-retry").waitForExistence(timeout: 20))
        app.buttons["state-error-action"].tap()
        XCTAssertTrue(app.buttons["live-watchlist-cta-toggle"].waitForExistence(timeout: 20))
        XCTAssertFalse(anyElement(app, identifier: "live-watchlist-cta-retry").exists)
    }

    func testLiveHTTPSWatchlistQualification() throws {
        guard let apiBaseURL = ProcessInfo.processInfo.environment["TICKETGROUND_LIVE_QUALIFICATION_URL"],
              !apiBaseURL.isEmpty else {
            throw XCTSkip("TICKETGROUND_LIVE_QUALIFICATION_URL is required for live HTTPS qualification")
        }
        let app = UITestBootstrap.liveApp(apiBaseURL: apiBaseURL)
        app.launch()

        XCTAssertTrue(UITestBootstrap.waitForHome(app).exists)
        XCTAssertTrue(app.buttons["discovery-featured-cta"].waitForExistence(timeout: 20))
        app.buttons["discovery-featured-cta"].tap()
        XCTAssertTrue(anyElement(app, identifier: "live-watchlist-cta-login-required").waitForExistence(timeout: 20))

        let detailAttachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        detailAttachment.name = "issue-101-cloudflare-detail-login-gate"
        detailAttachment.lifetime = .keepAlways
        add(detailAttachment)

        app.navigationBars.buttons.element(boundBy: 0).tap()
        app.buttons["header-menu"].tap()
        XCTAssertTrue(app.buttons["live-menu-watchlist"].waitForExistence(timeout: 10))
        app.buttons["live-menu-watchlist"].tap()
        XCTAssertTrue(anyElement(app, identifier: "live-watchlist-login-required").waitForExistence(timeout: 20))

        let routeAttachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        routeAttachment.name = "issue-101-cloudflare-watchlist-login-gate"
        routeAttachment.lifetime = .keepAlways
        add(routeAttachment)
    }

    func testCreateLogoutDismissesSupportDetail() {
        let app = liveApp(homeScenario: "supportAuthenticated")
        app.launch()
        XCTAssertTrue(app.buttons["header-menu"].waitForExistence(timeout: 10))
        app.buttons["header-menu"].tap()
        XCTAssertTrue(app.staticTexts["live-menu-screen-title"].waitForExistence(timeout: 10))
        app.buttons["live-menu-help"].tap()

        let subject = app.textFields["live-support-subject"]
        XCTAssertTrue(subject.waitForExistence(timeout: 20))
        subject.tap()
        subject.typeText("새 문의")
        let message = app.textFields["live-support-message"]
        message.tap()
        message.typeText("세션 만료 확인")
        app.buttons["live-support-submit"].tap()

        let thread = anyElement(app, identifier: "live-support-thread-support-ui")
        XCTAssertTrue(thread.waitForExistence(timeout: 10))
        thread.tap()
        let detail = anyElement(app, identifier: "live-support-detail")
        XCTAssertTrue(detail.waitForExistence(timeout: 10))
        let dismissed = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "exists == false"),
            object: detail
        )
        XCTAssertEqual(XCTWaiter.wait(for: [dismissed], timeout: 10), .completed)
        XCTAssertTrue(anyElement(app, identifier: "live-support-login-required").waitForExistence(timeout: 10))
    }

    func testLiveMenuOpensCapabilityLedger() {
        let app = liveApp()
        app.launch()

        XCTAssertTrue(app.buttons["header-menu"].waitForExistence(timeout: 10))
        app.buttons["header-menu"].tap()
        XCTAssertTrue(app.buttons["live-menu-capability-ledger"].waitForExistence(timeout: 10))
        app.buttons["live-menu-capability-ledger"].tap()

        XCTAssertTrue(app.staticTexts["capability-ledger-title"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["공개 공연 및 좌석 조회"].exists)
        XCTAssertTrue(app.staticTexts["공개 미디어 원본"].exists)
        XCTAssertTrue(app.staticTexts["공개 탐색"].exists)
        XCTAssertTrue(app.staticTexts["거래 및 인증 기능"].exists)
        XCTAssertTrue(app.buttons["capability-ledger-home"].exists)
        XCTAssertTrue(app.buttons["capability-ledger-login"].exists)
    }

    func testLiveMenuCloseReturnsToTheDiscoveryHome() {
        let app = liveApp()
        app.launch()
        XCTAssertTrue(app.buttons["header-menu"].waitForExistence(timeout: 10))
        app.buttons["header-menu"].tap()
        XCTAssertTrue(app.staticTexts["live-menu-screen-title"].waitForExistence(timeout: 10))

        app.buttons["live-menu-close"].tap()
        XCTAssertTrue(app.buttons["header-search"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.staticTexts["live-menu-screen-title"].exists)
    }

    private func liveApp(
        capabilityState: String? = nil,
        homeScenario: String? = nil,
        supportScenario: String? = nil,
        accountScenario: String? = nil,
        watchlistScenario: String? = nil,
        bookingScenario: String? = nil,
        notificationScenario: String? = nil,
        mobileTicketScenario: String? = nil
    ) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-ui-testing", "-api-mode", "live"]
        if let capabilityState {
            app.launchArguments += ["-live-capability-state", capabilityState]
        }
        if let homeScenario {
            app.launchArguments += ["-live-home-scenario", homeScenario]
        }
        if let supportScenario {
            app.launchArguments += ["-live-support-scenario", supportScenario]
        }
        if let accountScenario {
            app.launchArguments += ["-live-account-scenario", accountScenario]
        }
        if let watchlistScenario {
            app.launchArguments += ["-live-watchlist-scenario", watchlistScenario]
        }
        if let bookingScenario {
            app.launchArguments += ["-live-booking-scenario", bookingScenario]
        }
        if let notificationScenario {
            app.launchArguments += ["-live-notification-scenario", notificationScenario]
        }
        if let mobileTicketScenario {
            app.launchArguments += ["-live-mobile-ticket-scenario", mobileTicketScenario]
        }
        return app
    }

    private func anyElement(_ app: XCUIApplication, identifier: String) -> XCUIElement {
        app.descendants(matching: .any)[identifier]
    }

    private func anyElementWithIdentifierPrefix(_ app: XCUIApplication, prefix: String) -> XCUIElement {
        app.descendants(matching: .any).matching(NSPredicate(format: "identifier BEGINSWITH %@", prefix)).firstMatch
    }

    private func attachScreenshot(_ app: XCUIApplication, name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    private func assertDiscoverable(_ element: XCUIElement, file: StaticString = #filePath, line: UInt = #line) {
        XCTAssertTrue(element.waitForExistence(timeout: 10), file: file, line: line)
    }

    private func assertWithinHomeBounds(_ app: XCUIApplication, file: StaticString = #filePath, line: UInt = #line) {
        let window = app.windows.firstMatch
        XCTAssertTrue(window.waitForExistence(timeout: 10), file: file, line: line)
        let identifiers = ["header-logo", "header-search", "discovery-hero-previous", "discovery-hero-next"]
        for identifier in identifiers {
            let element = app.descendants(matching: .any)[identifier]
            XCTAssertTrue(element.waitForExistence(timeout: 10), identifier, file: file, line: line)
            XCTAssertGreaterThanOrEqual(element.frame.minX, window.frame.minX + 4, identifier, file: file, line: line)
            XCTAssertLessThanOrEqual(element.frame.maxX, window.frame.maxX - 4, identifier, file: file, line: line)
        }
    }
}
