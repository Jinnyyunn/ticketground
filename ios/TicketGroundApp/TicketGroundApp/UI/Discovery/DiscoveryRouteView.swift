import SwiftUI

struct DiscoveryRouteView: View {
    @Environment(AppContainer.self) private var container
    let route: AppRoute
    let content: DiscoveryContent?

    var body: some View {
        if container.environment.mode == .live {
            LiveDiscoveryRouteView(route: route)
        } else {
            fixtureBody
        }
    }

    @ViewBuilder
    private var fixtureBody: some View {
        switch route {
        case .search:
            DiscoverySearchView(content: content)
        case .login:
            DiscoveryLoginView()
        case .menu, .mypage:
            DiscoveryMenuView()
        case .capabilityLedger:
            CapabilityLedgerView()
        case .open:
            if let content {
                DiscoveryOpenCalendarView(content: content)
            } else {
                TicketgroundLoadingSurface(title: "오픈 캘린더를 불러오는 중")
            }
        default:
            VStack(alignment: .leading, spacing: TicketgroundSpacing.lg) {
                Text("이동한 화면")
                    .font(.caption.weight(.black))
                    .foregroundStyle(TicketgroundColor.accent)
                Text(route.id)
                    .font(.title.weight(.black))
                    .foregroundStyle(TicketgroundColor.ink)
                    .accessibilityIdentifier("route-\(route.id)")
                Text("이 화면은 다음 discovery 단계에서 콘텐츠를 연결합니다.")
                    .font(.body)
                    .foregroundStyle(TicketgroundColor.inkMuted)
            }
            .padding(TicketgroundSpacing.xl)
            .navigationTitle(route.id)
        }
    }
}

struct DiscoverySearchView: View {
    let content: DiscoveryContent?
    @State private var query = ""

