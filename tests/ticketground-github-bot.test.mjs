import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import bot from "../.github/scripts/ticketground-bot.cjs";

const {
  buildPullRequestComment,
  classifyIssue,
  classifyPullRequestFiles,
  extractLinkedIssues,
} = bot;

test("classifyIssue labels a mobile UI failure as a frontend bug", () => {
  const labels = classifyIssue("[Bug] 모바일 버튼 오류", "화면에서 클릭이 안됩니다.");

  assert.deepEqual(labels, ["status: triage", "bug", "area: frontend"]);
});

test("classifyPullRequestFiles reports every changed area and protected auth files", () => {
  const result = classifyPullRequestFiles([
    "src/components/home/home-sections.tsx",
    "src/app/api/auth/kakao/callback/route.ts",
    "server.js",
    "docs/backend.md",
    ".github/workflows/ci.yml",
  ]);

  assert.deepEqual(result.labels, [
    "status: qa-needed",
    "area: frontend",
    "area: backend",
    "area: docs",
    "area: automation",
    "area: auth",
  ]);
  assert.deepEqual(result.protectedAuthFiles, ["src/app/api/auth/kakao/callback/route.ts"]);
});

test("classifyPullRequestFiles covers the repository backend and protected login contract", () => {
  const protectedFiles = [
    "src/components/ticketing/social-login-buttons.tsx",
    "src/components/ticketing/google-sign-in-card.tsx",
    "src/components/ticketing/login-panel.tsx",
    "src/components/ticketing/login-session-panel.tsx",
    "src/app/auth/social-config/route.ts",
    "src/app/auth/google-config/route.ts",
    "src/lib/auth-preview-host.ts",
    "backend/social-oauth.js",
    "backend/social-oauth-config.js",
  ];
  const result = classifyPullRequestFiles(["backend/catalog.js", ...protectedFiles]);

  assert.deepEqual(result.protectedAuthFiles, protectedFiles);
  assert.ok(result.labels.includes("area: backend"));
  assert.ok(result.labels.includes("area: auth"));
});

test("classifyIssue uses ASCII keyword boundaries and recognizes automation", () => {
  assert.deepEqual(classifyIssue("Build fails in CI", "Linux test suite failure"), [
    "status: triage",
    "area: automation",
  ]);
  assert.deepEqual(classifyIssue("Feedback request", "General product feedback"), ["status: triage"]);
});

test("extractLinkedIssues returns unique issue numbers", () => {
  assert.deepEqual(extractLinkedIssues("Closes #12, fixes #12 and Resolves #31"), [12, 31]);
});

test("buildPullRequestComment includes manual QA and auth protection guidance", () => {
  const comment = buildPullRequestComment({
    labels: ["status: qa-needed", "area: frontend", "area: auth"],
    linkedIssues: [12],
    protectedAuthFiles: ["src/components/ticketing/social-login-buttons.tsx"],
  });

  assert.match(comment, /ticketground-bot:pr-checklist/);
  assert.match(comment, /http:\/\/localhost:5501/);
  assert.match(comment, /#12/);
  assert.match(comment, /간편로그인 보호 파일/);
});

test("buildPullRequestComment neutralizes Markdown in untrusted filenames", () => {
  const comment = buildPullRequestComment({
    labels: ["status: qa-needed", "area: auth"],
    linkedIssues: [],
    protectedAuthFiles: ["src/app/api/auth/`\n@everyone<script>"],
  });

  assert.doesNotMatch(comment, /\n@everyone/);
  assert.doesNotMatch(comment, /<script>/);
  assert.match(comment, /&lt;script&gt;/);
  assert.match(comment, /\\n@everyone/);
});

test("workflow targets main with least-privilege write permissions", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const botWorkflow = fs.readFileSync(path.join(root, ".github/workflows/ticketground-bot.yml"), "utf8");
  const ciWorkflow = fs.readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8");

  assert.match(botWorkflow, /pull_request_target:/);
  assert.match(botWorkflow, /contents: read/);
  assert.match(botWorkflow, /issues: write/);
  const pullRequestJob = botWorkflow.split("pull-request-triage:")[1];
  assert.match(pullRequestJob, /issues: write/);
  assert.match(pullRequestJob, /pull-requests: read/);
  assert.doesNotMatch(pullRequestJob, /pull-requests: write/);
  assert.match(botWorkflow, /actions\/checkout@d23441a48e516b6c34aea4fa41551a30e30af803/);
  assert.match(botWorkflow, /actions\/github-script@ed597411d8f924073f98dfc5c65a23a2325f34cd/);
  assert.match(ciWorkflow, /actions\/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38/);
  assert.doesNotMatch(botWorkflow, /pull_request\.head\.sha/);
  assert.match(ciWorkflow, /branches:\s*\n\s*- main/);
  assert.doesNotMatch(ciWorkflow, /- master/);
});

test("bot never overwrites a user-authored marker comment", async () => {
  const comments = [
    {
      id: 1,
      body: "<!-- ticketground-bot:issue-triage --> user content",
      user: { login: "contributor", type: "User" },
    },
  ];
  const updatedCommentIds = [];

  const issues = {
    async getLabel() {
      return { data: {} };
    },
    async listLabelsOnIssue() {
      return { data: [] };
    },
    async addLabels() {},
    async listComments() {
      return { data: comments };
    },
    async updateComment({ comment_id }) {
      updatedCommentIds.push(comment_id);
    },
    async createComment({ body }) {
      comments.push({
        id: 2,
        body,
        user: { login: "github-actions[bot]", type: "Bot" },
      });
    },
  };
  const github = {
    rest: { issues },
    async paginate(method, args) {
      return (await method(args)).data;
    },
  };
  const context = {
    eventName: "issues",
    repo: { owner: "Jinnyyunn", repo: "ticketground" },
    payload: {
      issue: { number: 77, title: "모바일 버튼 오류", body: "화면에서 작동하지 않습니다." },
    },
  };

  await bot({ github, context });
  await bot({ github, context });

  assert.equal(comments.length, 2);
  assert.equal(comments[0].body, "<!-- ticketground-bot:issue-triage --> user content");
  assert.deepEqual(updatedCommentIds, [2]);
});

test("pull request synchronization replaces only stale bot-managed labels", async () => {
  const issueLabels = new Set([
    "status: triage",
    "status: in-progress",
    "area: frontend",
    "bug",
    "keep-me",
  ]);
  const removedLabels = [];
  const issues = {
    async getLabel() {
      return { data: {} };
    },
    async listLabelsOnIssue() {
      return { data: [...issueLabels].map((name) => ({ name })) };
    },
    async removeLabel({ name }) {
      issueLabels.delete(name);
      removedLabels.push(name);
    },
    async addLabels({ labels }) {
      labels.forEach((label) => issueLabels.add(label));
    },
    async listComments() {
      return { data: [] };
    },
    async createComment() {},
  };
  const pulls = {
    async listFiles() {
      return { data: [{ filename: "docs/bot.md" }] };
    },
  };
  const github = {
    rest: { issues, pulls },
    async paginate(method, args) {
      return (await method(args)).data;
    },
  };
  const context = {
    eventName: "pull_request_target",
    repo: { owner: "Jinnyyunn", repo: "ticketground" },
    payload: {
      pull_request: { number: 78, title: "docs", body: "", state: "open", merged: false },
    },
  };

  await bot({ github, context });

  assert.deepEqual(removedLabels.sort(), ["area: frontend", "bug", "status: triage"]);
  assert.deepEqual([...issueLabels].sort(), [
    "area: docs",
    "keep-me",
    "status: in-progress",
    "status: qa-needed",
  ]);
});
