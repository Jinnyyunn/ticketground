import SwiftUI
import TossPayments
import UserNotifications

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
        case .menu:
            DiscoveryMenuView()
        case .mypage:
            DiscoveryMypageView()
        case .watchlist:
            DiscoveryWatchlistEmptyView()
        case .capabilityLedger:
            CapabilityLedgerView()
        case .open:
            if let content {
                DiscoveryOpenCalendarView(content: content)
            } else {
                TicketgroundLoadingSurface(title: "오픈 캘린더를 불러오는 중")
            }
        case .resale:
            DiscoveryPublicResaleView()
        case .genre(let name):
            DiscoveryGenreDestinationView(name: name, content: content)
        case .event(let slug):
            DiscoveryEditorialDestinationView(slug: slug)
        default:
            // No fixture-mode destination is wired up for this route yet
            // (e.g. the booking queue behind the home hero banner). Rather
            // than leak the raw internal route id on screen, show a graceful
            // "coming soon" state — the identifier below stays so existing
            // navigation/connectivity tests can still target this screen.
            DiscoveryComingSoonView(route: route)
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
    @State private var selectedProvider: Provider?
    @State private var providerMessage: String?
    @State private var googleSigningIn = false
    @State private var socialSigningInProvider: SocialLoginProvider?

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
                LoginHeroBanner()

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
                            if ProcessInfo.processInfo.arguments.contains("-ui-testing") {
                                selectedProvider = provider
                            } else if provider.id == "google" {
                                startGoogleLogin()
                            } else if let socialProvider = SocialLoginProvider(rawValue: provider.id) {
                                startSocialLogin(socialProvider)
                            } else {
                                selectedProvider = provider
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
                        .disabled(
                            (provider.id == "google" && googleSigningIn)
                                || socialSigningInProvider?.rawValue == provider.id
                        )
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

                if let session = container.environment.sessionStore.current {
                    VStack(alignment: .leading, spacing: TicketgroundSpacing.sm) {
                        Text("TicketGround 로그인 완료")
                            .font(.headline)
                        Text("사용자: \(session.userID)")
                            .font(.subheadline)
                            .foregroundStyle(TicketgroundColor.inkMuted)
                        Button("로그아웃") {
                            logoutGoogleSession()
                        }
                        .buttonStyle(.bordered)
                        .accessibilityIdentifier("login-google-logout")
                    }
                    .padding(TicketgroundSpacing.md)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(TicketgroundColor.surfaceMuted)
                    .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.medium))
                    .accessibilityIdentifier("login-google-session")
                }

                LoginBenefitsCard()

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

                LoginFooter(baseURL: container.environment.apiClient.baseURL)
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
                providerMessage = "\(provider.name) 인증을 취소했습니다.\n로그인 상태는 그대로입니다."
                selectedProvider = nil
            }
            .accessibilityIdentifier("login-provider-cancel")
        } message: {
            Text("외부 인증 앱 또는 브라우저에서 인증합니다. TicketGround는 비밀번호를 수집하지 않습니다.")
        }
    }

    private func startGoogleLogin() {
        guard !googleSigningIn else { return }
        googleSigningIn = true
        providerMessage = nil
        let coordinator = GoogleLoginCoordinator(
            identityProvider: GoogleSignInProvider(),
            sessionExchanger: GoogleNativeSessionClient(
                apiClient: container.environment.apiClient,
                sessionStore: container.environment.sessionStore
            ),
            isSecureBackend: container.environment.apiClient.baseURL?.scheme?.lowercased() == "https"
        )
        Task {
            await coordinator.signIn()
            googleSigningIn = false
            switch coordinator.state {
            case .signedIn(let userName):
                providerMessage = "\(userName)님으로 로그인했습니다."
                container.completeLoginNavigation()
            case .cancelled:
                providerMessage = GoogleLoginError.cancelled.localizedDescription
            case .failed(let message):
                providerMessage = message
            case .idle, .loading:
                break
            }
        }
    }

    private func startSocialLogin(_ provider: SocialLoginProvider) {
        guard socialSigningInProvider == nil else { return }
        guard let baseURL = container.environment.apiClient.baseURL else {
            providerMessage = SocialLoginError.httpsRequired.localizedDescription
            return
        }
        socialSigningInProvider = provider
        providerMessage = nil
        let sessionClient = SocialNativeSessionClient(
            apiClient: container.environment.apiClient,
            sessionStore: container.environment.sessionStore
        )
        let coordinator = SocialLoginCoordinator(
            provider: provider,
            baseURL: baseURL,
            readinessChecker: sessionClient,
            authenticator: SocialWebAuthenticator(),
            sessionExchanger: sessionClient
        )
        Task {
            await coordinator.signIn()
            socialSigningInProvider = nil
            switch coordinator.state {
            case .signedIn(_, let userName):
                providerMessage = "\(userName)님으로 로그인했습니다."
                container.completeLoginNavigation()
            case .cancelled(let provider):
                providerMessage = "\(provider.displayName) 인증을 취소했습니다.\n로그인 상태는 그대로입니다."
            case .failed(_, let message):
                providerMessage = message
            case .idle, .loading:
                break
            }
        }
    }

    private func logoutGoogleSession() {
        let identityProvider = GoogleSignInProvider()
        let client = GoogleNativeSessionClient(
            apiClient: container.environment.apiClient,
            sessionStore: container.environment.sessionStore
        )
        Task {
            do {
                try await client.logout()
                providerMessage = "로그아웃했습니다."
            } catch {
                providerMessage = "서버 연결을 확인할 수 없어 이 기기의 로그인 정보만 삭제했습니다."
            }
            identityProvider.signOut()
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

/// Brand hero art for the top of the login screen, matching the tone of the
/// home hero banner (dark gradient, wordmark, short tagline) without
/// depending on any specific event image.
private struct LoginHeroBanner: View {
    var body: some View {
        ZStack(alignment: .bottomLeading) {
            LinearGradient(
                colors: [TicketgroundColor.ink, TicketgroundColor.accent.opacity(0.82)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            VStack(alignment: .leading, spacing: TicketgroundSpacing.xs) {
                HStack(spacing: 2) {
                    Text("Ticketground")
                        .font(.title3.weight(.black))
                        .foregroundStyle(.white)
                    Circle()
                        .fill(.white)
                        .frame(width: 6, height: 6)
                }
                Text("공연을 발견하고, 예매하고, 안전하게 관리하세요.")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.88))
            }
            .padding(TicketgroundSpacing.lg)
        }
        .frame(maxWidth: .infinity)
        .frame(height: 132)
        .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.large))
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("login-hero-banner")
    }
}

/// Short trust-signal bullets beneath the social login buttons — fills the
/// login screen's previously empty lower half with reasons to sign in rather
/// than an onboarding carousel (out of scope per the improvement plan).
private struct LoginBenefitsCard: View {
    private let benefits: [(icon: String, title: String)] = [
        ("bolt.fill", "실시간 좌석 확보"),
        ("lock.shield.fill", "안전한 결제"),
        ("qrcode", "빠른 티켓 확인")
    ]

    var body: some View {
        TicketgroundSurface(tone: .muted) {
            VStack(alignment: .leading, spacing: TicketgroundSpacing.md) {
                ForEach(benefits, id: \.title) { benefit in
                    HStack(spacing: TicketgroundSpacing.md) {
                        Image(systemName: benefit.icon)
                            .font(.headline.weight(.bold))
                            .foregroundStyle(TicketgroundColor.accent)
                            .frame(width: 24)
                            .accessibilityHidden(true)
                        Text(benefit.title)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(TicketgroundColor.ink)
                        Spacer(minLength: 0)
                    }
                }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("login-benefits")
    }
}

/// URL derivation for the login footer's legal links, pulled out of
/// `LoginFooter` as a pure function so it's unit-testable without
/// instantiating a SwiftUI view.
///
/// The links are derived from the app's configured API host (`baseURL`)
/// rather than a hardcoded apex domain: `ticketground.co.kr` has no DNS
/// record (mail-only, MX record only) and was a dead link in every build
/// ("Safari can't open the page because the server can't be found"),
/// confirmed by tapping through the login screen and by `curl` (000 for
/// ticketground.co.kr and www., 200 for dev.ticketground.co.kr). Deriving
/// from `baseURL` keeps the link on whatever host the app is actually
/// configured against (e.g. dev.ticketground.co.kr in Debug), and falls
/// back to the previous hardcoded URL when no base URL is configured
/// (fixture/disabled live mode) to avoid changing behavior there.
enum LoginLegalLinks {
    static func termsURL(baseURL: URL?) -> URL {
        baseURL?.appendingPathComponent("terms") ?? URL(string: "https://ticketground.co.kr/terms")!
    }

    static func privacyURL(baseURL: URL?) -> URL {
        baseURL?.appendingPathComponent("privacy") ?? URL(string: "https://ticketground.co.kr/privacy")!
    }
}

/// Footer with legal links and the app version, anchoring the bottom of the
/// login screen.
private struct LoginFooter: View {
    let baseURL: URL?

    var body: some View {
        VStack(spacing: TicketgroundSpacing.sm) {
            HStack(spacing: TicketgroundSpacing.sm) {
                Link("이용약관", destination: LoginLegalLinks.termsURL(baseURL: baseURL))
                Text("·")
                    .foregroundStyle(TicketgroundColor.inkMuted)
                Link("개인정보처리방침", destination: LoginLegalLinks.privacyURL(baseURL: baseURL))
            }
            .font(.caption.weight(.semibold))
            .foregroundStyle(TicketgroundColor.inkMuted)
            .accessibilityIdentifier("login-footer-legal")

            Text("버전 \(Self.appVersionString)")
                .font(.caption2)
                .foregroundStyle(TicketgroundColor.inkMuted)
                .accessibilityIdentifier("login-footer-version")
        }
        .frame(maxWidth: .infinity)
        .padding(.top, TicketgroundSpacing.sm)
    }

    private static var appVersionString: String {
        let shortVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        let buildNumber = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "\(shortVersion) (\(buildNumber))"
    }
}

/// Fixture/demo-mode mypage tab. Distinct from `DiscoveryMenuView` (the
/// hamburger menu) — this is a focused login prompt, since fixture mode has
/// no live account to show account details for.
private struct DiscoveryMypageView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: TicketgroundSpacing.lg) {
                Text("마이페이지")
                    .font(.caption.weight(.black))
                    .foregroundStyle(TicketgroundColor.accent)
                    .accessibilityIdentifier("mypage-screen-title")

                VStack(alignment: .leading, spacing: TicketgroundSpacing.md) {
                    Image(systemName: "person.crop.circle")
                        .font(.system(size: 40))
                        .foregroundStyle(TicketgroundColor.accent)
                        .accessibilityHidden(true)
                    Text("로그인하면 마이페이지를 이용할 수 있어요")
                        .font(.title3.weight(.black))
                        .foregroundStyle(TicketgroundColor.ink)
                    Text("예매 내역, 관심공연 알림, 결제 수단을 마이페이지에서 한 번에 관리할 수 있습니다.")
                        .font(.body)
                        .foregroundStyle(TicketgroundColor.inkMuted)
                    NavigationLink(value: AppRoute.login) {
                        Text("로그인")
                            .font(.subheadline.weight(.bold))
                            .frame(maxWidth: .infinity, minHeight: 48)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(TicketgroundColor.accent)
                    .accessibilityIdentifier("mypage-login-cta")
                }
                .padding(TicketgroundSpacing.lg)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(TicketgroundColor.surfaceMuted)
                .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.medium))
            }
            .padding(TicketgroundSpacing.xl)
        }
        .navigationTitle("마이페이지")
        .navigationBarTitleDisplayMode(.inline)
    }
}

/// Fixture/demo-mode watchlist tab empty state — replaces the raw route id
/// placeholder with an icon + short explanation, consistent with the other
/// empty states in the app (`TicketgroundEmptySurface`).
private struct DiscoveryWatchlistEmptyView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: TicketgroundSpacing.lg) {
                Text("찜")
                    .font(.caption.weight(.black))
                    .foregroundStyle(TicketgroundColor.accent)
                    .accessibilityIdentifier("watchlist-screen-title")
                TicketgroundEmptySurface(
                    title: "관심공연이 없습니다",
                    message: "관심 공연을 찜하면 여기에 모아볼 수 있어요.",
                    actionTitle: nil,
                    action: nil,
                    icon: "heart"
                )
            }
            .padding(TicketgroundSpacing.xl)
        }
        .navigationTitle("찜")
        .navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("route-watchlist")
    }
}