    private var results: [DiscoverySearchResult] {
        guard let content else { return [] }
        let all = [
            DiscoverySearchResult(title: content.featured.title, subtitle: content.featured.venue, route: content.featured.route)
        ] + content.rankings.map {
            DiscoverySearchResult(title: $0.title, subtitle: "\($0.genre) · \($0.venue)", route: $0.route)
        }
        let normalized = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !normalized.isEmpty else { return all }
        return all.filter {
            $0.title.lowercased().contains(normalized) || $0.subtitle.lowercased().contains(normalized)
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: TicketgroundSpacing.lg) {
                Text("공연 검색")
                    .font(.caption.weight(.black))
                    .foregroundStyle(TicketgroundColor.accent)
                    .accessibilityIdentifier("search-screen-title")
                TextField("공연명, 아티스트, 공연장 검색", text: $query)
                    .textFieldStyle(.roundedBorder)
                    .accessibilityIdentifier("search-input")
                    .accessibilityLabel("검색어")
                if results.isEmpty {
                    TicketgroundEmptySurface(
                        title: "검색 결과가 없습니다",
                        message: "다른 공연명이나 공연장을 검색해 보세요.",
                        actionTitle: nil,
                        action: nil
                    )
                    .accessibilityIdentifier("search-empty")
                } else {
                    VStack(alignment: .leading, spacing: TicketgroundSpacing.sm) {
                        Text(query.isEmpty ? "추천 공연" : "검색 결과")
                            .font(.title2.weight(.black))
                        ForEach(results) { result in
                            NavigationLink(value: result.route) {
                                VStack(alignment: .leading, spacing: TicketgroundSpacing.xs) {
                                    Text(result.title).font(.headline)
                                    Text(result.subtitle)
                                        .font(.subheadline)
                                        .foregroundStyle(TicketgroundColor.inkMuted)
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(TicketgroundSpacing.md)
                                .background(TicketgroundColor.surfaceMuted)
                                .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.medium))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
            .padding(TicketgroundSpacing.xl)
        }
        .navigationTitle("검색")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct DiscoverySearchResult: Identifiable {
    let title: String
    let subtitle: String
    let route: AppRoute
    var id: String { route.id }
}

struct DiscoveryLoginView: View {
    @State private var selectedProvider: Provider?
    @State private var providerMessage: String?

    private struct Provider: Identifiable {
        let id: String
        let name: String
        let label: String
    }

    private let providers = [
        Provider(id: "google", name: "Google", label: "Google로 계속하기"),
        Provider(id: "kakao", name: "카카오톡", label: "카카오톡으로 계속하기"),
        Provider(id: "naver", name: "네이버", label: "네이버로 계속하기")
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: TicketgroundSpacing.xl) {
                VStack(alignment: .leading, spacing: TicketgroundSpacing.sm) {
                    Text("로그인")
                        .font(.caption.weight(.black))
                        .foregroundStyle(TicketgroundColor.accent)
                        .accessibilityIdentifier("login-screen-title")
                    Text("간편 로그인으로 계정을 시작해 주세요")
                        .font(.title.weight(.black))
                        .foregroundStyle(TicketgroundColor.ink)
                    Text("외부 인증 연결 상태를 확인한 뒤에만 로그인을 진행합니다.")
                        .font(.subheadline)
                        .foregroundStyle(TicketgroundColor.inkMuted)
                        .lineSpacing(3)
                }

                VStack(spacing: TicketgroundSpacing.sm) {
                    ForEach(providers, id: \.id) { provider in
                        Button {
                            selectedProvider = provider
                        } label: {
                            HStack(spacing: TicketgroundSpacing.md) {
                                providerMark(provider.id)
                                Text(provider.label)
                                    .font(.subheadline.weight(.bold))
                                Spacer(minLength: TicketgroundSpacing.sm)
                                Image(systemName: "arrow.up.right")
                                    .font(.caption.weight(.bold))
                            }
                            .foregroundStyle(providerForeground(provider.id))
                            .frame(maxWidth: .infinity, minHeight: 52, alignment: .leading)
                            .padding(.horizontal, TicketgroundSpacing.lg)
                            .background(providerBackground(provider.id))
                            .overlay {
                                RoundedRectangle(cornerRadius: TicketgroundRadius.medium)
                                    .stroke(providerBorder(provider.id), lineWidth: provider.id == "google" ? 1.25 : 1)
                            }
                            .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.medium))
                            .shadow(
                                color: provider.id == "google" ? Color.black.opacity(0.08) : .clear,
                                radius: provider.id == "google" ? 1.5 : 0,
                                y: provider.id == "google" ? 1 : 0
                            )
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("login-\(provider.id)")
                        .accessibilityLabel(provider.label)
                    }
                }

                if let providerMessage {
                    HStack(alignment: .top, spacing: TicketgroundSpacing.sm) {
                        Image(systemName: "info.circle.fill")
                        Text(providerMessage)
                            .font(.subheadline)
                            .foregroundStyle(TicketgroundColor.ink)
                            .fixedSize(horizontal: false, vertical: true)
                        Spacer(minLength: 0)
                    }
                    .padding(TicketgroundSpacing.md)
                    .background(TicketgroundColor.surfaceMuted)
                    .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.medium))
                    .accessibilityIdentifier("login-provider-external-state")
                }

                NavigationLink(value: AppRoute.signup) {
                    HStack {
                        Text("아직 계정이 없나요?")
                            .foregroundStyle(TicketgroundColor.inkMuted)
                        Text("회원가입")
                            .fontWeight(.bold)
                            .foregroundStyle(TicketgroundColor.ink)
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.caption.weight(.bold))
                    }
                    .font(.subheadline)
                    .frame(maxWidth: .infinity, minHeight: 48, alignment: .leading)
                }
                .buttonStyle(.plain)
                .padding(.horizontal, TicketgroundSpacing.sm)
                .accessibilityIdentifier("login-signup")
            }
            .padding(.horizontal, TicketgroundSpacing.xl)
            .padding(.vertical, TicketgroundSpacing.lg)
        }
        .navigationTitle("로그인")
        .navigationBarTitleDisplayMode(.inline)
        .confirmationDialog(
            "\(selectedProvider?.name ?? "")로 계속하기",
            isPresented: Binding(
                get: { selectedProvider != nil },
                set: { if !$0 { selectedProvider = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("외부 OAuth 인증 연결 필요") {
                guard let provider = selectedProvider else { return }
                providerMessage = externalOAuthMessage(for: provider)
                selectedProvider = nil
            }
            .accessibilityIdentifier("login-provider-external-gate")
            Button("인증 요청 취소") {
                guard let provider = selectedProvider else { return }
                providerMessage = "\(provider.name) 로그인 요청을 취소했습니다. 로그인 상태는 변경되지 않았습니다."
                selectedProvider = nil
            }
            .accessibilityIdentifier("login-provider-cancel")
        } message: {
            Text("외부 인증 앱 또는 브라우저로 전환해야 합니다. 이 앱은 인증 정보를 수집하거나 계정을 만들지 않습니다.")
        }
    }

    @ViewBuilder
    private func providerMark(_ id: String) -> some View {
        switch id {
        case "google":
            Image("GoogleG")
                .resizable()
                .scaledToFit()
                .frame(width: 24, height: 24)
                .accessibilityHidden(true)
        case "kakao":
            Image(systemName: "message.fill")
                .font(.subheadline.weight(.bold))
                .foregroundStyle(Color(red: 45 / 255, green: 27 / 255, blue: 27 / 255))
                .frame(width: 28, height: 28)
                .background(Color(red: 255 / 255, green: 222 / 255, blue: 50 / 255))
                .clipShape(Circle())
        default:
            Text("N")
                .font(.subheadline.weight(.black))
                .foregroundStyle(TicketgroundColor.surface)
                .frame(width: 28, height: 28)
                .background(Color(red: 3 / 255, green: 199 / 255, blue: 90 / 255))
                .clipShape(RoundedRectangle(cornerRadius: 7))
        }
    }

    private func providerBackground(_ id: String) -> Color {
        switch id {
        case "kakao": return Color(red: 255 / 255, green: 222 / 255, blue: 50 / 255)
        case "naver": return Color(red: 3 / 255, green: 199 / 255, blue: 90 / 255)
        default: return TicketgroundColor.surface
        }
    }

    private func providerForeground(_ id: String) -> Color {
        id == "kakao" ? Color(red: 45 / 255, green: 27 / 255, blue: 27 / 255) : (id == "naver" ? TicketgroundColor.surface : TicketgroundColor.ink)
    }

    private func providerBorder(_ id: String) -> Color {
        switch id {
        case "kakao": return Color(red: 232 / 255, green: 200 / 255, blue: 35 / 255)
        case "naver": return Color(red: 3 / 255, green: 174 / 255, blue: 78 / 255)
        default: return Color(red: 184 / 255, green: 184 / 255, blue: 188 / 255)
        }
    }

    private func externalOAuthMessage(for provider: Provider) -> String {
        "\(provider.name) 로그인은 HTTPS API와 외부 OAuth 인증 단계(E3) 연결이 모두 필요합니다. 현재 앱은 인증 정보를 수집하거나 계정을 만들지 않습니다."
    }
}

struct DiscoveryMenuView: View {
    @Environment(AppContainer.self) private var container

    private struct MenuItem: Identifiable {
        let id: String
        let title: String
        let icon: String
        let route: AppRoute
    }

    private let categories = [
        MenuItem(id: "menu-category-concert", title: "콘서트", icon: "music.mic", route: .genre(name: "concert")),
        MenuItem(id: "menu-category-musical", title: "뮤지컬", icon: "theatermasks", route: .genre(name: "musical")),
        MenuItem(id: "menu-category-theater", title: "연극", icon: "person.2", route: .genre(name: "theater")),
        MenuItem(id: "menu-category-classic", title: "클래식", icon: "pianokeys", route: .genre(name: "classic")),
        MenuItem(id: "menu-category-exhibition", title: "전시", icon: "photo", route: .genre(name: "exhibition")),
        MenuItem(id: "menu-category-children", title: "아동", icon: "figure.2.and.child.holdinghands", route: .genre(name: "children")),
        MenuItem(id: "menu-category-sports", title: "스포츠", icon: "sportscourt", route: .genre(name: "sports"))
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: TicketgroundSpacing.lg) {
                HStack(alignment: .center, spacing: TicketgroundSpacing.md) {
                    Button {
                        if !container.navigationPath.isEmpty {
                            container.navigationPath.removeLast()
                        }
                    } label: {
                        Image(systemName: "xmark")
                            .font(.subheadline.weight(.bold))
                            .frame(width: 40, height: 40)
                            .background(TicketgroundColor.surface)
                            .overlay { Circle().stroke(TicketgroundColor.lineStrong, lineWidth: 1) }
                            .clipShape(Circle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("menu-close")
                    .accessibilityLabel("전체 메뉴 닫기")

                    VStack(alignment: .leading, spacing: TicketgroundSpacing.xs) {
                        Text("전체 메뉴")
                            .font(.title2.weight(.black))
                            .foregroundStyle(TicketgroundColor.ink)
                            .accessibilityIdentifier("menu-screen-title")
                        Text("Ticketground의 모든 서비스를 확인하세요")
                            .font(.caption)
                            .foregroundStyle(TicketgroundColor.inkMuted)
                    }
                    Spacer(minLength: 0)
                }

                if let session = container.environment.sessionStore.current {
                    TicketgroundSurface {
                        HStack(spacing: TicketgroundSpacing.md) {
                            Image(systemName: "person.crop.circle.fill")
                                .font(.title2)
                                .foregroundStyle(TicketgroundColor.accent)
                            VStack(alignment: .leading, spacing: TicketgroundSpacing.xs) {
                                Text("로그인된 계정")
                                    .font(.caption.weight(.bold))
                                    .foregroundStyle(TicketgroundColor.inkMuted)
                                Text(session.userID.replacingOccurrences(of: "fixture-", with: "") + " fixture")
                                    .font(.headline.weight(.bold))
                                    .foregroundStyle(TicketgroundColor.ink)
                            }
                            Spacer(minLength: TicketgroundSpacing.sm)
                            Button("로그아웃") {
                                container.environment.sessionStore.logout()
                            }
                            .font(.caption.weight(.bold))
                            .foregroundStyle(TicketgroundColor.ink)
                            .padding(.horizontal, TicketgroundSpacing.sm)
                            .padding(.vertical, TicketgroundSpacing.xs)
                            .overlay { Capsule().stroke(TicketgroundColor.lineStrong, lineWidth: 1) }
                            .accessibilityIdentifier("menu-logout")
                        }
                    }
                }

                menuSection(title: "계정", detail: "로그인과 관심공연을 관리하세요") {
                    menuLink(title: "로그인", icon: "person", route: .login, identifier: "menu-login")
                    menuLink(title: "회원가입", icon: "person.badge.plus", route: .signup, identifier: "menu-signup")
                    menuLink(title: "관심공연", icon: "heart", route: .watchlist, identifier: "menu-watchlist")
                }

                menuSection(title: "카테고리", detail: "관심 있는 공연을 찾아보세요") {
                    menuButton(title: "홈", icon: "house", identifier: "menu-home") {
                        container.navigationPath.removeAll()
                    }
                    ForEach(categories) { category in
                        menuLink(title: category.title, icon: category.icon, route: category.route, identifier: category.id)
                    }
                }

                menuSection(title: "티켓 서비스", detail: "예매와 양도 일정을 한눈에") {
                    menuLink(title: "티켓 양도", icon: "arrow.left.arrow.right", route: .resale, identifier: "menu-resale")
                    menuLink(title: "티켓오픈 캘린더", icon: "calendar", route: .open, identifier: "menu-calendar")
                }

                menuSection(title: "고객센터", detail: "도움이 필요할 때 이용하세요") {
                    menuLink(title: "고객센터", icon: "questionmark.circle", route: .help, identifier: "menu-help")
                    menuLink(title: "1:1 문의", icon: "bubble.left", route: .inquiry, identifier: "menu-inquiry")
                    menuLink(title: "공지사항", icon: "megaphone", route: .open, identifier: "menu-notice")
                }

                menuSection(title: "서비스 안내", detail: "현재 연결 상태를 확인하세요") {
                    menuLink(title: "서비스 연결 현황", icon: "checklist", route: .capabilityLedger, identifier: "menu-capability-ledger")
                }

                Text("웹 서비스와 동일한 메뉴 구조 · fixture 모드")
                    .font(.caption)
                    .foregroundStyle(TicketgroundColor.inkMuted)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, TicketgroundSpacing.sm)
            }
            .padding(.horizontal, TicketgroundSpacing.lg)
            .padding(.vertical, TicketgroundSpacing.md)
        }
        .background(TicketgroundColor.surfaceMuted)
        .scrollIndicators(.hidden)
        .navigationTitle("전체 메뉴")
        .navigationBarTitleDisplayMode(.inline)
    }

    @ViewBuilder
    private func menuSection<Content: View>(title: String, detail: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: TicketgroundSpacing.sm) {
            VStack(alignment: .leading, spacing: TicketgroundSpacing.xs) {
                Text(title)
                    .font(.headline.weight(.black))
                    .foregroundStyle(TicketgroundColor.ink)
                Text(detail)
                    .font(.caption)
                    .foregroundStyle(TicketgroundColor.inkMuted)
            }
            VStack(spacing: 0) {
                content()
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(TicketgroundSpacing.lg)
        .background(TicketgroundColor.surface)
        .overlay {
            RoundedRectangle(cornerRadius: TicketgroundRadius.medium)
                .stroke(TicketgroundColor.line, lineWidth: 1)
        }
        .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.medium))
    }

