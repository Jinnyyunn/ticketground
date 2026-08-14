import SwiftUI

struct LiveSupportRouteView: View {
    let route: AppRoute
    @Environment(AppContainer.self) private var container
    @State private var publicState: PublicState = .loading
    @State private var inquiryState: InquiryState = .loading
    @State private var subject = ""
    @State private var message = ""
    @State private var category = "GENERAL"
    @State private var replyDrafts: [String: String] = [:]
    @State private var replyStates: [String: ReplySubmissionState] = [:]
    @State private var submission: SubmissionState = .idle
    @State private var reloadID = 0
    @FocusState private var focusedField: SupportField?
    @FocusState private var focusedReplyID: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: TicketgroundSpacing.lg) {
                Text(routeTitle)
                    .font(.caption.weight(.black))
                    .foregroundStyle(TicketgroundColor.accent)
                    .accessibilityIdentifier("live-support")
                publicContent
                if route == .inquiry {
                    inquiryContent
                }
            }
            .padding(TicketgroundSpacing.xl)
        }
        .navigationTitle(route == .inquiry ? "1:1 문의" : "고객센터")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: "\(container.environment.sessionStore.current?.userID ?? "")-\(reloadID)") {
            await load()
        }
    }

    @ViewBuilder
    private var publicContent: some View {
        switch publicState {
        case .loading:
            TicketgroundLoadingSurface(title: "고객센터 안내를 불러오는 중")
                .accessibilityIdentifier("live-support-public-loading")
        case .failure:
            TicketgroundErrorSurface(
                title: "고객센터 안내를 불러오지 못했습니다",
                message: "네트워크 연결을 확인한 뒤 다시 시도해 주세요.",
                actionTitle: "다시 시도",
                action: { reloadID += 1 }
            )
            .accessibilityIdentifier("live-support-public-error")
        case .loaded(let content):
            VStack(alignment: .leading, spacing: TicketgroundSpacing.lg) {
                ForEach(content.notices, id: \.id) { notice in
                    TicketgroundSurface(tone: .muted) {
                        VStack(alignment: .leading, spacing: TicketgroundSpacing.xs) {
                            Text(notice.title).font(.headline.weight(.bold))
                            Text(notice.body)
                                .font(.subheadline)
                                .foregroundStyle(TicketgroundColor.inkSecondary)
                        }
                    }
                }
                VStack(alignment: .leading, spacing: TicketgroundSpacing.sm) {
                    Text("자주 묻는 질문")
                        .font(.title3.weight(.black))
                    ForEach(content.faqs, id: \.id) { faq in
                        DisclosureGroup(faq.question) {
                            Text(faq.answer)
                                .font(.subheadline)
                                .foregroundStyle(TicketgroundColor.inkSecondary)
                                .padding(.top, TicketgroundSpacing.xs)
                        }
                        .font(.body.weight(.semibold))
                        .tint(TicketgroundColor.accent)
                        .padding(.vertical, TicketgroundSpacing.xs)
                    }
                }
            }
            .accessibilityIdentifier("live-support-public")
        }
    }

    @ViewBuilder
    private var inquiryContent: some View {
        switch inquiryState {
        case .loading:
            TicketgroundLoadingSurface(title: "문의 내역을 불러오는 중")
                .accessibilityIdentifier("live-support-inquiry-loading")
        case .capability(let capability):
            LiveAccountCapabilitySurface(
                state: capability,
                title: "1:1 문의",
                loginMessage: "문의 작성과 답변 확인은 로그인이 필요합니다.",
                identifier: "live-support",
                retry: { reloadID += 1 }
            )
        case .loaded(let userID, let content, let threads):
            composer(userID: userID, content: content)
            threadList(userID: userID, threads: threads)
        }
    }

    private func composer(userID: String, content: LiveSupportPublicContent) -> some View {
        TicketgroundSurface {
            VStack(alignment: .leading, spacing: TicketgroundSpacing.md) {
                Text("새 문의")
                    .font(.title3.weight(.black))
                    .accessibilityIdentifier("live-support-composer")
                Picker("문의 유형", selection: $category) {
                    ForEach(content.categories, id: \.id) { item in
                        Text(item.label).tag(item.id)
                    }
                }
                .pickerStyle(.menu)
                .accessibilityIdentifier("live-support-category")
                TicketgroundInput(title: "문의 제목", prompt: "문의 제목을 입력해 주세요", text: $subject)
                    .accessibilityIdentifier("live-support-subject")
                    .focused($focusedField, equals: .subject)
                TextField("문의 내용", text: $message, prompt: Text("문의 내용을 자세히 입력해 주세요"), axis: .vertical)
                    .lineLimit(3...6)
                    .textFieldStyle(.roundedBorder)
                    .accessibilityIdentifier("live-support-message")
                    .focused($focusedField, equals: .message)
                submissionFeedback
                TicketgroundPrimaryButton(title: submission == .sending ? "전송 중" : "문의 보내기", accessibilityIdentifier: "live-support-submit") {
                    Task { await submitInquiry(userID: userID) }
                }
                .disabled(submission == .sending || subject.trimmed.isEmpty || message.trimmed.isEmpty)
                .accessibilityValue(submission == .sending ? "전송 중" : "전송 가능")
            }
        }
    }

    @ViewBuilder
    private var submissionFeedback: some View {
        switch submission {
        case .idle, .sending:
            EmptyView()
        case .success:
            Text("문의가 접수되었습니다.")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(TicketgroundColor.success)
                .accessibilityAddTraits(.updatesFrequently)
                .accessibilityIdentifier("live-support-submit-success")
        case .failure(let message):
            Text(message)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(TicketgroundColor.accent)
                .accessibilityAddTraits(.updatesFrequently)
                .accessibilityIdentifier("live-support-submit-error")
        }
    }

    @ViewBuilder
    private func threadList(userID: String, threads: [LiveSupportThread]) -> some View {
        VStack(alignment: .leading, spacing: TicketgroundSpacing.sm) {
            Text("내 문의")
                .font(.title3.weight(.black))
            if threads.isEmpty {
                LiveRouteMessageView(
                    title: "문의 내역이 없습니다",
                    message: "새 문의를 남기면 처리 상태와 답변을 여기에서 확인할 수 있습니다.",
                    identifier: "live-support-empty"
                )
            } else {
                ForEach(threads, id: \.id) { thread in
                    threadCard(userID: userID, thread: thread)
                }
            }
        }
    }

    private func threadCard(userID: String, thread: LiveSupportThread) -> some View {
        TicketgroundSurface(tone: .muted) {
            VStack(alignment: .leading, spacing: TicketgroundSpacing.sm) {
                HStack(alignment: .firstTextBaseline) {
                    Text(thread.subject)
                        .font(.headline.weight(.bold))
                        .accessibilityIdentifier("live-support-thread-\(thread.id)")
                    Spacer()
                    TicketgroundTag(title: supportStatus(thread.status), tone: thread.status == .answered ? .success : .open)
                }
                ForEach(thread.messages, id: \.id) { item in
                    VStack(alignment: .leading, spacing: TicketgroundSpacing.xs) {
                        Text(item.role == .admin ? "고객센터" : "나")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(TicketgroundColor.inkMuted)
                        Text(item.body)
                            .font(.subheadline)
                            .foregroundStyle(TicketgroundColor.inkSecondary)
                    }
                }
                if thread.status != .closed {
                    TextField("추가 문의", text: replyBinding(for: thread.id), prompt: Text("추가 내용을 입력해 주세요"), axis: .vertical)
                        .lineLimit(2...4)
                        .textFieldStyle(.roundedBorder)
                        .accessibilityIdentifier("live-support-reply-\(thread.id)")
                        .focused($focusedReplyID, equals: thread.id)
                    replyFeedback(threadID: thread.id)
                    Button(replyStates[thread.id, default: .idle] == .sending ? "전송 중" : "추가 문의 보내기") {
                        Task { await submitReply(userID: userID, thread: thread) }
                    }
                    .buttonStyle(.bordered)
                    .tint(TicketgroundColor.ink)
                    .disabled(replyDrafts[thread.id, default: ""].trimmed.isEmpty || replyStates[thread.id, default: .idle] == .sending)
                    .accessibilityIdentifier("live-support-reply-submit-\(thread.id)")
                }
            }
        }
    }

    @ViewBuilder
    private func replyFeedback(threadID: String) -> some View {
        switch replyStates[threadID, default: .idle] {
        case .idle, .sending:
            EmptyView()
        case .success:
            Text("추가 문의가 전송되었습니다.")
                .font(.caption.weight(.semibold))
                .foregroundStyle(TicketgroundColor.success)
                .accessibilityAddTraits(.updatesFrequently)
                .accessibilityIdentifier("live-support-reply-success-\(threadID)")
        case .failure(let message):
            Text(message)
                .font(.caption.weight(.semibold))
                .foregroundStyle(TicketgroundColor.accent)
                .accessibilityAddTraits(.updatesFrequently)
                .accessibilityIdentifier("live-support-reply-error-\(threadID)")
        }
    }

    private func load() async {
        if let scenario = RuntimeConfiguration.liveSupportTestScenario {
            let content = Self.testContent
            if scenario == .publicLoading { return }
            publicState = .loaded(content)
            if scenario == .inquiryLoading { return }
            inquiryState = .loaded(userID: "ui-user", content: content, threads: [Self.testThread])
            submission = .idle
            if scenario == .submissionFailure { return }
            return
        }

        let service = LiveBackendService(apiClient: container.environment.apiClient)
        do {
            let content = try await service.getSupportPublicContent()
            publicState = .loaded(content)
            guard route == .inquiry else { return }
            await loadInquiries(service: service, content: content)
        } catch {
            publicState = .failure
            if route == .inquiry { inquiryState = .capability(.retry) }
        }
    }

    private func loadInquiries(service: LiveBackendService, content: LiveSupportPublicContent) async {
        if let testState = RuntimeConfiguration.liveAccountCapabilityTestState {
            inquiryState = .capability(testState)
            return
        }
        let apiClient = container.environment.apiClient
        let capabilityMap = LiveAPIContract.deployed.capabilityMap(
            for: apiClient.baseURL ?? LiveAPIContract.deployed.publicHost,
            observedResponseVersion: nil
        )
        do {
            let probe = try await service.diagnosePublicContract()
            let resolved = LiveAccountCapabilityState.resolve(
                for: .support,
                capabilityMap: probe.capabilities,
                session: container.environment.sessionStore.current,
                baseURL: apiClient.baseURL
            )
            guard case .available(let userID) = resolved else {
                inquiryState = .capability(resolved)
                return
            }
            inquiryState = .loaded(userID: userID, content: content, threads: try await service.getSupportThreads(userID: userID))
        } catch let error as APIClientError {
            inquiryState = .capability(LiveAccountCapabilityState.resolve(
                for: .support,
                capabilityMap: capabilityMap,
                session: container.environment.sessionStore.current,
                baseURL: apiClient.baseURL,
                requestError: error
            ))
        } catch {
            inquiryState = .capability(.retry)
        }
    }

    private func submitInquiry(userID: String) async {
        let cleanSubject = subject.trimmed
        let cleanMessage = message.trimmed
        guard !cleanSubject.isEmpty, !cleanMessage.isEmpty else { return }
        submission = .sending
        if RuntimeConfiguration.liveSupportTestScenario == .submissionLoading { return }
        if RuntimeConfiguration.liveSupportTestScenario == .submissionFailure {
            submission = .failure("문의를 전송하지 못했습니다. 작성 내용은 유지됩니다.")
            return
        }
        do {
            let thread: LiveSupportThread
            if RuntimeConfiguration.liveSupportTestScenario != nil {
                thread = Self.thread(subject: cleanSubject, message: cleanMessage)
            } else {
                thread = try await LiveBackendService(apiClient: container.environment.apiClient).createSupportThread(
                    userID: userID,
                    category: category,
                    subject: cleanSubject,
                    message: cleanMessage,
                    idempotencyKey: UUID().uuidString
                )
            }
            replaceOrInsert(thread)
            subject = ""
            message = ""
            focusedField = nil
            submission = .success
        } catch {
            submission = .failure("문의를 전송하지 못했습니다. 작성 내용은 유지됩니다.")
        }
    }

    private func submitReply(userID: String, thread: LiveSupportThread) async {
        let body = replyDrafts[thread.id, default: ""].trimmed
        guard !body.isEmpty else { return }
        replyStates[thread.id] = .sending
        if RuntimeConfiguration.liveSupportTestScenario == .replyLoading { return }
        if RuntimeConfiguration.liveSupportTestScenario == .replyFailure {
            replyStates[thread.id] = .failure("추가 문의를 전송하지 못했습니다. 작성 내용은 유지됩니다.")
            return
        }
        do {
            let updated: LiveSupportThread
            if RuntimeConfiguration.liveSupportTestScenario != nil {
                updated = LiveSupportThread(
                    id: thread.id,
                    userId: thread.userId,
                    subject: thread.subject,
                    status: .open,
                    updatedAt: "2026-08-02T00:00:00.000Z",
                    messages: thread.messages + [LiveSupportMessage(
                        id: UUID().uuidString,
                        actorId: userID,
                        role: .customer,
                        body: body,
                        at: "2026-08-02T00:00:00.000Z"
                    )]
                )
            } else {
                updated = try await LiveBackendService(apiClient: container.environment.apiClient).addSupportMessage(
                    userID: userID,
                    threadID: thread.id,
                    message: body,
                    idempotencyKey: UUID().uuidString
                )
            }
            replaceOrInsert(updated)
            replyDrafts[thread.id] = ""
            focusedReplyID = nil
            replyStates[thread.id] = .success
        } catch {
            replyStates[thread.id] = .failure("추가 문의를 전송하지 못했습니다. 작성 내용은 유지됩니다.")
        }
    }

    private func replaceOrInsert(_ thread: LiveSupportThread) {
        guard case let .loaded(userID, content, threads) = inquiryState else { return }
        inquiryState = .loaded(
            userID: userID,
            content: content,
            threads: [thread] + threads.filter { $0.id != thread.id }
        )
    }

    private func replyBinding(for threadID: String) -> Binding<String> {
        Binding(
            get: { replyDrafts[threadID, default: ""] },
            set: { replyDrafts[threadID] = $0 }
        )
    }

    private var routeTitle: String { route == .inquiry ? "1:1 문의 · LIVE" : "고객센터 · LIVE" }

    private func supportStatus(_ status: LiveSupportStatus) -> String {
        switch status {
        case .open: return "답변 대기"
        case .answered: return "답변 완료"
        case .closed: return "종료"
        case .unknown: return "상태 확인 중"
        }
    }

    private static let testContent = LiveSupportPublicContent(
        version: "1",
        categories: [LiveSupportCategory(id: "GENERAL", label: "일반")],
        faqs: [LiveSupportFAQ(id: "reservation-history", category: "GENERAL", question: "예매내역은 어디에서 확인하나요?", answer: "마이페이지의 예매내역에서 확인할 수 있습니다.")],
        notices: [LiveSupportNotice(id: "support-hours", title: "고객센터 운영시간 안내", body: "평일 09:00~18:00 운영합니다.")]
    )

    private static let testThread = thread(subject: "기존 문의", message: "답변 상태를 확인하고 싶습니다.")

    private static func thread(subject: String, message: String) -> LiveSupportThread {
        LiveSupportThread(
            id: UUID().uuidString,
            userId: "ui-user",
            subject: subject,
            status: .open,
            updatedAt: "2026-08-02T00:00:00.000Z",
            messages: [LiveSupportMessage(id: UUID().uuidString, actorId: "ui-user", role: .customer, body: message, at: "2026-08-02T00:00:00.000Z")]
        )
    }
}

private enum PublicState {
    case loading
    case loaded(LiveSupportPublicContent)
    case failure
}

private enum InquiryState {
    case loading
    case capability(LiveAccountCapabilityState)
    case loaded(userID: String, content: LiveSupportPublicContent, threads: [LiveSupportThread])
}

private enum SubmissionState: Equatable {
    case idle
    case sending
    case success
    case failure(String)
}

private enum ReplySubmissionState: Equatable {
    case idle
    case sending
    case success
    case failure(String)
}

private enum SupportField: Hashable {
    case subject
    case message
}

private extension String {
    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}
