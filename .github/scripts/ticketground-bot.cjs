const ISSUE_MARKER = "<!-- ticketground-bot:issue-triage -->";
const PR_MARKER = "<!-- ticketground-bot:pr-checklist -->";

const LABEL_DEFINITIONS = {
  "status: triage": { color: "FBCA04", description: "접수 후 검토가 필요한 항목" },
  "status: qa-needed": { color: "D4C5F9", description: "검증이 필요한 Pull Request" },
  "status: merged": { color: "0E8A16", description: "main에 병합된 Pull Request" },
  "status: closed": { color: "6A737D", description: "병합 없이 닫힌 Pull Request" },
  "area: frontend": { color: "1D76DB", description: "사용자 화면과 프론트엔드" },
  "area: backend": { color: "5319E7", description: "API, 서버와 데이터 처리" },
  "area: docs": { color: "0075CA", description: "문서와 정책" },
  "area: automation": { color: "BFDADC", description: "CI, GitHub Actions와 자동화" },
  "area: auth": { color: "D93F0B", description: "로그인, 인증과 보안 경계" },
};

const PROTECTED_AUTH_PATTERNS = [
  /^\.env(?:\.|$)/,
  /^간편로그인-수정금지-지침\.md$/,
  /^src\/app\/api\/auth\//,
  /^src\/app\/auth\/(?:google-config|social-config)\/route\.ts$/,
  /^src\/components\/ticketing\/(?:google-sign-in-card|login-panel|login-session-panel|social-login-buttons)\.tsx$/,
  /^src\/lib\/(?:auth|google|oauth|social-auth)/,
  /^backend\/social-oauth(?:-config)?\.js$/,
  /^tests\/(?:auth-preview-host-boundary|google-auth|social-auth|social-login)/,
];

const BOT_MANAGED_LABELS = new Set([
  ...Object.keys(LABEL_DEFINITIONS),
  "bug",
  "enhancement",
  "documentation",
]);
const PR_MANAGED_LABELS = new Set(Object.keys(LABEL_DEFINITIONS));

function unique(values) {
  return [...new Set(values)];
}

function formatInlineCode(value) {
  const normalized = String(value).replace(/\r/g, "\\r").replace(/\n/g, "\\n").replace(/\t/g, "\\t");
  const escaped = normalized.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<code>${escaped}</code>`;
}

function hasKeyword(text, keywords) {
  return keywords.some((keyword) => {
    if (!/^[\x00-\x7F]+$/.test(keyword)) return text.includes(keyword);
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(text);
  });
}

function classifyIssue(title = "", body = "") {
  const text = `${title}\n${body}`.toLowerCase();
  const labels = ["status: triage"];

  if (hasKeyword(text, ["[bug]", "버그", "오류", "에러", "실패", "안됨", "작동하지"])) {
    labels.push("bug");
  } else if (hasKeyword(text, ["[feature]", "기능 추가", "개선", "요청", "제안"])) {
    labels.push("enhancement");
  }

  if (hasKeyword(text, ["문서", "정책", "readme", "docs"])) labels.push("documentation", "area: docs");
  if (hasKeyword(text, ["ui", "ux", "css", "모바일", "화면", "버튼", "레이아웃", "프론트"])) {
    labels.push("area: frontend");
  }
  if (hasKeyword(text, ["api", "서버", "백엔드", "database", "db", "결제", "정산"])) {
    labels.push("area: backend");
  }
  if (hasKeyword(text, ["로그인", "인증", "oauth", "google", "kakao", "naver", "카카오", "네이버"])) {
    labels.push("area: auth");
  }
  if (hasKeyword(text, ["ci", "workflow", "github actions", "automation", "자동화"])) {
    labels.push("area: automation");
  }

  return unique(labels);
}

function isProtectedAuthFile(filename) {
  return PROTECTED_AUTH_PATTERNS.some((pattern) => pattern.test(filename));
}

function classifyPullRequestFiles(files = []) {
  const labels = ["status: qa-needed"];
  const protectedAuthFiles = files.filter(isProtectedAuthFile);

  if (
    files.some(
      (filename) =>
        /^(?:src\/components\/|src\/app\/(?!api\/)|src\/data\/|public\/)/.test(filename) ||
        /\.(?:css|scss)$/.test(filename),
    )
  ) {
    labels.push("area: frontend");
  }
  if (
    files.some(
      (filename) =>
        filename === "server.js" ||
        /^backend\//.test(filename) ||
        /^src\/app\/api\//.test(filename) ||
        /^src\/(?:backend|server|services)\//.test(filename),
    )
  ) {
    labels.push("area: backend");
  }
  if (files.some((filename) => /^(?:docs\/|.*\.md$)/.test(filename))) labels.push("area: docs");
  if (files.some((filename) => /^(?:\.github\/|scripts\/)/.test(filename))) labels.push("area: automation");
  if (protectedAuthFiles.length > 0) labels.push("area: auth");

  return { labels: unique(labels), protectedAuthFiles };
}

function extractLinkedIssues(body = "") {
  const matches = body.matchAll(/\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)/gi);
  return unique([...matches].map((match) => Number(match[1])));
}

function buildPullRequestComment({ labels, linkedIssues, protectedAuthFiles, state = "open" }) {
  const issueText = linkedIssues.length > 0 ? linkedIssues.map((number) => `#${number}`).join(", ") : "연결 없음";
  const authWarning =
    protectedAuthFiles.length > 0
      ? `\n> [!WARNING]\n> 간편로그인 보호 파일이 변경되었습니다. 사용자 요청이 명시된 변경인지 반드시 확인하세요.\n> ${protectedAuthFiles.map(formatInlineCode).join("<br>")}\n`
      : "";
  const resultText = state === "merged" ? "병합 완료" : state === "closed" ? "병합 없이 닫힘" : "검증 대기";

  return `${PR_MARKER}
## Ticketground Bot

- 상태: **${resultText}**
- 자동 분류: ${labels.map((label) => `\`${label}\``).join(" ")}
- 연결 이슈: ${issueText}
${authWarning}
### 검증 체크리스트