    private func menuLink(title: String, icon: String, route: AppRoute, identifier: String) -> some View {
        NavigationLink(value: route) {
            menuRow(title: title, icon: icon)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(identifier)
    }

    private func menuButton(title: String, icon: String, identifier: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            menuRow(title: title, icon: icon)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(identifier)
    }

    private func menuRow(title: String, icon: String) -> some View {
        HStack(spacing: TicketgroundSpacing.md) {
            Image(systemName: icon)
                .font(.subheadline.weight(.bold))
                .foregroundStyle(title == "홈" ? TicketgroundColor.accent : TicketgroundColor.inkSecondary)
                .frame(width: 24)
            Text(title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(TicketgroundColor.ink)
            Spacer(minLength: TicketgroundSpacing.sm)
            Image(systemName: "chevron.right")
                .font(.caption.weight(.bold))
                .foregroundStyle(TicketgroundColor.inkMuted)
        }
        .frame(maxWidth: .infinity, minHeight: 50, alignment: .leading)
        .contentShape(Rectangle())
    }
}

struct DiscoveryOpenCalendarView: View {
    let content: DiscoveryContent

    private let weekdays = ["월", "화", "수", "목", "금", "토", "일"]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: TicketgroundSpacing.xl) {
                VStack(alignment: .leading, spacing: TicketgroundSpacing.sm) {
                    Text("티켓오픈 캘린더")
                        .font(.caption.weight(.black))
                        .foregroundStyle(TicketgroundColor.accent)
                    Text("2026년 7월 월별 캘린더")
                        .font(.title.weight(.black))
                        .foregroundStyle(TicketgroundColor.ink)
                    Text("장르 색상과 오픈 임박 리스트로 공식 예매 시간을 확인합니다.")
                        .font(.body)
                        .foregroundStyle(TicketgroundColor.inkMuted)
                    NavigationLink(value: AppRoute.watchlist) {
                        Label("관심공연 알림", systemImage: "bell")
                            .font(.headline)
                            .frame(maxWidth: .infinity, minHeight: 44)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(TicketgroundColor.accent)
                    .accessibilityIdentifier("discovery-calendar-alert")
                }

                if content.calendar.isEmpty {
                    DiscoveryEmptyCalendarView(action: {})
                } else {
                    DiscoveryCalendarGrid(calendar: content.calendar, weekdays: weekdays)
                }

                VStack(alignment: .leading, spacing: TicketgroundSpacing.md) {
                    Text("오픈 임박")
                        .font(.title2.weight(.black))
                        .foregroundStyle(TicketgroundColor.ink)
                    ForEach(content.openingSoon, id: \.title) { item in
                        NavigationLink(value: item.alertRoute) {
                            HStack(alignment: .top, spacing: TicketgroundSpacing.md) {
                                Text(item.dday)
                                    .font(.headline.weight(.black))
                                    .foregroundStyle(TicketgroundColor.accent)
                                VStack(alignment: .leading, spacing: TicketgroundSpacing.xs) {
                                    Text(item.title)
                                        .font(.headline.weight(.black))
                                        .foregroundStyle(TicketgroundColor.ink)
                                        .multilineTextAlignment(.leading)
                                    Text("\(item.genre) · \(item.round) · \(item.time)")
                                        .font(.subheadline)
                                        .foregroundStyle(TicketgroundColor.inkMuted)
                                }
                                Spacer(minLength: 0)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(TicketgroundSpacing.md)
                            .background(TicketgroundColor.surfaceMuted)
                            .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.medium))
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("calendar-alert-\(item.day)")
                    }
                }
            }
            .padding(TicketgroundSpacing.xl)
        }
        .navigationTitle("오픈 캘린더")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct DiscoveryCalendarGrid: View {
    let calendar: [DiscoveryCalendar]
    let weekdays: [String]

    var body: some View {
        let entriesByDay = Dictionary(grouping: calendar, by: \.day)
        let leadingEmptyDays = DiscoveryCalendarLayout.leadingEmptyDays(year: 2026, month: 7)
        VStack(alignment: .leading, spacing: TicketgroundSpacing.md) {
            Text("월별 캘린더")
                .font(.title2.weight(.black))
                .foregroundStyle(TicketgroundColor.ink)
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 1), count: 7), spacing: 1) {
                ForEach(weekdays, id: \.self) { weekday in
                    Text(weekday)
                        .font(.caption.weight(.black))
                        .foregroundStyle(TicketgroundColor.inkMuted)
                        .frame(maxWidth: .infinity, minHeight: 32)
                        .background(TicketgroundColor.surfaceMuted)
                }
                ForEach(0..<leadingEmptyDays, id: \.self) { _ in
                    Color.clear
                        .frame(minHeight: 84)
                        .accessibilityHidden(true)
                }
                ForEach(1...31, id: \.self) { day in
                    VStack(alignment: .leading, spacing: TicketgroundSpacing.xs) {
                        Text("\(day)")
                            .font(.caption.weight(.black))
                            .foregroundStyle(TicketgroundColor.ink)
                        ForEach(entriesByDay[day] ?? [], id: \.title) { entry in
                            NavigationLink(value: entry.route) {
                                Text(entry.title)
                                    .font(.caption2.weight(.bold))
                                    .foregroundStyle(TicketgroundColor.surface)
                                    .lineLimit(2)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .padding(2)
                                    .background(TicketgroundColor.accent)
                                    .clipShape(RoundedRectangle(cornerRadius: 4))
                            }
                            .buttonStyle(.plain)
                        }
                        Spacer(minLength: 0)
                    }
                    .frame(maxWidth: .infinity, minHeight: 84, alignment: .topLeading)
                    .padding(TicketgroundSpacing.xs)
                    .background(TicketgroundColor.surface)
                    .overlay {
                        Rectangle()
                            .stroke(TicketgroundColor.line, lineWidth: 0.5)
                    }
                }
            }
            .accessibilityIdentifier("discovery-calendar-grid")
        }
    }
}

enum DiscoveryCalendarLayout {
    static func leadingEmptyDays(year: Int, month: Int) -> Int {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0) ?? .current
        guard let firstDay = calendar.date(from: DateComponents(year: year, month: month, day: 1)) else {
            return 0
        }
        return (calendar.component(.weekday, from: firstDay) + 5) % 7
    }
}

private enum LiveCatalogRouteState {
    case loading
    case loaded(LiveCatalog)
    case unavailable
    case failed(PublicReadPresentation)
}

enum LiveCatalogRouteMatcher {
    static func detailEvents(slug: String, in catalog: LiveCatalog) -> [LiveBackendCatalogEvent] {
        catalog.events.filter { event in
            event.id == slug || event.slug == slug || normalizedSlug(event.title) == normalizedSlug(slug)
        }
    }

    static func placeEvents(slug: String?, in catalog: LiveCatalog) -> [LiveBackendCatalogEvent] {
        guard let slug, !slug.isEmpty else { return catalog.events }
        let normalizedRoute = normalizedSlug(slug)
        return catalog.events.filter { event in
            [event.venueID, event.venue]
                .compactMap { $0 }
                .contains { normalizedSlug($0).contains(normalizedRoute) }
        }
    }

    static func matchesSearch(
        query: String,
        event: LiveBackendCatalogEvent,
        categoryLabel: String? = nil
    ) -> Bool {
        let normalizedQuery = normalizedSlug(query)
        guard !normalizedQuery.isEmpty else { return true }
        let values = [
            event.title,
            event.venue,
            event.category,
            categoryLabel,
            event.artistSlug
        ].compactMap { $0 } + (event.casts ?? [])
        return values.contains { normalizedSlug($0).contains(normalizedQuery) }
    }

    static func hasPriceGrade(_ grade: String, event: LiveBackendCatalogEvent) -> Bool {
        let normalizedGrade = normalizedSlug(grade)
        return (event.prices ?? []).contains { price in
            [price.grade, price.seat]
                .compactMap { $0 }
                .contains { normalizedSlug($0).contains(normalizedGrade) }
        }
    }

    private static func normalizedSlug(_ value: String) -> String {
        value.lowercased().filter { $0.isLetter || $0.isNumber }
    }
}

private struct LiveDiscoveryRouteView: View {
    let route: AppRoute
    @Environment(AppContainer.self) private var container
    @State private var state: LiveCatalogRouteState = .loading
    @State private var searchQuery = ""
    @State private var submittedSearchQuery = ""
    @State private var reloadID = 0

    var body: some View {
        switch route {
        case .login:
            DiscoveryLoginView()
        case .menu:
            LiveMenuRouteView()
        case .mypage:
            LiveAccountRouteView()
        case .capabilityLedger:
            CapabilityLedgerView()
        case .search, .ranking, .genre, .place, .event, .goods:
            catalogBody
        case .queue, .booking:
            LiveSeatMapRouteView(route: route)
        case .watchlist:
            LiveWatchlistRouteView()
        case .help, .inquiry:
            LiveSupportRouteView(route: route)
        case .region, .open:
            LiveUnsupportedRouteView(route: route)
        case .signup, .resale, .transfer, .cancel, .checkout, .reservation, .artist:
            LiveUnsupportedRouteView(route: route)
        default:
            LiveUnsupportedRouteView(route: route)
        }
    }

    @ViewBuilder
    private var catalogBody: some View {
        Group {
            switch state {
            case .loading:
                TicketgroundLoadingSurface(title: "\(routeTitle) 불러오는 중")
                    .accessibilityIdentifier("live-route-state")
            case .loaded(let catalog):
                catalogView(catalog)
            case .unavailable:
                LiveCatalogUnavailableRouteView(route: route, retryCatalog: retry)
            case .failed(let presentation):
                TicketgroundErrorSurface(
                    title: presentation.title,
                    message: presentation.message,
                    actionTitle: "다시 시도",
                    action: retry
                )
                .accessibilityIdentifier("live-route-state")
            }
        }
        .navigationTitle(routeTitle)
        .navigationBarTitleDisplayMode(.inline)
        .task(id: reloadID) {
            await loadCatalog()
        }
    }

    @ViewBuilder
    private func catalogView(_ catalog: LiveCatalog) -> some View {
        let events = events(for: route, in: catalog, searchQuery: submittedSearchQuery)
        ScrollView {
            VStack(alignment: .leading, spacing: TicketgroundSpacing.lg) {
                Text(routeTitle)
                    .font(.caption.weight(.black))
                    .foregroundStyle(TicketgroundColor.accent)
                    .accessibilityIdentifier("live-route-state")

                if route == .search {
                    TextField("공연명, 공연장, 장르 검색", text: $searchQuery)
                        .textFieldStyle(.roundedBorder)
                        .submitLabel(.search)
                        .onSubmit {
                            submittedSearchQuery = searchQuery
                        }
                        .accessibilityIdentifier("live-search-input")
                        .accessibilityLabel("LIVE catalog 검색어")
                }

                if isDetailRoute, let event = events.first {
                    LiveCatalogDetailView(event: event)
                } else if isDetailRoute {
                    TicketgroundEmptySurface(
                        title: routeTitle,
                        message: "요청한 공연을 GET /api/catalog 결과에서 찾을 수 없습니다.",
                        actionTitle: "다시 시도",
                        action: retry
                    )
                    .accessibilityIdentifier("live-catalog-not-found")
                } else if route == .search && !normalizedSearchQuery.isEmpty && events.isEmpty {
                    TicketgroundEmptySurface(
                        title: "검색 결과가 없습니다",
                        message: "\"\(searchQuery.trimmingCharacters(in: .whitespacesAndNewlines))\"에 해당하는 공연명, 공연장, 장르를 찾지 못했습니다.",
                        actionTitle: "검색어 지우기",
                        action: {
                            searchQuery = ""
                            submittedSearchQuery = ""
                        }
                    )
                    .accessibilityIdentifier("live-search-empty")
                } else if events.isEmpty {
                    TicketgroundEmptySurface(
                        title: routeTitle,
                        message: "GET /api/catalog 결과에 표시할 공연이 없습니다.",
                        actionTitle: "다시 시도",
                        action: retry
                    )
                    .accessibilityIdentifier("live-catalog-empty")
                } else {
                    LazyVStack(alignment: .leading, spacing: TicketgroundSpacing.sm) {
                        Text("LIVE catalog · \(events.count)개")
                            .font(.title2.weight(.black))
                            .foregroundStyle(TicketgroundColor.ink)
                        ForEach(events, id: \.id) { event in
                            LiveCatalogEventRow(event: event)
                        }
                    }
                }
            }
            .padding(TicketgroundSpacing.xl)
        }
    }

