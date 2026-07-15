import SwiftUI

struct DiscoveryRouteView: View {
    let route: AppRoute
    let content: DiscoveryContent?

    var body: some View {
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
                    Text("별도 이메일 회원가입 없이 간편 로그인 완료 시 티켓그라운드 계정이 생성됩니다.")
                        .font(.subheadline)
                        .foregroundStyle(TicketgroundColor.inkMuted)
                        .lineSpacing(3)
                }

                VStack(spacing: TicketgroundSpacing.sm) {
                    ForEach(providers, id: \.id) { provider in
                        Button {
                            container.environment.sessionStore.setFixtureUser("fixture-\(provider.id)")
                            providerName = provider.name
                            didLogin = true
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