/// Graceful fallback for fixture-mode routes without a wired-up destination
/// yet (e.g. the booking queue behind the home hero banner). Never displays
/// the raw internal route id — the identifier is kept for existing
/// navigation/connectivity tests, but only as an accessibility identifier,
/// never as on-screen text.
private struct DiscoveryComingSoonView: View {
    let route: AppRoute

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: TicketgroundSpacing.lg) {
                Text("준비 중")
                    .font(.caption.weight(.black))
                    .foregroundStyle(TicketgroundColor.accent)
                VStack(spacing: TicketgroundSpacing.sm) {
                    Image(systemName: "hourglass")
                        .font(.system(size: 36))
                        .foregroundStyle(TicketgroundColor.inkMuted)
                        .accessibilityHidden(true)
                    Text("아직 준비 중인 기능입니다")
                        .font(.title3.weight(.black))
                        .foregroundStyle(TicketgroundColor.ink)
                        .multilineTextAlignment(.center)
                        .accessibilityIdentifier("route-\(route.id)")
                    Text("빠른 시일 내에 이용하실 수 있도록 준비하고 있습니다.")
                        .font(.body)
                        .foregroundStyle(TicketgroundColor.inkMuted)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, TicketgroundSpacing.xl)
            }
            .padding(TicketgroundSpacing.xl)
        }
        .navigationTitle("준비 중")
        .navigationBarTitleDisplayMode(.inline)
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
                                // 로그인 제공자(Google/Kakao/Naver)와 무관하게 서버 세션부터
                                // 무효화한 뒤 로컬 자격증명을 지운다 — 기기 탈취·유출 시
                                // credential이 만료 전까지 계속 유효한 채로 남지 않도록 한다.
                                let sessionStore = container.environment.sessionStore
                                let apiClient = container.environment.apiClient
                                Task {
                                    try? await apiClient.revokeNativeSession(session)
                                    sessionStore.logout()
                                }
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
                    Link(destination: URL(string: "https://pf.kakao.com/_xmTniX/chat")!) {
                        menuRow(title: "카카오톡 채널 문의", icon: "bubble.left.and.bubble.right")
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("menu-kakao-channel")
                    Link(destination: URL(string: "https://pf.kakao.com/_xmTniX")!) {
                        menuRow(title: "카카오톡 채널 추가", icon: "person.crop.circle.badge.plus")
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("menu-kakao-channel-add")
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
        .accessibilityIdentifier("route-open")
    }
}

private struct DiscoveryPublicResaleView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: TicketgroundSpacing.lg) {
                Text("CLEAN TICKET POOL")
                    .font(.caption.weight(.black))
                    .foregroundStyle(TicketgroundColor.accent)
                Text("CLEAN 티켓 공식 양도")
                    .font(.title.weight(.black))
                    .foregroundStyle(TicketgroundColor.ink)
                Text("정가 범위와 구매 이력 검증을 통과한 티켓을 공식 풀에서 확인할 수 있습니다.")
                    .font(.body)
                    .foregroundStyle(TicketgroundColor.inkMuted)
                TicketgroundEmptySurface(
                    title: "공개 양도 티켓을 확인하는 화면입니다.",
                    message: "등록·취소 등 보유 티켓 변경은 로그인한 예매 내역에서만 진행됩니다.",
                    actionTitle: nil,
                    action: nil
                )
            }
            .padding(TicketgroundSpacing.xl)
        }
        .navigationTitle("공식 재판매")
        .navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("route-resale")
    }
}

private struct DiscoveryGenreDestinationView: View {
    let name: String
    let content: DiscoveryContent?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: TicketgroundSpacing.md) {
                Text("장르별 추천")
                    .font(.caption.weight(.black))
                    .foregroundStyle(TicketgroundColor.accent)
                Text(displayName)
                    .font(.title.weight(.black))
                    .foregroundStyle(TicketgroundColor.ink)
                if let rankings = content?.rankings, !rankings.isEmpty {
                    ForEach(rankings.prefix(10), id: \.rank) { ranking in
                        NavigationLink(value: ranking.route) {
                            VStack(alignment: .leading, spacing: TicketgroundSpacing.xs) {
                                Text(ranking.title)
                                    .font(.headline.weight(.black))
                                    .foregroundStyle(TicketgroundColor.ink)
                                Text("\(ranking.venue) · \(ranking.date)")
                                    .font(.caption)
                                    .foregroundStyle(TicketgroundColor.inkMuted)
                            }
                            .frame(maxWidth: .infinity, minHeight: 60, alignment: .leading)
                            .padding(TicketgroundSpacing.md)
                            .background(TicketgroundColor.surfaceMuted)
                            .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.medium))
                        }
                        .buttonStyle(.plain)
                    }
                } else {
                    TicketgroundEmptySurface(
                        title: "\(displayName) 공연을 준비 중입니다.",
                        message: "새로운 공연이 등록되면 이곳에 표시됩니다.",
                        actionTitle: nil,
                        action: nil
                    )
                }
            }
            .padding(TicketgroundSpacing.xl)
        }
        .navigationTitle(displayName)
        .navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("route-genre-\(name)")
    }

    private var displayName: String {
        switch name {
        case "concert": return "콘서트"
        case "musical": return "뮤지컬"
        case "play": return "연극"
        case "classic": return "클래식"
        case "exhibition": return "전시"
        case "child": return "아동"
        case "sports": return "스포츠"
        default: return name
        }
    }
}

private struct DiscoveryEditorialDestinationView: View {
    let slug: String

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: TicketgroundSpacing.lg) {
                Text("EDITORIAL")
                    .font(.caption.weight(.black))
                    .foregroundStyle(TicketgroundColor.accent)
                Text("Ticketground 기획전")
                    .font(.title.weight(.black))
                    .foregroundStyle(TicketgroundColor.ink)
                Text("지금 봐야 할 공연을 에디터가 엄선해 소개합니다.")
                    .font(.body)
                    .foregroundStyle(TicketgroundColor.inkMuted)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(TicketgroundSpacing.xl)
        }
        .navigationTitle("기획전")
        .navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("route-event-\(slug)")
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
        let exactMatches = catalog.events.filter { event in
            event.id == slug || event.slug == slug
        }
        guard exactMatches.isEmpty else { return exactMatches }
        return catalog.events.filter { normalizedSlug($0.title) == normalizedSlug(slug) }
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
        case .search, .ranking, .goods:
            catalogBody
        case .place(let slug):
            catalogBody
                .accessibilityIdentifier("route-venue-\(slug ?? "index")")
        case .genre(let name):
            catalogBody
                .accessibilityIdentifier("route-genre-\(name)")
        case .event(let slug):
            catalogBody
                .accessibilityIdentifier("route-event-\(slug)")
        case .seatMap, .queue, .booking:
            LiveSeatMapRouteView(route: route)
        case .watchlist:
            LiveWatchlistRouteView()
        case .help, .inquiry:
            LiveSupportRouteView(route: route)
        case .region, .artist:
            LiveDiscoveryContractView(route: route)
        case .open:
            LiveDiscoveryContractView(route: route)
                .accessibilityIdentifier("route-open")
        case .checkout(let ticketId):
            LiveCheckoutRouteView(ticketId: ticketId)
        case .reservation(let id):
            LiveTicketLifecycleRouteView(
                destination: RuntimeConfiguration.liveLifecycleTestConfiguration?.destination ?? .reservation(id: id)
            )
        case .cancel:
            LiveTicketLifecycleRouteView(destination: .cancellation)
        case .resale:
            if isLifecycleResaleRoute {
                LiveTicketLifecycleRouteView(destination: .resale)
            } else {
                DiscoveryPublicResaleView()
            }
        case .signup, .transfer:
            LiveUnsupportedRouteView(route: route)
        default:
            LiveUnsupportedRouteView(route: route)
        }
    }

    private var isLifecycleResaleRoute: Bool {
        if RuntimeConfiguration.liveLifecycleTestConfiguration != nil {
            return true
        }
        guard container.navigationPath.count >= 2 else { return false }
        switch container.navigationPath[container.navigationPath.count - 2] {
        case .reservation, .menu:
            return true
        default:
            return false
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
                        message: LiveDiscoveryCopy.catalogNotFound,
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
                        message: LiveDiscoveryCopy.catalogEmpty,
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
            let service = LiveBackendService(apiClient: container.environment.apiClient)
            _ = try await service.diagnosePublicContract()
            state = .loaded(try await service.getCatalog())
        } catch is CancellationError {
            return
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
                Text(LiveDiscoveryCopy.catalogUnavailableReason)
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
        case .seatMap, .queue, .booking: return "좌석 현황"
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
                    liveMenuLink(
                        title: "마이페이지",
                        icon: "person.crop.circle",
                        route: .mypage,
                        identifier: "live-menu-account"
                    )
                    liveMenuLink(title: "관심공연", icon: "heart", route: .watchlist, identifier: "live-menu-watchlist")
                }

                menuSection(title: "검색", detail: "공연을 빠르게 찾아보세요") {
                    liveMenuLink(title: "공연 검색", icon: "magnifyingglass", route: .search, identifier: "live-menu-search")
                    liveMenuLink(title: "실시간 예매 랭킹", icon: "chart.bar", route: .ranking, identifier: "live-menu-ranking")
                }

                menuSection(title: "공연 탐색", detail: "지역과 티켓오픈 일정으로 찾아보세요") {
                    liveMenuLink(title: "지역별 공연", icon: "mappin.and.ellipse", route: .region, identifier: "live-menu-region")
                    liveMenuLink(title: "티켓오픈 캘린더", icon: "calendar", route: .open, identifier: "live-menu-open-calendar")
                }

                menuSection(title: "티켓 서비스", detail: "예매한 티켓의 공식 양도를 관리하세요") {
                    liveMenuLink(title: "티켓 양도", icon: "arrow.left.arrow.right", route: .resale, identifier: "menu-resale")
                }

                menuSection(title: "카테고리", detail: "관심 있는 공연을 찾아보세요") {
                    ForEach(categories) { category in
                        liveMenuLink(title: category.title, icon: category.icon, route: category.route, identifier: category.id)
                    }
                }

                menuSection(title: "고객센터", detail: "도움이 필요할 때 이용하세요") {
                    liveMenuLink(title: "고객센터", icon: "questionmark.circle", route: .help, identifier: "live-menu-help")
                    liveMenuLink(title: "1:1 문의", icon: "bubble.left", route: .inquiry, identifier: "live-menu-inquiry")
                    Link(destination: URL(string: "https://pf.kakao.com/_xmTniX/chat")!) {
                        liveMenuRow(title: "카카오톡 채널 문의", icon: "bubble.left.and.bubble.right")
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("live-menu-kakao-channel")
                    Link(destination: URL(string: "https://pf.kakao.com/_xmTniX")!) {
                        liveMenuRow(title: "카카오톡 채널 추가", icon: "person.crop.circle.badge.plus")
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("live-menu-kakao-channel-add")
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
                    title: "공개 탐색",
                    detail: "지역·아티스트·티켓오픈 캘린더는 버전 1 공개 Discovery 계약을 별도로 확인한 뒤 표시합니다.",
                    icon: "checkmark.circle",
                    identifier: "capability-ledger-discovery"
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
            posterHeader
            infoCard
            if let prices = event.prices, !prices.isEmpty {
                priceCard(prices)
            }
            if let summary = event.summary, !summary.isEmpty {
                noteCard(title: "공연 소개", body: summary)
            }

            LiveWatchlistCTA(event: event)

            NavigationLink(value: AppRoute.seatMap(slug: event.slug ?? event.id)) {
                Label("좌석 현황 조회", systemImage: "square.grid.2x2")
                    .font(.headline.weight(.bold))
                    .frame(maxWidth: .infinity, minHeight: 48)
            }
            .buttonStyle(.borderedProminent)
            .tint(TicketgroundColor.accent)
            .accessibilityIdentifier("live-seat-map-link")

            if let artistSlug = event.artistSlug {
                NavigationLink(value: AppRoute.artist(slug: artistSlug)) {
                    Label("아티스트 공연 보기", systemImage: "music.mic")
                        .font(.headline.weight(.bold))
                        .frame(maxWidth: .infinity, minHeight: 48)
                }
                .buttonStyle(.bordered)
                .tint(TicketgroundColor.accent)
                .accessibilityIdentifier("live-artist-link")
            }
        }
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                ShareLink(
                    item: PublicShareURL.event(slug: event.slug ?? event.id),
                    subject: Text(event.title),
                    message: Text(event.title)
                ) {
                    Image(systemName: "square.and.arrow.up")
                }
                .accessibilityIdentifier("live-share-event")
                .accessibilityLabel("공연 공유")
            }
        }
    }

    @ViewBuilder
    private var posterHeader: some View {
        ZStack(alignment: .topLeading) {
            TicketgroundMediaImage(
                resource: container.environment.apiClient.resolveResource(event.image),
                role: .poster,
                accessibilityLabel: "\(event.title) 포스터",
                accessibilitySuffix: "live-detail"
            )
            .frame(maxWidth: .infinity)
            .frame(height: 320)
            .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.large))

            if let badge = event.badge, !badge.isEmpty {
                Text(badge)
                    .font(.caption.weight(.black))
                    .foregroundStyle(.white)
                    .padding(.horizontal, TicketgroundSpacing.md)
                    .frame(minHeight: 28)
                    .background(TicketgroundColor.accent)
                    .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.small))
                    .padding(TicketgroundSpacing.md)
            }
        }
    }

    private var infoCard: some View {
        VStack(alignment: .leading, spacing: TicketgroundSpacing.sm) {
            Text(event.title)
                .font(.title.weight(.black))
                .foregroundStyle(TicketgroundColor.ink)
                .accessibilityIdentifier("live-catalog-event")

            let venueRoute = event.venueID ?? event.venue
            NavigationLink(value: AppRoute.place(slug: venueRoute)) {
                    Label(event.venue, systemImage: "building.columns")
                        .font(.headline)
                        .foregroundStyle(TicketgroundColor.inkSecondary)
            }
            .accessibilityIdentifier("discovery-venue-\(venueRoute)")

            Label(event.period ?? event.date ?? "일정 미정", systemImage: "calendar")
                .font(.subheadline)
                .foregroundStyle(TicketgroundColor.inkMuted)

            if let runtime = event.runtime, !runtime.isEmpty {
                Label(runtime, systemImage: "clock")
                    .font(.subheadline)
                    .foregroundStyle(TicketgroundColor.inkMuted)
            }

            if let ageLimit = event.ageLimit, !ageLimit.isEmpty {
                Label(ageLimit, systemImage: "person.badge.shield.checkmark")
                    .font(.subheadline)
                    .foregroundStyle(TicketgroundColor.inkMuted)
            }

            Rectangle()
                .fill(TicketgroundColor.line)
                .frame(height: 1)
                .padding(.vertical, TicketgroundSpacing.xs)

            HStack(alignment: .center, spacing: TicketgroundSpacing.sm) {
                if let sale = event.sale {
                    LiveSaleStatusPill(sale: sale)
                }
                Spacer(minLength: TicketgroundSpacing.sm)
                Text("판매 집계 \(event.soldCount)건")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(TicketgroundColor.inkMuted)
            }

            if let note = event.sale?.note, !note.isEmpty {
                Text(note)
                    .font(.caption)
                    .foregroundStyle(TicketgroundColor.inkMuted)
            }
        }
        .padding(TicketgroundSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(TicketgroundColor.surface)
        .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.medium))
        .overlay {
            RoundedRectangle(cornerRadius: TicketgroundRadius.medium)
                .stroke(TicketgroundColor.line, lineWidth: 1)
        }
    }

    private func priceCard(_ prices: [LiveCatalogPrice]) -> some View {
        VStack(alignment: .leading, spacing: TicketgroundSpacing.sm) {
            Text("가격 안내")
                .font(.headline.weight(.black))
                .foregroundStyle(TicketgroundColor.ink)
            ForEach(Array(prices.enumerated()), id: \.offset) { _, price in
                HStack {
                    Text(price.grade ?? price.seat ?? "등급 정보 없음")
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(TicketgroundColor.inkSecondary)
                    Spacer(minLength: TicketgroundSpacing.sm)
                    if let priceValue = price.price {
                        Text("\(priceValue.formatted())원")
                            .font(.subheadline.weight(.black))
                            .foregroundStyle(TicketgroundColor.ink)
                    }
                }
            }
        }
        .padding(TicketgroundSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(TicketgroundColor.surfaceMuted)
        .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.medium))
    }

    private func noteCard(title: String, body: String) -> some View {
        VStack(alignment: .leading, spacing: TicketgroundSpacing.sm) {
            Text(title)
                .font(.headline.weight(.black))
                .foregroundStyle(TicketgroundColor.ink)
            Text(body)
                .font(.body)
                .foregroundStyle(TicketgroundColor.inkSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(TicketgroundSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(TicketgroundColor.surfaceMuted)
        .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.medium))
    }
}