    private var isDetailRoute: Bool {
        switch route {
        case .event, .goods: return true
        default: return false
        }
    }

    private func loadCatalog() async {
        guard case .loading = state else { return }
        do {
            state = .loaded(try await LiveBackendService(apiClient: container.environment.apiClient).getCatalog())
        } catch {
            if error as? APIClientError == .capabilityUnavailable(endpoint: .catalog, state: .unknown) {
                state = .unavailable
            } else {
                state = .failed(PublicReadPresentation.resolve(error))
            }
        }
    }

    private func retry() {
        state = .loading
        reloadID += 1
    }

    private var normalizedSearchQuery: String {
        normalizedSearchValue(submittedSearchQuery)
    }

    private var routeTitle: String {
        switch route {
        case .search: return "공연 검색 · LIVE catalog"
        case .ranking: return "실시간 예매 랭킹"
        case .genre(let name): return "\(displayGenre(name)) 공연"
        case .region: return "지역별 공연"
        case .place(let slug): return slug.map { "\($0) 공연장" } ?? "공연장별 공연"
        case .event: return "공연 상세"
        case .goods: return "상품 상세"
        case .open: return "티켓오픈 캘린더 · LIVE catalog"
        default: return route.id
        }
    }

    private func events(for route: AppRoute, in catalog: LiveCatalog, searchQuery: String) -> [LiveBackendCatalogEvent] {
        switch route {
        case .ranking:
            return sortedEvents(catalog.events)
        case .genre(let name):
            if normalizedGenre(name) == "vip" {
                return sortedEvents(catalog.events.filter {
                    LiveCatalogRouteMatcher.hasPriceGrade("vip", event: $0)
                })
            }
            return sortedEvents(catalog.events.filter { normalizedGenre($0.category) == normalizedGenre(name) })
        case .search:
            return sortedEvents(catalog.events.filter { event in
                LiveCatalogRouteMatcher.matchesSearch(
                    query: searchQuery,
                    event: event,
                    categoryLabel: event.category.map(displayGenre)
                )
            })
        case .region, .open:
            return []
        case .place(let slug):
            return sortedEvents(LiveCatalogRouteMatcher.placeEvents(slug: slug, in: catalog))
        case .event(let slug), .goods(let slug):
            return LiveCatalogRouteMatcher.detailEvents(slug: slug, in: catalog)
        default:
            return []
        }
    }

    private func sortedEvents(_ events: [LiveBackendCatalogEvent]) -> [LiveBackendCatalogEvent] {
        events.sorted { lhs, rhs in
            switch (lhs.pinnedRank, rhs.pinnedRank) {
            case let (left?, right?): return left == right ? lhs.soldCount > rhs.soldCount : left < right
            case (_?, nil): return true
            case (nil, _?): return false
            case (nil, nil): return lhs.soldCount > rhs.soldCount
            }
        }
    }

    private func normalizedGenre(_ value: String?) -> String {
        switch value?.lowercased() {
        case "play", "theater": return "theater"
        case "child", "children", "family": return "children"
        default: return value?.lowercased() ?? ""
        }
    }

    private func normalizedSlug(_ value: String) -> String {
        value.lowercased().filter { $0.isLetter || $0.isNumber }
    }

    private func normalizedSearchValue(_ value: String) -> String {
        normalizedSlug(value)
    }

    private func displayGenre(_ value: String) -> String {
        switch value.lowercased() {
        case "concert": return "콘서트"
        case "musical": return "뮤지컬"
        case "play", "theater": return "연극"
        case "classic": return "클래식"
        case "exhibition": return "전시"
        case "child", "children", "family": return "아동"
        case "sports": return "스포츠"
        case "vip": return "VIP석"
        default: return value
        }
    }
}

private struct LiveCatalogUnavailableRouteView: View {
    @Environment(AppContainer.self) private var container
    let route: AppRoute
    let retryCatalog: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: TicketgroundSpacing.lg) {
                Text("공연 정보 연결 상태")
                    .font(.caption.weight(.black))
                    .foregroundStyle(TicketgroundColor.accent)
                    .accessibilityIdentifier("live-route-state")
                Text("공연 정보 이용 불가")
                    .font(.title2.weight(.black))
                    .foregroundStyle(TicketgroundColor.ink)
                Text("공연 목록, 검색, 상세와 좌석도는 아직 사용할 수 없습니다.")
                    .font(.body)
                    .foregroundStyle(TicketgroundColor.inkSecondary)
                Text("GET /api/catalog 계약이 확인되지 않아 공연 정보를 추정하거나 표시하지 않습니다.")
                    .font(.body)
                    .foregroundStyle(TicketgroundColor.inkSecondary)
                Text("공개 상태는 홈 화면에서 확인할 수 있습니다.")
                    .font(.caption)
                    .foregroundStyle(TicketgroundColor.inkMuted)
                Button("공연 정보 다시 확인", action: retryCatalog)
                .buttonStyle(.borderedProminent)
                .accessibilityIdentifier("live-catalog-unavailable-retry")
                Button("홈으로") {
                    container.navigationPath.removeAll()
                }
                .buttonStyle(.bordered)
                .accessibilityIdentifier("live-catalog-unavailable-home")
            }
            .padding(TicketgroundSpacing.xl)
        }
        .accessibilityIdentifier("live-catalog-unavailable")
        .navigationTitle(routeTitle)
        .navigationBarTitleDisplayMode(.inline)
    }

    private var routeTitle: String {
        switch route {
        case .search: return "공연 검색"
        case .ranking: return "실시간 예매 랭킹"
        case .genre(let name): return "\(name) 공연"
        case .place: return "공연장별 공연"
        case .event: return "공연 상세"
        case .goods: return "상품 상세"
        case .queue, .booking: return "좌석 현황"
        default: return "공연 정보"
        }
    }
}

private struct LiveMenuRouteView: View {
    @Environment(AppContainer.self) private var container

    private struct MenuItem: Identifiable {
        let id: String
        let title: String
        let icon: String
        let route: AppRoute
    }

    private let categories = [
        MenuItem(id: "live-menu-category-concert", title: "콘서트", icon: "music.mic", route: .genre(name: "concert")),
        MenuItem(id: "live-menu-category-musical", title: "뮤지컬", icon: "theatermasks", route: .genre(name: "musical")),
        MenuItem(id: "live-menu-category-theater", title: "연극", icon: "person.2", route: .genre(name: "theater")),
        MenuItem(id: "live-menu-category-classic", title: "클래식", icon: "pianokeys", route: .genre(name: "classic")),
        MenuItem(id: "live-menu-category-exhibition", title: "전시", icon: "photo", route: .genre(name: "exhibition")),
        MenuItem(id: "live-menu-category-children", title: "아동", icon: "figure.2.and.child.holdinghands", route: .genre(name: "children")),
        MenuItem(id: "live-menu-category-sports", title: "스포츠", icon: "sportscourt", route: .genre(name: "sports"))
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: TicketgroundSpacing.lg) {
                HStack(alignment: .center, spacing: TicketgroundSpacing.md) {
                    Button {
                        if !container.navigationPath.isEmpty {
                            container.navigationPath.removeLast()
                        }
                    } label: {
                        Image(systemName: "xmark")
                            .font(.subheadline.weight(.bold))
                            .frame(width: 40, height: 40)
                            .background(TicketgroundColor.surface)
                            .overlay { Circle().stroke(TicketgroundColor.lineStrong, lineWidth: 1) }
                            .clipShape(Circle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("live-menu-close")
                    .accessibilityLabel("전체 메뉴 닫기")

                    VStack(alignment: .leading, spacing: TicketgroundSpacing.xs) {
                        Text("전체 메뉴 · LIVE")
                            .font(.title2.weight(.black))
                            .foregroundStyle(TicketgroundColor.ink)
                            .accessibilityIdentifier("live-menu-screen-title")
                        Text("Ticketground의 모든 서비스를 확인하세요")
                            .font(.caption)
                            .foregroundStyle(TicketgroundColor.inkMuted)
                    }
                    Spacer(minLength: 0)
                }

                menuSection(title: "계정", detail: "로그인과 관심공연을 관리하세요") {
                    liveMenuLink(title: "로그인", icon: "person", route: .login, identifier: "live-menu-login")
                    NavigationLink {
                        LiveAccountRouteView()
                    } label: {
                        liveMenuRow(title: "마이페이지", icon: "person.crop.circle")
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("live-menu-account")
                    liveMenuLink(title: "관심공연", icon: "heart", route: .watchlist, identifier: "live-menu-watchlist")
                }

                menuSection(title: "검색", detail: "공연을 빠르게 찾아보세요") {
                    liveMenuLink(title: "공연 검색", icon: "magnifyingglass", route: .search, identifier: "live-menu-search")
                    liveMenuLink(title: "실시간 예매 랭킹", icon: "chart.bar", route: .ranking, identifier: "live-menu-ranking")
                }

                menuSection(title: "카테고리", detail: "관심 있는 공연을 찾아보세요") {
                    ForEach(categories) { category in
                        liveMenuLink(title: category.title, icon: category.icon, route: category.route, identifier: category.id)
                    }
                }

                menuSection(title: "티켓 서비스", detail: "예매와 오픈 일정을 한눈에") {
                    liveMenuLink(title: "티켓오픈 캘린더", icon: "calendar", route: .open, identifier: "live-menu-open-calendar")
                }

                menuSection(title: "고객센터", detail: "도움이 필요할 때 이용하세요") {
                    liveMenuLink(title: "고객센터", icon: "questionmark.circle", route: .help, identifier: "live-menu-help")
                    liveMenuLink(title: "1:1 문의", icon: "bubble.left", route: .inquiry, identifier: "live-menu-inquiry")
                }

                menuSection(title: "서비스 안내", detail: "현재 연결 상태를 확인하세요") {
                    liveMenuLink(title: "서비스 연결 현황", icon: "checklist", route: .capabilityLedger, identifier: "live-menu-capability-ledger")
                }

                Text("실시간 서비스 메뉴")
                    .font(.caption)
                    .foregroundStyle(TicketgroundColor.inkMuted)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, TicketgroundSpacing.sm)
            }
            .padding(.horizontal, TicketgroundSpacing.lg)
            .padding(.vertical, TicketgroundSpacing.md)
        }
        .background(TicketgroundColor.surfaceMuted)
        .scrollIndicators(.hidden)
        .navigationTitle("전체 메뉴")
        .navigationBarTitleDisplayMode(.inline)
    }

