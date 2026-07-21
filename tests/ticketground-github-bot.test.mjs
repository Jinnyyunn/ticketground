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

test("workflow targets main with least-privilege write permissions", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const botWorkflow = fs.readFileSync(path.join(root, ".github/workflows/ticketground-bot.yml"), "utf8");
  const ciWorkflow = fs.readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8");

  assert.match(botWorkflow, /pull_request_target:/);
  assert.match(botWorkflow, /contents: read/);
  assert.match(botWorkflow, /issues: write/);
  assert.match(botWorkflow, /pull-requests: write/);
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
