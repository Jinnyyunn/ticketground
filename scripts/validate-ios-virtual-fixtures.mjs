#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const manifestRelativePath = "docs/research/native-ios-api-contract.json";
const fixtureDirectory = path.join(root, "ios/TicketGroundApp/Fixtures/Backend");

function readJson(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`missing artifact: ${relativePath}`);
  }
  try {
    return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  } catch (error) {
    throw new Error(`invalid JSON: ${relativePath} (${error.message})`);
  }
}

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(relativePath) {
  return crypto.createHash("sha256")
    .update(fs.readFileSync(path.join(root, relativePath)))
    .digest("hex");
}

function validateManifest(manifest) {
  requireValue(manifest.manifestVersion === 1, "manifestVersion must be 1");
  requireValue(manifest.mode === "virtual", "manifest mode must be virtual");
  requireValue(manifest.characterization === "fixture-only", "characterization must be fixture-only");
  requireValue(manifest.live === false, "live must be false");
  requireValue(manifest.authorization?.kind === "user-override", "authorization kind must be user-override");
  requireValue(manifest.authorization?.ownerSignoff === "not-provided", "owner sign-off must remain not-provided");
  requireValue(manifest.liveGate?.status === "blocked", "live gate must remain blocked");
  requireValue(manifest.transport?.authentication === "none", "fixture transport must not claim native auth");
  requireValue(manifest.transport?.cache === "bundled-only", "fixture transport must be bundled-only");
  requireValue(Array.isArray(manifest.allowUnknownKeys), "allowUnknownKeys must be an array");
  requireValue(Array.isArray(manifest.endpoints) && manifest.endpoints.length > 0, "endpoints must be non-empty");
  requireValue(Array.isArray(manifest.fixtures) && manifest.fixtures.length > 0, "fixtures must be non-empty");
}

function validateFixture(manifest, fixture, relativePath) {
  requireValue(fixture.contractId === manifest.contractId, `${relativePath}: contractId mismatch`);
  requireValue(fixture.mode === "virtual", `${relativePath}: mode must be virtual`);
  requireValue(fixture.source === "fixture-only", `${relativePath}: source must be fixture-only`);
  requireValue(fixture.live === false, `${relativePath}: live must be false`);
  requireValue(typeof fixture.fixtureId === "string" && fixture.fixtureId.length > 0, `${relativePath}: fixtureId missing`);
  requireValue(Number.isInteger(fixture.status), `${relativePath}: status must be an integer`);
  requireValue(fixture.deterministic === true, `${relativePath}: deterministic marker missing`);
}

function validate() {
  const manifest = readJson(manifestRelativePath);
  validateManifest(manifest);

  const fixtureEntries = new Map();
  for (const entry of manifest.fixtures) {
    requireValue(typeof entry.file === "string", "fixture file path missing");
    requireValue(!path.isAbsolute(entry.file), `fixture path must be relative: ${entry.file}`);
    requireValue(!fixtureEntries.has(entry.file), `duplicate fixture path: ${entry.file}`);
    fixtureEntries.set(entry.file, entry);
    const fixture = readJson(entry.file);
    validateFixture(manifest, fixture, entry.file);
  }

  for (const endpoint of manifest.endpoints) {
    requireValue(typeof endpoint.path === "string", "endpoint path missing");
    requireValue(["GET", "POST"].includes(endpoint.method), `${endpoint.path}: unsupported method`);
    requireValue(typeof endpoint.fixture === "string", `${endpoint.path}: fixture missing`);
    requireValue(fixtureEntries.has(endpoint.fixture), `${endpoint.path}: fixture is not declared`);
    requireValue(endpoint.auth?.transport === "fixture-scenario", `${endpoint.path}: auth transport must be fixture-scenario`);
    requireValue(endpoint.response?.fieldTypes && typeof endpoint.response.fieldTypes === "object", `${endpoint.path}: fieldTypes missing`);
    requireValue(Array.isArray(endpoint.response?.requiredFields), `${endpoint.path}: requiredFields missing`);
    requireValue(Array.isArray(endpoint.response?.nullableFields), `${endpoint.path}: nullableFields missing`);
    requireValue(Array.isArray(endpoint.response?.allowUnknownKeys), `${endpoint.path}: allowUnknownKeys missing`);
  }

  const probes = readJson("ios/TicketGroundApp/Fixtures/Backend/negative-probes.json");
  requireValue(probes.mode === "virtual" && probes.live === false, "negative probes must be non-live");
  const probeNames = new Set(probes.probes.map((probe) => probe.name));
  for (const name of ["malformed-json", "unknown-key", "null-required-field", "empty-response", "unauthorized"]) {
    requireValue(probeNames.has(name), `negative probe missing: ${name}`);
  }

  for (const entry of manifest.fixtures) {
    requireValue(fs.statSync(path.join(root, entry.file)).isFile(), `fixture is not a file: ${entry.file}`);
    requireValue(sha256(entry.file).length === 64, `fixture hash unavailable: ${entry.file}`);
  }
  requireValue(fs.realpathSync(fixtureDirectory).endsWith("Fixtures/Backend"), "fixture directory is unexpected");
  console.log(`virtual fixture validation passed: ${manifest.fixtures.length} fixtures, ${manifest.endpoints.length} endpoints`);
}

try {
  validate();
} catch (error) {
  console.error(`virtual fixture validation failed: ${error.message}`);
  process.exitCode = 1;
}
