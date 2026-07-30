#!/usr/bin/env node

import { readFile } from "node:fs/promises";

function usage() {
  console.error("Usage: node scripts/verify-ios-plan-graph.mjs --plan <path> --assert-acyclic --assert-wave-order");
}

function option(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

const args = process.argv.slice(2);
const planPath = option(args, "--plan");
if (!planPath) {
  usage();
  process.exit(2);
}

const plan = await readFile(planPath, "utf8");
const lines = plan.split(/\r?\n/);
const starts = [];
for (let index = 0; index < lines.length; index += 1) {
  const match = /^- \[[ xX]\] (\d+)\.\s+/.exec(lines[index]);
  if (match) starts.push({ id: Number(match[1]), line: index + 1, index });
}
if (starts.length === 0) throw new Error("plan has no todo entries");

const nodes = new Map();
for (let index = 0; index < starts.length; index += 1) {
  const start = starts[index];
  const end = starts[index + 1]?.index ?? lines.length;
  const block = lines.slice(start.index, end).join("\n");
  const parallelization = /Parallelization:\s*Wave\s+(\d+)\s*\|\s*Blocked by:\s*([^|\n]+)/i.exec(block);
  if (!parallelization) throw new Error(`todo ${start.id} line ${start.line} is missing Parallelization/Wave/Blocked by`);
  const wave = Number(parallelization[1]);
  const blockedBy = parallelization[2].trim().toLowerCase() === "none"
    ? []
    : [...parallelization[2].matchAll(/\d+/g)].map((match) => Number(match[0]));
  if (nodes.has(start.id)) throw new Error(`duplicate todo id ${start.id}`);
  nodes.set(start.id, { id: start.id, line: start.line, wave, blockedBy });
}

if (args.includes("--assert-wave-order") || args.includes("--assert-acyclic")) {
  for (const node of nodes.values()) {
    for (const dependencyId of node.blockedBy) {
      const dependency = nodes.get(dependencyId);
      if (!dependency) throw new Error(`todo ${node.id} depends on missing todo ${dependencyId}`);
      if (args.includes("--assert-wave-order") && dependency.wave > node.wave) {
        throw new Error(`todo ${node.id} is Wave ${node.wave} before dependency ${dependency.id} in Wave ${dependency.wave}`);
      }
    }
  }
}

if (args.includes("--assert-acyclic")) {
  const visiting = new Set();
  const visited = new Set();
  const visit = (id, path) => {
    if (visiting.has(id)) throw new Error(`dependency cycle: ${[...path, id].join(" -> ")}`);
    if (visited.has(id)) return;
    visiting.add(id);
    const node = nodes.get(id);
    for (const dependencyId of node.blockedBy) visit(dependencyId, [...path, id]);
    visiting.delete(id);
    visited.add(id);
  };
  for (const node of nodes.values()) visit(node.id, []);
}

console.log(`plan graph valid: ${nodes.size} todos`);