private struct LiveCatalogEventRow: View {
    let event: LiveBackendCatalogEvent
    @Environment(AppContainer.self) private var container

    var body: some View {
        NavigationLink(value: AppRoute.event(slug: event.slug ?? event.id)) {
            HStack(alignment: .top, spacing: TicketgroundSpacing.md) {
                TicketgroundMediaImage(
                    resource: container.environment.apiClient.resolveResource(event.image),
                    role: .poster,
                    accessibilityLabel: "\(event.title) 포스터"
                )
                .frame(width: 92, height: 124)
                .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.medium))

                VStack(alignment: .leading, spacing: TicketgroundSpacing.xs) {
                    if let category = event.category, !category.isEmpty {
                        Text(liveCatalogDisplayGenre(category))
                            .font(.caption2.weight(.black))
                            .foregroundStyle(TicketgroundColor.accent)
                    }
                    Text(event.title)
                        .font(.headline.weight(.bold))
                        .foregroundStyle(TicketgroundColor.ink)
                        .lineLimit(2)
                        .accessibilityIdentifier("live-catalog-event")
                    Text(event.venue)
                        .font(.subheadline)
                        .foregroundStyle(TicketgroundColor.inkSecondary)
                        .lineLimit(1)
                    Text(event.period ?? event.date ?? "일정 미정")
                        .font(.caption)
                        .foregroundStyle(TicketgroundColor.inkMuted)
                    Spacer(minLength: TicketgroundSpacing.xs)
                    HStack(spacing: TicketgroundSpacing.sm) {
                        if let sale = event.sale {
                            LiveSaleStatusPill(sale: sale, compact: true)
                        }
                        if let lowestPrice = (event.prices ?? []).compactMap(\.price).min() {
                            Text("\(lowestPrice.formatted())원~")
                                .font(.caption.weight(.bold))
                                .foregroundStyle(TicketgroundColor.ink)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(TicketgroundSpacing.md)
            .background(TicketgroundColor.surface)
            .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.medium))
            .overlay {
                RoundedRectangle(cornerRadius: TicketgroundRadius.medium)
                    .stroke(TicketgroundColor.line, lineWidth: 1)
            }
            .shadow(color: .black.opacity(0.05), radius: 8, y: 3)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("live-catalog-event-link-\(event.id)")
    }
}

private struct LiveSaleStatusPill: View {
    let sale: LiveCatalogSale
    var compact: Bool = false

    var body: some View {
        let bookable = sale.state == "ON_SALE"
        Text(sale.label ?? "판매 정보 확인 중")
            .font(compact ? .caption2.weight(.black) : .caption.weight(.black))
            .foregroundStyle(.white)
            .padding(.horizontal, compact ? TicketgroundSpacing.sm : TicketgroundSpacing.md)
            .frame(minHeight: compact ? 20 : 26)
            .background(bookable ? TicketgroundColor.success : TicketgroundColor.inkMuted)
            .clipShape(Capsule())
    }
}

private func liveCatalogDisplayGenre(_ category: String) -> String {
    switch category.lowercased() {
    case "concert": return "콘서트"
    case "musical": return "뮤지컬"
    case "play", "theater": return "연극"
    case "classic": return "클래식"
    case "exhibition": return "전시"
    case "child", "children", "family": return "아동"
    case "sports": return "스포츠"
    case "event": return "행사"
    default: return category
    }
}

enum LiveSeatMapFailurePresentation: Equatable {
    case unavailable
    case retry(PublicReadPresentation)

    static func resolve(_ error: Error) -> LiveSeatMapFailurePresentation {
        guard let apiError = error as? APIClientError else {
            return .retry(PublicReadPresentation.resolve(error))
        }
        switch apiError {
        case .capabilityUnavailable(endpoint: .seatMap, state: _):
            return .unavailable
        case .server(let status, _, _) where [404, 405, 501].contains(status):
            return .unavailable
        default:
            return .retry(PublicReadPresentation.resolve(apiError))
        }
    }
}

private enum LiveSeatMapRouteState {
    case loading
    case loaded(LiveSeatMap, performanceDateID: String)
    case unavailable
    case failed(PublicReadPresentation)
}

private struct LiveSeatMapRouteView: View {
    let route: AppRoute
    @Environment(AppContainer.self) private var container
    @State private var catalogState: LiveCatalogRouteState = .loading
    @State private var seatMapState: LiveSeatMapRouteState = .loading
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
                switch seatMapState {
                case .loading:
                    TicketgroundLoadingSurface(title: "좌석 현황 불러오는 중")
                        .accessibilityIdentifier("live-seat-map-loading")
                case .unavailable:
                    LiveSeatMapUnavailableView()
                case .failed(let presentation):
                    TicketgroundErrorSurface(
                        title: presentation.title,
                        message: presentation.message,
                        actionTitle: "다시 시도",
                        action: retry
                    )
                    .accessibilityIdentifier("live-seat-map-error")
                case .loaded(let seatMap, let performanceDateID):
                    LiveSeatMapContent(seatMap: seatMap, performanceDateID: performanceDateID)
                }
            }
            .padding(TicketgroundSpacing.xl)
        }
        .accessibilityIdentifier("live-seat-map")
    }

    private func event(in catalog: LiveCatalog) -> LiveBackendCatalogEvent? {
        guard let slug = routeSlug else { return nil }
        return LiveCatalogRouteMatcher.detailEvents(slug: slug, in: catalog).first
    }

    private func loadSeatMap() async {
        guard case .loading = catalogState else { return }
        do {
            let service = LiveBackendService(apiClient: container.environment.apiClient)
            _ = try await service.diagnosePublicContract()
            let catalog = try await service.getCatalog()
            guard !Task.isCancelled else { return }
            catalogState = .loaded(catalog)
            guard let event = event(in: catalog) else {
                seatMapState = .unavailable
                return
            }
            guard let performanceDateID = (event.dates ?? event.schedules)?.first?.id else {
                seatMapState = .unavailable
                return
            }
            _ = try await service.diagnoseSeatMap(
                eventID: event.id,
                performanceDateID: performanceDateID
            )
            let seatMap = try await service.getSeatMap(
                eventID: event.id,
                performanceDateID: performanceDateID
            )
            guard !Task.isCancelled else { return }
            seatMapState = .loaded(seatMap, performanceDateID: performanceDateID)
        } catch is CancellationError {
            return
        } catch {
            if case .loaded = catalogState {
                switch LiveSeatMapFailurePresentation.resolve(error) {
                case .unavailable:
                    seatMapState = .unavailable
                case .retry(let presentation):
                    seatMapState = .failed(presentation)
                }
            } else if error as? APIClientError == .capabilityUnavailable(endpoint: .catalog, state: .unknown) {
                catalogState = .unavailable
            } else {
                catalogState = .failed(PublicReadPresentation.resolve(error))
            }
        }
    }

    private func retry() {
        catalogState = .loading
        seatMapState = .loading
        reloadID += 1
    }

    private var routeSlug: String? {
        switch route {
        case .seatMap(let slug), .queue(let slug), .booking(let slug): return slug
        default: return nil
        }
    }

}

private struct LiveSeatMapUnavailableView: View {
    @Environment(AppContainer.self) private var container

    var body: some View {
        TicketgroundSurface {
            VStack(alignment: .leading, spacing: TicketgroundSpacing.md) {
                Label("좌석 현황을 제공하지 않습니다", systemImage: "square.grid.3x3")
                    .font(.headline.weight(.black))
                Text("이 공연의 공개 좌석 조회 계약이 확인되지 않았습니다.")
                    .font(.body)
                    .foregroundStyle(TicketgroundColor.inkSecondary)

                Button("홈으로") {
                    container.navigationPath.removeAll()
                }
                .buttonStyle(.bordered)
                .accessibilityIdentifier("live-seat-map-unavailable-home")

                NavigationLink(value: AppRoute.capabilityLedger) {
                    Label("서비스 연결 현황 확인", systemImage: "checklist")
                }
                .buttonStyle(.borderedProminent)
                .tint(TicketgroundColor.accent)
                .accessibilityIdentifier("live-seat-map-unavailable-capability-ledger")
            }
        }
        .accessibilityIdentifier("live-seat-map-unavailable")
    }
}

private struct LiveSeatMapContent: View {
    let seatMap: LiveSeatMap
    let performanceDateID: String