    @ViewBuilder
    private func menuSection<Content: View>(title: String, detail: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: TicketgroundSpacing.sm) {
            VStack(alignment: .leading, spacing: TicketgroundSpacing.xs) {
                Text(title)
                    .font(.headline.weight(.black))
                    .foregroundStyle(TicketgroundColor.ink)
                Text(detail)
                    .font(.caption)
                    .foregroundStyle(TicketgroundColor.inkMuted)
            }
            VStack(spacing: 0) {
                content()
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(TicketgroundSpacing.lg)
        .background(TicketgroundColor.surface)
        .overlay {
            RoundedRectangle(cornerRadius: TicketgroundRadius.medium)
                .stroke(TicketgroundColor.line, lineWidth: 1)
        }
        .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.medium))
    }

    private func liveMenuLink(title: String, icon: String, route: AppRoute, identifier: String) -> some View {
        NavigationLink(value: route) {
            liveMenuRow(title: title, icon: icon)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(identifier)
    }

    private func liveMenuRow(title: String, icon: String) -> some View {
        HStack(spacing: TicketgroundSpacing.md) {
            Image(systemName: icon)
                .font(.subheadline.weight(.bold))
                .foregroundStyle(TicketgroundColor.inkSecondary)
                .frame(width: 24)
            Text(title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(TicketgroundColor.ink)
            Spacer(minLength: TicketgroundSpacing.sm)
            Image(systemName: "chevron.right")
                .font(.caption.weight(.bold))
                .foregroundStyle(TicketgroundColor.inkMuted)
        }
        .frame(maxWidth: .infinity, minHeight: 50, alignment: .leading)
        .contentShape(Rectangle())
    }
}

private struct CapabilityLedgerView: View {
    @Environment(AppContainer.self) private var container

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: TicketgroundSpacing.lg) {
                Text("서비스 연결 현황")
                    .font(.title2.weight(.black))
                    .foregroundStyle(TicketgroundColor.ink)
                    .accessibilityIdentifier("capability-ledger-title")
                Text("현재 확인된 계약만 기능으로 엽니다. 아직 연결 조건이 없는 메뉴는 이유와 다음 행동을 함께 안내합니다.")
                    .font(.body)
                    .foregroundStyle(TicketgroundColor.inkSecondary)

                statusCard(
                    title: "공개 공연 및 좌석 조회",
                    detail: "공연 목록 계약이 확인되면 검색·랭킹·상세·좌석 현황을 읽기 전용으로 표시합니다. 연결이 불안정하면 홈에서 다시 시도할 수 있습니다.",
                    icon: "checkmark.circle",
                    identifier: "capability-ledger-public-read"
                )
                statusCard(
                    title: "공개 미디어 원본",
                    detail: "포스터와 좌석도는 승인된 HTTPS 미디어 원본이 설정된 경우에만 불러옵니다. 설정이 없거나 안전하지 않으면 대체 이미지를 표시합니다.",
                    icon: "photo.badge.exclamationmark",
                    identifier: "capability-ledger-media"
                )
                statusCard(
                    title: "로그인과 내 정보",
                    detail: "로그인·마이페이지·관심공연·문의는 HTTPS와 실제 제공자 설정, 짝지어진 로그인 세션이 모두 필요합니다. 준비 전에는 요청을 보내지 않습니다.",
                    icon: "lock.circle",
                    identifier: "capability-ledger-auth"
                )
                statusCard(
                    title: "계약이 없는 탐색 메뉴",
                    detail: "지역·아티스트·티켓오픈 캘린더는 현재 공개 응답에 필요한 데이터가 없어 임의로 구성하지 않습니다. 홈의 공연 목록에서 지원되는 탐색을 이용해 주세요.",
                    icon: "questionmark.circle",
                    identifier: "capability-ledger-contract-missing"
                )
                statusCard(
                    title: "거래 및 인증 기능",
                    detail: "회원가입, 결제, 예약·취소·양도·전송, QR, 푸시와 기기 신뢰는 별도 서버 계약과 HTTPS 증명이 완료될 때까지 실행하지 않습니다.",
                    icon: "hand.raised.circle",
                    identifier: "capability-ledger-external-gate"
                )

                VStack(spacing: TicketgroundSpacing.sm) {
                    Button("홈으로") {
                        container.navigationPath.removeAll()
                    }
                    .buttonStyle(.bordered)
                    .accessibilityIdentifier("capability-ledger-home")

                    NavigationLink(value: AppRoute.login) {
                        Label("로그인 조건 확인", systemImage: "lock")
                            .frame(maxWidth: .infinity, minHeight: 44)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(TicketgroundColor.accent)
                    .accessibilityIdentifier("capability-ledger-login")
                }
            }
            .padding(TicketgroundSpacing.xl)
        }
        .background(TicketgroundColor.surfaceMuted)
        .navigationTitle("서비스 연결 현황")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func statusCard(title: String, detail: String, icon: String, identifier: String) -> some View {
        VStack(alignment: .leading, spacing: TicketgroundSpacing.sm) {
            Label(title, systemImage: icon)
                .font(.headline.weight(.black))
                .foregroundStyle(TicketgroundColor.ink)
            Text(detail)
                .font(.body)
                .foregroundStyle(TicketgroundColor.inkSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(TicketgroundSpacing.lg)
        .background(TicketgroundColor.surface)
        .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.medium))
        .accessibilityIdentifier(identifier)
    }
}

private struct LiveCatalogDetailView: View {
    let event: LiveBackendCatalogEvent
    @Environment(AppContainer.self) private var container

    var body: some View {
        VStack(alignment: .leading, spacing: TicketgroundSpacing.lg) {
            TicketgroundMediaImage(
                resource: container.environment.apiClient.resolveResource(event.image),
                role: .poster,
                accessibilityLabel: "\(event.title) 포스터"
            )
            .frame(maxWidth: .infinity)
            .frame(height: 320)
            .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.medium))

            VStack(alignment: .leading, spacing: TicketgroundSpacing.sm) {
                Text(event.title)
                    .font(.title.weight(.black))
                    .foregroundStyle(TicketgroundColor.ink)
                    .accessibilityIdentifier("live-catalog-event")
                Text(event.venue)
                    .font(.headline)
                    .foregroundStyle(TicketgroundColor.inkSecondary)
                Text(event.period ?? event.date ?? "일정 미정")
                    .font(.subheadline)
                    .foregroundStyle(TicketgroundColor.inkMuted)
                if let sale = event.sale {
                    Text([sale.label, sale.note].compactMap { $0 }.joined(separator: " · "))
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(TicketgroundColor.accent)
                }
                Text("판매 집계: \(event.soldCount)")
                    .font(.caption)
                    .foregroundStyle(TicketgroundColor.inkMuted)
            }
            .padding(TicketgroundSpacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(TicketgroundColor.surfaceMuted)
            .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.medium))

            NavigationLink(value: AppRoute.queue(slug: event.slug ?? event.id)) {
                Label("좌석 현황 조회", systemImage: "square.grid.2x2")
                    .font(.headline.weight(.bold))
                    .frame(maxWidth: .infinity, minHeight: 48)
            }
            .buttonStyle(.borderedProminent)
            .tint(TicketgroundColor.accent)
            .accessibilityIdentifier("live-seat-map-link")
        }
    }
}

private struct LiveCatalogEventRow: View {
    let event: LiveBackendCatalogEvent
    @Environment(AppContainer.self) private var container

