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
        XCTAssertTrue(app.buttons["header-watchlist"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["header-watchlist"].isHittable)
        app.buttons["header-watchlist"].tap()
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
    }

    func testProviderLoginCancellationDoesNotCreateASession() {
        let app = UITestBootstrap.fixtureApp(scenario: .happy)
        app.launch()
        app.buttons["header-watchlist"].tap()
        XCTAssertTrue(app.buttons["login-kakao"].waitForExistence(timeout: 10))
        app.buttons["login-kakao"].tap()
        let cancel = app.buttons.matching(identifier: "login-provider-cancel").element(boundBy: 1)
        XCTAssertTrue(cancel.waitForExistence(timeout: 10))
        cancel.tap()
        XCTAssertTrue(app.staticTexts["login-provider-external-state"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.staticTexts["login-success"].exists)
    }

    func testHeaderMenuNavigatesToFixtureMenu() {
        let app = UITestBootstrap.fixtureApp(scenario: .happy)
        app.launch()
        XCTAssertTrue(app.buttons["header-mypage"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["header-mypage"].isHittable)
        app.buttons["header-mypage"].tap()
        XCTAssertTrue(app.staticTexts["menu-screen-title"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["menu-login"].exists)
        XCTAssertTrue(app.buttons["menu-signup"].exists)
        XCTAssertFalse(app.switches["menu-theme-toggle"].exists)
        XCTAssertTrue(app.buttons["menu-category-concert"].exists)
        XCTAssertTrue(app.buttons["menu-category-musical"].exists)
        XCTAssertTrue(app.buttons["menu-calendar"].exists)
        XCTAssertTrue(app.buttons["menu-help"].exists)
        XCTAssertTrue(app.buttons["menu-inquiry"].exists)
        app.buttons["menu-login"].tap()
        XCTAssertTrue(app.staticTexts["login-screen-title"].waitForExistence(timeout: 10))
    }

    func testMenuOpensCapabilityLedgerWithoutClaimingUnavailableFunctionsAreLive() {
        let app = UITestBootstrap.fixtureApp(scenario: .happy)
        app.launch()

        XCTAssertTrue(app.buttons["header-mypage"].waitForExistence(timeout: 10))
        app.buttons["header-mypage"].tap()
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
        ranking.buttons["header-mypage"].tap()
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

    func testAdmittedLiveCatalogShowsReadOnlySeatMap() {
        let app = liveApp(homeScenario: "catalog")
        app.launch()
        XCTAssertTrue(app.buttons["discovery-featured-cta"].waitForExistence(timeout: 10))
        app.buttons["discovery-featured-cta"].tap()
        XCTAssertTrue(app.buttons["live-seat-map-link"].waitForExistence(timeout: 10))
        app.buttons["live-seat-map-link"].tap()
        XCTAssertTrue(anyElement(app, identifier: "live-seat-map").waitForExistence(timeout: 10))
        XCTAssertTrue(anyElement(app, identifier: "live-seat-performance-selector").waitForExistence(timeout: 10))
        XCTAssertFalse(app.staticTexts["좌석 구역 및 잔여 수량"].exists)
        app.buttons["live-seat-performance-live-neon-first"].tap()
        XCTAssertTrue(app.staticTexts["좌석 구역 및 잔여 수량"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["R석"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.buttons["live-seat-hold"].exists)
    }

    func testAdmittedLiveCatalogExposesVersionedDiscoveryRoutes() {
        let region = liveApp(homeScenario: "catalog")
        region.launch()
        XCTAssertTrue(region.buttons["header-mypage"].waitForExistence(timeout: 10))
        region.buttons["header-mypage"].tap()
        XCTAssertTrue(region.buttons["live-menu-region"].waitForExistence(timeout: 10))
        region.buttons["live-menu-region"].tap()
        XCTAssertTrue(anyElement(region, identifier: "live-discovery-region-seoul").waitForExistence(timeout: 10))
        XCTAssertTrue(region.staticTexts["Neon Stage"].exists)

        let calendar = liveApp(homeScenario: "catalog")
        calendar.launch()
        XCTAssertTrue(calendar.buttons["header-mypage"].waitForExistence(timeout: 10))
        calendar.buttons["header-mypage"].tap()
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
        XCTAssertTrue(empty.buttons["header-mypage"].waitForExistence(timeout: 10))
        empty.buttons["header-mypage"].tap()
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
        XCTAssertTrue(routeNotFound.buttons["header-mypage"].waitForExistence(timeout: 10))
        routeNotFound.buttons["header-mypage"].tap()
        XCTAssertTrue(routeNotFound.buttons["live-menu-region"].waitForExistence(timeout: 10))
        routeNotFound.buttons["live-menu-region"].tap()
        XCTAssertTrue(routeNotFound.staticTexts["공연 정보를 불러올 수 없습니다"].waitForExistence(timeout: 10))

        let failure = liveApp(homeScenario: "discoveryFailure")
        failure.launch()
        XCTAssertTrue(failure.buttons["header-mypage"].waitForExistence(timeout: 10))
        failure.buttons["header-mypage"].tap()
        XCTAssertTrue(failure.buttons["live-menu-region"].waitForExistence(timeout: 10))
        failure.buttons["live-menu-region"].tap()
        XCTAssertTrue(failure.staticTexts["공연 정보를 불러올 수 없습니다"].waitForExistence(timeout: 10))
    }

    func testLiveLoginDoesNotCreateFixtureUser() {
        let app = liveApp()
        app.launch()
        XCTAssertTrue(app.buttons["header-watchlist"].waitForExistence(timeout: 10))
        app.buttons["header-watchlist"].tap()
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
        XCTAssertTrue(app.buttons["header-watchlist"].waitForExistence(timeout: 10))
        app.buttons["header-watchlist"].tap()
        XCTAssertTrue(app.buttons["login-signup"].waitForExistence(timeout: 10))
        app.buttons["login-signup"].tap()

        XCTAssertTrue(anyElement(app, identifier: "live-unsupported-capability").waitForExistence(timeout: 10))
        XCTAssertFalse(app.staticTexts["이 화면은 다음 discovery 단계에서 콘텐츠를 연결합니다."].exists)
    }

    func testLiveAccountRouteExposesWatchlistAndSupportState() {
        let app = liveApp()
        app.launch()
        XCTAssertTrue(app.buttons["header-mypage"].waitForExistence(timeout: 10))
        app.buttons["header-mypage"].tap()
        XCTAssertTrue(app.staticTexts["live-menu-screen-title"].waitForExistence(timeout: 10))
        app.buttons["live-menu-account"].tap()
        XCTAssertTrue(anyElement(app, identifier: "live-account").waitForExistence(timeout: 20))
        XCTAssertTrue(app.buttons["live-mypage-watchlist"].exists)
        XCTAssertTrue(app.buttons["live-mypage-support"].exists)

        app.buttons["live-mypage-support"].tap()
        XCTAssertTrue(anyElement(app, identifier: "live-support").waitForExistence(timeout: 20))
        XCTAssertTrue(anyElement(app, identifier: "live-login-required").exists
                      || anyElementWithIdentifierPrefix(app, prefix: "live-support-thread-").exists
                      || anyElement(app, identifier: "live-support-empty").exists
                      || anyElement(app, identifier: "live-support-error").exists)

        let watchlistApp = liveApp()
        watchlistApp.launch()
        XCTAssertTrue(watchlistApp.buttons["header-mypage"].waitForExistence(timeout: 10))
        watchlistApp.buttons["header-mypage"].tap()
        XCTAssertTrue(watchlistApp.staticTexts["live-menu-screen-title"].waitForExistence(timeout: 10))
        watchlistApp.buttons["live-menu-account"].tap()
        XCTAssertTrue(watchlistApp.buttons["live-mypage-watchlist"].waitForExistence(timeout: 20))
        watchlistApp.buttons["live-mypage-watchlist"].tap()
        XCTAssertTrue(anyElement(watchlistApp, identifier: "live-watchlist").waitForExistence(timeout: 20))
        XCTAssertTrue(anyElement(watchlistApp, identifier: "live-login-required").exists || anyElement(watchlistApp, identifier: "live-watchlist-items").exists)
    }

    func testLiveAccountRoutesBlockHTTPBeforeProtectedRequests() {
        let accountApp = liveApp()
        accountApp.launch()
        XCTAssertTrue(accountApp.buttons["header-mypage"].waitForExistence(timeout: 10))
        accountApp.buttons["header-mypage"].tap()
        XCTAssertTrue(accountApp.staticTexts["live-menu-screen-title"].waitForExistence(timeout: 10))
        accountApp.buttons["live-menu-account"].tap()
        XCTAssertTrue(anyElement(accountApp, identifier: "live-account-https-required").waitForExistence(timeout: 10))
        XCTAssertFalse(anyElement(accountApp, identifier: "live-account-error").exists)

        let watchlistApp = liveApp()
        watchlistApp.launch()
        XCTAssertTrue(watchlistApp.buttons["header-mypage"].waitForExistence(timeout: 10))
        watchlistApp.buttons["header-mypage"].tap()
        XCTAssertTrue(watchlistApp.staticTexts["live-menu-screen-title"].waitForExistence(timeout: 10))
        watchlistApp.buttons["live-menu-watchlist"].tap()
        XCTAssertTrue(anyElement(watchlistApp, identifier: "live-watchlist-https-required").waitForExistence(timeout: 10))
        XCTAssertFalse(anyElement(watchlistApp, identifier: "live-watchlist-error").exists)

        let supportApp = liveApp()
        supportApp.launch()
        XCTAssertTrue(supportApp.buttons["header-mypage"].waitForExistence(timeout: 10))
        supportApp.buttons["header-mypage"].tap()
        XCTAssertTrue(supportApp.staticTexts["live-menu-screen-title"].waitForExistence(timeout: 10))
        supportApp.buttons["live-menu-help"].tap()
        XCTAssertTrue(anyElement(supportApp, identifier: "live-support-https-required").waitForExistence(timeout: 10))
        XCTAssertFalse(anyElement(supportApp, identifier: "live-support-error").exists)
    }

    func testLiveAccountCapabilityRendersLoginRequiredSurface() {
        let app = liveApp(capabilityState: "login-required")
        app.launch()
        XCTAssertTrue(app.buttons["header-mypage"].waitForExistence(timeout: 10))
        app.buttons["header-mypage"].tap()
        XCTAssertTrue(app.staticTexts["live-menu-screen-title"].waitForExistence(timeout: 10))
        app.buttons["live-menu-account"].tap()
        XCTAssertTrue(anyElement(app, identifier: "live-account-login-required").waitForExistence(timeout: 10))
        XCTAssertFalse(anyElement(app, identifier: "live-account-error").exists)
    }

    func testLiveAccountCapabilityRendersHTTPSRequiredSurface() {
        let app = liveApp(capabilityState: "https-required")
        app.launch()
        XCTAssertTrue(app.buttons["header-mypage"].waitForExistence(timeout: 10))
        app.buttons["header-mypage"].tap()
        XCTAssertTrue(app.staticTexts["live-menu-screen-title"].waitForExistence(timeout: 10))
        app.buttons["live-menu-account"].tap()
        XCTAssertTrue(anyElement(app, identifier: "live-account-https-required").waitForExistence(timeout: 10))
        XCTAssertFalse(anyElement(app, identifier: "live-account-error").exists)
    }

    func testLiveAccountCapabilityRendersUnsupportedSurface() {
        let app = liveApp(capabilityState: "unsupported")
        app.launch()
        XCTAssertTrue(app.buttons["header-mypage"].waitForExistence(timeout: 10))
        app.buttons["header-mypage"].tap()
        XCTAssertTrue(app.staticTexts["live-menu-screen-title"].waitForExistence(timeout: 10))
        app.buttons["live-menu-account"].tap()
        XCTAssertTrue(anyElement(app, identifier: "live-account-unsupported").waitForExistence(timeout: 10))
        XCTAssertFalse(anyElement(app, identifier: "live-account-error").exists)
    }

    func testLiveAccountCapabilityRendersRetrySurface() {
        let app = liveApp(capabilityState: "retry")
        app.launch()
        XCTAssertTrue(app.buttons["header-mypage"].waitForExistence(timeout: 10))
        app.buttons["header-mypage"].tap()
        XCTAssertTrue(app.staticTexts["live-menu-screen-title"].waitForExistence(timeout: 10))
        app.buttons["live-menu-account"].tap()
        XCTAssertTrue(anyElement(app, identifier: "live-account-retry").waitForExistence(timeout: 10))
        XCTAssertFalse(anyElement(app, identifier: "live-account-error").exists)
    }

    func testLiveAccountCapabilityRendersHelpSurface() {
        let app = liveApp(capabilityState: "help")
        app.launch()
        XCTAssertTrue(app.buttons["header-mypage"].waitForExistence(timeout: 10))
        app.buttons["header-mypage"].tap()
        XCTAssertTrue(app.staticTexts["live-menu-screen-title"].waitForExistence(timeout: 10))
        app.buttons["live-menu-account"].tap()
        XCTAssertTrue(anyElement(app, identifier: "live-account-help").waitForExistence(timeout: 10))
        XCTAssertFalse(anyElement(app, identifier: "live-account-error").exists)
    }

    func testLiveHamburgerMenuProvidesWebLikeLinksAndLiveAccountEntry() {
        let app = liveApp()
        app.launch()
        XCTAssertTrue(app.buttons["header-mypage"].waitForExistence(timeout: 10))
        app.buttons["header-mypage"].tap()

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
            "live-menu-category-concert",
            "live-menu-category-musical"
        ] {
            XCTAssertTrue(app.buttons[identifier].exists, identifier)
        }
        XCTAssertFalse(app.staticTexts["fixture-state-happy"].exists)
        XCTAssertFalse(app.staticTexts["fixture"].exists)

        app.buttons["live-menu-account"].tap()
        XCTAssertTrue(anyElement(app, identifier: "live-account").waitForExistence(timeout: 20))

        let supportApp = liveApp()
        supportApp.launch()
        XCTAssertTrue(supportApp.buttons["header-mypage"].waitForExistence(timeout: 10))
        supportApp.buttons["header-mypage"].tap()
        XCTAssertTrue(supportApp.staticTexts["live-menu-screen-title"].waitForExistence(timeout: 10))
        supportApp.buttons["live-menu-help"].tap()
        XCTAssertTrue(anyElement(supportApp, identifier: "live-support").waitForExistence(timeout: 20))
    }

    func testLiveMenuOpensCapabilityLedger() {
        let app = liveApp()
        app.launch()

        XCTAssertTrue(app.buttons["header-mypage"].waitForExistence(timeout: 10))
        app.buttons["header-mypage"].tap()
        XCTAssertTrue(app.buttons["live-menu-capability-ledger"].waitForExistence(timeout: 10))
        app.buttons["live-menu-capability-ledger"].tap()

        XCTAssertTrue(app.staticTexts["capability-ledger-title"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["공개 공연 및 좌석 조회"].exists)
        XCTAssertTrue(app.staticTexts["공개 미디어 원본"].exists)
        XCTAssertTrue(app.staticTexts["계약이 없는 탐색 메뉴"].exists)
        XCTAssertTrue(app.staticTexts["거래 및 인증 기능"].exists)
        XCTAssertTrue(app.buttons["capability-ledger-home"].exists)
        XCTAssertTrue(app.buttons["capability-ledger-login"].exists)
    }

    func testLiveMenuCloseReturnsToTheDiscoveryHome() {
        let app = liveApp()
        app.launch()
        XCTAssertTrue(app.buttons["header-mypage"].waitForExistence(timeout: 10))
        app.buttons["header-mypage"].tap()
        XCTAssertTrue(app.staticTexts["live-menu-screen-title"].waitForExistence(timeout: 10))

        app.buttons["live-menu-close"].tap()
        XCTAssertTrue(app.buttons["header-search"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.staticTexts["live-menu-screen-title"].exists)
    }

    private func liveApp(capabilityState: String? = nil, homeScenario: String? = nil) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-ui-testing", "-api-mode", "live"]
        if let capabilityState {
            app.launchArguments += ["-live-capability-state", capabilityState]
        }
        if let homeScenario {
            app.launchArguments += ["-live-home-scenario", homeScenario]
        }
        return app
    }

    private func anyElement(_ app: XCUIApplication, identifier: String) -> XCUIElement {
        app.descendants(matching: .any)[identifier]
    }

    private func anyElementWithIdentifierPrefix(_ app: XCUIApplication, prefix: String) -> XCUIElement {
        app.descendants(matching: .any).matching(NSPredicate(format: "identifier BEGINSWITH %@", prefix)).firstMatch
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
