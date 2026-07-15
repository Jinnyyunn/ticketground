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
        case .mypage:
            DiscoveryMenuView()
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
    @Environment(AppContainer.self) private var container
    @State private var didLogin = false
    @State private var providerName = ""
    @State private var liveProviderMessage: String?

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
                    Text(container.environment.mode == .fixture
                         ? "별도 이메일 회원가입 없이 간편 로그인 완료 시 티켓그라운드 계정이 생성됩니다."
                         : "현재 백엔드가 확인한 로그인 경로의 준비 상태를 안내합니다.")
                        .font(.subheadline)
                        .foregroundStyle(TicketgroundColor.inkMuted)
                        .lineSpacing(3)
                }

                VStack(spacing: TicketgroundSpacing.sm) {
                    ForEach(providers, id: \.id) { provider in
                        Button {
                            if container.environment.mode == .fixture {
                                container.environment.sessionStore.setFixtureUser("fixture-\(provider.id)")
                                providerName = provider.name
                                didLogin = true
                            } else {
                                liveProviderMessage = liveProviderReason(for: provider.id)
                            }
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

                if didLogin {
                    HStack(spacing: TicketgroundSpacing.sm) {
                        Image(systemName: "checkmark.circle.fill")
                        VStack(alignment: .leading, spacing: TicketgroundSpacing.xs) {
                            Text("로그인 완료")
                                .font(.subheadline.weight(.bold))
                            Text("\(providerName) fixture 로그인 완료")
                                .font(.caption.weight(.semibold))
                            Text("\(providerName) fixture 계정으로 시작합니다.")
                                .font(.caption)
                                .foregroundStyle(TicketgroundColor.inkMuted)
                        }
                        Spacer(minLength: 0)
                    }
                    .foregroundStyle(TicketgroundColor.success)
                    .padding(TicketgroundSpacing.md)
                    .background(TicketgroundColor.success.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.medium))
                    .accessibilityIdentifier("login-success")
                }

                if let liveProviderMessage {
                    HStack(alignment: .top, spacing: TicketgroundSpacing.sm) {
                        Image(systemName: "info.circle.fill")
                        Text(liveProviderMessage)
                            .font(.subheadline)
                            .foregroundStyle(TicketgroundColor.ink)
                            .fixedSize(horizontal: false, vertical: true)
                        Spacer(minLength: 0)
                    }
                    .padding(TicketgroundSpacing.md)
                    .background(TicketgroundColor.surfaceMuted)
                    .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.medium))
                    .accessibilityIdentifier("live-login-provider-state")
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

    private func liveProviderReason(for id: String) -> String {
        switch id {
        case "google":
            return "Google 로그인은 POST /api/auth/google에 provider credential이 필요합니다. 현재 앱에는 provider credential이 없어 로그인 계정을 만들지 않았습니다."
        case "kakao":
            return "카카오톡 로그인은 provider 설정과 브라우저 callback flow가 필요해 현재 앱에서 사용할 수 없습니다."
        default:
            return "네이버 로그인은 provider 설정과 브라우저 callback flow가 필요해 현재 앱에서 사용할 수 없습니다."
        }
    }
}

struct DiscoveryMenuView: View {
    @Environment(AppContainer.self) private var container
    @State private var lightMode = true

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