    var body: some View {
        LiveSeatBookingView(seatMap: seatMap, performanceDateID: performanceDateID)
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

@Observable
private final class CheckoutViewModel: NSObject, TossPaymentsDelegate {
    var successResult: TossPaymentsResult.Success?
    var failResult: TossPaymentsResult.Fail?

    func handleSuccessResult(_ success: TossPaymentsResult.Success) {
        successResult = success
    }

    func handleFailResult(_ fail: TossPaymentsResult.Fail) {
        failResult = fail
    }
}

private enum LiveCheckoutLoadState: Equatable {
    case loading
    case ready(ticket: LiveTicket, config: TosspaymentsConfig)
    case notConfigured
    case failed(String)
}

private struct LiveCheckoutRouteView: View {
    let ticketId: String
    @Environment(AppContainer.self) private var container
    @State private var gate: LiveAccountCapabilityState = .loginRequired
    @State private var loadState: LiveCheckoutLoadState = .loading
    @State private var widget: PaymentWidget?
    @State private var model = CheckoutViewModel()
    @State private var submitting = false
    @State private var purchaseError: String?
    @State private var purchasedTicket: TosspaymentsPurchaseResult.Ticket?
    @State private var purchaseSuccessFeedback = 0
    @State private var purchaseErrorFeedback = 0

    var body: some View {
        Group {
            if case .available(let userID) = gate {
                content(userID: userID)
            } else {
                LiveAccountCapabilitySurface(
                    state: gate,
                    title: "결제하기",
                    loginMessage: "결제는 로그인 후 진행할 수 있습니다.",
                    identifier: "live-checkout",
                    retry: { resolveGate() }
                )
            }
        }
        .navigationTitle("결제하기")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: container.environment.sessionStore.current?.userID ?? "") {
            resolveGate()
        }
        .onChange(of: model.successResult) { _, result in
            guard let result else { return }
            Task { await confirmPurchase(tossPaymentKey: result.paymentKey) }
        }
        .onChange(of: model.failResult) { _, result in
            guard let result else { return }
            purchaseError = result.errorMessage
            purchaseErrorFeedback += 1
        }
        .sensoryFeedback(.success, trigger: purchaseSuccessFeedback)
        .sensoryFeedback(.error, trigger: purchaseErrorFeedback)
    }

    private func resolveGate() {
        let baseURL = container.environment.apiClient.baseURL
        if let baseURL, baseURL.scheme?.lowercased() != "https" {
            gate = .httpsRequired
            return
        }
        guard let session = container.environment.sessionStore.current,
              !session.userID.isEmpty,
              let credential = session.credential,
              !credential.isEmpty else {
            gate = .loginRequired
            return
        }
        gate = .available(userID: session.userID)
        Task { await load() }
    }

    @ViewBuilder
    private func content(userID: String) -> some View {
        if let purchasedTicket {
            successView(ticket: purchasedTicket)
        } else {
            ScrollView {
                VStack(alignment: .leading, spacing: TicketgroundSpacing.lg) {
                    Text("결제 · LIVE")
                        .font(.caption.weight(.black))
                        .foregroundStyle(TicketgroundColor.accent)
                        .accessibilityIdentifier("live-checkout")
                    loadStateBody(userID: userID)
                }
                .padding(TicketgroundSpacing.xl)
            }
        }
    }

    @ViewBuilder
    private func loadStateBody(userID: String) -> some View {
        switch loadState {
        case .loading:
            TicketgroundLoadingSurface(title: "결제 준비 중", identifier: "live-checkout-loading")
        case .notConfigured:
            TicketgroundErrorSurface(title: "결제하기", message: "토스페이먼츠가 아직 설정되어 있지 않습니다.", actionTitle: "다시 시도", action: { Task { await load() } })
                .accessibilityIdentifier("live-checkout-not-configured")
        case .failed(let message):
            TicketgroundErrorSurface(title: "결제하기", message: message, actionTitle: "다시 시도", action: { Task { await load() } })
                .accessibilityIdentifier("live-checkout-error")
        case .ready(let ticket, let config):
            readyBody(userID: userID, ticket: ticket, config: config)
        }
    }

    @ViewBuilder
    private func readyBody(userID: String, ticket: LiveTicket, config: TosspaymentsConfig) -> some View {
        if let widget {
            VStack(alignment: .leading, spacing: TicketgroundSpacing.md) {
                Text("좌석 \(ticket.seatLabel) · \(ticket.faceValue)원")
                    .font(.subheadline.weight(.bold))
                    .accessibilityIdentifier("live-checkout-amount")
                PaymentMethodWidgetView(widget: widget, amount: PaymentMethodWidget.Amount(value: Double(ticket.faceValue)))
                    .accessibilityIdentifier("live-checkout-payment-method")
                AgreementWidgetView(widget: widget)
                    .accessibilityIdentifier("live-checkout-agreement")
                if let purchaseError {
                    Text(purchaseError)
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .accessibilityIdentifier("live-checkout-failure")
                }
                Button(submitting ? "결제 처리 중" : "결제하기") {
                    requestPayment(ticket: ticket)
                }
                .buttonStyle(.borderedProminent)
                .tint(TicketgroundColor.accent)
                .disabled(submitting)
                .frame(maxWidth: .infinity, minHeight: 46)
                .accessibilityIdentifier("live-checkout-pay")
            }
        } else {
            TicketgroundLoadingSurface(title: "결제 위젯 불러오는 중", identifier: "live-checkout-widget-loading")
        }
    }

    private func successView(ticket: TosspaymentsPurchaseResult.Ticket) -> some View {
        VStack(alignment: .leading, spacing: TicketgroundSpacing.md) {
            Text("결제 완료")
                .font(.headline.weight(.black))
                .accessibilityIdentifier("live-checkout-success")
            Text("좌석 \(ticket.seatLabel)의 결제가 완료되었습니다.")
                .font(.body)
                .foregroundStyle(TicketgroundColor.inkSecondary)
            VStack(spacing: TicketgroundSpacing.sm) {
                Button {
                    container.navigationPath.append(.reservation(id: ticket.id))
                } label: {
                    Text("티켓 확인하기")
                        .frame(maxWidth: .infinity, minHeight: TicketgroundLayout.primaryActionMinimumHeight)
                }
                .buttonStyle(.borderedProminent)
                .tint(TicketgroundColor.accent)
                .accessibilityIdentifier("live-checkout-success-view-ticket")
                Button {
                    // Replacing the whole path (rather than popping) matches
                    // the pattern already used to return to 마이페이지 from the
                    // ticket-lifecycle flow (see LiveTicketLifecycleView) -
                    // it discards the checkout/seat-map stack entirely and
                    // constructs a fresh `LiveAccountRouteView`, so its ticket
                    // list `.task` reliably re-fetches instead of reusing a
                    // preserved instance that may still hold pre-purchase data.
                    container.navigationPath = [.mypage]
                } label: {
                    Text("마이페이지로 이동")
                        .frame(maxWidth: .infinity, minHeight: TicketgroundLayout.primaryActionMinimumHeight)
                }
                .buttonStyle(.bordered)
                .accessibilityIdentifier("live-checkout-success-go-mypage")
            }
            .padding(.top, TicketgroundSpacing.sm)
        }
        .padding(TicketgroundSpacing.xl)
    }

    private func load() async {
        loadState = .loading
        widget = nil
        let client = TosspaymentsClient(apiClient: container.environment.apiClient, sessionStore: container.environment.sessionStore)
        do {
            async let ticketTask = client.fetchTicket(ticketID: ticketId)
            async let configTask = client.fetchConfig()
            let (ticket, config) = try await (ticketTask, configTask)
            guard config.configured else {
                loadState = .notConfigured
                return
            }
            loadState = .ready(ticket: ticket, config: config)
            let createdWidget = PaymentWidget(clientKey: config.clientKey, customerKey: tossCustomerKey())
            createdWidget.delegate = model
            widget = createdWidget
        } catch {
            loadState = .failed((error as? LocalizedError)?.errorDescription ?? "결제 정보를 불러오지 못했습니다.")
        }
    }

    private func requestPayment(ticket: LiveTicket) {
        guard let widget else { return }
        purchaseError = nil
        submitting = true
        widget.requestPayment(info: DefaultWidgetPaymentInfo(orderId: ticket.id, orderName: ticket.seatLabel))
    }

    private func confirmPurchase(tossPaymentKey: String) async {
        let client = TosspaymentsClient(apiClient: container.environment.apiClient, sessionStore: container.environment.sessionStore)
        do {
            let result = try await client.confirmPurchase(
                ticketID: ticketId,
                paymentMethod: "CREDIT_CARD",
                tossPaymentKey: tossPaymentKey,
                idempotencyKey: tossPaymentKey
            )
            submitting = false
            purchasedTicket = result.ticket
            purchaseSuccessFeedback += 1
        } catch {
            submitting = false
            purchaseError = (error as? LocalizedError)?.errorDescription ?? "결제 승인 처리에 실패했습니다."
            purchaseErrorFeedback += 1
        }
    }
}

// TossPayments requires an unpredictable customerKey (never the raw account
// userID) - a random id generated once per install and reused after that.
private func tossCustomerKey() -> String {
    let key = "ticketground.tosspayments.customerKey"
    if let existing = UserDefaults.standard.string(forKey: key) {
        return existing
    }
    let generated = UUID().uuidString
    UserDefaults.standard.set(generated, forKey: key)
    return generated
}

private struct LiveAccountRouteView: View {
    @Environment(AppContainer.self) private var container
    @State private var state: LiveAccountState = .loading
    @State private var reloadID = 0
    @State private var profileName = ""
    @State private var isSavingProfile = false
    @State private var profileSaveError: String?
    @State private var admittedAccountCapabilityMap: LiveCapabilityMap?
    @State private var showPushSoftAsk = false
    @State private var isLoggingOut = false