    var body: some View {
        NavigationLink(value: AppRoute.goods(slug: event.slug ?? event.id)) {
            HStack(alignment: .top, spacing: TicketgroundSpacing.md) {
                TicketgroundMediaImage(
                    resource: container.environment.apiClient.resolveResource(event.image),
                    role: .poster,
                    accessibilityLabel: "\(event.title) 포스터"
                )
                .frame(width: 76, height: 104)
                .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.small))

                VStack(alignment: .leading, spacing: TicketgroundSpacing.xs) {
                    Text(event.title)
                        .font(.headline.weight(.bold))
                        .foregroundStyle(TicketgroundColor.ink)
                        .accessibilityIdentifier("live-catalog-event")
                    Text(event.venue)
                        .font(.subheadline)
                        .foregroundStyle(TicketgroundColor.inkMuted)
                    Text(event.period ?? event.date ?? "일정 미정")
                        .font(.caption)
                        .foregroundStyle(TicketgroundColor.inkMuted)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(TicketgroundSpacing.md)
            .background(TicketgroundColor.surfaceMuted)
            .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.medium))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("live-catalog-event-link-\(event.id)")
    }
}

private enum LiveSeatMapRouteState {
    case loading
    case awaitingPerformance
    case loaded(LiveSeatMap)
    case failed(String)
}

private struct LiveSeatMapRouteView: View {
    let route: AppRoute
    @Environment(AppContainer.self) private var container
    @State private var catalogState: LiveCatalogRouteState = .loading
    @State private var seatMapState: LiveSeatMapRouteState = .loading
    @State private var selectedPerformanceDateID: String?
    @State private var admittedService: LiveBackendService?
    @State private var reloadID = 0

    var body: some View {
        Group {
            switch catalogState {
            case .loading:
                TicketgroundLoadingSurface(title: "좌석 공연 정보 불러오는 중")
                    .accessibilityIdentifier("live-route-state")
            case .failed(let presentation):
                TicketgroundErrorSurface(
                    title: "좌석 현황을 표시할 수 없습니다",
                    message: presentation.message,
                    actionTitle: "다시 시도",
                    action: retry
                )
                .accessibilityIdentifier("live-route-state")
            case .unavailable:
                LiveCatalogUnavailableRouteView(route: route, retryCatalog: retry)
            case .loaded(let catalog):
                seatMapBody(for: catalog)
            }
        }
        .navigationTitle("좌석 현황")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: reloadID) {
            await loadSeatMap()
        }
    }

    @ViewBuilder
    private func seatMapBody(for catalog: LiveCatalog) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: TicketgroundSpacing.lg) {
                Text(routeTitle(for: catalog))
                    .font(.caption.weight(.black))
                    .foregroundStyle(TicketgroundColor.accent)
                    .accessibilityIdentifier("live-route-state")
                switch seatMapState {
                case .loading:
                    TicketgroundLoadingSurface(title: "좌석 현황 불러오는 중")
                        .accessibilityIdentifier("live-seat-map-loading")
                case .awaitingPerformance:
                    if let event = event(in: catalog) {
                        performanceSelector(for: event)
                    }
                case .failed(let message):
                    TicketgroundErrorSurface(
                        title: "좌석 현황을 표시할 수 없습니다",
                        message: message,
                        actionTitle: "다시 시도",
                        action: retry
                    )
                    .accessibilityIdentifier("live-seat-map-error")
                case .loaded(let seatMap):
                    if let event = event(in: catalog), performanceOptions(for: event).count > 1 {
                        performanceSelector(for: event)
                    }
                    LiveSeatMapContent(seatMap: seatMap)
                }
            }
            .padding(TicketgroundSpacing.xl)
        }
        .accessibilityIdentifier("live-seat-map")
    }

    private func event(in catalog: LiveCatalog) -> LiveBackendCatalogEvent? {
        guard let slug = routeSlug else { return nil }
        return catalog.events.first { $0.id == slug || $0.slug == slug || $0.title == slug }
    }

    private func loadSeatMap() async {
        guard case .loading = catalogState else { return }
        do {
            let service = LiveBackendService(apiClient: container.environment.apiClient)
            let catalog = try await service.getCatalog()
            admittedService = service
            catalogState = .loaded(catalog)
            guard let event = event(in: catalog) else {
                seatMapState = .failed("요청한 공연이 GET /api/catalog 결과에 없습니다.")
                return
            }
            let options = performanceOptions(for: event)
            guard !options.isEmpty else {
                seatMapState = .failed("좌석 현황을 조회할 공연 회차 정보가 없습니다.")
                return
            }
            guard options.count == 1, let performanceDateID = options.first?.id else {
                seatMapState = .awaitingPerformance
                return
            }
            selectedPerformanceDateID = performanceDateID
            await loadSeatMap(eventID: event.id, performanceDateID: performanceDateID)
        } catch {
            if case .loaded = catalogState {
                seatMapState = .failed("GET /api/seat-map?eventId=... 요청에 실패했습니다: \(error.localizedDescription)")
            } else if error as? APIClientError == .capabilityUnavailable(endpoint: .catalog, state: .unknown) {
                catalogState = .unavailable
            } else {
                catalogState = .failed(PublicReadPresentation.resolve(error))
            }
        }
    }

    private func loadSeatMap(eventID: String, performanceDateID: String) async {
        guard selectedPerformanceDateID == performanceDateID, !Task.isCancelled else { return }
        guard let admittedService else {
            seatMapState = .failed("좌석 조회 서비스를 준비하지 못했습니다. 다시 시도해 주세요.")
            return
        }
        do {
            seatMapState = .loading
            let seatMap = try await admittedService.getSeatMap(
                eventID: eventID,
                performanceDateID: performanceDateID
            )
            guard selectedPerformanceDateID == performanceDateID, !Task.isCancelled else { return }
            seatMapState = .loaded(seatMap)
        } catch is CancellationError {
            return
        } catch {
            guard selectedPerformanceDateID == performanceDateID, !Task.isCancelled else { return }
            seatMapState = .failed(
                "GET /api/seat-map?eventId=...&performanceDateId=... 요청에 실패했습니다: \(error.localizedDescription)"
            )
        }
    }

    @ViewBuilder
    private func performanceSelector(for event: LiveBackendCatalogEvent) -> some View {
        VStack(alignment: .leading, spacing: TicketgroundSpacing.sm) {
            Text("관람 회차")
                .font(.headline.weight(.black))
                .accessibilityIdentifier("live-seat-performance-selector")
            Text("좌석 현황을 확인할 회차를 선택해주세요.")
                .font(.subheadline)
                .foregroundStyle(TicketgroundColor.inkMuted)
            ForEach(performanceOptions(for: event), id: \.id) { option in
                Button(option.label) {
                    selectedPerformanceDateID = option.id
                    Task {
                        await loadSeatMap(eventID: event.id, performanceDateID: option.id)
                    }
                }
                .buttonStyle(.bordered)
                .tint(
                    selectedPerformanceDateID == option.id
                        ? TicketgroundColor.accent
                        : TicketgroundColor.inkMuted
                )
                .accessibilityIdentifier("live-seat-performance-\(option.id)")
            }
        }
    }

    private func performanceOptions(
        for event: LiveBackendCatalogEvent
    ) -> [(id: String, label: String)] {
        (event.dates ?? []).compactMap { performance in
            guard let id = performance.id else { return nil }
            return (
                id: id,
                label: performance.label
                    ?? performance.startsAt
                    ?? performance.date
                    ?? id
            )
        }
    }

    private func retry() {
        admittedService = nil
        catalogState = .loading
        seatMapState = .loading
        selectedPerformanceDateID = nil
        reloadID += 1
    }

    private var routeSlug: String? {
        switch route {
        case .queue(let slug), .booking(let slug): return slug
        default: return nil
        }
    }

    private func routeTitle(for catalog: LiveCatalog) -> String {
        event(in: catalog)?.title ?? "LIVE 좌석 현황"
    }
}

private struct LiveSeatMapContent: View {
    let seatMap: LiveSeatMap
    @Environment(AppContainer.self) private var container

    var body: some View {
        VStack(alignment: .leading, spacing: TicketgroundSpacing.lg) {
            VStack(alignment: .leading, spacing: TicketgroundSpacing.xs) {
                Text(seatMap.event.title)
                    .font(.title2.weight(.black))
                    .foregroundStyle(TicketgroundColor.ink)
                Text(seatMap.event.venue)
                    .font(.subheadline)
                    .foregroundStyle(TicketgroundColor.inkMuted)
                Text(seatMap.map.description)
                    .font(.body)
                    .foregroundStyle(TicketgroundColor.inkSecondary)
            }

            TicketgroundMediaImage(
                resource: container.environment.apiClient.resolveResource(seatMap.map.image),
                role: .seatMap,
                accessibilityLabel: "\(seatMap.map.title) 좌석 배치도",
                contentMode: .fit
            )
            .frame(maxWidth: .infinity)
            .frame(height: 260)
            .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.medium))