                TicketgroundSurface(tone: .muted) {
                    HStack {
                        Label("화면 모드", systemImage: lightMode ? "sun.max" : "moon")
                            .font(.subheadline.weight(.bold))
                        Spacer()
                        Toggle("라이트 모드", isOn: $lightMode)
                            .labelsHidden()
                            .tint(TicketgroundColor.accent)
                            .accessibilityIdentifier("menu-theme-toggle")
                            .accessibilityLabel("라이트 모드")
                    }
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

private enum LiveCatalogRouteState {
    case loading
    case loaded(LiveCatalog)
    case failed(String)
}

private struct LiveDiscoveryRouteView: View {
    let route: AppRoute
    @Environment(AppContainer.self) private var container
    @State private var state: LiveCatalogRouteState = .loading
    @State private var searchQuery = ""

    var body: some View {
        switch route {
        case .login:
            DiscoveryLoginView()
        case .mypage:
            LiveMenuRouteView()
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
            catalogBody
        }
    }

    @ViewBuilder
    private var catalogBody: some View {
        Group {
            switch state {
            case .loading:
                LiveRouteMessageView(
                    title: routeTitle,
                    message: "공개 catalog를 불러오는 중입니다.",
                    identifier: "live-route-state"
                )
            case .loaded(let catalog):
                catalogView(catalog)
            case .failed(let message):
                LiveRouteMessageView(
                    title: routeTitle,
                    message: message,
                    identifier: "live-route-state"
                )
            }
        }
        .navigationTitle(routeTitle)
        .navigationBarTitleDisplayMode(.inline)
        .task {
            guard case .loading = state else { return }
            do {
                state = .loaded(try await LiveBackendService(apiClient: container.environment.apiClient).getCatalog())
            } catch {
                state = .failed("GET /api/catalog 요청에 실패했습니다: \(error.localizedDescription)")
            }
        }
    }

    @ViewBuilder
    private func catalogView(_ catalog: LiveCatalog) -> some View {
        let events = events(for: route, in: catalog)
        ScrollView {
            VStack(alignment: .leading, spacing: TicketgroundSpacing.lg) {
                Text(routeTitle)
                    .font(.caption.weight(.black))
                    .foregroundStyle(TicketgroundColor.accent)
                    .accessibilityIdentifier("live-route-state")

                if route == .search {
                    TextField("공연명, 공연장, 장르 검색", text: $searchQuery)
                        .textFieldStyle(.roundedBorder)
                        .accessibilityIdentifier("live-search-input")
                        .accessibilityLabel("LIVE catalog 검색어")
                }

                if isDetailRoute, let event = events.first {
                    LiveCatalogDetailView(event: event)
                } else if isDetailRoute {
                    LiveRouteMessageView(
                        title: routeTitle,
                        message: "요청한 공연을 GET /api/catalog 결과에서 찾을 수 없습니다.",
                        identifier: "live-catalog-not-found"
                    )
                } else if route == .search && !normalizedSearchQuery.isEmpty && events.isEmpty {
                    LiveRouteMessageView(
                        title: "검색 결과가 없습니다",
                        message: "\"\(searchQuery.trimmingCharacters(in: .whitespacesAndNewlines))\"에 해당하는 공연명, 공연장, 장르를 찾지 못했습니다.",
                        identifier: "live-search-empty"
                    )
                } else if events.isEmpty {
                    LiveRouteMessageView(
                        title: routeTitle,
                        message: "GET /api/catalog 결과에 표시할 공연이 없습니다.",
                        identifier: "live-catalog-empty"
                    )
                } else {
                    VStack(alignment: .leading, spacing: TicketgroundSpacing.sm) {
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

    private var normalizedSearchQuery: String {
        normalizedSearchValue(searchQuery)
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

    private func events(for route: AppRoute, in catalog: LiveCatalog) -> [LiveBackendCatalogEvent] {
        switch route {
        case .ranking:
            return sortedEvents(catalog.events)
        case .genre(let name):
            return sortedEvents(catalog.events.filter { normalizedGenre($0.category) == normalizedGenre(name) })
        case .search:
            guard !normalizedSearchQuery.isEmpty else { return sortedEvents(catalog.events) }
            return sortedEvents(catalog.events.filter { event in
                [
                    event.title,
                    event.venue,
                    event.category,
                    event.category.map(displayGenre)
                ]
                .compactMap { $0 }
                .contains { normalizedSearchValue($0).contains(normalizedSearchQuery) }
            })
        case .region, .open:
            return []
        case .place(let slug):
            guard let slug, !slug.isEmpty else { return sortedEvents(catalog.events) }
            return sortedEvents(catalog.events.filter { event in
                [event.id, event.slug, event.venue, event.title]
                    .compactMap { $0 }
                    .contains { normalizedSlug($0).contains(normalizedSlug(slug)) }
            })
        case .event(let slug), .goods(let slug):
            return catalog.events.filter { event in
                event.id == slug || event.slug == slug || normalizedSlug(event.title) == normalizedSlug(slug)
            }
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
        default: return value
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

private struct LiveCatalogDetailView: View {
    let event: LiveBackendCatalogEvent

    var body: some View {
        VStack(alignment: .leading, spacing: TicketgroundSpacing.lg) {
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

    var body: some View {
        NavigationLink(value: AppRoute.queue(slug: event.slug ?? event.id)) {
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
    case loaded(LiveSeatMap)
    case failed(String)
}

private struct LiveSeatMapRouteView: View {
    let route: AppRoute
    @Environment(AppContainer.self) private var container
    @State private var catalogState: LiveCatalogRouteState = .loading
    @State private var seatMapState: LiveSeatMapRouteState = .loading

    var body: some View {
        Group {
            switch catalogState {
            case .loading:
                LiveRouteMessageView(title: "좌석 현황", message: "GET /api/catalog으로 공연을 확인하는 중입니다.", identifier: "live-route-state")
            case .failed(let message):
                LiveRouteMessageView(title: "좌석 현황", message: "GET /api/catalog 요청에 실패했습니다: \(message)", identifier: "live-route-state")
            case .loaded(let catalog):
                seatMapBody(for: catalog)
            }
        }
        .navigationTitle("좌석 현황")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            guard case .loading = catalogState else { return }
            do {
                let catalog = try await LiveBackendService(apiClient: container.environment.apiClient).getCatalog()
                catalogState = .loaded(catalog)
                guard let event = event(in: catalog) else {
                    seatMapState = .failed("요청한 공연이 GET /api/catalog 결과에 없습니다.")
                    return
                }
                seatMapState = .loading
                seatMapState = .loaded(try await LiveBackendService(apiClient: container.environment.apiClient).getSeatMap(eventID: event.id))
            } catch {
                if case .loaded = catalogState {
                    seatMapState = .failed("GET /api/seat-map?eventId=... 요청에 실패했습니다: \(error.localizedDescription)")
                } else {
                    catalogState = .failed(error.localizedDescription)
                }
            }
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
                    LiveRouteMessageView(title: "좌석 현황", message: "GET /api/seat-map으로 구역과 잔여 좌석을 확인하는 중입니다.", identifier: "live-seat-map-loading")
                case .failed(let message):
                    LiveRouteMessageView(title: "좌석 현황을 표시할 수 없습니다", message: message, identifier: "live-seat-map-error")
                case .loaded(let seatMap):
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

            VStack(alignment: .leading, spacing: TicketgroundSpacing.sm) {
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

private struct LiveAccountRouteView: View {
    @Environment(AppContainer.self) private var container
    @State private var state: LiveAccountState = .loading

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
        .task(id: container.environment.sessionStore.current?.userID) {
            guard let session = realSession else {
                state = .loginRequired
                return
            }
            do {
                async let profile = LiveBackendService(apiClient: container.environment.apiClient).getSession(userID: session.userID)
                async let tickets = LiveBackendService(apiClient: container.environment.apiClient).getTickets(userID: session.userID)
                state = .loaded(try await profile, try await tickets)
            } catch {
                state = .failed("GET /api/users/\(session.userID)/session 또는 /tickets 요청에 실패했습니다: \(error.localizedDescription)")
            }
        }
    }

    @ViewBuilder
    private var accountBody: some View {
        switch state {
        case .loading:
            LiveRouteMessageView(title: "계정", message: "세션과 티켓을 불러오는 중입니다.", identifier: "live-account-loading")
        case .loginRequired:
            LiveLoginRequiredSurface(message: "마이페이지를 보려면 실제 로그인 세션이 필요합니다.", identifier: "live-login-required")
        case .failed(let message):
            LiveRouteMessageView(title: "계정 정보를 표시할 수 없습니다", message: message, identifier: "live-account-error")
        case .loaded(let session, let tickets):
            VStack(alignment: .leading, spacing: TicketgroundSpacing.sm) {
                Text(session.name)
                    .font(.title2.weight(.black))
                Text("세션 \(session.id) · \(session.status)")
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

    private var realSession: NativeSession? {
        guard let session = container.environment.sessionStore.current, session.credential != nil else { return nil }
        return session
    }
}

private enum LiveAccountState {
    case loading
    case loginRequired
    case loaded(LiveSession, [LiveTicket])
    case failed(String)
}

private struct LiveWatchlistRouteView: View {
    @Environment(AppContainer.self) private var container
    @State private var state: LiveWatchlistState = .loading

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
                case .loginRequired:
                    LiveLoginRequiredSurface(message: "관심공연은 실제 로그인 세션이 필요합니다.", identifier: "live-login-required")
                case .failed(let message):
                    LiveRouteMessageView(title: "관심공연을 표시할 수 없습니다", message: message, identifier: "live-watchlist-error")
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
        .task(id: container.environment.sessionStore.current?.userID) {
            guard let session = realSession else {
                state = .loginRequired
                return
            }
            do {
                state = .loaded(try await LiveBackendService(apiClient: container.environment.apiClient).getWatchlist(userID: session.userID))
            } catch {
                state = .failed("GET /api/users/\(session.userID)/watchlist 요청에 실패했습니다: \(error.localizedDescription)")
            }
        }
    }

    private var realSession: NativeSession? {
        guard let session = container.environment.sessionStore.current, session.credential != nil else { return nil }
        return session
    }
}

private enum LiveWatchlistState {
    case loading
    case loginRequired
    case loaded([LiveWatchlistItem])
    case failed(String)
}

private struct LiveSupportRouteView: View {
    let route: AppRoute
    @Environment(AppContainer.self) private var container
    @State private var state: LiveSupportState = .loading

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
                case .loginRequired:
                    LiveLoginRequiredSurface(message: "고객센터와 1:1 문의는 실제 로그인 세션이 필요합니다.", identifier: "live-login-required")
                case .failed(let message):
                    LiveRouteMessageView(title: routeTitle, message: message, identifier: "live-support-error")
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
        .task(id: container.environment.sessionStore.current?.userID) {
            guard let session = realSession else {
                state = .loginRequired
                return
            }
            do {
                state = .loaded(try await LiveBackendService(apiClient: container.environment.apiClient).getSupportThreads(userID: session.userID))
            } catch {
                state = .failed("GET /api/support/threads?userId=\(session.userID) 요청에 실패했습니다: \(error.localizedDescription)")
            }
        }
    }

    private var routeTitle: String {
        route == .inquiry ? "1:1 문의 · LIVE" : "고객센터 · LIVE"
    }

    private var realSession: NativeSession? {
        guard let session = container.environment.sessionStore.current, session.credential != nil else { return nil }
        return session
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
    case loginRequired
    case loaded([LiveSupportThread])
    case failed(String)
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
