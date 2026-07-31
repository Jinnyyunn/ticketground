import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const repoRoot = path.resolve(new URL("../", import.meta.url).pathname);

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    ...options
  });
}

test("plan graph rejects a dependency scheduled in the same wave", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "ticketground-plan-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const plan = path.join(directory, "plan.md");
  await writeFile(plan, [
    "- [ ] 1. Foundation",
    "  - Parallelization: Wave 0 | Blocked by: none",
    "- [ ] 2. Consumer",
    "  - Parallelization: Wave 0 | Blocked by: 1"
  ].join("\n"));

  const result = run(process.execPath, [
    "scripts/verify-ios-plan-graph.mjs",
    "--plan", plan,
    "--assert-wave-order"
  ]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /same or later wave/i);
});

test("virtual fixture validator rejects undeclared body fields", async (t) => {
  const root = await fixtureValidationRoot(t);
  const statePath = path.join(root, "ios/TicketGroundApp/Fixtures/Backend/state.json");
  const state = JSON.parse(await readFile(statePath, "utf8"));
  state.body.unexpected = true;
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`);

  const result = run(process.execPath, [path.join(root, "scripts/validate-ios-virtual-fixtures.mjs")], {
    cwd: root
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /undeclared field: unexpected/);
});

test("virtual fixture validator rejects corrupted negative-probe expectations", async (t) => {
  const root = await fixtureValidationRoot(t);
  const probesPath = path.join(root, "ios/TicketGroundApp/Fixtures/Backend/negative-probes.json");
  const probes = JSON.parse(await readFile(probesPath, "utf8"));
  probes.probes.find((probe) => probe.name === "unauthorized").expectedStatus = 200;
  await writeFile(probesPath, `${JSON.stringify(probes, null, 2)}\n`);

  const result = run(process.execPath, [path.join(root, "scripts/validate-ios-virtual-fixtures.mjs")], {
    cwd: root
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unauthorized: expectedStatus must be 401/);
});

test("live iOS wrapper can omit a seed database", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "ticketground-ios-wrapper-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const backend = path.join(directory, "backend");
  const project = path.join(directory, "App.xcodeproj");
  const evidence = path.join(directory, "evidence");
  await mkdir(path.join(backend, "node_modules"), { recursive: true });
  await mkdir(project);
  await writeFile(path.join(backend, "server.js"), "setInterval(() => {}, 1000);\n");

  const result = run("bash", [
    "scripts/run-ios-live-tests.sh",
    "--project", project,
    "--scheme", "TicketGroundApp",
    "--destination", "invalid",
    "--test-only", "TicketGroundAppTests/Smoke",
    "--evidence-dir", evidence,
    "--backend-root", backend
  ]);

  assert.equal(result.status, 2);
  assert.match(result.stderr, /unsupported destination/);
  assert.doesNotMatch(result.stderr, /seed database is missing/);
});

test("live iOS wrapper waits between refused readiness probes", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "ticketground-ios-readiness-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const backend = path.join(directory, "backend");
  const project = path.join(directory, "App.xcodeproj");
  const evidence = path.join(directory, "evidence");
  await mkdir(path.join(backend, "node_modules"), { recursive: true });
  await mkdir(project);
  await writeFile(path.join(backend, "server.js"), "setInterval(() => {}, 1000);\n");

  const startedAt = Date.now();
  const result = run("bash", [
    "scripts/run-ios-live-tests.sh",
    "--project", project,
    "--scheme", "TicketGroundApp",
    "--destination", "platform=iOS Simulator,name=iPhone 17 Pro",
    "--test-only", "TicketGroundAppTests/Smoke",
    "--evidence-dir", evidence,
    "--backend-root", backend
  ], {
    env: {
      ...process.env,
      TICKETGROUND_IOS_READINESS_ATTEMPTS: "2",
      TICKETGROUND_IOS_READINESS_DELAY_SECONDS: "0.1"
    }
  });
  const elapsed = Date.now() - startedAt;

  assert.notEqual(result.status, 0);
  assert.ok(elapsed >= 180, `expected readiness delay, observed ${elapsed}ms`);
});

test("semantic readiness probe is terminated at the advertised timeout", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "ticketground-ios-probe-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const probe = path.join(directory, "probe.sh");
  await writeFile(probe, "#!/usr/bin/env bash\ntrap '' TERM\nsleep 6\n");

  const startedAt = Date.now();
  const result = run("bash", [
    "scripts/wait-for-ios-ready.sh",
    "--device-id", "test-device",
    "--accessibility-id", "ready-marker",
    "--timeout", "1",
    "--", "bash", probe
  ]);
  const elapsed = Date.now() - startedAt;

  assert.equal(result.status, 1);
  assert.match(result.stderr, /timed-out-accessibility-id=ready-marker/);
  assert.ok(elapsed < 5_000, `probe exceeded bounded timeout: ${elapsed}ms`);
});

test("live iOS wrapper fails closed when cleanup postconditions are incomplete", async () => {
  const script = await readFile(path.join(repoRoot, "scripts/run-ios-live-tests.sh"), "utf8");

  assert.match(script, /cleanup_status=/);
  assert.match(script, /cleanup_marker="incomplete"/);
  assert.match(script, /trap - EXIT INT TERM/);
  assert.match(script, /exit "\$cleanup_status"/);
});

test("pull-request CI compiles and tests the native iOS project on macOS", async () => {
  const workflow = await readFile(path.join(repoRoot, ".github/workflows/ci.yml"), "utf8");

  assert.match(workflow, /runs-on: macos-/);
  assert.match(workflow, /xcodebuild[\s\S]*TicketGroundAppTests/);
  assert.match(workflow, /TicketGroundAppUITests\/DiscoveryTests\/testHomeRankingAndOpenCalendar/);
  assert.match(workflow, /TicketGroundAppUITests\/DiscoveryTests\/testLiveCatalogRoutesUseOneUnavailableSurface/);
  assert.match(workflow, /TicketGroundAppUITests\/DiscoveryTests\/testAdmittedLiveCatalogEnablesSearchRankingGenreAndGoods/);
});

async function fixtureValidationRoot(t) {
  const root = await mkdtemp(path.join(tmpdir(), "ticketground-fixtures-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "scripts"), { recursive: true });
  await mkdir(path.join(root, "docs/research"), { recursive: true });
  await mkdir(path.join(root, "ios/TicketGroundApp/Fixtures"), { recursive: true });
  await cp(
    path.join(repoRoot, "scripts/validate-ios-virtual-fixtures.mjs"),
    path.join(root, "scripts/validate-ios-virtual-fixtures.mjs")
  );
  await cp(
    path.join(repoRoot, "docs/research/native-ios-api-contract.json"),
    path.join(root, "docs/research/native-ios-api-contract.json")
  );
  await cp(
    path.join(repoRoot, "ios/TicketGroundApp/Fixtures/Backend"),
    path.join(root, "ios/TicketGroundApp/Fixtures/Backend"),
    { recursive: true }
  );
  return root;
}
