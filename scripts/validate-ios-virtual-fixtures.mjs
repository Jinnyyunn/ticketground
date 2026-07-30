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

function valueType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (Number.isInteger(value)) return "integer";
  return typeof value;
}

function collectBodyPaths(value, currentPath = "", paths = new Map()) {
  if (currentPath) {
    const type = valueType(value);
    const existing = paths.get(currentPath) ?? [];
    paths.set(currentPath, [...new Set([...existing, type])]);
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectBodyPaths(item, currentPath ? `${currentPath}[]` : "[]", paths);
    }
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      collectBodyPaths(child, currentPath ? `${currentPath}.${key}` : key, paths);
    }
  }
  return paths;
}

function valuesAtPath(body, fieldPath) {
  const segments = fieldPath.split(".");
  let values = [body];
  for (const segment of segments) {
    const arraySegment = segment.endsWith("[]");
    const key = arraySegment ? segment.slice(0, -2) : segment;
    const next = [];
    for (const value of values) {
      const child = key ? value?.[key] : value;
      if (arraySegment) {
        if (Array.isArray(child)) next.push(...child);
      } else if (child !== undefined) {
        next.push(child);
      }
    }
    values = next;
  }
  return values;
}

function validateEndpointFixture(endpoint, fixture) {
  const response = endpoint.response;
  requireValue(fixture.status === response.status, `${endpoint.path}: fixture status must be ${response.status}`);
  requireValue(Object.hasOwn(fixture, "body"), `${endpoint.path}: fixture body missing`);
  const declaredPaths = new Set(Object.keys(response.fieldTypes));
  const allowedUnknownPaths = new Set(response.allowUnknownKeys);
  for (const actualPath of collectBodyPaths(fixture.body).keys()) {
    requireValue(
      declaredPaths.has(actualPath) || allowedUnknownPaths.has(actualPath),
      `${endpoint.path}: undeclared field: ${actualPath}`
    );
  }
  for (const [fieldPath, expectedTypes] of Object.entries(response.fieldTypes)) {
    const allowedTypes = expectedTypes.split("|");
    for (const value of valuesAtPath(fixture.body, fieldPath)) {
      requireValue(
        allowedTypes.includes(valueType(value)),
        `${endpoint.path}: ${fieldPath} must be ${expectedTypes}`
      );
    }
  }
  for (const fieldPath of response.requiredFields) {
    const parentPath = fieldPath.includes(".") ? fieldPath.slice(0, fieldPath.lastIndexOf(".")) : "";
    const parentValues = parentPath ? valuesAtPath(fixture.body, parentPath) : [fixture.body];
    if (parentValues.length === 0) continue;
    requireValue(
      valuesAtPath(fixture.body, fieldPath).length === parentValues.length,
      `${endpoint.path}: required field missing: ${fieldPath}`
    );
  }
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
    const fixture = readJson(endpoint.fixture);
    validateEndpointFixture(endpoint, fixture);
  }

  const probes = readJson("ios/TicketGroundApp/Fixtures/Backend/negative-probes.json");
  requireValue(probes.mode === "virtual" && probes.live === false, "negative probes must be non-live");
  const expectedProbes = new Map([
    ["malformed-json", { input: "{", expectedStatus: 400, expectedCode: "BAD_JSON" }],
    ["unknown-key", { input: { unexpected: true }, expectedStatus: 422, expectedCode: "INVALID_API_RESPONSE" }],
    ["null-required-field", { input: { userId: null }, expectedStatus: 400, expectedCode: "MISSING_FIELD" }],
    ["empty-response", { input: {}, expectedStatus: 200, expectedCode: "EMPTY_RESPONSE" }],
    ["unauthorized", { input: { credential: "fixture-missing" }, expectedStatus: 401, expectedCode: "UNAUTHORIZED" }]
  ]);
  requireValue(Array.isArray(probes.probes), "negative probes list missing");
  requireValue(probes.probes.length === expectedProbes.size, "negative probes must contain exactly five entries");
  for (const probe of probes.probes) {
    const expected = expectedProbes.get(probe.name);
    requireValue(expected, `unexpected negative probe: ${probe.name}`);
    requireValue(
      JSON.stringify(probe.input) === JSON.stringify(expected.input),
      `${probe.name}: input mismatch`
    );
    requireValue(
      probe.expectedStatus === expected.expectedStatus,
      `${probe.name}: expectedStatus must be ${expected.expectedStatus}`
    );
    requireValue(
      probe.expectedCode === expected.expectedCode,
      `${probe.name}: expectedCode must be ${expected.expectedCode}`
    );
    expectedProbes.delete(probe.name);
  }
  requireValue(expectedProbes.size === 0, `negative probe missing: ${[...expectedProbes.keys()].join(", ")}`);

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