    var body: some View {
        Group {
            if case .loading = state {
                TicketgroundLoadingSurface(title: "계정 불러오는 중", identifier: "live-account-loading")
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
            } else {
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
                            Link(destination: URL(string: "https://pf.kakao.com/_xmTniX/chat")!) {
                                Label("카카오톡 채널 1:1 문의", systemImage: "bubble.left.and.bubble.right")
                                    .frame(maxWidth: .infinity, minHeight: 46)
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(Color(red: 254 / 255, green: 229 / 255, blue: 0))
                            .foregroundStyle(Color.black)
                            .accessibilityIdentifier("live-mypage-kakao-channel")
                            Link(destination: URL(string: "https://pf.kakao.com/_xmTniX")!) {
                                Label("카카오톡 채널 추가", systemImage: "person.crop.circle.badge.plus")
                                    .frame(maxWidth: .infinity, minHeight: 46)
                            }
                            .buttonStyle(.bordered)
                            .accessibilityIdentifier("live-mypage-kakao-channel-add")
                            if case .loaded = state {
                                Button(role: .destructive) {
                                    Task { await logout() }
                                } label: {
                                    Text(isLoggingOut ? "로그아웃 처리 중" : "로그아웃")
                                        .frame(maxWidth: .infinity, minHeight: 46)
                                }
                                .buttonStyle(.bordered)
                                .disabled(isLoggingOut)
                                .accessibilityIdentifier("live-mypage-logout")
                            }
                        }
                    }
                    .padding(TicketgroundSpacing.xl)
                }
            }
        }
        .navigationTitle("마이페이지")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showPushSoftAsk) {
            PushSoftAskSheet(
                onRequestPermission: {
                    showPushSoftAsk = false
                    Task { try? await PushRegistrationCoordinator.shared.requestToken() }
                },
                onDismiss: { showPushSoftAsk = false }
            )
        }
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
                admittedAccountCapabilityMap = probe.capabilities
                async let profile = service.getSession(userID: userID)
                async let tickets = service.getTickets(userID: userID)
                let loadedProfile = try await profile
                let loadedTickets = try await tickets
                profileName = loadedProfile.name
                state = .loaded(loadedProfile, loadedTickets)

                // Best-effort app icon badge: reflects tickets the user
                // currently owns (an "upcoming ticket" signal already
                // fetched for this screen), not a fabricated number. There
                // is no push-driven update path yet, so this only refreshes
                // when My Page is (re)loaded - see `TicketGroundApp.swift`
                // for the launch/foreground badge clear that keeps a stale
                // count from lingering otherwise.
                let activeTicketCount = loadedTickets.filter { $0.status == "OWNED" }.count
                try? await UNUserNotificationCenter.current().setBadgeCount(activeTicketCount)

                await presentPushSoftAskIfNeeded()
            } catch let error as APIClientError {
                let resolvedState = LiveAccountCapabilityState.resolve(
                    for: .account,
                    capabilityMap: capabilityMap,
                    session: container.environment.sessionStore.current,
                    baseURL: apiClient.baseURL,
                    requestError: error
                )
                if resolvedState == .loginRequired {
                    container.environment.sessionStore.logout()
                }
                state = .capability(resolvedState)
            } catch {
                state = .capability(.retry)
            }
        }
    }

    /// Shows the push soft-ask sheet the first time an authenticated user
    /// reaches My Page, but only if: it has never been shown before (see
    /// `PushSoftAskStorage`), the system permission is still undetermined
    /// (no point re-asking if it was already granted/denied elsewhere,
    /// e.g. the manual button on the push-notifications lifecycle screen),
    /// and this isn't a UI test run (deterministic, no OS permission
    /// dialogs to fight with in CI).
    @MainActor
    private func presentPushSoftAskIfNeeded() async {
        guard !PushSoftAskStorage.hasBeenPresented,
              !ProcessInfo.processInfo.arguments.contains("-ui-testing") else { return }
        PushSoftAskStorage.hasBeenPresented = true
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        guard settings.authorizationStatus == .notDetermined else { return }
        showPushSoftAsk = true
    }

    @ViewBuilder
    private var accountBody: some View {
        switch state {
        case .loading:
            TicketgroundLoadingSurface(title: "계정 불러오는 중", identifier: "live-account-loading")
        case .capability(let capability):
            LiveAccountCapabilitySurface(
                state: capability,
                title: "계정 정보를 표시할 수 없습니다",
                loginMessage: "마이페이지를 보려면 로그인이 필요합니다.",
                identifier: "live-account",
                retry: { reloadID += 1 }
            )
        case .loaded(let session, let tickets):
            VStack(alignment: .leading, spacing: TicketgroundSpacing.sm) {
                TextField("닉네임", text: $profileName)
                    .textFieldStyle(.roundedBorder)
                    .textInputAutocapitalization(.never)
                    .accessibilityIdentifier("live-account-profile-name")
                Button {
                    Task { await saveProfile(tickets: tickets) }
                } label: {
                    Text(isSavingProfile ? "저장 중" : "프로필 저장")
                        .frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(.borderedProminent)
                .disabled(isSavingProfile || profileName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                .accessibilityIdentifier("live-account-profile-save")
                if let profileSaveError {
                    Text(profileSaveError)
                        .font(.caption)
                        .foregroundStyle(.red)
                        .accessibilityIdentifier("live-account-profile-error")
                }
                Text(LiveAccountDisplay.statusText(for: session))
                    .font(.subheadline)
                    .foregroundStyle(TicketgroundColor.inkMuted)
                Text("보유 티켓 \(tickets.count)장 · 신뢰 점수 \(session.trustScore)")
                    .font(.subheadline.weight(.semibold))
                if tickets.isEmpty {
                    Text("예매내역이 없습니다.")
                        .font(.subheadline)
                        .foregroundStyle(TicketgroundColor.inkMuted)
                        .accessibilityIdentifier("live-account-empty-tickets")
                } else {
                    ForEach(tickets, id: \.id) { ticket in
                        NavigationLink(value: AppRoute.reservation(id: ticket.id)) {
                            VStack(alignment: .leading, spacing: TicketgroundSpacing.xs) {
                                Text(ticket.event?.title ?? "예매 티켓")
                                    .font(.headline)
                                Text("\(ticket.seatLabel) · \(ticket.status)")
                                    .font(.subheadline)
                                    .foregroundStyle(TicketgroundColor.inkMuted)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .accessibilityIdentifier("live-account-ticket-\(ticket.id)")
                    }
                }
            }
            .padding(TicketgroundSpacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(TicketgroundColor.surfaceMuted)
            .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.medium))
            .accessibilityIdentifier("live-account-data")
        }
    }

    // Signs the current user out from My Page directly, regardless of which
    // provider (Google/Kakao/Naver) they originally signed in with -
    // `GoogleNativeSessionClient.logout()` is not actually Google-specific
    // despite its name: it revokes whatever `NativeSession` is currently
    // stored via the shared `/api/auth/native/logout` endpoint and always
    // clears the local session afterward (even if the server revoke call
    // fails), matching the same fail-closed-locally behavior already used
    // by the login screen's session card. Previously the only way to log
    // out was to navigate to the Login screen and notice the "로그아웃"
    // button buried inside its "로그인 완료" card - not discoverable from
    // My Page or the full menu, which is where a user would expect it.
    @MainActor
    private func logout() async {
        guard !isLoggingOut else { return }
        isLoggingOut = true
        defer { isLoggingOut = false }
        let client = GoogleNativeSessionClient(
            apiClient: container.environment.apiClient,
            sessionStore: container.environment.sessionStore
        )
        try? await client.logout()
        GoogleSignInProvider().signOut()
        state = .capability(.loginRequired)
    }

    @MainActor
    private func saveProfile(tickets: [LiveTicket]) async {
        guard let userID = container.environment.sessionStore.current?.userID else {
            state = .capability(.loginRequired)
            return
        }
        isSavingProfile = true
        profileSaveError = nil
        defer { isSavingProfile = false }
        do {
            guard let admittedAccountCapabilityMap else {
                profileSaveError = "기능 상태를 다시 확인해 주세요."
                return
            }
            let service = LiveBackendService(
                apiClient: container.environment.apiClient,
                initialCapabilityMap: admittedAccountCapabilityMap
            )
            let updated = try await service.updateProfile(userID: userID, name: profileName)
            profileName = updated.name
            state = .loaded(updated, tickets)
        } catch let error as APIClientError {
            if case .server(status: 401, _, _) = error {
                container.environment.sessionStore.logout()
                state = .capability(.loginRequired)
            } else {
                profileSaveError = error.localizedDescription
            }
        } catch {
            profileSaveError = "프로필을 저장하지 못했습니다. 다시 시도해 주세요."
        }
    }

}

private struct LiveTicketDetailView: View {
    let ticket: LiveTicket

    var body: some View {
        List {
            LabeledContent("공연", value: ticket.event?.title ?? ticket.eventId)
            LabeledContent("공연장", value: ticket.event?.venue ?? "확인 중")
            LabeledContent("공연 회차", value: ticket.event?.performance?.label ?? "확인 중")
            LabeledContent("공연 일시", value: ticket.event?.performance?.startsAt ?? "확인 중")
            LabeledContent("좌석", value: ticket.seatLabel)
            LabeledContent("티켓 상태", value: ticket.status)
            LabeledContent("결제 상태", value: ticket.payment?.status ?? "확인 중")
            LabeledContent("결제 수단", value: ticket.payment?.method ?? "확인 중")
            LabeledContent("결제 금액", value: ticket.payment?.amount.formatted(.currency(code: "KRW")) ?? "확인 중")
        }
        .navigationTitle("예매 상세")
        .navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("live-ticket-detail")
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

private struct LiveWatchlistCTA: View {
    let event: LiveBackendCatalogEvent
    @Environment(AppContainer.self) private var container
    @State private var capability: LiveAccountCapabilityState?
    @State private var admittedCapabilityMap: LiveCapabilityMap?
    @State private var isWatched = false
    @State private var isLoading = true
    @State private var isMutating = false
    @State private var errorMessage: String?
    @State private var reloadID = 0
    @State private var toggleFeedbackTrigger = 0

    var body: some View {
        Group {
            if isLoading {
                ProgressView("관심공연 상태 확인 중")
                    .frame(maxWidth: .infinity, minHeight: 48)
                    .accessibilityIdentifier("live-watchlist-cta-loading")
            } else if let capability {
                LiveAccountCapabilitySurface(
                    state: capability,
                    title: "관심공연을 변경할 수 없습니다",
                    loginMessage: "로그인하면 이 공연을 관심공연에 저장할 수 있습니다.",
                    identifier: "live-watchlist-cta",
                    retry: { reloadID += 1 }
                )
            } else {
                VStack(alignment: .leading, spacing: TicketgroundSpacing.xs) {
                    Button {
                        Task { await toggleWatchlist() }
                    } label: {
                        Label(isWatched ? "관심공연 해제" : "관심공연 추가", systemImage: isWatched ? "heart.fill" : "heart")
                            .font(.headline.weight(.bold))
                            .frame(maxWidth: .infinity, minHeight: 48)
                    }
                    .buttonStyle(.bordered)
                    .tint(TicketgroundColor.accent)
                    .disabled(isMutating)
                    .accessibilityIdentifier("live-watchlist-cta-toggle")
                    if let errorMessage {
                        Text(errorMessage)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.red)
                            .accessibilityIdentifier("live-watchlist-cta-error")
                    }
                }
            }
        }
        .task(id: "\(container.environment.sessionStore.revision)-\(reloadID)") {
            await loadWatchlistState()
        }
        .sensoryFeedback(.impact(weight: .light), trigger: toggleFeedbackTrigger)
    }

    @MainActor
    private func loadWatchlistState() async {
        isLoading = true
        errorMessage = nil
        admittedCapabilityMap = nil
        let generation = LiveWatchlistGeneration(
            userID: container.environment.sessionStore.current?.userID,
            sessionRevision: container.environment.sessionStore.revision,
            reloadID: reloadID
        )
        let apiClient = container.environment.apiClient
        let initialMap = LiveAPIContract.deployed.capabilityMap(
            for: apiClient.baseURL ?? LiveAPIContract.deployed.publicHost,
            observedResponseVersion: nil
        )
        let initialState = LiveAccountCapabilityState.resolve(
            for: .watchlist,
            capabilityMap: initialMap,
            session: container.environment.sessionStore.current,
            baseURL: apiClient.baseURL
        )
        guard initialState == .retry else {
            capability = initialState
            isLoading = false
            return
        }
        let service = LiveBackendService(apiClient: apiClient)
        let probe: LiveAPIContractProbe
        do {
            probe = try await service.diagnoseWatchlistContract()
            guard generation.isCurrent(
                userID: container.environment.sessionStore.current?.userID,
                sessionRevision: container.environment.sessionStore.revision,
                reloadID: reloadID,
                isCancelled: Task.isCancelled
            ) else { return }
        } catch {
            guard generation.isCurrent(
                userID: container.environment.sessionStore.current?.userID,
                sessionRevision: container.environment.sessionStore.revision,
                reloadID: reloadID,
                isCancelled: Task.isCancelled
            ) else { return }
            capability = .retry
            isLoading = false
            return
        }
        let resolved = LiveAccountCapabilityState.resolve(
            for: .watchlist,
            capabilityMap: probe.capabilities,
            session: container.environment.sessionStore.current,
            baseURL: apiClient.baseURL
        )
        guard case .available(let userID) = resolved else {
            capability = resolved
            isLoading = false
            return
        }
        do {
            let items = try await service.getWatchlist(userID: userID)
            guard generation.isCurrent(
                userID: container.environment.sessionStore.current?.userID,
                sessionRevision: container.environment.sessionStore.revision,
                reloadID: reloadID,
                isCancelled: Task.isCancelled
            ) else { return }
            admittedCapabilityMap = probe.capabilities
            isWatched = items.contains { $0.eventId == event.id }
            capability = nil
            isLoading = false
        } catch let error as APIClientError {
            guard generation.isCurrent(
                userID: container.environment.sessionStore.current?.userID,
                sessionRevision: container.environment.sessionStore.revision,
                reloadID: reloadID,
                isCancelled: Task.isCancelled
            ) else { return }
            applyWatchlistError(error, capabilityMap: probe.capabilities)
            isLoading = false
        } catch {
            guard generation.isCurrent(
                userID: container.environment.sessionStore.current?.userID,
                sessionRevision: container.environment.sessionStore.revision,
                reloadID: reloadID,
                isCancelled: Task.isCancelled
            ) else { return }
            capability = .retry
            isLoading = false
        }
    }

    @MainActor
    private func toggleWatchlist() async {
        guard !isMutating,
              let userID = container.environment.sessionStore.current?.userID,
              let admittedCapabilityMap else { return }
        let generation = LiveWatchlistGeneration(
            userID: userID,
            sessionRevision: container.environment.sessionStore.revision,
            reloadID: reloadID
        )
        isWatched.toggle()
        toggleFeedbackTrigger += 1
        isMutating = true
        errorMessage = nil
        defer { isMutating = false }
        let service = LiveBackendService(
            apiClient: container.environment.apiClient,
            initialCapabilityMap: admittedCapabilityMap
        )
        do {
            if isWatched {
                _ = try await service.upsertWatchlist(
                    userID: userID,
                    eventID: event.id,
                    channels: ["APP_PUSH"],
                    calendarEnabled: false,
                    notificationEnabled: true
                )
            } else {
                _ = try await service.deleteWatchlist(userID: userID, eventID: event.id)
            }
            guard generation.isCurrent(
                userID: container.environment.sessionStore.current?.userID,
                sessionRevision: container.environment.sessionStore.revision,
                reloadID: reloadID,
                isCancelled: Task.isCancelled
            ) else { return }
        } catch let error as APIClientError {
            guard generation.isCurrent(
                userID: container.environment.sessionStore.current?.userID,
                sessionRevision: container.environment.sessionStore.revision,
                reloadID: reloadID,
                isCancelled: Task.isCancelled
            ) else { return }
            if case .server(status: 401, _, _) = error {
                container.environment.sessionStore.logout()
                capability = .loginRequired
            } else {
                await reconcileWatchlistState(using: service, userID: userID, generation: generation)
            }
        } catch {
            guard generation.isCurrent(
                userID: container.environment.sessionStore.current?.userID,
                sessionRevision: container.environment.sessionStore.revision,
                reloadID: reloadID,
                isCancelled: Task.isCancelled
            ) else { return }
            await reconcileWatchlistState(using: service, userID: userID, generation: generation)
        }
    }

    @MainActor
    private func reconcileWatchlistState(
        using service: LiveBackendService,
        userID: String,
        generation: LiveWatchlistGeneration
    ) async {
        do {
            let items = try await service.getWatchlist(userID: userID)
            guard generation.isCurrent(
                userID: container.environment.sessionStore.current?.userID,
                sessionRevision: container.environment.sessionStore.revision,
                reloadID: reloadID,
                isCancelled: Task.isCancelled
            ) else { return }
            isWatched = items.contains { $0.eventId == event.id }
            errorMessage = "변경 응답을 확인하지 못해 서버 상태를 다시 불러왔습니다."
        } catch let error as APIClientError {
            guard generation.isCurrent(
                userID: container.environment.sessionStore.current?.userID,
                sessionRevision: container.environment.sessionStore.revision,
                reloadID: reloadID,
                isCancelled: Task.isCancelled
            ) else { return }
            if case .server(status: 401, _, _) = error {
                container.environment.sessionStore.logout()
                capability = .loginRequired
            } else {
                capability = .retry
            }
        } catch {
            guard generation.isCurrent(
                userID: container.environment.sessionStore.current?.userID,
                sessionRevision: container.environment.sessionStore.revision,
                reloadID: reloadID,
                isCancelled: Task.isCancelled
            ) else { return }
            capability = .retry
        }
    }

    @MainActor
    private func applyWatchlistError(_ error: APIClientError, capabilityMap: LiveCapabilityMap) {
        let resolved = LiveAccountCapabilityState.resolve(
            for: .watchlist,
            capabilityMap: capabilityMap,
            session: container.environment.sessionStore.current,
            baseURL: container.environment.apiClient.baseURL,
            requestError: error
        )
        if case .server(status: 401, _, _) = error {
            container.environment.sessionStore.logout()
        }
        capability = resolved
    }
}

private struct LiveWatchlistRouteView: View {
    @Environment(AppContainer.self) private var container
    @State private var state: LiveWatchlistState = .loading
    @State private var reloadID = 0
    @State private var admittedCapabilityMap: LiveCapabilityMap?
    @State private var inFlightEventIDs: Set<String> = []
    @State private var mutationError: String?

    var body: some View {
        Group {
            if case .loading = state {
                TicketgroundLoadingSurface(title: "관심공연 불러오는 중", identifier: "live-watchlist-loading")
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: TicketgroundSpacing.lg) {
                        Text("관심공연 · LIVE")
                            .font(.caption.weight(.black))
                            .foregroundStyle(TicketgroundColor.accent)
                            .accessibilityIdentifier("live-watchlist")
                        switch state {
                        case .loading:
                            EmptyView()
                        case .capability(let capability):
                            LiveAccountCapabilitySurface(
                                state: capability,
                                title: "관심공연을 표시할 수 없습니다",
                                loginMessage: "관심공연은 로그인이 필요합니다.",
                                identifier: "live-watchlist",
                                retry: { reloadID += 1 }
                            )
                        case .loaded(let items):
                            if items.isEmpty {
                                LiveRouteMessageView(title: "관심공연이 없습니다", message: "공연 상세에서 관심공연을 추가하면 여기에 표시됩니다.", identifier: "live-watchlist-empty")
                            } else {
                                VStack(alignment: .leading, spacing: TicketgroundSpacing.sm) {
                                    Text("관심공연 \(items.count)개")
                                        .font(.title2.weight(.black))
                                        .accessibilityIdentifier("live-watchlist-items")
                                    ForEach(items, id: \.id) { item in
                                        watchlistCard(item)
                                    }
                                }
                            }
                        }
                        if let mutationError {
                            Text(mutationError)
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.red)
                                .accessibilityIdentifier("live-watchlist-mutation-error")
                        }
                    }
                    .padding(TicketgroundSpacing.xl)
                }
            }
        }
        .navigationTitle("관심공연")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: "\(container.environment.sessionStore.revision)-\(reloadID)") {
            await loadWatchlist()
        }
    }

    @ViewBuilder
    private func watchlistCard(_ item: LiveWatchlistItem) -> some View {
        let isInFlight = inFlightEventIDs.contains(item.eventId)
        VStack(alignment: .leading, spacing: TicketgroundSpacing.sm) {
            Text(item.event?.title ?? item.eventId)
                .font(.headline.weight(.bold))
                .accessibilityIdentifier("live-watchlist-item-\(item.id)")
            Text(item.event?.venue ?? "공연장 정보 없음")
                .font(.subheadline)
                .foregroundStyle(TicketgroundColor.inkMuted)
            HStack(spacing: TicketgroundSpacing.sm) {
                Button(item.notificationEnabled ? "오픈 알림 끄기" : "오픈 알림 켜기") {
                    Task { await setPreferences(item, notificationEnabled: !item.notificationEnabled) }
                }
                .buttonStyle(.bordered)
                .disabled(isInFlight)
                .accessibilityIdentifier("live-watchlist-notification-\(item.eventId)")
                Button(item.calendarEnabled ? "캘린더 해제" : "캘린더 연동") {
                    Task { await setPreferences(item, calendarEnabled: !item.calendarEnabled) }
                }
                .buttonStyle(.bordered)
                .disabled(isInFlight)
                .accessibilityIdentifier("live-watchlist-calendar-\(item.eventId)")
            }
            Button("관심공연 삭제", role: .destructive) {
                Task { await deleteItem(item) }
            }
            .disabled(isInFlight)
            .accessibilityIdentifier("live-watchlist-delete-\(item.eventId)")
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(TicketgroundSpacing.md)
        .background(TicketgroundColor.surfaceMuted)
        .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.medium))
    }

    @MainActor
    private func loadWatchlist() async {
        state = .loading
        admittedCapabilityMap = nil
        inFlightEventIDs.removeAll()
        mutationError = nil
        let generation = LiveWatchlistGeneration(
            userID: container.environment.sessionStore.current?.userID,
            sessionRevision: container.environment.sessionStore.revision,
            reloadID: reloadID
        )
        if let testState = RuntimeConfiguration.liveAccountCapabilityTestState {
            state = .capability(testState)
            return
        }
        let apiClient = container.environment.apiClient
        let initialMap = LiveAPIContract.deployed.capabilityMap(
            for: apiClient.baseURL ?? LiveAPIContract.deployed.publicHost,
            observedResponseVersion: nil
        )
        let initialState = LiveAccountCapabilityState.resolve(
            for: .watchlist,
            capabilityMap: initialMap,
            session: container.environment.sessionStore.current,
            baseURL: apiClient.baseURL
        )
        guard initialState == .retry else {
            state = .capability(initialState)
            return
        }
        let service = LiveBackendService(apiClient: apiClient)
        let probe: LiveAPIContractProbe
        do {
            probe = try await service.diagnoseWatchlistContract()
            guard generation.isCurrent(
                userID: container.environment.sessionStore.current?.userID,
                sessionRevision: container.environment.sessionStore.revision,
                reloadID: reloadID,
                isCancelled: Task.isCancelled
            ) else { return }
        } catch {
            guard generation.isCurrent(
                userID: container.environment.sessionStore.current?.userID,
                sessionRevision: container.environment.sessionStore.revision,
                reloadID: reloadID,
                isCancelled: Task.isCancelled
            ) else { return }
            state = .capability(.retry)
            return
        }
        let resolved = LiveAccountCapabilityState.resolve(
            for: .watchlist,
            capabilityMap: probe.capabilities,
            session: container.environment.sessionStore.current,
            baseURL: apiClient.baseURL
        )
        guard case .available(let userID) = resolved else {
            state = .capability(resolved)
            return
        }
        do {
            let items = try await service.getWatchlist(userID: userID)
            guard generation.isCurrent(
                userID: container.environment.sessionStore.current?.userID,
                sessionRevision: container.environment.sessionStore.revision,
                reloadID: reloadID,
                isCancelled: Task.isCancelled
            ) else { return }
            admittedCapabilityMap = probe.capabilities
            state = .loaded(items)
        } catch let error as APIClientError {
            guard generation.isCurrent(
                userID: container.environment.sessionStore.current?.userID,
                sessionRevision: container.environment.sessionStore.revision,
                reloadID: reloadID,
                isCancelled: Task.isCancelled
            ) else { return }
            applyLoadError(error, capabilityMap: probe.capabilities)
        } catch {
            guard generation.isCurrent(
                userID: container.environment.sessionStore.current?.userID,
                sessionRevision: container.environment.sessionStore.revision,
                reloadID: reloadID,
                isCancelled: Task.isCancelled
            ) else { return }
            state = .capability(.retry)
        }
    }

    @MainActor
    private func setPreferences(
        _ item: LiveWatchlistItem,
        notificationEnabled: Bool? = nil,
        calendarEnabled: Bool? = nil
    ) async {
        guard !inFlightEventIDs.contains(item.eventId),
              let userID = container.environment.sessionStore.current?.userID,
              let admittedCapabilityMap,
              case .loaded(let currentItems) = state else { return }
        let generation = LiveWatchlistGeneration(
            userID: userID,
            sessionRevision: container.environment.sessionStore.revision,
            reloadID: reloadID
        )
        let optimistic = copyingWatchlistItem(
            item,
            notificationEnabled: notificationEnabled ?? item.notificationEnabled,
            calendarEnabled: calendarEnabled ?? item.calendarEnabled
        )
        state = .loaded(replacingWatchlistItem(optimistic, in: currentItems))
        inFlightEventIDs.insert(item.eventId)
        mutationError = nil
        defer { inFlightEventIDs.remove(item.eventId) }
        let service = LiveBackendService(
            apiClient: container.environment.apiClient,
            initialCapabilityMap: admittedCapabilityMap
        )
        do {
            let updated = try await service.upsertWatchlist(
                userID: userID,
                eventID: item.eventId,
                channels: item.channels,
                calendarEnabled: optimistic.calendarEnabled,
                notificationEnabled: optimistic.notificationEnabled
            )
            guard generation.isCurrent(
                userID: container.environment.sessionStore.current?.userID,
                sessionRevision: container.environment.sessionStore.revision,
                reloadID: reloadID,
                isCancelled: Task.isCancelled
            ), case .loaded(let latestItems) = state else { return }
            state = .loaded(replacingWatchlistItem(updated, in: latestItems))
        } catch let error as APIClientError {
            guard generation.isCurrent(
                userID: container.environment.sessionStore.current?.userID,
                sessionRevision: container.environment.sessionStore.revision,
                reloadID: reloadID,
                isCancelled: Task.isCancelled
            ) else { return }
            if case .server(status: 401, _, _) = error {
                container.environment.sessionStore.logout()
                state = .capability(.loginRequired)
            } else {
                await reconcileItems(
                    using: service,
                    userID: userID,
                    generation: generation,
                    message: "설정 변경 응답을 확인하지 못해 서버 상태를 다시 불러왔습니다."
                )
            }
        } catch {
            guard generation.isCurrent(
                userID: container.environment.sessionStore.current?.userID,
                sessionRevision: container.environment.sessionStore.revision,
                reloadID: reloadID,
                isCancelled: Task.isCancelled
            ) else { return }
            await reconcileItems(
                using: service,
                userID: userID,
                generation: generation,
                message: "설정 변경 응답을 확인하지 못해 서버 상태를 다시 불러왔습니다."
            )
        }
    }

    @MainActor
    private func reconcileItems(
        using service: LiveBackendService,
        userID: String,
        generation: LiveWatchlistGeneration,
        message: String
    ) async {
        do {
            let items = try await service.getWatchlist(userID: userID)
            guard generation.isCurrent(
                userID: container.environment.sessionStore.current?.userID,
                sessionRevision: container.environment.sessionStore.revision,
                reloadID: reloadID,
                isCancelled: Task.isCancelled
            ) else { return }
            state = .loaded(items)
            mutationError = message
        } catch let error as APIClientError {
            guard generation.isCurrent(
                userID: container.environment.sessionStore.current?.userID,
                sessionRevision: container.environment.sessionStore.revision,
                reloadID: reloadID,
                isCancelled: Task.isCancelled
            ) else { return }
            if case .server(status: 401, _, _) = error {
                container.environment.sessionStore.logout()
                state = .capability(.loginRequired)
            } else {
                state = .capability(.retry)
            }
        } catch {
            guard generation.isCurrent(
                userID: container.environment.sessionStore.current?.userID,
                sessionRevision: container.environment.sessionStore.revision,
                reloadID: reloadID,
                isCancelled: Task.isCancelled
            ) else { return }
            state = .capability(.retry)
        }
    }

    @MainActor
    private func deleteItem(_ item: LiveWatchlistItem) async {
        guard !inFlightEventIDs.contains(item.eventId),
              let userID = container.environment.sessionStore.current?.userID,
              let admittedCapabilityMap,
              case .loaded(let currentItems) = state,
              currentItems.contains(where: { $0.id == item.id }) else { return }
        let generation = LiveWatchlistGeneration(
            userID: userID,
            sessionRevision: container.environment.sessionStore.revision,
            reloadID: reloadID
        )
        state = .loaded(currentItems.filter { $0.id != item.id })
        inFlightEventIDs.insert(item.eventId)
        mutationError = nil
        defer { inFlightEventIDs.remove(item.eventId) }
        let service = LiveBackendService(
            apiClient: container.environment.apiClient,
            initialCapabilityMap: admittedCapabilityMap
        )
        do {
            _ = try await service.deleteWatchlist(userID: userID, eventID: item.eventId)
            guard generation.isCurrent(
                userID: container.environment.sessionStore.current?.userID,
                sessionRevision: container.environment.sessionStore.revision,
                reloadID: reloadID,
                isCancelled: Task.isCancelled
            ) else { return }
        } catch let error as APIClientError {
            guard generation.isCurrent(
                userID: container.environment.sessionStore.current?.userID,
                sessionRevision: container.environment.sessionStore.revision,
                reloadID: reloadID,
                isCancelled: Task.isCancelled
            ) else { return }
            if case .server(status: 401, _, _) = error {
                container.environment.sessionStore.logout()
                state = .capability(.loginRequired)
            } else {
                await reconcileItems(
                    using: service,
                    userID: userID,
                    generation: generation,
                    message: "삭제 응답을 확인하지 못해 서버 상태를 다시 불러왔습니다."
                )
            }
        } catch {
            guard generation.isCurrent(
                userID: container.environment.sessionStore.current?.userID,
                sessionRevision: container.environment.sessionStore.revision,
                reloadID: reloadID,
                isCancelled: Task.isCancelled
            ) else { return }
            await reconcileItems(
                using: service,
                userID: userID,
                generation: generation,
                message: "삭제 응답을 확인하지 못해 서버 상태를 다시 불러왔습니다."
            )
        }
    }

    @MainActor
    private func applyLoadError(_ error: APIClientError, capabilityMap: LiveCapabilityMap) {
        let resolved = LiveAccountCapabilityState.resolve(
            for: .watchlist,
            capabilityMap: capabilityMap,
            session: container.environment.sessionStore.current,
            baseURL: container.environment.apiClient.baseURL,
            requestError: error
        )
        if case .server(status: 401, _, _) = error {
            container.environment.sessionStore.logout()
        }
        state = .capability(resolved)
    }
}