- [ ] GitHub Actions의 lint, typecheck, build, test가 모두 통과했습니다.
- [ ] 연결된 이슈의 요구사항을 실제 동작으로 확인했습니다.
- [ ] 프론트 변경은 \`http://localhost:5501\`에서 데스크톱과 모바일을 직접 확인했습니다.
- [ ] 간편로그인 보호 파일을 의도하지 않게 변경하지 않았습니다.

자동 병합은 수행하지 않습니다. 최종 병합은 검증 결과를 확인한 뒤 진행하세요.
`;
}

function buildIssueComment(labels) {
  return `${ISSUE_MARKER}
## Ticketground Bot 접수

이슈를 접수하고 다음과 같이 분류했습니다: ${labels.map((label) => `\`${label}\``).join(" ")}

재현 절차, 기대 결과, 실제 결과가 빠져 있다면 추가해 주세요. PR을 만들 때 본문에 \`Closes #이슈번호\`를 적으면 자동으로 연결됩니다.
`;
}

async function ensureLabels({ github, owner, repo, labels }) {
  for (const name of labels) {
    const definition = LABEL_DEFINITIONS[name];
    if (!definition) continue;

    try {
      await github.rest.issues.getLabel({ owner, repo, name });
    } catch (error) {
      if (error.status !== 404) throw error;
      try {
        await github.rest.issues.createLabel({ owner, repo, name, ...definition });
      } catch (createError) {
        if (createError.status !== 422) throw createError;
      }
    }
  }
}

async function replaceManagedLabels({
  github,
  owner,
  repo,
  issueNumber,
  labels,
  managedLabels = BOT_MANAGED_LABELS,
}) {
  const current = await github.paginate(github.rest.issues.listLabelsOnIssue, {
    owner,
    repo,
    issue_number: issueNumber,
    per_page: 100,
  });
  const expectedManagedLabels = new Set(
    labels.filter((label) => label.startsWith("status: ") || label.startsWith("area: ")),
  );

  for (const label of current) {
    if (managedLabels.has(label.name) && !expectedManagedLabels.has(label.name)) {
      await github.rest.issues.removeLabel({ owner, repo, issue_number: issueNumber, name: label.name });
    }
  }

  await github.rest.issues.addLabels({ owner, repo, issue_number: issueNumber, labels });
}

async function upsertComment({ github, owner, repo, issueNumber, marker, body }) {
  const comments = await github.paginate(github.rest.issues.listComments, {
    owner,
    repo,
    issue_number: issueNumber,
    per_page: 100,
  });
  const existing = comments.find(
    (comment) => comment.user?.login === "github-actions[bot]" && comment.body?.includes(marker),
  );

  if (existing) {
    await github.rest.issues.updateComment({ owner, repo, comment_id: existing.id, body });
    return;
  }

  await github.rest.issues.createComment({ owner, repo, issue_number: issueNumber, body });
}

async function handleIssue({ github, context }) {
  const { owner, repo } = context.repo;
  const issue = context.payload.issue;
  const labels = classifyIssue(issue.title, issue.body || "");

  await ensureLabels({ github, owner, repo, labels });
  await replaceManagedLabels({ github, owner, repo, issueNumber: issue.number, labels });
  await upsertComment({
    github,
    owner,
    repo,
    issueNumber: issue.number,
    marker: ISSUE_MARKER,
    body: buildIssueComment(labels),
  });
}

async function handlePullRequest({ github, context }) {
  const { owner, repo } = context.repo;
  const pullRequest = context.payload.pull_request;
  const files = await github.paginate(github.rest.pulls.listFiles, {
    owner,
    repo,
    pull_number: pullRequest.number,
    per_page: 100,
  });
  const classification = classifyPullRequestFiles(files.map((file) => file.filename));
  const linkedIssues = extractLinkedIssues(pullRequest.body || "");
  const state = pullRequest.merged ? "merged" : pullRequest.state === "closed" ? "closed" : "open";
  const labels = classification.labels.filter((label) => !label.startsWith("status: "));
  labels.unshift(state === "merged" ? "status: merged" : state === "closed" ? "status: closed" : "status: qa-needed");

  await ensureLabels({ github, owner, repo, labels });
  await replaceManagedLabels({
    github,
    owner,
    repo,
    issueNumber: pullRequest.number,
    labels,
    managedLabels: PR_MANAGED_LABELS,
  });
  await upsertComment({
    github,
    owner,
    repo,
    issueNumber: pullRequest.number,
    marker: PR_MARKER,
    body: buildPullRequestComment({ ...classification, labels, linkedIssues, state }),
  });
}

async function run({ github, context }) {
  if (context.eventName === "issues") return handleIssue({ github, context });
  if (context.eventName === "pull_request_target") return handlePullRequest({ github, context });
  throw new Error(`Unsupported event: ${context.eventName}`);
}

module.exports = run;
module.exports.buildPullRequestComment = buildPullRequestComment;
module.exports.classifyIssue = classifyIssue;
module.exports.classifyPullRequestFiles = classifyPullRequestFiles;
module.exports.extractLinkedIssues = extractLinkedIssues;