            VStack(alignment: .leading, spacing: TicketgroundSpacing.sm) {
                Text("좌석 구역 및 잔여 수량")
                    .font(.headline.weight(.black))
                    .accessibilityIdentifier("live-seat-map-zones")
                ForEach(seatMap.zones, id: \.id) { zone in
                    HStack(alignment: .firstTextBaseline) {
                        Text(zone.name)
                            .font(.subheadline.weight(.bold))
                            .accessibilityIdentifier("live-seat-zone")
                        Spacer()
                        Text("\(zone.available)석 가능")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(zone.available > 0 ? TicketgroundColor.success : TicketgroundColor.inkMuted)
                        Text(formatPrice(zone.price))
                            .font(.caption)
                            .foregroundStyle(TicketgroundColor.inkMuted)
                    }
                    .padding(TicketgroundSpacing.md)
                    .background(TicketgroundColor.surfaceMuted)
                    .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.medium))
                }
            }

            LazyVStack(alignment: .leading, spacing: TicketgroundSpacing.sm) {
                Text("좌석별 상태")
                    .font(.headline.weight(.black))
                ForEach(seatMap.seats, id: \.id) { seat in
                    HStack(alignment: .firstTextBaseline) {
                        VStack(alignment: .leading, spacing: TicketgroundSpacing.xs) {
                            Text(seat.displayCode.isEmpty ? seat.label : seat.displayCode)
                                .font(.subheadline.weight(.bold))
                            Text(seat.zoneName)
                                .font(.caption)
                                .foregroundStyle(TicketgroundColor.inkMuted)
                        }
                        Spacer()
                        Text(seat.available ? "선택 가능" : "\(seat.status) · 선택 불가")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(seat.available ? TicketgroundColor.success : TicketgroundColor.inkMuted)
                    }
                    .padding(.vertical, TicketgroundSpacing.xs)
                }
            }
        }
    }

    private func formatPrice(_ price: Int) -> String {
        "\(price.formatted())원"
    }
}

private struct LiveAccountCapabilitySurface: View {
    let state: LiveAccountCapabilityState
    let title: String
    let loginMessage: String
    let identifier: String
    let retry: () -> Void

    var body: some View {
        switch state {
        case .available:
            EmptyView()
        case .loginRequired:
            LiveLoginRequiredSurface(message: loginMessage, identifier: "\(identifier)-login-required")
        case .httpsRequired:
            LiveRouteMessageView(title: title, message: "보안 인증 정보는 HTTPS 연결에서만 전송할 수 있습니다.", identifier: "\(identifier)-https-required")
        case .unsupported:
            LiveRouteMessageView(title: title, message: "현재 백엔드에서 지원하지 않는 기능입니다.", identifier: "\(identifier)-unsupported")
        case .retry:
            TicketgroundErrorSurface(title: title, message: "기능 상태를 확인할 수 없습니다.", actionTitle: "다시 시도", action: retry)
                .accessibilityIdentifier("\(identifier)-retry")
        case .help:
            LiveRouteMessageView(title: title, message: "기능 상태가 호환되지 않습니다. 고객센터에 문의해 주세요.", identifier: "\(identifier)-help")
        }
    }
}

private struct LiveAccountRouteView: View {
    @Environment(AppContainer.self) private var container
    @State private var state: LiveAccountState = .loading
    @State private var reloadID = 0

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: TicketgroundSpacing.lg) {
                Text("마이페이지 · LIVE")
                    .font(.caption.weight(.black))
                    .foregroundStyle(TicketgroundColor.accent)
                    .accessibilityIdentifier("live-account")
                accountBody
                VStack(spacing: TicketgroundSpacing.sm) {
                    NavigationLink {
                        LiveWatchlistRouteView()
                    } label: {
                        Label("관심공연", systemImage: "heart")
                            .frame(maxWidth: .infinity, minHeight: 46)
                    }
                    .buttonStyle(.bordered)
                    .accessibilityIdentifier("live-mypage-watchlist")
                    NavigationLink {
                        LiveSupportRouteView(route: .help)
                    } label: {
                        Label("고객센터 문의", systemImage: "questionmark.circle")
                            .frame(maxWidth: .infinity, minHeight: 46)
                    }
                    .buttonStyle(.bordered)
                    .accessibilityIdentifier("live-mypage-support")
                }
            }
            .padding(TicketgroundSpacing.xl)
        }
        .navigationTitle("마이페이지")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: "\(container.environment.sessionStore.current?.userID ?? "")-\(reloadID)") {
            if let testState = RuntimeConfiguration.liveAccountCapabilityTestState {
                state = .capability(testState)
                return
            }
            let apiClient = container.environment.apiClient
            let capabilityMap = LiveAPIContract.deployed.capabilityMap(
                for: apiClient.baseURL ?? LiveAPIContract.deployed.publicHost,
                observedResponseVersion: nil
            )
            let initialState = LiveAccountCapabilityState.resolve(
                for: .account,
                capabilityMap: capabilityMap,
                session: container.environment.sessionStore.current,
                baseURL: apiClient.baseURL
            )
            guard initialState == .retry else {
                state = .capability(initialState)
                return
            }

            let service = LiveBackendService(apiClient: apiClient)
            do {
                let probe = try await service.diagnosePublicContract()
                let resolvedState = LiveAccountCapabilityState.resolve(
                    for: .account,
                    capabilityMap: probe.capabilities,
                    session: container.environment.sessionStore.current,
                    baseURL: apiClient.baseURL
                )
                guard case .available(let userID) = resolvedState else {
                    state = .capability(resolvedState)
                    return
                }
                async let profile = service.getSession(userID: userID)
                async let tickets = service.getTickets(userID: userID)
                state = .loaded(try await profile, try await tickets)
            } catch let error as APIClientError {
                state = .capability(LiveAccountCapabilityState.resolve(
                    for: .account,
                    capabilityMap: capabilityMap,
                    session: container.environment.sessionStore.current,
                    baseURL: apiClient.baseURL,
                    requestError: error
                ))
            } catch {
                state = .capability(.retry)
            }
        }
    }

    @ViewBuilder
    private var accountBody: some View {
        switch state {
        case .loading:
            LiveRouteMessageView(title: "계정", message: "세션과 티켓을 불러오는 중입니다.", identifier: "live-account-loading")
        case .capability(let capability):
            LiveAccountCapabilitySurface(
                state: capability,
                title: "계정 정보를 표시할 수 없습니다",
                loginMessage: "마이페이지를 보려면 실제 로그인 세션이 필요합니다.",
                identifier: "live-account",
                retry: { reloadID += 1 }
            )
        case .loaded(let session, let tickets):
            VStack(alignment: .leading, spacing: TicketgroundSpacing.sm) {
                Text(session.name)
                    .font(.title2.weight(.black))
                Text(LiveAccountDisplay.statusText(for: session))
                    .font(.subheadline)
                    .foregroundStyle(TicketgroundColor.inkMuted)
                Text("보유 티켓 \(tickets.count)장 · 신뢰 점수 \(session.trustScore)")
                    .font(.subheadline.weight(.semibold))
            }
            .padding(TicketgroundSpacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(TicketgroundColor.surfaceMuted)
            .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.medium))
            .accessibilityIdentifier("live-account-data")
        }
    }

}

private enum LiveAccountState {
    case loading
    case capability(LiveAccountCapabilityState)
    case loaded(LiveSession, [LiveTicket])
}

enum LiveAccountDisplay {
    static func statusText(for session: LiveSession) -> String {
        "계정 상태 \(session.status)"
    }
}

private struct LiveWatchlistRouteView: View {
    @Environment(AppContainer.self) private var container
    @State private var state: LiveWatchlistState = .loading
    @State private var reloadID = 0

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: TicketgroundSpacing.lg) {
                Text("관심공연 · LIVE")
                    .font(.caption.weight(.black))
                    .foregroundStyle(TicketgroundColor.accent)
                    .accessibilityIdentifier("live-watchlist")
                switch state {
                case .loading:
                    LiveRouteMessageView(title: "관심공연", message: "GET /api/users/{userId}/watchlist 요청을 준비하는 중입니다.", identifier: "live-watchlist-loading")
                case .capability(let capability):
                    LiveAccountCapabilitySurface(
                        state: capability,
                        title: "관심공연을 표시할 수 없습니다",
                        loginMessage: "관심공연은 실제 로그인 세션이 필요합니다.",
                        identifier: "live-watchlist",
                        retry: { reloadID += 1 }
                    )
                case .loaded(let items):
                    if items.isEmpty {
                        LiveRouteMessageView(title: "관심공연이 없습니다", message: "GET /api/users/{userId}/watchlist 결과가 비어 있습니다.", identifier: "live-watchlist-empty")
                    } else {
                        VStack(alignment: .leading, spacing: TicketgroundSpacing.sm) {
                            Text("관심공연 \(items.count)개")
                                .font(.title2.weight(.black))
                            ForEach(items, id: \.id) { item in
                                VStack(alignment: .leading, spacing: TicketgroundSpacing.xs) {
                                    Text(item.event?.title ?? item.eventId)
                                        .font(.headline.weight(.bold))
                                    Text(item.event?.venue ?? "공연장 정보 없음")
                                        .font(.subheadline)
                                        .foregroundStyle(TicketgroundColor.inkMuted)
                                    Text("알림 \(item.notificationEnabled ? "켜짐" : "꺼짐") · 캘린더 \(item.calendarEnabled ? "연동" : "미연동")")
                                        .font(.caption)
                                        .foregroundStyle(TicketgroundColor.inkMuted)
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(TicketgroundSpacing.md)
                                .background(TicketgroundColor.surfaceMuted)
                                .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.medium))
                                .accessibilityIdentifier("live-watchlist-item-\(item.id)")
                            }
                        }
                        .accessibilityIdentifier("live-watchlist-items")
                    }
                }
            }
            .padding(TicketgroundSpacing.xl)
        }
        .navigationTitle("관심공연")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: "\(container.environment.sessionStore.current?.userID ?? "")-\(reloadID)") {
            if let testState = RuntimeConfiguration.liveAccountCapabilityTestState {
                state = .capability(testState)
                return
            }
            let apiClient = container.environment.apiClient
            let capabilityMap = LiveAPIContract.deployed.capabilityMap(
                for: apiClient.baseURL ?? LiveAPIContract.deployed.publicHost,
                observedResponseVersion: nil
            )
            let initialState = LiveAccountCapabilityState.resolve(
                for: .watchlist,
                capabilityMap: capabilityMap,
                session: container.environment.sessionStore.current,
                baseURL: apiClient.baseURL
            )
            guard initialState == .retry else {
                state = .capability(initialState)
                return
            }

            let service = LiveBackendService(apiClient: apiClient)
            do {
                let probe = try await service.diagnosePublicContract()
                let resolvedState = LiveAccountCapabilityState.resolve(
                    for: .watchlist,
                    capabilityMap: probe.capabilities,
                    session: container.environment.sessionStore.current,
                    baseURL: apiClient.baseURL
                )
                guard case .available(let userID) = resolvedState else {
                    state = .capability(resolvedState)
                    return
                }
                state = .loaded(try await service.getWatchlist(userID: userID))
            } catch let error as APIClientError {
                state = .capability(LiveAccountCapabilityState.resolve(
                    for: .watchlist,
                    capabilityMap: capabilityMap,
                    session: container.environment.sessionStore.current,
                    baseURL: apiClient.baseURL,
                    requestError: error
                ))
            } catch {
                state = .capability(.retry)
            }
        }
    }
}