private enum LiveWatchlistState {
    case loading
    case capability(LiveAccountCapabilityState)
    case loaded([LiveWatchlistItem])
}

private struct LiveWatchlistGeneration {
    let userID: String?
    let sessionRevision: Int
    let reloadID: Int

    func isCurrent(userID: String?, sessionRevision: Int, reloadID: Int, isCancelled: Bool) -> Bool {
        !isCancelled
            && self.userID == userID
            && self.sessionRevision == sessionRevision
            && self.reloadID == reloadID
    }
}

private func copyingWatchlistItem(
    _ item: LiveWatchlistItem,
    notificationEnabled: Bool,
    calendarEnabled: Bool
) -> LiveWatchlistItem {
    LiveWatchlistItem(
        id: item.id,
        userId: item.userId,
        eventId: item.eventId,
        channels: item.channels,
        calendarEnabled: calendarEnabled,
        notificationEnabled: notificationEnabled,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        event: item.event,
        notificationJobs: item.notificationJobs
    )
}

private func replacingWatchlistItem(_ replacement: LiveWatchlistItem, in items: [LiveWatchlistItem]) -> [LiveWatchlistItem] {
    items.map { $0.id == replacement.id ? replacement : $0 }
}

private struct LiveSupportRouteView: View {
    let route: AppRoute
    @Environment(AppContainer.self) private var container
    @State private var state: LiveSupportState = .loading
    @State private var reloadID = 0
    @State private var publicSupport: LivePublicSupport?
    @State private var admittedCapabilityMap: LiveCapabilityMap?
    @State private var subject = ""
    @State private var message = ""
    @State private var submissionKey = UUID().uuidString
    @State private var isSubmitting = false
    @State private var submissionError: String?

    var body: some View {
        Group {
            if case .loading = state {
                TicketgroundLoadingSurface(title: "\(routeTitle) 불러오는 중", identifier: "live-support-loading")
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: TicketgroundSpacing.lg) {
                        Text(routeTitle)
                            .font(.caption.weight(.black))
                            .foregroundStyle(TicketgroundColor.accent)
                            .accessibilityIdentifier("live-support")
                        if let publicSupport {
                            publicSupportContent(publicSupport)
                        }
                        switch state {
                        case .loading:
                            EmptyView()
                        case .capability(let capability):
                            LiveAccountCapabilitySurface(
                                state: capability,
                                title: routeTitle,
                                loginMessage: "1:1 문의 작성과 내역 확인에는 로그인이 필요합니다.",
                                identifier: "live-support",
                                retry: { reloadID += 1 }
                            )
                        case .loaded(let threads):
                            supportComposer()
                            if threads.isEmpty {
                                LiveRouteMessageView(title: "문의 내역이 없습니다", message: "새 문의를 작성하면 이곳에서 답변 상태를 확인할 수 있습니다.", identifier: "live-support-empty")
                            } else {
                                VStack(alignment: .leading, spacing: TicketgroundSpacing.sm) {
                                    ForEach(threads, id: \.id) { thread in
                                        Group {
                                            if let admittedCapabilityMap {
                                                NavigationLink {
                                                    LiveSupportThreadDetailView(
                                                        initialThread: thread,
                                                        capabilityMap: admittedCapabilityMap,
                                                        sessionBinding: LiveSupportSessionBinding(
                                                            userID: container.environment.sessionStore.current?.userID,
                                                            revision: container.environment.sessionStore.revision
                                                        ),
                                                        onThreadUpdated: updateSupportThread
                                                    )
                                                } label: {
                                                    supportThreadRow(thread)
                                                }
                                            } else {
                                                supportThreadRow(thread)
                                            }
                                        }
                                        .accessibilityIdentifier("live-support-thread-\(thread.id)")
                                    }
                                }
                            }
                        }
                        Link(destination: URL(string: "https://pf.kakao.com/_xmTniX/chat")!) {
                            Label("카카오톡 채널 1:1 문의", systemImage: "bubble.left.and.bubble.right")
                                .frame(maxWidth: .infinity, minHeight: 46)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(Color(red: 254 / 255, green: 229 / 255, blue: 0))
                        .foregroundStyle(Color.black)
                        .accessibilityIdentifier("live-support-kakao-channel")
                        Link(destination: URL(string: "https://pf.kakao.com/_xmTniX")!) {
                            Label("카카오톡 채널 추가", systemImage: "person.crop.circle.badge.plus")
                                .frame(maxWidth: .infinity, minHeight: 46)
                        }
                        .buttonStyle(.bordered)
                        .accessibilityIdentifier("live-support-kakao-channel-add")
                    }
                    .padding(TicketgroundSpacing.xl)
                }
            }
        }
        .scrollDismissesKeyboard(.immediately)
        .navigationTitle(routeTitle)
        .navigationBarTitleDisplayMode(.inline)
        .task(id: "\(container.environment.sessionStore.revision)-\(reloadID)") {
            if let testState = RuntimeConfiguration.liveAccountCapabilityTestState {
                state = .capability(testState)
                return
            }
            let generation = LiveSupportLoadGeneration(
                userID: container.environment.sessionStore.current?.userID,
                sessionRevision: container.environment.sessionStore.revision,
                reloadID: reloadID
            )
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
            guard initialState != .httpsRequired else {
                state = .capability(initialState)
                return
            }

            if container.environment.sessionStore.current == nil {
                admittedCapabilityMap = nil
                state = .capability(.loginRequired)
            }

            let service = LiveBackendService(apiClient: apiClient)
            let probe: LiveAPIContractProbe
            let loadedPublicSupport: LivePublicSupport
            do {
                probe = try await service.diagnoseSupportContract()
                guard generation.isCurrent(
                    userID: container.environment.sessionStore.current?.userID,
                    sessionRevision: container.environment.sessionStore.revision,
                    reloadID: reloadID,
                    isCancelled: Task.isCancelled
                ) else { return }
                loadedPublicSupport = try await service.getPublicSupport()
                guard generation.isCurrent(
                    userID: container.environment.sessionStore.current?.userID,
                    sessionRevision: container.environment.sessionStore.revision,
                    reloadID: reloadID,
                    isCancelled: Task.isCancelled
                ) else { return }
            } catch let error as APIClientError {
                applySupportLoadError(
                    error,
                    stage: .publicProbe,
                    generation: generation,
                    capabilityMap: capabilityMap
                )
                return
            } catch {
                guard generation.isCurrent(
                    userID: container.environment.sessionStore.current?.userID,
                    sessionRevision: container.environment.sessionStore.revision,
                    reloadID: reloadID,
                    isCancelled: Task.isCancelled
                ) else { return }
                state = .capability(.retry)
                return
            }

            publicSupport = loadedPublicSupport
            admittedCapabilityMap = probe.capabilities
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
            do {
                let loadedThreads = try await service.getSupportThreads(userID: userID)
                guard generation.isCurrent(
                    userID: container.environment.sessionStore.current?.userID,
                    sessionRevision: container.environment.sessionStore.revision,
                    reloadID: reloadID,
                    isCancelled: Task.isCancelled
                ) else { return }
                state = .loaded(loadedThreads)
            } catch let error as APIClientError {
                applySupportLoadError(
                    error,
                    stage: .privateThreads,
                    generation: generation,
                    capabilityMap: probe.capabilities
                )
            } catch {
                guard generation.isCurrent(
                    userID: container.environment.sessionStore.current?.userID,
                    sessionRevision: container.environment.sessionStore.revision,
                    reloadID: reloadID,
                    isCancelled: Task.isCancelled
                ) else { return }
                state = .capability(.retry)
            }
        }
        .onChange(of: subject) { _, _ in
            if !isSubmitting { submissionKey = UUID().uuidString }
        }
        .onChange(of: message) { _, _ in
            if !isSubmitting { submissionKey = UUID().uuidString }
        }
    }

    @ViewBuilder
    private func publicSupportContent(_ content: LivePublicSupport) -> some View {
        VStack(alignment: .leading, spacing: TicketgroundSpacing.sm) {
            Text("자주 묻는 질문")
                .font(.headline.weight(.black))
            ForEach(content.faqs, id: \.id) { faq in
                VStack(alignment: .leading, spacing: TicketgroundSpacing.xs) {
                    Text(faq.question).font(.subheadline.weight(.bold))
                    Text(faq.answer).font(.caption).foregroundStyle(TicketgroundColor.inkMuted)
                }
            }
            Text("공지사항")
                .font(.headline.weight(.black))
            ForEach(content.notices, id: \.id) { notice in
                VStack(alignment: .leading, spacing: TicketgroundSpacing.xs) {
                    HStack(spacing: TicketgroundSpacing.xs) {
                        Text("공지")
                            .font(.caption2.weight(.black))
                            .foregroundStyle(TicketgroundColor.accent)
                        Text(notice.title).font(.subheadline.weight(.bold))
                    }
                    Text(notice.body).font(.caption).foregroundStyle(TicketgroundColor.inkMuted)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(TicketgroundSpacing.sm)
                .background(TicketgroundColor.surface)
                .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.small))
            }
        }
        .padding(TicketgroundSpacing.lg)
        .background(TicketgroundColor.surfaceMuted)
        .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.medium))
        .accessibilityIdentifier("live-support-public")
    }

    @ViewBuilder
    private func supportComposer() -> some View {
        VStack(alignment: .leading, spacing: TicketgroundSpacing.sm) {
            Text("새 1:1 문의").font(.headline.weight(.black))
            TextField("문의 제목", text: $subject)
                .textFieldStyle(.roundedBorder)
                .disabled(isSubmitting)
                .accessibilityIdentifier("live-support-subject")
            TextField("문의 내용", text: $message, axis: .vertical)
                .textFieldStyle(.roundedBorder)
                .lineLimit(3...6)
                .disabled(isSubmitting)
                .accessibilityIdentifier("live-support-message")
            if subject.utf16.count > 80 {
                Text("문의 제목은 80자 이하로 입력해주세요.")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.red)
                    .accessibilityIdentifier("live-support-subject-limit")
            }
            if message.utf16.count > 1000 {
                Text("문의 내용은 1,000자 이하로 입력해주세요.")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.red)
            }
            Text("제목 \(subject.utf16.count)/80 · 내용 \(message.utf16.count)/1,000")
                .font(.caption)
                .foregroundStyle(subject.utf16.count > 80 || message.utf16.count > 1000 ? .red : TicketgroundColor.inkMuted)
            Button {
                Task { await submitThread() }
            } label: {
                Text(isSubmitting ? "전송 중" : "문의 보내기")
                    .frame(maxWidth: .infinity, minHeight: 44)
            }
            .buttonStyle(.borderedProminent)
            .disabled(
                isSubmitting
                    || message.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                    || subject.utf16.count > 80
                    || message.utf16.count > 1000
            )
            .accessibilityIdentifier("live-support-submit")
            if let submissionError {
                Text(submissionError).font(.caption).foregroundStyle(.red)
            }
        }
    }

    private func supportThreadRow(_ thread: LiveSupportThread) -> some View {
        VStack(alignment: .leading, spacing: TicketgroundSpacing.xs) {
            Text(thread.subject).font(.headline.weight(.bold))
            Text(supportStatus(thread.status))
                .font(.caption.weight(.semibold))
                .foregroundStyle(TicketgroundColor.accent)
            if let latestMessage = thread.messages.last {
                Text(latestMessage.body)
                    .font(.subheadline)
                    .foregroundStyle(TicketgroundColor.inkSecondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(TicketgroundSpacing.md)
        .background(TicketgroundColor.surfaceMuted)
        .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.medium))
    }

    private func updateSupportThread(_ updatedThread: LiveSupportThread) {
        guard case .loaded(let threads) = state else { return }
        state = .loaded(puttingSupportThreadFirst(updatedThread, in: threads))
    }

    @MainActor
    private func submitThread() async {
        guard let userID = container.environment.sessionStore.current?.userID,
              let admittedCapabilityMap else {
            state = .capability(.loginRequired)
            return
        }
        let generation = LiveSupportLoadGeneration(
            userID: userID,
            sessionRevision: container.environment.sessionStore.revision,
            reloadID: reloadID
        )
        isSubmitting = true
        submissionError = nil
        defer { isSubmitting = false }
        do {
            let service = LiveBackendService(
                apiClient: container.environment.apiClient,
                initialCapabilityMap: admittedCapabilityMap
            )
            let created = try await service.createSupportThread(
                userID: userID,
                subject: subject,
                message: message,
                idempotencyKey: submissionKey
            )
            guard generation.isCurrent(
                userID: container.environment.sessionStore.current?.userID,
                sessionRevision: container.environment.sessionStore.revision,
                reloadID: reloadID,
                isCancelled: Task.isCancelled
            ), case .loaded(let currentThreads) = state else { return }
            state = .loaded(puttingSupportThreadFirst(created, in: currentThreads))
            subject = ""
            message = ""
            submissionKey = UUID().uuidString
        } catch let error as APIClientError {
            guard generation.isCurrent(
                userID: container.environment.sessionStore.current?.userID,
                sessionRevision: container.environment.sessionStore.revision,
                reloadID: reloadID,
                isCancelled: Task.isCancelled
            ) else { return }
            if case .server(status: 401, _, _) = error {
                container.environment.sessionStore.logout()
                state = .capability(.loginRequired)
            } else {
                submissionError = error.localizedDescription
            }
        } catch {
            guard generation.isCurrent(
                userID: container.environment.sessionStore.current?.userID,
                sessionRevision: container.environment.sessionStore.revision,
                reloadID: reloadID,
                isCancelled: Task.isCancelled
            ) else { return }
            submissionError = "문의를 전송하지 못했습니다. 다시 시도해 주세요."
        }
    }

    private var routeTitle: String {
        route == .inquiry ? "1:1 문의 · LIVE" : "고객센터 · LIVE"
    }

    @MainActor
    private func applySupportLoadError(
        _ error: APIClientError,
        stage: LiveSupportRequestStage,
        generation: LiveSupportLoadGeneration,
        capabilityMap: LiveCapabilityMap
    ) {
        guard generation.isCurrent(
            userID: container.environment.sessionStore.current?.userID,
            sessionRevision: container.environment.sessionStore.revision,
            reloadID: reloadID,
            isCancelled: Task.isCancelled
        ) else { return }
        let resolvedState = LiveAccountCapabilityState.resolve(
            for: .support,
            capabilityMap: capabilityMap,
            session: container.environment.sessionStore.current,
            baseURL: container.environment.apiClient.baseURL,
            requestError: error
        )
        if case .server(let status, _, _) = error {
            if stage.invalidatesSession(status: status) {
                container.environment.sessionStore.logout()
            }
            state = .capability(stage == .publicProbe && status == 401 ? .retry : resolvedState)
            return
        }
        state = .capability(resolvedState)
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

private struct LiveSupportThreadDetailView: View {
    @Environment(AppContainer.self) private var container
    @Environment(\.dismiss) private var dismiss
    @State private var thread: LiveSupportThread
    @State private var reply = ""
    @State private var replyKey = UUID().uuidString
    @State private var isSending = false
    @State private var errorMessage: String?
    let capabilityMap: LiveCapabilityMap
    let sessionBinding: LiveSupportSessionBinding
    let onThreadUpdated: (LiveSupportThread) -> Void

    init(
        initialThread: LiveSupportThread,
        capabilityMap: LiveCapabilityMap,
        sessionBinding: LiveSupportSessionBinding,
        onThreadUpdated: @escaping (LiveSupportThread) -> Void
    ) {
        _thread = State(initialValue: initialThread)
        self.capabilityMap = capabilityMap
        self.sessionBinding = sessionBinding
        self.onThreadUpdated = onThreadUpdated
    }

    var body: some View {
        List {
            Section("문의") {
                LabeledContent("제목", value: thread.subject)
                LabeledContent("상태", value: statusText)
            }
            Section("대화") {
                ForEach(thread.messages, id: \.id) { message in
                    VStack(alignment: .leading, spacing: TicketgroundSpacing.xs) {
                        Text(roleLabel(message.role))
                            .font(.caption.weight(.bold))
                            .foregroundStyle(TicketgroundColor.accent)
                        Text(message.body)
                    }
                }
            }
            Section("답글") {
                TextField("추가 문의 내용", text: $reply, axis: .vertical)
                    .lineLimit(3...6)
                    .disabled(isSending)
                    .accessibilityIdentifier("live-support-reply")
                Text("\(reply.utf16.count)/1,000")
                    .font(.caption)
                    .foregroundStyle(reply.utf16.count > 1000 ? .red : TicketgroundColor.inkMuted)
                Button(isSending ? "전송 중" : "답글 보내기") {
                    Task { await sendReply() }
                }
                .disabled(isSending || reply.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || reply.utf16.count > 1000)
                .accessibilityIdentifier("live-support-reply-submit")
                if let errorMessage {
                    Text(errorMessage).foregroundStyle(.red)
                }
            }
        }
        .navigationTitle("문의 상세")
        .navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("live-support-detail")
        .onAppear {
            dismissIfSessionChanged()
        }
        .onChange(of: container.environment.sessionStore.revision) { _, _ in
            dismissIfSessionChanged()
        }
        .onChange(of: reply) { _, _ in
            if !isSending { replyKey = UUID().uuidString }
        }
    }

    @MainActor
    private func sendReply() async {
        guard let userID = sessionBinding.userID,
              sessionBinding.isCurrent(
                userID: container.environment.sessionStore.current?.userID,
                revision: container.environment.sessionStore.revision,
                isCancelled: Task.isCancelled
              ) else {
            errorMessage = "로그인이 필요합니다."
            dismiss()
            return
        }
        isSending = true
        errorMessage = nil
        defer { isSending = false }
        do {
            let service = LiveBackendService(
                apiClient: container.environment.apiClient,
                initialCapabilityMap: capabilityMap
            )
            let updatedThread = try await service.addSupportMessage(
                userID: userID,
                threadID: thread.id,
                message: reply,
                idempotencyKey: replyKey
            )
            guard sessionBinding.isCurrent(
                userID: container.environment.sessionStore.current?.userID,
                revision: container.environment.sessionStore.revision,
                isCancelled: Task.isCancelled
            ) else { return }
            thread = updatedThread
            onThreadUpdated(thread)
            reply = ""
            replyKey = UUID().uuidString
        } catch let error as APIClientError {
            guard sessionBinding.isCurrent(
                userID: container.environment.sessionStore.current?.userID,
                revision: container.environment.sessionStore.revision,
                isCancelled: Task.isCancelled
            ) else { return }
            if case .server(status: 401, _, _) = error {
                container.environment.sessionStore.logout()
                dismiss()
            } else {
                errorMessage = error.localizedDescription
            }
        } catch {
            guard sessionBinding.isCurrent(
                userID: container.environment.sessionStore.current?.userID,
                revision: container.environment.sessionStore.revision,
                isCancelled: Task.isCancelled
            ) else { return }
            errorMessage = "답글을 전송하지 못했습니다. 다시 시도해 주세요."
        }
    }

    private func dismissIfSessionChanged() {
        if !sessionBinding.isCurrent(
            userID: container.environment.sessionStore.current?.userID,
            revision: container.environment.sessionStore.revision,
            isCancelled: false
        ) {
            dismiss()
        }
    }

    private var statusText: String {
        switch thread.status {
        case .open: return "답변 대기"
        case .answered: return "답변 완료"
        case .closed: return "종료"
        case .unknown: return "상태 확인 중"
        }
    }

    private func roleLabel(_ role: LiveSupportRole) -> String {
        switch role {
        case .customer: return "나"
        case .admin: return "고객센터"
        case .unknown: return "발신자 확인 중"
        }
    }
}

struct LiveSupportLoadGeneration: Equatable {
    let userID: String?
    let sessionRevision: Int
    let reloadID: Int

    func isCurrent(userID: String?, sessionRevision: Int, reloadID: Int, isCancelled: Bool) -> Bool {
        !isCancelled
            && self.userID == userID
            && self.sessionRevision == sessionRevision
            && self.reloadID == reloadID
    }
}

struct LiveSupportSessionBinding: Equatable {
    let userID: String?
    let revision: Int

    func isCurrent(userID: String?, revision: Int, isCancelled: Bool) -> Bool {
        !isCancelled
            && self.userID != nil
            && self.userID == userID
            && self.revision == revision
    }
}

enum LiveSupportRequestStage: Equatable {
    case publicProbe
    case privateThreads

    func invalidatesSession(status: Int) -> Bool {
        self == .privateThreads && status == 401
    }
}

func puttingSupportThreadFirst(
    _ thread: LiveSupportThread,
    in currentThreads: [LiveSupportThread]
) -> [LiveSupportThread] {
    [thread] + currentThreads.filter { $0.id != thread.id }
}

private enum LiveSupportState {
    case loading
    case capability(LiveAccountCapabilityState)
    case loaded([LiveSupportThread])
}

private struct LiveUnsupportedRouteView: View {
    @Environment(AppContainer.self) private var container
    let route: AppRoute

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: TicketgroundSpacing.lg) {
                Text(routeTitle)
                    .font(.caption.weight(.black))
                    .foregroundStyle(TicketgroundColor.accent)
                    .accessibilityIdentifier("live-unsupported-capability")
                Text(LiveDiscoveryCopy.unsupportedRouteHeadline)
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

                Button("홈으로") {
                    container.navigationPath.removeAll()
                }
                .buttonStyle(.bordered)
                .accessibilityIdentifier("live-unsupported-home")

                NavigationLink(value: AppRoute.capabilityLedger) {
                    Label("서비스 연결 현황 확인", systemImage: "checklist")
                        .frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(.borderedProminent)
                .tint(TicketgroundColor.accent)
                .accessibilityIdentifier("live-unsupported-capability-ledger")
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
        case .queue: return "대기열 · 지원 보류"
        case .booking: return "예매 · 지원 보류"
        case .reservation: return "예약 · 지원 보류"
        case .artist: return "아티스트 · 지원 보류"
        case .region: return "지역별 공연 · 지원 보류"
        case .open: return "티켓오픈 캘린더 · 지원 보류"
        default: return route.id
        }
    }

    private var reason: String {
        LiveDiscoveryCopy.unsupportedReason(for: route)
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