private enum LiveWatchlistState {
    case loading
    case capability(LiveAccountCapabilityState)
    case loaded([LiveWatchlistItem])
}

private struct LiveSupportRouteView: View {
    let route: AppRoute
    @Environment(AppContainer.self) private var container
    @State private var state: LiveSupportState = .loading
    @State private var reloadID = 0

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: TicketgroundSpacing.lg) {
                Text(routeTitle)
                    .font(.caption.weight(.black))
                    .foregroundStyle(TicketgroundColor.accent)
                    .accessibilityIdentifier("live-support")
                switch state {
                case .loading:
                    LiveRouteMessageView(title: routeTitle, message: "GET /api/support/threads?userId={userId} 요청을 준비하는 중입니다.", identifier: "live-support-loading")
                case .capability(let capability):
                    LiveAccountCapabilitySurface(
                        state: capability,
                        title: routeTitle,
                        loginMessage: "고객센터와 1:1 문의는 실제 로그인 세션이 필요합니다.",
                        identifier: "live-support",
                        retry: { reloadID += 1 }
                    )
                case .loaded(let threads):
                    if threads.isEmpty {
                        LiveRouteMessageView(title: "문의 내역이 없습니다", message: "GET /api/support/threads 결과가 비어 있습니다.", identifier: "live-support-empty")
                    } else {
                        VStack(alignment: .leading, spacing: TicketgroundSpacing.sm) {
                            ForEach(threads, id: \.id) { thread in
                                VStack(alignment: .leading, spacing: TicketgroundSpacing.xs) {
                                    Text(thread.subject)
                                        .font(.headline.weight(.bold))
                                    Text(supportStatus(thread.status))
                                        .font(.caption.weight(.semibold))
                                        .foregroundStyle(TicketgroundColor.accent)
                                    if let message = thread.messages.last {
                                        Text(message.body)
                                            .font(.subheadline)
                                            .foregroundStyle(TicketgroundColor.inkSecondary)
                                    }
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(TicketgroundSpacing.md)
                                .background(TicketgroundColor.surfaceMuted)
                                .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.medium))
                                .accessibilityIdentifier("live-support-thread-\(thread.id)")
                            }
                        }
                    }
                }
            }
            .padding(TicketgroundSpacing.xl)
        }
        .navigationTitle(routeTitle)
        .navigationBarTitleDisplayMode(.inline)
        .task(id: "\(container.environment.sessionStore.current?.userID ?? "")-\(reloadID)") {
            if let testState = RuntimeConfiguration.liveAccountCapabilityTestState {
                state = .capability(testState)
                return
            }
            let apiClient = container.environment.apiClient
            let capabilityMap = LiveAPIContract.deployed.capabilityMap(
                for: apiClient.baseURL ?? LiveAPIContract.deployed.publicHost,
                observedResponseVersion: nil
            )
            let initialState = LiveAccountCapabilityState.resolve(
                for: .support,
                capabilityMap: capabilityMap,
                session: container.environment.sessionStore.current,
                baseURL: apiClient.baseURL
            )
            guard initialState == .retry else {
                state = .capability(initialState)
                return
            }

            let service = LiveBackendService(apiClient: apiClient)
            do {
                let probe = try await service.diagnosePublicContract()
                let resolvedState = LiveAccountCapabilityState.resolve(
                    for: .support,
                    capabilityMap: probe.capabilities,
                    session: container.environment.sessionStore.current,
                    baseURL: apiClient.baseURL
                )
                guard case .available(let userID) = resolvedState else {
                    state = .capability(resolvedState)
                    return
                }
                state = .loaded(try await service.getSupportThreads(userID: userID))
            } catch let error as APIClientError {
                state = .capability(LiveAccountCapabilityState.resolve(
                    for: .support,
                    capabilityMap: capabilityMap,
                    session: container.environment.sessionStore.current,
                    baseURL: apiClient.baseURL,
                    requestError: error
                ))
            } catch {
                state = .capability(.retry)
            }
        }
    }

    private var routeTitle: String {
        route == .inquiry ? "1:1 문의 · LIVE" : "고객센터 · LIVE"
    }

    private func supportStatus(_ status: LiveSupportStatus) -> String {
        switch status {
        case .open: return "답변 대기"
        case .answered: return "답변 완료"
        case .closed: return "종료"
        case .unknown: return "상태 확인 중"
        }
    }
}

private enum LiveSupportState {
    case loading
    case capability(LiveAccountCapabilityState)
    case loaded([LiveSupportThread])
}

private struct LiveUnsupportedRouteView: View {
    let route: AppRoute

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: TicketgroundSpacing.lg) {
                Text(routeTitle)
                    .font(.caption.weight(.black))
                    .foregroundStyle(TicketgroundColor.accent)
                    .accessibilityIdentifier("live-unsupported-capability")
                Text("현재 백엔드에서 확인된 공개 GET 범위에 포함되지 않은 화면입니다.")
                    .font(.title3.weight(.black))
                    .foregroundStyle(TicketgroundColor.ink)
                Text(reason)
                    .font(.body)
                    .foregroundStyle(TicketgroundColor.inkSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(TicketgroundSpacing.lg)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(TicketgroundColor.surfaceMuted)
                    .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.medium))
                    .accessibilityIdentifier("live-unsupported-route")
            }
            .padding(TicketgroundSpacing.xl)
        }
        .navigationTitle(routeTitle)
        .navigationBarTitleDisplayMode(.inline)
    }

    private var routeTitle: String {
        switch route {
        case .signup: return "회원가입 · 지원 보류"
        case .resale: return "티켓 양도 · 지원 보류"
        case .transfer: return "티켓 전송 · 지원 보류"
        case .cancel: return "예매 취소 · 지원 보류"
        case .checkout: return "결제 · 지원 보류"
        case .reservation: return "예약 · 지원 보류"
        case .artist: return "아티스트 · 지원 보류"
        case .region: return "지역별 공연 · 지원 보류"
        case .open: return "티켓오픈 캘린더 · 지원 보류"
        default: return route.id
        }
    }

    private var reason: String {
        switch route {
        case .signup:
            return "회원가입 POST endpoint가 LiveBackendService에 없어 계정을 만들지 않습니다."
        case .resale, .transfer, .cancel, .checkout, .reservation:
            return "해당 거래/예약 mutation 또는 조회 endpoint가 현재 공개 backend contract에 없어 작업을 실행하지 않습니다."
        case .artist:
            return "아티스트 전용 공개 GET endpoint가 현재 확인되지 않아 catalog에 포함된 공연만 표시할 수 있습니다."
        case .region:
            return "GET /api/catalog에는 지역 필드가 없어 지역별 공연을 추정하거나 임의로 분류하지 않습니다."
        case .open:
            return "현재 확인된 공개 GET contract에 티켓오픈 캘린더 데이터가 없어 catalog 공연을 오픈 일정으로 표시하지 않습니다."
        default:
            return "이 route에 대응하는 공개 backend capability가 현재 확인되지 않았습니다."
        }
    }
}

private struct LiveRouteMessageView: View {
    let title: String
    let message: String
    let identifier: String

    var body: some View {
        VStack(alignment: .leading, spacing: TicketgroundSpacing.md) {
            Text(title)
                .font(.headline.weight(.black))
                .foregroundStyle(TicketgroundColor.ink)
            Text(message)
                .font(.body)
                .foregroundStyle(TicketgroundColor.inkSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(TicketgroundSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(TicketgroundColor.surfaceMuted)
        .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.medium))
        .accessibilityIdentifier(identifier)
    }
}

private struct LiveLoginRequiredSurface: View {
    let message: String
    let identifier: String

    var body: some View {
        VStack(alignment: .leading, spacing: TicketgroundSpacing.md) {
            Text("로그인 필요")
                .font(.headline.weight(.black))
                .foregroundStyle(TicketgroundColor.ink)
            Text(message)
                .font(.body)
                .foregroundStyle(TicketgroundColor.inkSecondary)
                .fixedSize(horizontal: false, vertical: true)
            NavigationLink(value: AppRoute.login) {
                Text("로그인 화면으로")
                    .font(.subheadline.weight(.bold))
                    .frame(maxWidth: .infinity, minHeight: 44)
            }
            .buttonStyle(.borderedProminent)
            .tint(TicketgroundColor.accent)
            .accessibilityIdentifier("live-login-route")
        }
        .padding(TicketgroundSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(TicketgroundColor.surfaceMuted)
        .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.medium))
        .accessibilityIdentifier(identifier)
    }
}
